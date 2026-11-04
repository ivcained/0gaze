# EyesOnly Blueprint

## System Overview

EyesOnly is a private AI agent that can hold and spend money: the wallet key lives in a Dabao hardware signer and never leaves it, spending approvals render only inside the wearer's RayNeo AR glasses, a head-motion gate proves the enrolled human is present, and World ID gates large spends. The agent pays for its own 0G inference per request over x402, settling in USDT on Whitechain Sepolia through our facilitator. Built for ETHGlobal Mumbai 2026.

Design: `docs/designs/eyesonly.md`. Architecture: `docs/architecture/private-agent.html`.

## Subdirectories & System Boundaries

- relay: [./relay/README.md](./relay/README.md) - Mac-side TCP relay: speaks the burner's envelope protocol, forwards frames to the Dabao over USB HID
- merchant: [./merchant/README.md](./merchant/README.md) - demo paid API (x402) that serves 402 quotes and settles payments
- agent: [./agent/README.md](./agent/README.md) - the agent loop: balance watch, three-tier spend rule, 0G inference/storage, safe-stop
- app: [./app/README.md](./app/README.md) - Unity/Ffalcon Android app for the glasses: approval UI, motion gate, World ID gate
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

- Run: `scripts/verify-e2e.sh`
