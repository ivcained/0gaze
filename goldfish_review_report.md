# Goldfish Annotated Review Report

**Status: resolved**

**Target:** `/Users/lc/Projects/0gaze/docs/designs/0gaze.md` (`full file`)
**Round:** 1 · **Reviewers:** design_critic, structural, implementation_readiness, codebase_details, comprehension, zoom_out (6/6 completed)

## Prioritized Findings & AI Suggestions

### [F1] Missing Risks & Mitigations section [design_critic, structural] — Severity: High
* **Affected Scope:** whole document
* **Discrepancy:** the standard requires a dedicated failure-modes/security section; the doc has none. Concrete exhibit: the relay accepts the emulator protocol on TCP with no auth, and the burner signs anything from anyone who can reach the port.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** valid; the unauthenticated relay on stage WiFi is the sharpest concrete risk found in the round.
* ***Proposed Edit:*** add `## Risks & Mitigations` covering: relay auth (bearer token + Tailscale/LAN bind, single-client refusal), BLE open GATT (bonding or accept-known-peer for demo), motion-gate false-accept/false-reject handling (escalate to World ID, never block forever), 0G-unreachable safe-stop (pause spending + glasses banner; never fake a decision — Physical AI hard requirement), facilitator hot-wallet custody (env var, faucet-funded, testnet only), mocked World ID proofs honesty (what the demo proves vs cannot), relay/HID error semantics (type-0x02 error code 5 on board absent; both frame types 0x01/0x02 forwarded; report-ID 0 prefix on HID writes).

### [F2] World ID is both a planned pick and a future improvement [structural] — Severity: High
* **Affected Scope:** L36 vs L146
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** delete the Future Improvements item "World ID Agent Pass as a prize submission if the pick cap allows" (it is a current pick).

### [F3] CUJ 1 crosses tokens: "USDC on Whitechain Sepolia" [structural, codebase_details, design_critic] — Severity: High
* **Affected Scope:** L45
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** CUJ 1 Given becomes "agent has USDT on Whitechain Sepolia (official token 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7)".

### [F4] EIP-3009 on Whitechain USDT "unverified, likely wrong" [implementation_readiness, codebase_details, design_critic] — Severity: High
* **Affected Scope:** L47, L194; CUJ 1
* ***AI Suggestion:*** CONTEST (with new live evidence) + PROPOSE FIX (pin the evidence)
* ***Justification:*** verified live during resolution: the Whitechain Sepolia USDT contract at `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` implements `transferWithAuthorization`, `receiveWithAuthorization`, `authorizationState`, `DOMAIN_SEPARATOR` (EIP-712), and `permit` (EIP-2612), per the explorer ABI. The contract is a proxy; the explorer serves the implementation ABI. The SafeERC20 note was misapplied (it concerns `transfer`/`approve`, not `transferWithAuthorization`).
* ***Proposed Edit:*** facilitator/whitechain.ts spec: pin token address, note EIP-3009 confirmed by explorer ABI on 2026-11-04, remove the SafeERC20 misapplication note, add "token is a USDC-style fiat-token contract behind a proxy despite the USDT ticker".

### [F5] x402 wire format unspecified [implementation_readiness] — Severity: High
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** merchant spec: x402 v2 headers (`PAYMENT-REQUIRED` on 402, `PAYMENT-SIGNATURE` on retry, `PAYMENT-RESPONSE` on settle); base64-JSON payload with scheme/network/asset/payTo/amount/validBefore/nonce; the Dabao signs the EIP-712 typed data (ERC-4527 data type 2, v=27/28 per protocol.cddl); exact EIP-712 domain fields (name, version, chainId 1874, verifyingContract = USDT address).

### [F6] MotionGate under-specified [implementation_readiness] — Severity: High
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** v1 spec: 6-axis head-pose delta stream from Ffalcon head tracking at measured rate; features = per-axis angular-velocity histograms (16 fixed bins), spectral energy in 4 bands (0.5-2, 2-4, 4-8 Hz), mean/max jerk; 128-dim L2-normalized vector; cosine similarity; threshold set at enrollment to target <5% false rejects for the wearer; Android Keystore-held AES-GCM key encrypts the profile blob before it leaves the phone; blob schema = version + vector + enrollment timestamp.

### [F7] Agent↔phone channel and approval orchestration undefined [implementation_readiness] — Severity: High
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** add the message schema + state machine: WebSocket JSON messages `approval_request {amount, token, chain, purpose, spendTier}`, `motion_verdict {match, score}`, `worldid_verdict {verified | denied | expired}`, `sign_result {signature | error}`; orchestration: agent → approval_request → phone motion gate → (spendTier=high → World ID) → sign via relay (bench) or S3 (product) → facilitator → settle. The swap path routes through the same phone gate; `agent/swap.ts` never signs directly.

### [F8] 0G safe-stop fallback and per-decision episode log missing [codebase_details, design_critic, zoom_out] — Severity: High
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** hard requirement of the 0G Physical AI track, which is a planned submission.
* ***Proposed Edit:*** agent/loop.ts gains a safe-stop state: if 0G is unreachable, the agent stops initiating payments and posts a glasses-visible "offline" banner; every agent decision writes an episode entry to 0G Storage with its 0G request ID. Add to Goals: "safe-stop demonstrated live by killing network access mid-demo".

### [F9] Undefined terms / missing hackathon frame [comprehension, 10 blockers] — Severity: High
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** per the resolve rules, comprehension gaps are document gaps, never contested.
* ***Proposed Edit:*** add a `## Context` preamble (ETHGlobal Mumbai 2026 hackathon project; Dabao = Baochip-1x USB hardware signer from the Devcon workshop; burner model = no screen, signs on request, testnets only) and a `## Glossary` defining: x402, facilitator, 0G Private Computer, 0G Storage, Anon-RPC, CROPS, World ID Agent Pass, ENS, S3 (= XIAO ESP32-S3), Ffalcon SDK, EIP-3009, bench vs product topology, ERC-4527.

### [F10] Sub-threshold auto-approve tier missing [zoom_out Finding 2] — Severity: High
* **Discrepancy:** "the wearer approves everything" fails in practice: nobody approves a $0.001 inference call through a 10-15 s motion gate per request. A spend floor (below floor: auto-approve; floor to cap: motion gate; above cap: World ID) is simultaneously the product-realism fix and the unlock for Hedera Track 1 eligibility ("no human approving").
* ***AI Suggestion:*** ESCALATE (owner decision; recommendation: accept)

### [F11] Prize picks: include Whitechain Scale? [zoom_out Finding 4] — Severity: High
* **Discrepancy:** Whitechain Track 3 "Scale" ($3,000) describes CUJ 1 verbatim ("pay-per-request APIs where an AI agent pays a business in USDT over x402, settled on Whitechain through a facilitator you run") and is left unsubmitted while weaker-fit tracks are picked.
* ***AI Suggestion:*** ESCALATE (owner decision; options: keep 0G + World + EF, or swap EF for Whitechain Scale. Note: EF counts once across its tracks, and Anon-RPC network support for our chains is unverified, weakening the EF pick's Anon-RPC half; the CROPS half remains strong.)

### [F12] S3 bridge is YAGNI for the bench demo [zoom_out Finding 8] — Severity: High
* **Discrepancy:** the bench demo works over WiFi relay alone; the S3 firmware + Android BLE bridge is the riskiest quarter of the plan and serves only the product path (a stated Future Improvement).
* ***AI Suggestion:*** ESCALATE (owner decision; recommendation: keep the S3 as the product-story differentiator and demo enhancement, but make the WiFi relay the primary demo path and the S3 a stretch item. The S3 is why the hardware story is a system and not a peripheral.)

### [F13] Hedera leg hand-waved ("HTS/EVM") [design_critic, implementation_readiness] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** mark the Hedera leg as stretch pending a testnet spike: name the exact USDC token and confirm EIP-3009-compatible surface exists on Hedera EVM; if not, Hedera leg drops to "settlement shown on Whitechain only, Hedera as alternate rail in docs". Note: with F10's auto-approve floor, Hedera Track 1 becomes eligible, which may re-raise its priority.

### [F14] Denied-path honesty under mocked proofs [design_critic] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** state plainly: mocked proofs mean the denied path demonstrates the flow and UX, not a cryptographic guarantee; the security argument is the layering (motion tripwire + World ID), stated as design intent.

### [F15] Diagram↔doc drift: ENS present in diagram, dropped in doc; "five subsystems" never enumerated [design_critic, structural, codebase_details] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** enumerate the five subsystems (wearable UI, signing transport, agent brain, payment rail, identity/privacy layer); state ENS = agent nameplate, integrated, unsubmitted (bonus points require an ENS submission, so the ENS prize claim is dropped; the feature stays).

### [F16] World ID renders on the phone, conflicting with "phone shows nothing sensitive" [design_critic] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** reword the goal: "the phone screen shows no payment details; the World app shows only its own verification UI." Add integration path: deep link to the World app / IDKit flow from the Unity app (verify at event).

### [F17] CROPS "personal data stays on-device" vs motion profile on 0G Storage [design_critic] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** CROPS section argues: the profile leaves the phone only as ciphertext under a device-held key; 0G Storage holds the user's own encrypted data; the plaintext never leaves. Keys (Dabao seed, profile key) stay on-device.

### [F18] Anon-RPC network support unverified [design_critic, zoom_out] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** Open Question: does Anon-RPC serve Whitechain Sepolia (1874) and Hedera testnet? If not, Anon-RPC covers the swap-chain reads only, and the EF submission leads with CROPS App.

### [F19] Facilitator custody, BLE contract, 0G auth/blobs, phasing, verify-e2e executability [implementation_readiness M3-M8] — Severity: Medium
* ***AI Suggestion:*** PROPOSE FIX
* ***Proposed Edit:*** facilitator key in env var, faucet-funded, testnet-only; BLE: pin service/characteristic UUIDs, MTU 185, 2-byte chunk header; 0G: pin endpoints/SDK, blob schemas, identity binding (World ID nullifier ↔ Dabao address ↔ profile hash); add Day 0-3 phasing with cut list (cut order: motion gate → Hedera leg → S3 firmware → swap leg); verify-e2e drives the motion self-test over ADB and pins the expected address from a fixed emulator seed.

### [F20] 0G Physical AI "weakest fit / body claim thin" [zoom_out Finding 3] — Severity: Medium
* ***AI Suggestion:*** CONTEST (partially)
* ***Justification:*** the track brief explicitly names the lane: "personal devices (open, verifiable alternative to Meta's Muse on glasses/pocket device/desktop companion, user memory on 0G Storage + sealed inference)". The glasses + sealed user memory fit is documented in the sponsor's own words. Accepted part: the safe-stop requirement gap (fixed in F8) and the "not a chatbot with a robot avatar" risk, mitigated by the paid-inference-in-main-flow requirement already in the design.

### [F21] "The vault says three picks" unverified [zoom_out Finding 5] — Severity: Medium
* ***AI Suggestion:*** CONTEST (grounded) 
* ***Justification:*** the vault's Arkiv section states prizes "count as ONE partner prize on ETHGlobal (doesn't burn one of your three picks)" — the three-pick frame is grounded in the sponsor's own text. The Open Question to verify the cap at the event stays.

### Nits (DECLINE unless noted)
Garbled "(motion +, above cap, World ID)" [FIX in pass], Definitive pool is 2×$2,500 not "$5k track" [FIX], Arkiv rationale misstates pick budget (it does not burn a pick) [FIX], VPS-absolute vault path and archify home-relative path in a public repo [FIX: repo-relative copies], H3 nesting under NFR [FIX], "ERC-4527 framing" misnomer (envelope carries type 0x01 + 0x02) [FIX], "one request at a time" is HID-scoped not burner-wide [FIX], HARDWARE-TESTS items 2.1-2.5 cannot run through the relay [FIX: only 3.4-3.8], unmeasured latency budgets marked as NFRs [FIX: mark as targets], HID report-ID byte [FIXED in F1], vitest with no facilitator test file [FIX: add merchant test file], bench WiFi signing leg missing from ASCII [FIX].

**Round verdict:** NOT clean (blockers present). Fixes are specified; owner decisions F10/F11/F12 gate the next round.
