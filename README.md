# EyesOnly Blueprint

## System Overview

EyesOnly is a private AI agent that can hold and spend money: the wallet key lives in a Dabao hardware signer and never leaves it, spending approvals render only inside the wearer's RayNeo AR glasses, a head-motion gate proves the enrolled human is present, and World ID gates large spends. The agent pays for its own 0G inference per request over x402, settling in USDT on Whitechain Sepolia through our facilitator. Built for ETHGlobal Mumbai 2026.

Design: `docs/designs/eyesonly.md`. Architecture: `docs/architecture/private-agent.html`.

**Public proof page:** https://ivcained.github.io/eyesonly/

**Submission checklist and video outline:** `docs/SUBMISSION.md`.

## Verified on real hardware

- Real Dabao-signed x402 payment settled on Whitechain Sepolia
- Real sealed 0G inference paid by the Dabao and settled onchain
- Groth16 motion proof verified, then bound to a Dabao-signed EIP-712 witness
- Denied approval, bad challenge, tampered proof, and storage-outage paths exercised

## Subdirectories & System Boundaries

- relay: [./relay/README.md](./relay/README.md) - Mac-side TCP relay: speaks the burner's envelope protocol, forwards frames to the Dabao over USB HID
- merchant: [./merchant/README.md](./merchant/README.md) - demo paid API (x402) that serves 402 quotes and settles payments
- agent: [./agent/README.md](./agent/README.md) - the agent loop: balance watch, three-tier spend rule, 0G inference/storage, safe-stop
- app: [./app/README.md](./app/README.md) - Unity/Ffalcon Android app for the glasses: approval UI, motion gate, World ID gate
- glasses: [./glasses/README.md](./glasses/README.md) - real RayNeo Air IMU capture, enrollment, motion gate, and ZKP-compatible feature hashing
- firmware: [./firmware/README.md](./firmware/README.md) - ESP32-S3 BLE-to-WiFi signing bridge (stretch)
- scripts: [./scripts/README.md](./scripts/README.md) - verification and staged-demo entry points
- docs: [./docs/designs/eyesonly.md](./docs/designs/eyesonly.md) - design documents, vendored architecture diagram, prize-vault reference

## Global Invariants

- The Dabao seed exists only in the chip's keystore (slots 132/133); no component may request or receive it.
- All signing routes through the phone's approval gate; the agent never signs directly.
- Testnets and small amounts only (burner model); no mainnet keys anywhere in the repo.
- Plaintext biometric data never leaves the phone; 0G Storage holds ciphertext only.

## Global Side Effects

- Onchain writes: Whitechain Sepolia (USDT via EIP-3009); stretch: Hedera testnet, a Uniswap-deployed testnet.
- Network calls: 0G Private Computer API, 0G Storage, Anon-RPC (where supported), World ID (mocked proofs at the hackathon).

## System Verification

- Relay: `cd relay && ~/dabao-venv312/bin/python -m pytest -q`
- Merchant: `cd merchant && npm test`
- Agent and approval gate: `cd agent && npm test`
- ZKP circuit: `cd zkp/prover && node scripts/setup-dev.mjs && node scripts/e2e-test.mjs`
- Glasses capture and motion features: `cd glasses && npm test`
- Real-chip ZKP witness: `cd zkp/prover && npx tsx scripts/demo-chip.mjs 7601` with the Dabao relay running
- Public proof page UI: `cd site && npm run lint:ui` with the site served on port 7654

