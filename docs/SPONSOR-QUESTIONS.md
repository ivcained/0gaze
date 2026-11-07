# Sponsor questions — paste-ready answers

Three questions per sponsor: **How are you using this Protocol / API?** ·
**Link to the code where the tech is used** · **Additional feedback for the sponsor.**
Every claim below was verified by execution on 2026-11-07 (see docs/SUBMISSION.md).

---

## 0G — Physical AI: Agents with a Body

### How are you using this Protocol / API?

```
0G is the agent's brain and its memory, and the RayNeo glasses are its body.

Inference in the decision loop: every live demo call goes to 0G Private Computer
(router-api.0g.ai/v1/chat/completions) through agent/zerog-provider.ts, and the
per-request trace ID (x_0g_trace.request_id) is journaled into the episode
record — inference is provable, not asserted.

Journaling to 0G Storage: every decision (timestamp, verdict, 0G request ID,
settlement hash) is written as an episode and anchored to 0G Storage. Root
0xaaa3cc310afb8eb4191104d2260ef943d76bb99bd5848ade564e7253920e80d2 was
re-downloaded from 0G testnet storage nodes on 2026-11-07 and is byte-identical
to the journaled episode; six further roots are in the journal.

The body: a 496.5 Hz IMU stream from the glasses drives per-wearer calibrated
head-motion approvals (measured capture stats committed at
glasses/evidence/imu-capture-stats.json). 0G's inference output can only become
a payment with the wearer's physical consent, and a proximity-sensor wear gate
means the glasses must be on a head for anything to arm.

Safe-stop is real: when 0G is unreachable the provider retries 3× with backoff,
then throws; the loop journals an error episode and signs nothing. The
"full agent loop with safe-stop" settlement (0x23c28f…29d376) is the on-chain
record of that path.
```

### Link to the code where the tech is used

```
Inference client:      https://github.com/ivcained/0gaze/blob/main/agent/zerog-provider.ts
Episode journal + 0G Storage anchoring:
                       https://github.com/ivcained/0gaze/blob/main/agent/episode-log.ts
Decision loop (calls both):
                       https://github.com/ivcained/0gaze/blob/main/agent/loop.ts
The body (IMU bridge, gestures, calibration, wear gate):
                       https://github.com/ivcained/0gaze/tree/main/glasses
Evidence + explorer links:
                       https://github.com/ivcained/0gaze/blob/main/docs/SUBMISSION.md
```

### Additional feedback for the sponsor

```
1. router-api.0g.ai DNS failed once mid-demo (ENOTFOUND, 2026-11-06); we now
   retry 3× with backoff. A public status/health endpoint would let builders
   gate demo runs on it instead of discovering an outage live.
2. x_0g_trace.request_id is the single most useful artifact for proving
   inference happened — worth surfacing more prominently in the docs.
3. The 0.5 0G testnet grant arrived quickly and covered our storage uploads;
   the grant flow was smooth.
4. Physical AI fit: the "inference in the loop + journaled episodes + wearable
   body" pattern mapped cleanly onto your primitives with no custom contracts.
```

---

## Whitechain — Scale: Payments Nobody Notices

### How are you using this Protocol / API?

```
x402 pay-per-request in official USDT on Whitechain Sepolia (chain 1874),
settled through a facilitator we run — the track brief's exact architecture.

Zero visible crypto steps for the payer: the Dabao chip (inside the glasses
approval flow) signs an EIP-3009 transferWithAuthorization in official USDT
(0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7); our facilitator verifies the
signature and pays the gas. The wearer never holds WBT, never sees a chain
name — the glasses card says "0.10 USDT → 0G inference".

Live evidence: five chip-signed settlements verified through the explorer API
(all transferWithAuthorization, all from the chip address 0xbdF5…b8BE),
including a 0.10 USDT payment approved by head gestures. Public 402 quote at
https://0gaze.tech/generate — curl -i decodes to x402 v2, eip155:1874,
resource 0gaze://generate, 0.01 USDT.

Honest disclosure: we deploy no custom contract — settlement runs through the
official USDT token and our off-chain facilitator, per the ethskills rule we
followed (use audited token interfaces, don't roll your own).
```

### Link to the code where the tech is used

```
x402 client (agent side):
                       https://github.com/ivcained/0gaze/blob/main/agent/x402-client.ts
Merchant (402 quotes + payment verification):
                       https://github.com/ivcained/0gaze/blob/main/merchant/server.ts
Facilitator (EIP-3009 verify, gas, submit):
                       https://github.com/ivcained/0gaze/blob/main/merchant/facilitator/whitechain.ts
Chain integration tests:
                       https://github.com/ivcained/0gaze/blob/main/merchant/facilitator/whitechain.test.ts
Chip signing path:     https://github.com/ivcained/0gaze/blob/main/agent/dabao-client.ts
                       https://github.com/ivcained/0gaze/blob/main/relay/server.py
Live 402:              https://0gaze.tech/generate
Explorer (chip):       https://explorer.testnet.whitechain.io/address/0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE
```

### Additional feedback for the sponsor

```
Full write-up: docs/WHITECHAIN_FEEDBACK.md (in repo). Summary:

Worked: the EIP-3009 pull-payment shape fit our hardware-signer architecture
exactly; the Blockscout v2 explorer API carried our entire evidence pipeline
without flaking through a night of scripted access; the public RPC was a
non-issue for a full day; the token contract behaves exactly per spec (6
decimals, sane DOMAIN_SEPARATOR, plus isValidSignature for an EIP-1271 path).

Stuck: no reference EIP-3009 facilitator — building and self-verifying our own
was the largest single chunk of integration work, and getting it wrong silently
loses money. Domain parameters (type hash, version, separator) had to be read
off the deployed contract rather than from docs. One x402 seam: deciding that
the 402 quote's payTo should be the facilitator submitter, not the merchant
EOA, was ours to invent.

Suggestion: a "pull payments cookbook" — reference facilitator, parameter
sheet, one end-to-end test. We are happy to contribute ours.
```

---

## World — World ID Agent Pass

### How are you using this Protocol / API?

```
World ID is the escalation tier of a three-tier spend rule (agent/tiers.ts):
auto below $0.05, head-motion gate to $25, World ID above $25 — the moment a
spend stops being demo-scale, a unique human must be present and reachable.

The agent acts as the relying party. Request binding: before asking the World
App for a proof, the agent signs the request with the RP signing key
(HMAC-SHA256 over action:nonce:created:expires, 5-minute expiry, per-spend
nonce) so a returned proof is bound to this specific spend decision and cannot
be reused. Verification: the proof is forwarded untouched to the Developer
Portal POST /api/v4/verify/{rp_id}; the nullifier is extracted for replay
protection so the same human cannot approve the same spend twice.

Fail-closed, tested: with RP credentials unset, verification returns a
structured denied (not_configured) and the agent declines — a missing
credential can never become an approval. worldid_denied, worldid_expired and
not_configured paths are covered by agent/gate.test.ts.

Honest disclosure (as the track permits): we did not run a live end-to-end
World App proof during the event; the verification path is real code that
refuses to approve without credentials. Full status: docs/WORLDID-DEBRIEF.md.
```

### Link to the code where the tech is used

```
RP request signing + v4 verification + nullifiers:
                       https://github.com/ivcained/0gaze/blob/main/agent/worldid.ts
Tier gate (auto / motion / worldid):
                       https://github.com/ivcained/0gaze/blob/main/agent/gate.ts
                       https://github.com/ivcained/0gaze/blob/main/agent/tiers.ts
Denied-path tests:     https://github.com/ivcained/0gaze/blob/main/agent/gate.test.ts
Required integration debrief:
                       https://github.com/ivcained/0gaze/blob/main/docs/WORLDID-DEBRIEF.md
```

### Additional feedback for the sponsor

```
The v4 verify endpoint's contract (send the proof untouched, get
{success, code, detail, nullifier}) is refreshingly boring — that is praise.

Two frictions: (1) the request-signature (rp_context) conventions are SDK-side
knowledge; a short reference for non-JS backends would remove a day of
guesswork. (2) For headless agents wearing AR glasses, the natural pairing is
device-code style: the agent renders a QR/code on the glasses, the human
confirms in World App. An Agent Pass flow that blesses that pattern (instead
of requiring a browser redirect) would fit wearable agents directly — our
glasses display could carry it with no phone bridge.
```
