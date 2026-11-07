# Submission form — copy-paste answers

Prepared 2026-11-07 06:00 IST. Every answer is grounded in `docs/SUBMISSION.md`
and was verified by execution. Paste these into the ETHGlobal Hacker Dashboard
form; edit live links only after the video is uploaded.

---

## Project name

```
0Gaze
```

## Tagline (one line)

```
A private AI agent that thinks on 0G, pays through a hardware chip with x402, and takes its spend approvals through guided head-motion challenges shown only inside the wearer's AR glasses.
```

## GitHub repository

```
https://github.com/ivcained/0gaze
```

## Live demo / deployment

```
https://0gaze.tech/  (product page)
https://0gaze.tech/generate  (live x402 402 quote — `curl -i https://0gaze.tech/generate`)
```

## Demo video

*(paste after upload)*

## Describe your project (long answer)

```
0Gaze is a private AI agent that can hold and spend money while the key never leaves its hardware chip and approvals render only on the wearer's AR glasses.

The wallet key is generated inside a Dabao hardware signer (a XIAO ESP32-S3 board running xous, a small embedded OS) and never leaves the chip. Spend requests render only on the wearer's RayNeo AR glasses; in the product path the glasses run as an independent display, so no other screen shows the approval.

Consent is a guided head-motion challenge — the demo uses a single deliberate look left, drawn from a calibrated four-move vocabulary — matched against a per-wearer calibrated motion signature, behind an arming gate that keeps motion capture closed while the wearer reads the request, so the instinctive nod of assent is never scored as a move. The vocabulary is deliberately four moves (two yaw, two roll): nods are excluded because glasses wearers move their eyes, not their head.

The agent thinks on 0G Private Computer inference, journals every decision as an episode anchored to 0G Storage, and pays per request over x402 in USDT on Whitechain Sepolia through our own facilitator — the chip signs an EIP-3009 transferWithAuthorization and our facilitator verifies it and pays the gas, so the wearer never holds the chain's gas token and never sees a chain name. Every denial path (wrong motion, a stranger's head, timeout, unreachable 0G) fails closed: nothing is signed and the refusal itself is journaled.

Five hardware-signed settlements are on the Whitechain Sepolia explorer today, including a 0.10 USDT payment approved by head gestures and signed on the chip. The live 402 quote at https://0gaze.tech/generate is real: it decodes to x402 v2, eip155:1874, the official Whitechain USDT deployment, 0.01 USDT.
```

## How did you build it? / What did you build? (long answer)

```
Four pieces, wired end to end:

1. HARDWARE CUSTODY. A Dabao signer (ESP32-S3, xous) generates the wallet key inside its keystore and signs EIP-3009 typed data on demand. The Mac speaks ERC-4527 CBOR over 64-byte USB HID reports through a small Python relay that auto-recovers from HID wedges but never retries a signing request whose outcome became unknown — a retried signature can be a duplicated payment.

2. THE GLASSES AS THE ONLY APPROVAL SCREEN. A C++ bridge streams the RayNeo glasses' IMU at 496.5 Hz (measured, evidence committed). A segmenter integrates the gyro with per-session median-bias correction and separates deliberate sweeps from ambient noise; a per-wearer calibrated signature (four directions, each with amplitude/speed/duration envelopes plus a mean rotation vector) classifies moves. An arming gate keeps capture closed while the wearer reads the request card — minimum card time, a measured stillness beat, a short countdown, auto-arm after 5 s — so the instinctive nod of assent can never be scored. The approval UI is a fullscreen page rendered on the glasses' own display; in extended-display mode it appears on the glasses and nothing else.

3. THE AGENT LOOP. The agent calls 0G Private Computer inference inside its decision loop (per-request trace IDs are journaled), pays per request over x402, and journals every decision — timestamp, verdict, 0G request ID, settlement hash — with episode roots stored on 0G Storage and re-downloadable from 0G nodes.

4. SETTLEMENT ON WHITECHAIN. The chip signs an EIP-3009 transferWithAuthorization in official Whitechain USDT; our own facilitator verifies the signature, pays the gas, and settles on Whitechain Sepolia. All denial paths fail closed and every refusal is journaled: real refusal episodes include wrong_direction_after_3_attempts, not_your_motion, wearer_timeout, glasses_unavailable.

A Groth16 proof pipeline binds the motion window to each spend challenge off-chain (proven end-to-end with snarkjs; intended on-chain verification is Phase 2), and a three-tier spend rule scales friction: auto below $0.05, head-motion gate to $25, World ID above.
```

## Challenges you ran into (and what you learned)

```
The hardest bug of the event was not in the gesture algorithm — it was in delivery. We measured (from a 490 MB recording of real head motion) that a failed take lost 27.9% of IMU samples to gaps over 50 ms, with one 3.6 s hole, because the bridge process starved while the Mac also ran inference, storage uploads, a screen recording, and a fullscreen UI. The same 700 ms turn that integrated to 60° in the clean session fragmented into three 200 ms spikes totaling 13°. The lesson: instrument the feed itself. We built a stream-quality monitor (rate, lost-time %, max gap) into the live pipeline and a preflight gate that refuses to record on a degraded feed — and we verified the fixed bridge delivers 496.8 Hz lossless.

The second lesson was honesty under deadline pressure. We measured a promising fix (gravity-aligned rotation, inspired by another glasses app) and rejected it because the data showed only a 0.02 dominance gain. We also caught ourselves claiming a settlement was chip-signed when the explorer showed it was paid from a bench key, and removed the claim before submission. Every number in this submission was re-derived by execution on the final day.
```

## What we are most proud of / accomplishments

```
Five hardware-signed USDT settlements on Whitechain Sepolia, including a 0.10 USDT payment approved by head gestures and signed on the chip. Every denial path proven to fail closed with journaled refusals. The arming gate that makes the nod-of-assent structurally impossible rather than unlikely. And an evidence pipeline where judges can curl the live 402 and decode it themselves: x402 v2, eip155:1874, official USDT, 0gaze://generate.
```

## What's next / roadmap

```
1. On-chip policy reasoning: Needle 2 (45M tool-calling model, ~14 MB 2-bit binary) runs on ESP32-S3-class MCUs — the signer itself would evaluate spends against the wearer's policy before signing, escalating to the glasses challenge when uncertain. Requires an N16R8-class board or a pruned quant (the current Dabao has 8 MB flash).
2. Gravity-referenced attitude for long-session drift immunity, and World ID escalation exercised end-to-end with a live World App proof.
3. Notarized macOS .dmg distribution (Developer ID), a 2-of-3 Safe vault for bulk funds with the chip holding a small float, and extending the 0G journal to encrypted profile blobs.
```

---

## Sponsor track answers

### 0G — Physical AI: Agents with a Body ($5,000)

```
0Gaze is a wearable whose decisions run on 0G. The RayNeo glasses are the body: a 496.5 Hz IMU stream (evidence committed at glasses/evidence/imu-capture-stats.json) feeds a per-wearer gesture signature, and the approval UI renders on the glasses' own display.

0G Private Computer runs inside the decision loop with no mock in this path: agent/zerog-provider.ts calls router-api.0g.ai/v1/chat/completions and journals the per-request trace ID (x_0g_trace.request_id); data/episodes.ndjson pairs real request IDs with settlement hashes (e.g. 28a37a4e-… ↔ 0x23c2…d376; 6ed5058d-… ↔ 0xeabe0a…8441).

Every decision is journaled to 0G Storage: root 0xaaa3cc310afb8eb4191104d2260ef943d76bb99bd5848ade564e7253920e80d2 was re-downloaded from 0G testnet storage nodes on 2026-11-07 and is byte-identical to the journaled episode; six further roots are in the journal.

Safe-stop is real: when 0G is unreachable the provider throws after bounded retries and the loop records an error episode instead of spending. The "full agent loop with safe-stop" settlement (0x23c28f…29d376) is the on-chain record of that path. This is a real-hardware build — live hardware demo at the booth, not a simulation.
```

### Whitechain — Scale: Payments Nobody Notices ($3,000)

```
The track brief asks for "pay-per-request APIs where an AI agent pays a business in USDT over x402, settled on Whitechain through a facilitator you run" — that is our architecture verbatim.

Zero visible crypto steps for the payer: the chip signs an EIP-3009 transferWithAuthorization; our facilitator (merchant/facilitator/) verifies it and pays the gas. The wearer never holds WBT, never sees a chain name — the glasses card says "0.10 USDT → 0G inference".

Official USDT 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 on Whitechain Sepolia (chain ID 1874): five chip-signed settlements verified through the explorer API (all transferWithAuthorization, all from the chip address 0xbdF5…b8BE), plus a live 402 quote at https://0gaze.tech/generate that anyone can curl — it decodes to x402 v2, eip155:1874, resource 0gaze://generate, 0.01 USDT.

Why onchain stablecoin settlement: a card rail cannot give an autonomous agent a hardware-rooted, per-request, human-presence-gated spend with no stored credentials and no checkout session. Here the authorization IS the settlement (EIP-3009), so the agent's spending power is exactly as revocable as physical access to the wearer's glasses and chip.

Honest disclosure: we deploy no custom contract — settlement runs through the official USDT token and our off-chain facilitator. docs/WHITECHAIN_FEEDBACK.md is our builder feedback on the chain, docs, and a facilitator cookbook we are happy to contribute.
```

### World — World ID Agent Pass ($5,000)

```
World ID in 0Gaze is a meaningful human-identity action, not a bolted-on login: it fires only above the $25 cap — the moment a spend stops being demo-scale.

Complete journey implemented: the agent signs each approval request as the relying party (signApprovalForWorldId binds action + nonce + a 5-minute expiry with the RP signing key), the proof returned by the World App is verified server-side at developer.world.org/api/v4/verify/{rp_id}, and only a verified result unlocks the spend (agent/worldid.ts, agent/gate.ts). Nullifiers are extracted for replay protection.

Denied path: worldid_denied, worldid_expired, and not_configured all fail closed — a missing credential can never become an approval. Covered by agent/gate.test.ts.

Disclosure, exactly as the hackathon permits: proofs are mocked in the demo path; the verification path is real code and refuses to approve without RP credentials. Required integration debrief: docs/WORLDID-DEBRIEF.md.
```

---

## Before you paste: one-time actions for you (need your password / accounts)

1. **sudoers** (removes the bridge renice warning):
   ```
   sudo visudo -f /etc/sudoers.d/bridge-renice
   ```
   content: `lc ALL=(ALL) NOPASSWD: /usr/sbin/renice`
2. Record the video, upload, then fill the Demo video link above.
3. Submission form: save early, edit until deadline.
