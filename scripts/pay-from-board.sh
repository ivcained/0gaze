#!/bin/bash
# One-shot: live x402 payment signed by the REAL Dabao chip, through the relay.
# Prereqs: relay up on 127.0.0.1:7601, board booted (PROG short-press), merchant on :4021.
set -euo pipefail

BOARD=0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE
PAYEE=0xb307D0C8Ef0FA16D728A6A7F73f3E4CCd3e7CdaB
CLIENT=~/dabao-workshop/ethereum-app/dabao-app-eth-burner/tools/eth_client.py
PY=~/dabao-venv312/bin/python
RETAIL_DIR="$(cd "$(dirname "$0")/.." && pwd)/merchant"

echo "== 1/3 chip address via relay =="
$PY $CLIENT --tcp 127.0.0.1:7601 get-address

echo "== 2/3 burner signs the EIP-3009 authorization =="
FIXTURE=$(mktemp /tmp/board-payment.XXXXXX.json)
AMOUNT=${1:-10000}  # base units, default 0.01 USDT
$PY - "$FIXTURE" "$BOARD" "$PAYEE" "$AMOUNT" <<'EOF'
import json, sys, time, secrets
fixture, frm, to, amount = sys.argv[1:]
now = int(time.time())
json.dump({
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"}, {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"}, {"name": "verifyingContract", "type": "address"}],
    "TransferWithAuthorization": [
      {"name": "from", "type": "address"}, {"name": "to", "type": "address"},
      {"name": "value", "type": "uint256"}, {"name": "validAfter", "type": "uint256"},
      {"name": "validBefore", "type": "uint256"}, {"name": "nonce", "type": "bytes32"}]},
  "primaryType": "TransferWithAuthorization",
  "domain": {"name": "Tether USD", "version": "1", "chainId": 1874,
             "verifyingContract": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7"},
  "message": {"from": frm, "to": to, "value": str(int(amount)),
              "validAfter": now - 30, "validBefore": now + 600,
              "nonce": "0x" + secrets.token_hex(32)}
}, open(fixture, "w"))
EOF
SIG=$($PY $CLIENT --tcp 127.0.0.1:7601 sign-typed-data "$FIXTURE" --expect "$BOARD" | awk '/^signature/{print $2}')
echo "chip signature: ${SIG:0:26}..."

echo "== 3/3 POST to the merchant =="
$PY - "$FIXTURE" "$SIG" <<'EOF'
import json, sys, base64, urllib.request
fixture, sig = sys.argv[1:]
m = json.load(open(fixture))["message"]
payment = {"x402Version": 2, "scheme": "exact", "network": "eip155:1874",
           "payload": {"signature": "0x" + sig if not sig.startswith("0x") else sig,
                       "authorization": {k: (int(m[k]) if k in ("value", "validAfter", "validBefore") else m[k])
                                          for k in ("from", "to", "value", "validAfter", "validBefore", "nonce")}}}
hdr = base64.b64encode(json.dumps(payment).encode()).decode()
req = urllib.request.Request("http://127.0.0.1:4021/generate", headers={"PAYMENT-SIGNATURE": hdr})
try:
    r = urllib.request.urlopen(req, timeout=180)
    print("HTTP", r.status, "| settlement:", base64.b64decode(r.headers.get("PAYMENT-RESPONSE", b"")).decode())
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:300])
EOF
rm -f "$FIXTURE"
