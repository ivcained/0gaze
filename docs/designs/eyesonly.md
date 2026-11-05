# EyesOnly — Design Document

* **Author:** ivcained
* **Status:** In Review (goldfish round 1 resolved)
* **Date:** 2026-11-04

---

## Context

This is an ETHGlobal Mumbai 2026 hackathon project. Three pieces of existing context a fresh reader needs:

* **The Dabao** is a Baochip-1x USB hardware signer built at a Devcon workshop. It runs Xous and an "eth-burner" app: a burner wallet with no screen, no PIN, and no recovery phrase. It generates its key from the chip's random number generator on first boot, stores it in the chip's keystore (application slots 132/133), and signs any well-formed request it receives over USB HID. It never exports the key. It speaks ERC-4527 messages (CBOR sign requests and responses) inside a length-prefixed envelope, over USB HID on the real board and over a TCP socket (port 7600) in the emulator. Test networks and small amounts only: anyone who can reach the port can sign.
* **x402** is a payment protocol built on the HTTP 402 "Payment Required" status: a server quotes a price in a 402 response, the client attaches a signed payment authorization and retries, and a **facilitator** (a service, ours or hosted) verifies the signature and submits the transfer onchain, paying gas so the buyer needs none.
* The project is solo-built over a hackathon weekend. Everything in this document is scoped against that constraint.

## Overview

EyesOnly lets anyone run an AI agent that can hold and spend money safely. The agent's wallet key is generated inside the Dabao chip and cannot leave it. Spending approvals appear only inside the wearer's RayNeo AR glasses, so no screen, log, or bystander ever sees them. A head-motion profile proves the enrolled human is physically present when an approval happens, and World ID gates large spends. The agent thinks on 0G Private Computer (0G's model API), keeps its memory on 0G Storage under the user's ownership, reads blockchains through Anon-RPC where supported, and pays per request over x402 with signatures from the chip, settling in USDT on Whitechain Sepolia. When its paying balance runs low, the agent proposes a Uniswap swap to top itself up, and the wearer approves it in the glasses.

Target user after the demo: a non-crypto person who wants a hardware wallet with a motion layer, and an agent that handles things, without knowing what a private key is.

## The Problem

AI agents are starting to spend money, and the current custody options are all bad in a different way: keys on a server (theft, operator access), keys on a phone (malware, screen visible to bystanders, approval replay), and "the agent has an API key to a custodial account" (not the user's money, not the user's control). Nobody combines hardware custody, a private approval channel, and proof that the approving human is present. Existing hardware wallets assume a careful, crypto-literate user reading hexadecimal. The result: either agents cannot spend at all, or they spend with unacceptable risk.

## Goals

* A live, staged demo where an x402 payment settles on Whitechain Sepolia in USDT, signed by the Dabao, in under 60 seconds for an above-floor approval (target, measured at rehearsal, not a guarantee).
* Approvals render only in the glasses. The phone screen shows no payment details; the World app shows only its own verification UI.
* Motion gate works on the bench: the enrolled wearer passes repeatedly, a different wearer fails and triggers the World ID denied path.
* The agent pays for its own 0G inference per request, with request IDs logged; one paid image generation appears inside the glasses.
* Safe-stop demonstrated live: kill network access mid-demo and the agent pauses spending and shows an offline banner instead of faking decisions (a 0G Physical AI hard requirement).
* One Uniswap swap leg (agent treasury top-up) is quoted, approved, signed on the Dabao, and settled on a Uniswap-deployed testnet (integrated, unsubmitted).
* Public repo from day one with steady commits, README including a CROPS section, FEEDBACK.md for Uniswap, WHITECHAIN_FEEDBACK.md, World ID integration debrief, and a demo video under 3 minutes.

## Non-Goals

* Mainnet, real funds, or production security claims. The Dabao burner signs without review by design; testnets and small amounts only.
* Trading strategy, portfolio management, or the Definitive track (two $2,500 tracks, both social-trading; off-product).
* Custom smart contracts. Zero new contracts ship; x402 rides the existing USDT token plus our facilitator. (Per ethskills: most dApps need 0-2 contracts.)
* Account abstraction. ENS prize submission (bonus points require an ENS submission; dropped; the ENS nameplate feature stays, unsubmitted).
* The 0G earning loop (Track 4 is v2) and the S3-as-USB-host product path (v2).
* iOS support. The Ffalcon Unity SDK targets Android only.

## Open Questions

* **Prize pick cap**: the vault's Arkiv section references "your three picks", grounding a three-partner-pick cap at Mumbai. Planned three: **0G Physical AI, World ID Agent Pass, Whitechain Scale**. Integrated but unsubmitted: EF Anon-RPC, Uniswap, ENS, Hedera. Hedera Track 1 becomes eligible under the auto-approve floor (see Technical Plan) and is a candidate fourth submission alongside Uniswap if the cap allows. Verify the cap at the event.
* **Uniswap Trading API testnet support**: does the hosted API serve quotes on Unichain Sepolia or Base Sepolia? If not, fall back to viem + Universal Router calldata. Decide before Day 2.
* **RayNeo IMU sample rate**: the Ffalcon SDK exposes head tracking; the achievable sample rate determines the motion feature set. Measure on hardware on Day 0 before finalizing features.
* **S3 powering the Dabao**: the XIAO cannot source 5V VBUS (to be confirmed on the bench; treated as an assumption until measured). The product path needs a powered hub or Y-cable; the bench demo keeps the Dabao on the Mac.
* **Anon-RPC network support**: does Anon-RPC serve Whitechain Sepolia (chain 1874) or Hedera testnet? If not, Anon-RPC covers the swap-chain reads only and stays an unsubmitted integration.
* **Hedera leg — ANSWERED 2026-11-05: not viable with the Dabao.** Hedera USDC is an HTS token (testnet ID 0.0.429274) under the `hedera:testnet` CAIP-2 namespace, not an EVM ERC-20 with EIP-3009; USDT0's documentation states Hedera is an explicit exception ("every EVM token contract supports it except Polygon PoS, Tempo, and Hedera"). The Dabao signs EVM-format EIP-191/712/1559 only, so it cannot authorize an HTS transfer. Hedera stays a documented alternate rail; no facilitator code is built for it.

## Critical User Journeys (CUJs)

### CUJ 1: Agent pays for its own inference

* **Given**: enrolled wearer; Dabao connected (bench: via the Mac relay; product: via the S3); agent holds USDT on Whitechain Sepolia (official token `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`); World ID linked; spend tiers configured (floor $0.05, cap $25).
* **When**: the agent decides it needs a 0G inference call that costs money; it composes an x402 payment and requests a signature.
* **Then**: below the floor, the agent pays without asking (and every auto-pay is logged); between floor and cap, the approval card renders only in the glasses, the motion gate samples 10-15 seconds and must pass, then the Dabao signs the EIP-3009 authorization; above cap, World ID verification is required first. The facilitator settles the payment; the inference response arrives with a request ID; the agent writes an episode entry (decision + request ID) to 0G Storage.

### CUJ 2: Wrong wearer (denied path)

* **Given**: the device is enrolled to person A; person B puts on the glasses.
* **When**: any payment above the floor is requested.
* **Then**: the motion gate scores a mismatch, refuses, and demands a fresh World ID verification; person B cannot complete it as person A (World ID is bound to person A's proof); nothing is signed. Stated plainly for judges: hackathon proofs are mocked, so the demo shows the flow and UX of denial; the security argument is the layering (motion tripwire escalating to World ID), presented as design intent, not as a proven guarantee.

### CUJ 3: Treasury top-up

* **Given**: the agent's USDT balance is below its operating floor; the wallet holds ETH or WETH on the swap chain.
* **When**: the agent requests a Uniswap quote for the top-up amount and presents it in the glasses.
* **Then**: this is always an above-floor spend, so the motion gate must pass, and above the cap World ID is required as well; the Dabao signs the swap transaction; the swap settles onchain; the agent's USDT balance recovers and it resumes paying.

### CUJ 4: Day-one enrollment

* **Given**: fresh Dabao, fresh install of the app.
* **When**: first boot: the Dabao generates its seed in-chip and reports its address; the app records 5 minutes of head motion; the wearer completes a World ID Agent Pass link.
* **Then**: the motion profile is encrypted on the phone with a key in the Android Keystore and written (as ciphertext) to 0G Storage; the app shows the agent's address and its agent nameplate (ENS integration, unsubmitted); a test approval passes end to end.

## Technical Plan (Architecture)

Five subsystems, matching the architecture diagram (see Additional Resources):

1. **Wearable UI**: RayNeo glasses + Android phone running the Unity/Ffalcon app. Renders approvals eyes-only; runs the motion gate.
2. **Signing transport**: bench path (primary) = phone → WiFi → Mac relay → USB HID → Dabao. Product path (stretch this weekend): phone → BLE → XIAO ESP32-S3 → WiFi → Mac relay; v2: S3 as direct USB host to the Dabao.
3. **Agent brain**: the agent loop on the Mac: watch balance → decide → request approval → wait for verdicts → sign → pay → record episode.
4. **Payment rail**: demo merchant + our own facilitator; settlement on Whitechain Sepolia in USDT via EIP-3009 `transferWithAuthorization` (confirmed present on the official token contract by explorer ABI, 2026-11-04; the token is a USDC-style fiat-token contract behind a proxy despite the USDT ticker). Hedera as an alternate rail pending the Open Question spike.
5. **Identity & privacy layer**: World ID Agent Pass (unique human, fresh verification on demand), motion gate (present human), Anon-RPC (private reads where supported), ENS nameplate (unsubmitted).

```text
RayNeo glasses --USB-C DP--> Android phone (Unity, Ffalcon SDK)
   |  IMU stream                 | WiFi (bench, primary) or BLE (stretch)
   v                             v
 Motion Gate (on phone)     [XIAO ESP32-S3] --WiFi--> Mac relay --USB HID--> Dabao
                                   phone ----WiFi------------^
   Agent (Mac) <--WebSocket--> phone
   Agent --> 0G PC (inference) · 0G Storage (encrypted profile + episode log)
   Agent --> Anon-RPC (reads, where supported) · World ID (verify) · Uniswap (quote)
   Merchant/facilitator --> Whitechain Sepolia (USDT) · [Hedera testnet, stretch]
   Swap leg --> Uniswap-deployed testnet
```

Key design choices:

* **The relay forwards the burner's envelope verbatim.** The envelope is `length (u32 BE) || type || message` carrying either ERC-4527 CBOR (type 0x01) or the app's own get-address/get-version messages (type 0x02); the relay forwards both, chunked into 64-byte HID reports with a report-ID 0 prefix and zero padding, matching `tools/eth_client.py`'s HID path in the workshop repo. The emulator binds loopback only; the relay binds the LAN interface and requires a bearer token, because the burner signs whatever it receives. One client at a time: a second connection is refused (this single-client rule is our relay's choice; the HID transport is one-request-at-a-time per protocol.cddl, while the emulator's TCP loop itself imposes no such limit). Board absent or unplugged mid-frame: the relay answers with a type-0x02 error-response (code 5, internal) so stock clients fail cleanly.
* **Three-tier spend rule.** Below the floor ($0.05) the agent pays without asking and logs every auto-pay; floor-to-cap requires the motion gate; above the cap ($25) requires World ID. The floor is what makes the agent usable (no one approves a $0.001 call through a 10-15 s gate) and it makes the flow eligible for Hedera's no-human-approval track if submitted later.
* **The x402 wire format is pinned.** 402 responses carry requirements in the base64-JSON `PAYMENT-REQUIRED` header; the client retries with `PAYMENT-SIGNATURE` (base64 JSON: scheme, network, asset, payTo, amount, validBefore, nonce); settlement returns `PAYMENT-RESPONSE` with the tx hash. The Dabao signs the payment as EIP-712 typed data (ERC-4527 data type 2, v=27/28) with the domain separator: name/version from the token contract, chainId 1874, verifyingContract = the USDT address above.
* **Motion features are computed on-device.** The phone samples head-pose deltas from the Ffalcon head-tracking stream and computes: per-axis angular-velocity histograms (16 fixed bins per axis), spectral energy in four bands (0.5-2, 2-4, 4-8, 8+ Hz), and mean/max jerk, forming a 128-dim L2-normalized vector. Match = cosine similarity above a threshold calibrated at enrollment (target: under 5% false rejects for the wearer across the enrollment session's own held-out windows; a false reject escalates to World ID, never blocks forever). The profile blob = version || vector || enrollment timestamp, AES-GCM-encrypted under an Android Keystore key before it leaves the phone. Only a match/mismatch boolean ever exits the gate.
* **Agent↔phone channel is a WebSocket with four message types.** `approval_request {amount, token, chain, purpose, spendTier}`; `motion_verdict {match, score}`; `worldid_verdict {verified | denied | expired}`; `sign_result {signature | error}`. All signing, including the swap, routes through the phone gate; the agent never signs directly.
* **0G integration is pinned.** 0G Private Computer's OpenAI-compatible API for inference, with the request ID of every call recorded; 0G Storage holds two blobs: the encrypted motion profile and the episode log (one entry per decision: timestamp, decision, 0G request ID, payment tx hash if any). Identity binding: World ID nullifier ↔ Dabao address ↔ profile hash are written together at enrollment so a profile swap is detectable.
* **Zero contracts.** Settlement rides the existing USDT token. Our facilitator only verifies signatures and submits transactions; its key is a faucet-funded testnet key in an env var, stated plainly in the README.

## Risks & Mitigations

* **The relay signs for anyone who can reach it.** The burner has no review by design, so the relay binds the LAN interface with a required bearer token and refuses concurrent clients. Residual risk (a LAN attacker who has the token) is accepted for a testnet demo and stated in the README.
* **BLE GATT is open by default (product path).** For the demo the S3 accepts only the bonded phone; pairing happens during setup. If bonding proves unreliable on stage, the demo runs on the WiFi relay path.
* **Motion gate false rejects on stage.** A false reject escalates to World ID immediately (this path already exists for the denied-path demo). The demo script treats a false reject as a planned branch, not a failure.
* **Motion gate false accepts.** Accepted risk, stated plainly: the gate is a tripwire, not a lock; the cap forces World ID for large spends regardless of the motion score.
* **0G unreachable.** The agent enters safe-stop: no new payments, no new decisions, a glasses-visible offline banner. The fallback never fakes a decision (a 0G Physical AI hard requirement).
* **Mocked World ID proofs.** Hackathon proofs use fake identities, so the denied path demonstrates flow and UX, not a cryptographic guarantee. The README and the World ID debrief say this plainly.
* **Facilitator hot wallet.** Faucet-funded testnet key in an env var; worst case is drained testnet tokens.
* **Single-client relay DoS on stage WiFi.** Bearer token plus single-client refusal; a port scanner gets refused connections, not signatures.
* **Unmeasured latency.** The 60-second loop and sub-100 ms relay hop are rehearsal targets, measured on Day 2, not guarantees.

## Alternatives Considered

### Alternative A: Glasses as a notification screen only

* **Pros**: simplest possible integration; no Unity work beyond display.
* **Cons**: does not survive the question "why not the phone screen"; the glasses' only unique property is privacy.
* **Reason for rejection**: cosmetic use of hardware; fails the product rule that each piece must solve a real problem.

### Alternative B: Phone USB-OTG directly to the Dabao, drop the glasses and S3

* **Pros**: two fewer devices; no BLE; simpler demo.
* **Cons**: loses the privacy layer, which is the product; also the glasses occupy the port in the target form factor, so OTG is unavailable in the product.
* **Reason for rejection**: removes the thing that makes this more than another wallet.

### Alternative C: Challenge-response head gesture as the primary motion check

* **Pros**: a random challenge defeats pre-recorded replay.
* **Cons**: deliberate gestures are less individual than unconscious movement, so false rejects rise and mimicry is easier; worse UX in a live demo.
* **Reason for rejection as primary**: passive scoring is the fingerprint; a random challenge is kept as an anti-replay supplement for high-value approvals.

### Alternative D: Arkiv for agent state

* **Pros**: agent coordination state is a stated Arkiv direction; public reads need no key; Arkiv prizes count as one partner prize without consuming a pick.
* **Cons**: four judged markdown files plus runnable queries per track rules; heavy paperwork for the weekend.
* **Reason for rejection**: paperwork cost, not pick budget. Revisit after the event if a pick slot is free.

### Alternative E: Definitive trading agent

* **Pros**: Flash API is agent-friendly; two $2,500 tracks.
* **Cons**: pivots the product to trading; adds market-moving risk to a live stage demo; the open track is social-trading-shaped, which we are not.
* **Reason for rejection**: scope creep against the privacy-agent core.

---

## Non-Functional Requirements

* **Security & Privacy**: the seed exists only in the chip's keystore; the motion profile leaves the phone only as ciphertext under a device-held key (0G Storage holds user-owned ciphertext; plaintext and keys stay on-device; this is the CROPS README argument); approvals never render on a shareable screen; testnets only.
* **Performance & Latency**: targets, not guarantees — full above-floor approval loop under 60 seconds; motion sampling window 10-15 seconds; relay hop under 100 ms locally. All measured at rehearsal.
* **Rollout & Rollback**: everything runs from one repo; the demo degrades to "WiFi relay only" if BLE fails, and to a recorded video if hardware fails entirely (the video is a stage fallback, never presented as a live run at a sponsor booth).

## Additional Resources

* Architecture diagram (archify v5.1): copy vendored at `docs/architecture/private-agent.html` (source of truth: `/Users/lc/.archify/architecture-private-agent-20261104-162200/private-agent.html` on the build machine)
* Prize vault working copy: `docs/reference/ethglobal-mumbai-prizes.md` (vendored from the VPS Obsidian vault snapshot)
* Dabao workshop repos on the build machine: `~/dabao-workshop/xous-core` and `~/dabao-workshop/ethereum-app`, branch `devcon8-workshop`
* ethskills: https://ethskills.com/SKILL.md — binding rules for all onchain work
* Uniswap AI skills pack: https://www.skills.sh/uniswap/uniswap-ai

## Future Improvements

* Earning loop (the agent charges for a service) for 0G Track 4.
* S3 as direct USB host to the Dabao with a powered hub; the Mac leaves the product path.
* On-device small model for the motion gate instead of fixed features.
* Uniswap and/or Hedera as fourth submissions if the pick cap allows.

---

## Detailed Implementation Plan

### Staging

* **Day 0 (today)**: relay + tests; IMU sample-rate measurement; Whitechain EIP-3009 spike completes (ABI already verified; send one real settled payment); S3 firmware starts (stretch).
* **Day 1**: merchant + facilitator + payment loop end to end on Whitechain; agent loop with the three-tier rule; episode log.
* **Day 2**: Unity app (approval card, agent client, motion gate, World ID gate); rehearsal with latency measurement; safe-stop demo.
* **Day 3**: integrations hardening (Anon-RPC where supported, Uniswap swap leg), docs and sponsor paperwork, video, submission.
* **Cut order if slipping**: motion gate → Hedera leg → S3 firmware → Uniswap swap leg.

### Target Files to Create/Modify

Repo root: `~/Projects/eyesonly/` (new repo, public from day one, MIT license, steady commits).

#### 1. `relay/server.py` (Create)

* **Type / Scope**: Python asyncio service on the Mac.
* **Proposed Changes**: TCP server on a configurable port (default 7601) that accepts the burner envelope, requires a bearer token on connect, refuses concurrent clients, forwards frames to the Dabao over HID in 64-byte reports (report-ID 0 prefix, zero-padded), reassembles responses, and returns them. Board absent or unplugged mid-frame: answer with a type-0x02 error-response (code 5). Flags: `--port`, `--token-env`, `--bind` (default the LAN interface).

#### 2. `relay/hid_transport.py` (Create)

* **Type / Scope**: Python module wrapping hidapi.
* **Proposed Changes**: open VID 0x1d50 / PID 0x6197; `send(frame)` and `recv()` with report-ID 0 prefix, zero-padding, and explicit timeouts (500 ms per report, 5 s total); reconnect logic for replug.

#### 3. `relay/test_relay.py` (Create)

* **Type / Scope**: pytest unit tests.
* **Proposed Changes**: framing round-trip against a fake HID device; 64-byte chunk boundary tests; timeout and board-absent error-frame tests; bearer-token refusal test; concurrent-client refusal test.

#### 4. `firmware/s3-bridge/main/main.c` (Create) — STRETCH

* **Type / Scope**: ESP-IDF C firmware for the XIAO ESP32-S3.
* **Proposed Changes**: init BLE GATT server and WiFi client; forwarding loop: GATT write → TCP to the relay → GATT notify. Reconnect supervision. WiFi credentials and relay host:port provisioned over a UART setup command, stored in NVS.

#### 5. `firmware/s3-bridge/main/ble_server.c` (Create) — STRETCH

* **Type / Scope**: BLE module.
* **Proposed Changes**: one GATT service (UUID base `6e5e0001`), write characteristic `…0002`, notify characteristic `…0003`; MTU 185 negotiated; frames chunked with a 2-byte length header; bonded peers only.

#### 6. `firmware/s3-bridge/main/wifi_relay.c` (Create) — STRETCH

* **Type / Scope**: WiFi/TCP module.
* **Proposed Changes**: TCP client to the Mac relay; keepalive; framed send/recv identical to `relay/server.py`, including the bearer token on connect.

#### 7. `merchant/server.ts` (Create)

* **Type / Scope**: Node/TypeScript (Hono), the demo paid API.
* **Proposed Changes**: `GET /generate` returns 402 with a `PAYMENT-REQUIRED` header (x402 v2 schema; Whitechain USDT option); on a valid `PAYMENT-SIGNATURE`, verifies and settles through the facilitator, then proxies a 0G image generation call so the paid artifact is visible in the glasses. Returns `PAYMENT-RESPONSE` with the tx hash and the 0G request ID.

#### 8. `merchant/facilitator/whitechain.ts` (Create)

* **Type / Scope**: TypeScript module, viem.
* **Proposed Changes**: verify the EIP-3009 typed-data signature against USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on Whitechain Sepolia (chain 1874) and submit `transferWithAuthorization` from the facilitator wallet (pays gas). EIP-3009 support confirmed on this contract by explorer ABI on 2026-11-04.

#### 9. `merchant/facilitator/hedera.ts` (Create) — STRETCH, gated on the Open Question spike

* **Type / Scope**: TypeScript module.
* **Proposed Changes**: same verify-and-settle against a Hedera testnet USDC token, only after the spike confirms an EIP-3009-compatible surface on Hedera's EVM; otherwise this file becomes a docs note naming Hedera as an alternate rail.

#### 10. `merchant/facilitator/whitechain.test.ts` (Create)

* **Type / Scope**: vitest unit tests.
* **Proposed Changes**: signature verification against known-good and known-bad EIP-712 payloads; replay rejection (same nonce twice); wrong-chain and wrong-token rejection.

#### 11. `app/Assets/Scripts/AgentClient.cs` (Create)

* **Type / Scope**: Unity C# (Ffalcon SDK project).
* **Proposed Changes**: WebSocket client to the agent on the Mac implementing the four message types (`approval_request`, `motion_verdict`, `worldid_verdict`, `sign_result`).

#### 12. `app/Assets/Scripts/ApprovalCard.cs` (Create)

* **Type / Scope**: Unity C#.
* **Proposed Changes**: the eyes-only approval UI: amount, token, recipient, purpose, countdown; renders on the glasses display; the phone screen shows a neutral idle screen with no payment details.

#### 13. `app/Assets/Scripts/MotionGate.cs` (Create)

* **Type / Scope**: Unity C#.
* **Proposed Changes**: enrollment (5-minute head-pose delta capture), the 128-dim feature vector per the Technical Plan, cosine similarity, threshold calibrated at enrollment; emits `motion_verdict`; on mismatch, raises the World ID re-verification. Profile blob = version || vector || enrollment timestamp, AES-GCM under an Android Keystore key.

#### 14. `app/Assets/Scripts/PayClient.cs` (Create)

* **Type / Scope**: Unity C#.
* **Proposed Changes**: builds the EIP-3009 typed-data payload (domain per the Technical Plan), sends the sign request over WiFi to the relay (bench, primary) or BLE to the S3 (stretch), receives the signature, attaches it as the `PAYMENT-SIGNATURE` header value.

#### 15. `app/Assets/Scripts/BleBridge.cs` (Create) — STRETCH

* **Type / Scope**: Unity C#, Android BLE via AndroidJavaObject.
* **Proposed Changes**: scan/connect/bond to the S3 GATT service, chunked writes, notify subscription; matches the firmware's 2-byte chunk header.

#### 16. `app/Assets/Scripts/WorldIdGate.cs` (Create)

* **Type / Scope**: Unity C#.
* **Proposed Changes**: World ID Agent Pass request via deep link to the World app (or IDKit web flow in a webview; verify the exact integration path at the event); mocked proofs for the hackathon; verified results validated by the agent backend, never trusted from the client; the deny path is a first-class UI state.

#### 17. `agent/zerog.ts` (Create)

* **Type / Scope**: TypeScript module (agent side, on the Mac).
* **Proposed Changes**: 0G Private Computer client (OpenAI-compatible API); records the request ID of every call into the episode log.

#### 18. `agent/memory.ts` (Create)

* **Type / Scope**: TypeScript module.
* **Proposed Changes**: 0G Storage read/write for two blobs: the encrypted motion profile and the episode log (one entry per decision: timestamp, decision, 0G request ID, payment tx hash if any). Enrollment writes the identity binding (World ID nullifier ↔ Dabao address ↔ profile hash).

#### 19. `agent/rpc.ts` (Create)

* **Type / Scope**: TypeScript module.
* **Proposed Changes**: routes chain reads through Anon-RPC where the network is supported (see Open Questions); logs which calls go through it (a judging requirement).

#### 20. `agent/swap.ts` (Create)

* **Type / Scope**: TypeScript module.
* **Proposed Changes**: Uniswap Trading API quote for the top-up amount, transaction build, hands the transaction to the phone gate for approval and signing (never signs directly), submits, verifies the balance recovery.

#### 21. `agent/loop.ts` (Create)

* **Type / Scope**: TypeScript module.
* **Proposed Changes**: the agent loop: watch balance → decide → (0G unreachable → safe-stop: no payments, offline banner) → request approval per the three-tier rule → wait for verdicts → sign → pay → record episode. Every auto-pay below the floor is logged.

#### 22. `README.md` and `docs/` (Create)

* **Type / Scope**: Documentation.
* **Proposed Changes**: setup, vendored architecture diagram, the CROPS section (one or two lines per letter, including the ciphertext-only profile argument), demo script, the burner-model limitation stated plainly, the mocked-proofs honesty note, and exact pointers to contracts and lines for any Uniswap verification.

#### 23. `FEEDBACK.md`, `docs/WHITECHAIN_FEEDBACK.md`, `docs/WORLDID-DEBRIEF.md` (Create)

* **Type / Scope**: Sponsor paperwork.
* **Proposed Changes**: WHITECHAIN_FEEDBACK.md is required (Whitechain Scale is a submission); FEEDBACK.md and the World ID debrief are written as built (the Uniswap and World integrations exist regardless of submission status).

#### 24. `scripts/verify-e2e.sh` (Create)

* **Type / Scope**: Shell verification script.
* **Proposed Changes**: relay up and token-refusal check; board answering `get-address` with the expected address (pinned from the enrolled seed, or the emulator seed file for CI); merchant 402-then-200 round trip with the tx link printed; motion-gate self-test pass and fail driven over ADB against the debug build.

#### 25. `scripts/demo.sh` (Create)

* **Type / Scope**: Shell script.
* **Proposed Changes**: the staged demo sequence including the denied path and the safe-stop demonstration, with the recorded-video fallback clearly labeled as a fallback.

### Verification Plan

* **Build**: `cargo build --release --target riscv32imac-unknown-xous-elf` in `~/dabao-workshop/ethereum-app/dabao-app-eth-burner` (external workshop firmware, regression check only); `idf.py build` for the S3 (stretch); `tsc --noEmit` for merchant and agent; Unity builds for Android.
* **Unit tests**: `pytest relay/`; `vitest` for the facilitator.
* **Integration**: `scripts/verify-e2e.sh` green on the bench rig.
* **Hardware acceptance**: the workshop's HARDWARE-TESTS.md items 3.4-3.8 on the real board through the relay (items 2.1-2.5 are direct-USB enumeration checks and do not apply through a relay). Note: that file's own reference to `opencard-app-eth-signer/tools` is stale; the tools live in `dabao-app-eth-burner/tools`.
* **Stage rehearsal**: two full runs of `scripts/demo.sh` including the denied path and the safe-stop branch, timed against the latency targets, with the backup video recorded.

*Drafted with EGM*
