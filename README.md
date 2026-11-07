# 0Gaze Blueprint

## System Overview

0Gaze is a private AI agent that can hold and spend money: the wallet key lives in a Dabao hardware signer and never leaves it, spending approvals render only inside the wearer's RayNeo AR glasses, a head-motion gate proves the enrolled human is present, and World ID gates large spends. The agent pays for its own 0G inference per request over x402, settling in USDT on Whitechain Sepolia through our facilitator. Built for ETHGlobal Mumbai 2026.

**Why onchain stablecoin settlement:** a card rail cannot give an autonomous agent a hardware-rooted, per-request, human-presence-gated spend with no stored credentials and no checkout session. Here the authorization *is* the settlement (EIP-3009 `transferWithAuthorization` in official USDT on Whitechain Sepolia), so the agent's spending power is exactly as revocable as physical access to the wearer's glasses and chip.

Design: `docs/designs/0gaze.md`. Architecture: `docs/architecture/private-agent.html`.

**Live deployment:** https://0gaze.tech/ — product page plus a live x402 paid API at https://0gaze.tech/generate (`curl -i` it for a real 402 quote). Mirror: https://ivcained.github.io/0gaze/

**Settlements on Whitechain Sepolia (official USDT `0xcedf…55a7`, chain 1874):**

- The chip's address (all hardware-signed settlements): https://explorer.testnet.whitechain.io/address/0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE
- 0.10 USDT approved by head-gesture on the glasses, signed on the chip: https://explorer.testnet.whitechain.io/tx/0xeabe0a76a36746477e763c004ca8d8f78e3fe62e31651d6413848a3eab6a8441
- First chip-signed x402 settlement (2026-11-05): https://explorer.testnet.whitechain.io/tx/0xc765630294e801e2c1cf80efa4dfd9a1206b6533a5976969a01ff71190d690ca

**Submission checklist and video script:** `docs/SUBMISSION.md`.

## Verified on real hardware

- Real Dabao-signed x402 payment settled on Whitechain Sepolia
- Real 0G Private Computer inference paid by the Dabao and settled onchain (sealed execution is 0G's service property)
- Groth16 motion proof verified, then bound to a Dabao-signed EIP-712 witness
- Denied approval, bad challenge, tampered proof, and storage-outage paths exercised

## Subdirectories & System Boundaries

- relay: [./relay/README.md](./relay/README.md) - Mac-side TCP relay: speaks the burner's envelope protocol, forwards frames to the Dabao over USB HID
- merchant: [./merchant/README.md](./merchant/README.md) - demo paid API (x402) that serves 402 quotes and settles payments
- agent: [./agent/README.md](./agent/README.md) - the agent loop: balance watch, three-tier spend rule, 0G inference/storage, safe-stop
- app: [./app/README.md](./app/README.md) - Unity/Ffalcon Android app for the glasses (design-stage scaffolding; the built approval surface is the browser UI on the glasses' own display, see glasses/ and scripts/)
- glasses: [./glasses/README.md](./glasses/README.md) - real RayNeo Air IMU capture, enrollment, motion gate, and ZKP-compatible feature hashing
- firmware: [./firmware/README.md](./firmware/README.md) - ESP32-S3 BLE-to-WiFi signing bridge (stretch)
- scripts: [./scripts/README.md](./scripts/README.md) - verification and staged-demo entry points
- docs: [./docs/designs/0gaze.md](./docs/designs/0gaze.md) - design documents, vendored architecture diagram, prize-vault reference

## Global Invariants

- The Dabao seed exists only in the chip's keystore (slots 132/133); no component may request or receive it.
- All signing is gated by the wearer's approval (the glasses head-motion challenge on the bench; the phone app is the product-flow design stage) and executes agent → relay → Dabao; the agent never holds a signing key.
- Testnets and small amounts only (burner model); no mainnet keys anywhere in the repo.
- Raw IMU windows and biometric data never leave the Mac; the 0G Storage journal carries episode metadata and content hashes only (plaintext today — encrypted profile blobs are design-stage).

## Global Side Effects

- Onchain writes: Whitechain Sepolia (USDT via EIP-3009); stretch: Hedera testnet, a Uniswap-deployed testnet.
- Network calls: 0G Private Computer API, 0G Storage, Anon-RPC (where supported), World ID (mocked proofs at the hackathon).

## Setup (bench demo)

Prerequisites: macOS, RayNeo Air-series glasses (USB-C), a Dabao hardware signer (USB), Node 20+, Python 3.12 (relay venv), and the env secrets described in `agent/README.md` (0G API key, facilitator key). Testnets only.

1. Glasses IMU bridge (supervised, auto-restarts): `cd glasses && bash bridge-loop.sh start 7605 14400` — health at `/tmp/bridge-loop.health`
2. Dabao relay: `cd relay && ~/dabao-venv312/bin/python server.py 7601` (auto-recovers from HID wedges; never replays a signing request)
3. Merchant (x402, motion tier): `cd merchant && MERCHANT_PRICE=0.10 npx tsx server.ts` (port 4021)
4. Glasses UI + control panel: `cd glasses && npx tsx ui-server.ts --port 7610 --imu 7605 --profile=$PWD/signature.json` — card at `http://127.0.0.1:7610/`, control panel at `http://127.0.0.1:7610/control`
5. One-command staged take (preflight + all services + stream-quality gate): `bash scripts/demo-video.sh`
6. Calibrate the wearer first (once, ~2 min): `cd glasses && npx tsx calibrate.ts --tcp 7605 --out signature.json --reps 4`

## Current limitations

- **No custom contracts.** Settlement runs through the official Whitechain Sepolia USDT token and our off-chain facilitator (the standard EIP-3009 pull-payment pattern); there is no 0Gaze-deployed contract to verify on the explorer. Disclosed deliberately, per our ethskills rule of using audited token interfaces over rolling our own.
- **World ID proofs are mocked at the event** (as the track itself specifies). The RP request-signing, server-side v4 verification, nullifier handling and fail-closed denials are real, tested code (`agent/worldid.ts`, `agent/gate.test.ts`); a live World App proof was not exercised during the event window. Details: `docs/WORLDID-DEBRIEF.md`.
- **The Unity/Ffalcon phone bridge is descoped** (`app/` is design-stage): the glasses' own display carries the approval UI, which the wearer sees and no one else does in extended-display mode.
- **Demo video is recorded in mirror mode** (one capture shows wearer + terminal). In the product path the card renders on the glasses display only (`scripts/demo-video.sh --extended`, proven on hardware).
- **Groth16 motion proofs bind off-chain** (proven end-to-end with snarkjs); on-chain verification is Phase 2 (RIP-7212 / verifier contract).
- **0G Storage episodes are plaintext metadata + content hashes**; encrypted profile blobs are design-stage.
- **On-chip LLM (Needle 2) is roadmap**: the 13.7 MB model exceeds the Dabao's 8 MB flash; needs an N16R8-class board or a pruned quant.

## System Verification

Suites last run green on 2026-11-07: agent 38/38, glasses 92/92, merchant 10/10, relay 19/19, plus the ZKP end-to-end (real Groth16 keygen, proof verify, wrong-challenge / tamper / below-threshold rejection).

- Relay: `cd relay && ~/dabao-venv312/bin/python -m pytest -q`
- Merchant: `cd merchant && npm test`
- Agent and approval gate: `cd agent && npm test`
- ZKP circuit: `cd zkp/prover && node scripts/setup-dev.mjs && node scripts/e2e-test.mjs`
- Glasses capture and motion features: `cd glasses && npm test`
- Real-chip ZKP witness: `cd zkp/prover && npx tsx scripts/demo-chip.mjs 7601` with the Dabao relay running
- Public proof page UI: `cd site && npm run lint:ui` with the site served on port 7654

