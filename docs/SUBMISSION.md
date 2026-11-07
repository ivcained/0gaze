# ETHGlobal Mumbai 2026 submission

## Project

**Name:** 0Gaze

**One-line pitch:** A private AI agent that thinks on 0G, pays through a Dabao hardware signer with x402, and takes its spend approvals through guided head-motion challenges shown only inside the wearer's AR glasses.

**Public repository:** https://github.com/ivcained/0gaze (public, verified 2026-11-07)

**Live deployment:** https://0gaze.tech/ — the product page plus the live paid API at https://0gaze.tech/generate (returns a real x402 402 quote to anyone; `curl -i https://0gaze.tech/generate`). Mirror of the page: https://ivcained.github.io/0gaze/

## Judging pitch

0Gaze is a private AI agent that can hold and spend money while the key never leaves its hardware chip and approvals render only on the wearer's AR-glasses display. The wallet key is generated inside a Dabao hardware signer (a XIAO ESP32-S3 board running xous, a small embedded OS) and never leaves the chip. Spend requests render only on the wearer's RayNeo AR glasses; in the product path the glasses run as an independent display, so no other screen shows the approval. Consent is a guided head-motion challenge drawn from a calibrated four-move vocabulary (yaw and roll; the demo sequence is look left, then look right) matched against a per-wearer calibrated motion signature, behind an arming gate that keeps motion capture closed while the wearer reads, so the instinctive nod of assent is not scored as a move. The agent thinks on 0G Private Computer inference (0G is an AI inference and storage network; sealed execution is 0G's service property, not something our method re-verifies), journals every decision as an episode (one local record per decision: timestamp, verdict, 0G request ID, settlement hash) anchored to 0G Storage, and pays per request over x402 (an open standard for machine-to-machine HTTP 402 payments) in USDT on Whitechain Sepolia through our own facilitator; every denial path (wrong motion, a stranger's head, timeout, unreachable 0G) fails closed. Five hardware-signed settlements are on the Whitechain Sepolia explorer as of 2026-11-07, including a 0.10 USDT payment approved by head gestures and signed on the chip.

## Why this is hard

- **Turning a worn 496.5 Hz IMU stream into a signature without ever capturing a nod of assent.** The segmenter integrates the gyro with per-session median-bias correction, separates deliberate 8–15° glances from ambient ~1.4 dps (degrees per second) noise, and classifies yaw vs roll against a per-wearer calibrated envelope — pitch is deliberately excluded because glasses wearers move their eyes, not their head. The arming gate keeps capture closed while the wearer reads the request (minimum card time, a measured stillness beat, then a short countdown; motion restarts it), so the instinctive "yes" nod is not scored as a move while the gate is closed; an auto-arm at 5 s opens capture regardless of stillness so a fidgeting wearer is never locked out. All of it fails closed. A guided challenge is the primary check because each sequence is bound to one spend and each move is scored against the wearer's own calibrated envelope (the design doc's earlier rejection of challenge-response assumed unbound, replayable gestures scored against a population model; per-spend binding plus per-wearer calibration answers both objections, and passive unconscious-motion scoring remains the Phase-2 upgrade path).
- **Rooting payment custody in a chip that cannot export its key.** The Dabao signs EIP-3009 typed data inside its keystore; the Mac speaks ERC-4527 CBOR (a compact binary message format for hardware-signer commands) in 64-byte USB HID reports; the relay recovers from HID wedges (stuck USB-HID states) automatically but never retries a signing request whose outcome became unknown — a retried signature can be a duplicated payment.
- **Composing four trust systems into one approval that feels atomic.** x402 negotiation, a Groth16 proof (a zk-SNARK; the pipeline is proven end-to-end off-chain today, and its intended consumer is a facilitator-side or on-chain proof check in Phase 2) over a SHA-256-committed motion window bound to a per-spend challenge (the chip also signs the witness, the private input the proof attests to), 0G Private Computer inference inside the decision loop with per-request trace IDs, and EIP-3009 settlement through our own facilitator on Whitechain Sepolia — while every dependency (0G, storage, glasses, World ID proof-of-personhood) can fail, and each failure must decline the spend rather than fake it.

## Verified evidence (re-checked 2026-11-07, method in parentheses)

| Claim | Status | Method |
|---|---|---|
| Repo public at github.com/ivcained/0gaze | Verified | GitHub API: `"private": false`, default branch `main` |
| Test suites green | Verified | Ran them: agent **38/38**, glasses **92/92**, merchant **10/10**, relay **19/19**; ZKP e2e all checks pass (real snarkjs Groth16 keygen + verify + wrong-challenge/tamper/below-threshold rejection) |
| Five chip-signed USDT settlements on Whitechain Sepolia | Verified | Explorer API: all `ok`, all `transferWithAuthorization` (EIP-3009), all from the Dabao address `0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE` to the demo merchant `0xb307D0C8Ef0FA16D728A6A7F73f3E4CCd3e7CdaB` — hashes and blocks below |
| Live 402 quote | Verified | `curl -i https://0gaze.tech/generate` → HTTP 402, `payment-required` decodes to x402 v2, scheme `exact`, `eip155:1874`, asset `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (official Whitechain USDT), 0.01 USDT |
| 0G inference with real request IDs | Verified | `agent/zerog-provider.ts` calls `router-api.0g.ai/v1/chat/completions` and records `x_0g_trace.request_id`; `data/episodes.ndjson` pairs request IDs (`28a37a4e-…`, `5a721368-…`, `6ed5058d-…`) with settlement tx hashes |
| Episode journal on 0G Storage | Verified | Root `0xaaa3cc310afb8eb4191104d2260ef943d76bb99bd5848ade564e7253920e80d2` re-downloaded from 0G testnet storage nodes via the SDK on 2026-11-07; content matches the journaled episode byte-for-byte. Six more root hashes in `data/episodes.ndjson` |
| Real RayNeo IMU at 496.5 Hz | Evidence committed | `glasses/evidence/imu-capture-stats.json` (59,633 samples / 120.09 s = 496.5 Hz, VID 0x1BBB / PID 0xAF50) and a 2,000-sample raw excerpt are committed on `main` |
| Gesture vocabulary = look left / look right / bend left / bend right | Verified | `glasses/gestures.ts` `CARDINALS`; nods are segmenter output but excluded from challenges (worn devices read eye movement, not head pitch). The vocabulary tightened during the event; earlier journal entries may still show a "down" move |
| Arming gate | Verified | `glasses/arming.ts`: card visible ≥1.2 s, then ~0.7 s measured stillness (<12 dps) + 0.7 s countdown, auto-arm at 5 s so a fidgeting wearer is never locked out; any motion restarts the countdown |
| Denial paths fail closed | Verified | `data/episodes.ndjson` records real refusals: `wrong_direction_after_3_attempts`, `not_your_motion_after_5_attempts`, `wearer_timeout`, `glasses_unavailable`, `glasses_motion_mismatch` — none signed |
| Three-tier spend rule | Verified | `agent/tiers.ts`: auto below $0.05, motion gate $0.05–$25, World ID above $25 |
| World ID path exists and fails closed | Path verified (proofs mocked) | `agent/worldid.ts` verifies at `developer.world.org/api/v4/verify/{rp_id}`; unconfigured → denied, never approved |

## Event window and honest build timeline

Hacking began **Thursday Nov 5, 2026, 21:00 IST** (opening ceremony 20:00, per https://ethglobal.com/events/mumbai). The repository history is exactly what happened, and we state the split plainly:

### Before kickoff (Nov 4–5 daytime, bench preparation)

Dabao board bring-up and flashing, the USB-HID relay, the Whitechain merchant/facilitator and EIP-3009 verification, the agent loop skeleton, the 0G inference provider, and the first Groth16 circuit. This is plumbing and hardware bring-up; none of the product's approval experience existed yet.

### During the hackathon (Nov 5 21:00 onward)

The entire product differentiator —
- the real RayNeo glasses IMU bridge (496.5 Hz measured, evidence committed under `glasses/evidence/`),
- the gesture segmenter, per-wearer motion signature, and challenge derivation,
- the arming gate that makes the nod-of-assent unscoreable,
- the fullscreen see-through approval UI on the glasses display,
- the guided head-motion challenge wired end-to-end into the agent's spend gate,
- the real-chip guided-approval settlement and the 0G Storage episode uploads,
- the relay's automatic HID recovery.

Nothing has been backdated, squashed, or re-timestamped. If the team's track placement needs a ruling, we will state this same split to the organizers.

## Use of AI tools (required disclosure)

Development was heavily AI-assisted, driven by Hermes Agent (Nous Research). The specification, design documents, adversarial review reports, and delegation briefs that shaped the build are committed in this repository: `concepts_brief.md`, `docs/designs/0gaze.md`, `goldfish_review_report.md`, and `research/`. All on-chain work follows the [ethskills production checklist](https://ethskills.com/SKILL.md).

## Submission requirements

| Requirement | Status | Evidence / next step |
|---|---|---|
| Public GitHub repository | Done | https://github.com/ivcained/0gaze (GitHub API: public) |
| Frequent public commits | Done and ongoing | Continuous history; every verified change pushed |
| Live deployment accessible publicly | Done | https://0gaze.tech/ — product page + live 402 paid API (`curl -i https://0gaze.tech/generate`) |
| Demo video on ETHGlobal.com | **Pending — record morning of 2026-11-07** | 2–4 min, ≥720p, narration, no music; script below (2:45) |
| Completed submission form | **Pending** | Fill early on the Hacker Dashboard; edit until deadline |

## Sponsor submissions

### 1. 0G — Physical AI: Agents with a Body ($5,000; best-real-hardware lane)

A wearable whose decisions run on 0G: the RayNeo glasses are the body, the agent calls 0G Private Computer inside the decision loop, and the record lives on 0G Storage.

- **0G call inside the decision loop, with request IDs:** `agent/zerog-provider.ts` (no mock in this path); `data/episodes.ndjson` pairs 0G request IDs with settlement tx hashes (`28a37a4e-…` ↔ `0x23c2…d376`; `6ed5058d-…` ↔ `0xeabe0a…8441`).
- **Episode log on 0G Storage:** root `0xaaa3cc310afb8eb4191104d2260ef943d76bb99bd5848ade564e7253920e80d2` — re-downloaded from 0G testnet storage nodes on 2026-11-07 and byte-identical to the journaled episode; six further root hashes in the journal.
- **Safe-stop, never faked:** when 0G is unreachable the provider throws after bounded retries and the loop records an error episode instead of spending (`agent/zerog-provider.ts`, `agent/loop.ts`); the storage side degrades to local journaling (`agent/episode-log.ts`). The "full agent loop with safe-stop" settlement below is the on-chain record of that path.
- **Live hardware demo** at the booth; this is a real-hardware build, not a simulation.

### 2. Whitechain — Scale: Payments Nobody Notices ($3,000)

The track brief calls out exactly this shape: *"pay-per-request APIs where an AI agent pays a business in USDT over x402, settled on Whitechain through a facilitator you run."* That is the architecture verbatim.

- **Zero visible crypto steps for the payer:** the chip signs an EIP-3009 `transferWithAuthorization`; our facilitator (`merchant/facilitator/`) verifies it and pays the gas. The wearer never holds WBT (Whitechain's native gas token), never sees a chain name — the glasses card says "0.10 USDT → 0G inference".
- **Official USDT** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on Whitechain Sepolia (chain ID 1874): five chip-signed settlements, explorer links below, plus a live 402 quote at https://0gaze.tech/generate that anyone can curl.
- **Why onchain stablecoin settlement (required by the track; this line also lives in the repo README):** a card rail cannot give an autonomous agent a hardware-rooted, per-request, human-presence-gated spend with no stored credentials and no checkout session — here the authorization *is* the settlement (EIP-3009), so the agent's spending power is exactly as revocable as physical access to the wearer's glasses and chip.
- **Still to close:** the deployed-contract ruling risk (see "What we could not verify", Whitechain requirement).

### 3. World — World ID Agent Pass (open track, $5,000)

A meaningful human-identity action, not a bolted-on login: World ID fires only above the $25 cap — the moment a spend stops being demo-scale.

- **Complete journey implemented:** the agent signs each approval request as the relying party (`signApprovalForWorldId` binds action + nonce + expiry), the proof returned by the World App is verified server-side at `developer.world.org/api/v4/verify/{rp_id}`, and only a verified result unlocks the spend (`agent/worldid.ts`, `agent/gate.ts`).
- **Denied path:** `worldid_denied`, `worldid_expired`, and `not_configured` all fail closed; covered by `agent/gate.test.ts`.
- **Disclosure:** proofs are mocked, exactly as the hackathon permits ("We are mocking proofs now"); the verification path is real code and refuses to approve without RP credentials.
- **Required integration debrief:** done — `docs/WORLDID-DEBRIEF.md` (time to first success, friction, docs gaps).

## Live proof transactions

All five are EIP-3009 `transferWithAuthorization` settlements in official Whitechain USDT, paid **from the Dabao chip address** `0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE` to the demo merchant; all re-verified `ok` on the explorer on 2026-11-07.

- First hardware-signed x402 payment (0.01 USDT, block 12,263,228): https://explorer.testnet.whitechain.io/tx/0xc765630294e801e2c1cf80efa4dfd9a1206b6533a5976969a01ff71190d690ca
- Real 0G inference paid by the chip (0.01 USDT, block 12,276,593): https://explorer.testnet.whitechain.io/tx/0x2cb94dd11edcb3c2ee11c7e304e974bfa847de99a24c911901089d3379266e2e
- Full agent loop with safe-stop (0.01 USDT, block 12,277,048): https://explorer.testnet.whitechain.io/tx/0x23c28fd3557b1125f705c4499218327b9d894e715ac4d8e4ba8bdb7eee29d376
- Passive motion-window approval, signed on the chip (0.10 USDT, block 12,353,236): https://explorer.testnet.whitechain.io/tx/0xa2697a7200c12e5404169a6b5418578cf79366588dc86d0c787e3278bb618e1c
- **Guided head-motion approval, signed on the chip** — the demo centerpiece (0.10 USDT, block 12,364,563): https://explorer.testnet.whitechain.io/tx/0xeabe0a76a36746477e763c004ca8d8f78e3fe62e31651d6413848a3eab6a8441

## Demo video script (target 2:45, record morning of 2026-11-07)

*Working notes: this shot list and the pre-submit checklist at the bottom are team-internal material kept in the submission for transparency; the judged artifacts are the pitch, evidence, and sponsor sections above.*

Staging: `bash scripts/demo-video.sh --extended` (preflights the Dabao, relay, glasses bridge, merchant at 0.10 USDT, and the glasses UI). **`--extended` is mandatory for the take:** it un-mirrors the glasses so the approval UI renders on the glasses display only and the Mac capture never shows it, which is what makes the Shot 2 narration literally true. Record both surfaces separately (glasses display via `screencapture -D <glasses index>`, Mac screen for the agent terminal) and cut side-by-side. Demo challenge sequence is fixed at **look left → bend left → look right** (fixed for narratability; production challenges are derived per spend). Narration only, no music; capture 1920×1080 (1280×720 minimum).

**Shot 1 — 0:00–0:18 (18 s) — Problem.**
Visual: black title card ("0Gaze"), then the repo page, then 0gaze.tech.
Narration: "Agents are starting to spend money, and every custody option leaks — keys on servers, popups on phones. 0Gaze gives an agent a wallet whose key is born inside a hardware chip, and whose approval lives inside your glasses."

**Shot 2 — 0:18–1:00 (42 s) — The glasses approval, live.**
Visual: record the glasses display directly (`screencapture -D <glasses index>`; the index comes from `scripts/glasses-display info`), with the Mac screen recorded separately as the agent-side view. The agent requests 0.10 USDT for 0G inference; the card renders on the glasses and on nothing else. The "hold still" arming beat runs — capture is closed while the wearer reads, so a nod right now scores nothing. Stillness confirmed, the countdown arms capture, and the wearer performs the guided sequence: look left, look right — the ring fills per move, then "Signed — 0.10 USDT → 0G inference". No phone anywhere in frame.
Narration: "A payment request appears only in the glasses. Nothing is captured while I read it — the arming gate waits for a still head, and if I fidget it arms itself after five seconds so I can never be locked out. The vocabulary is four moves: look left, look right, bend left, bend right — no nods, because a worn device reads your eyes, not your neck pitch. Each move is matched against my calibrated signature. Left, right — signed. No phone, no seed phrase, no second screen."

**Shot 3 — 1:00–1:28 (28 s) — The hardware trust.**
Visual: terminal — the agent log shows the challenge verdict and the Dabao address; the relay forwards the signing frames; then the Whitechain explorer with the confirmed settlement.
Narration: "The EIP-3009 authorization is signed on the chip over USB HID — the key never touches this Mac. Our facilitator verifies the signature and settles on Whitechain Sepolia, paying the gas. This exact flow already settled onchain — and this payment appears on the public page within seconds."

**Shot 4 — 1:28–1:52 (24 s) — The denial path.**
Visual: rerun the challenge with deliberately wrong moves → "not your motion" → Declined; then let it time out → Declined; show the refusal lines in the episode log.
Narration: "Wrong moves, a stranger's head, or no answer at all — every path fails closed. Nothing is signed, and the refusal itself is journaled. Fail-closed is the product."

**Shot 5 — 1:52–2:20 (28 s) — 0G and the zero-knowledge layer.**
Visual: episode log with the 0G request ID and provider identity; the 0G Storage root hash downloading from 0G nodes; the ZKP end-to-end run (proof verifies; wrong challenge rejected; tampered signals rejected); one line on safe-stop.
Narration: "Every decision carries a real 0G request ID and is journaled to 0G Storage — this root hash downloads from 0G nodes today. A Groth16 proof binds the motion window to each spend challenge without exposing the biometrics. And if 0G goes dark, the agent safe-stops instead of faking a decision."

**Shot 6 — 2:20–2:45 (25 s) — Close.**
Visual: the three-tier rule as text (auto under $0.05 · head-motion gate to $25 · World ID above), then links: github.com/ivcained/0gaze, 0gaze.tech, the explorer.
Narration: "Under five cents, the agent pays and logs. Above that, your head is the signature. Above twenty-five dollars, World ID. The motion gate is calibrated per wearer and still being tuned — that honesty is the point: the key, the approval, and the evidence all belong to the wearer."

## Roadmap: on-device policy reasoning (Needle on the signer)

The Dabao already proves the key never leaves the chip. Phase 2 puts *judgment*
on the chip too, using [Needle 2](https://huggingface.co/Cactus-Compute/needle2)
from Cactus Compute: a 45M-parameter tool-calling model (CQ2-bit quant, a
single ~14 MB binary, schema-constrained JSON out) that the model card reports
running on ESP32-S3-class microcontrollers (~11 MB session RAM reported by
community ports; 300–700 tok/s on budget phones).

The fit for 0Gaze is exact: before signing an EIP-3009 authorization, the
signer itself evaluates the spend against the wearer's stated policy
(per-merchant limits, purpose, cadence). Text-in, JSON-out tool calling is
Needle's native shape, and its confidence design (a call is accepted only when
the calibrated confidence head clears a threshold) means the failure mode is
*escalation, not wrong execution*: an uncertain policy check falls through to
the glasses head-gesture challenge instead of signing.

Honest hardware gap: the current Dabao is a XIAO ESP32-S3 with 8 MB flash, so
the stock ~14 MB binary does not fit this exact board. Phase-2 paths, in
order of preference: (1) an N16R8-class S3 signer board (same family,
xous-compatible, ~$7), (2) a pruned/finer quant of Needle under ~6 MB,
(3) external SPI flash. Gesture biometrics deliberately stay on the
per-wearer calibrated classifier: pretrained language weights are the wrong
modality for 496 Hz gyro windows and cannot provide per-wearer binding, which
is what the enrollment reps capture in minutes.

## What we could not verify (stated plainly)

- **Dabao signing itself.** The relay suite (19/19) passes and the five on-chain signatures are consistent with chip signing, but this audit ran without the board attached; the nightly re-verification needs the hardware.
- **The glasses-on-face approval UX.** The UI, state machine, and glasses-display pipeline exist and are tested (92/92), but there is no compiled Unity APK using Ffalcon (RayNeo's Unity SDK for glasses apps) — the `app/` project's Ffalcon SDK import is incomplete, so no scene builds. The bench demo runs the browser approval UI on the glasses' own display through the Mac bridge: in extended-display mode (`scripts/demo-video.sh --extended`) the UI renders on the glasses display only, with no native glasses-side app.
- **The 0.10 USDT settlement `0x5de81f9b…83d4`** (block 12,360,330) is real but was paid from a bench key (`0x01ba…44Ba`), not the chip — it is deliberately **not** cited as a hardware-signed proof.
- **Needle 2 figures** (~14 MB binary, ~11 MB S3 RAM, 300–700 tok/s) are the model card's and community reports', not our measurements.
- **The "ciphertext on 0G Storage" invariant is not yet true.** Today's journal uploads are plaintext episode metadata (request IDs, hashes, verdicts) — no raw IMU windows or biometric data ever leave the Mac. Encrypted profile blobs remain design-stage.
- **Whitechain's "contracts deployed and verified" requirement.** We deploy no custom contract; settlement runs through the official USDT token and our off-chain facilitator. If judges read the requirement strictly, we need a ruling or a small deployed contract.
- **Demo video and submission form** remain pending until tonight (hard requirements).

## Final pre-submit checks

*Working notes (team-internal; see the note under the video script).*

- [ ] Public page loads signed-out and every transaction link resolves
- [x] **Redeploy https://0gaze.tech/ from current `main`** — verified 2026-11-07 06:10 IST: page serves the current brand design with all five proofs and zero EyesOnly mentions; the live 402 payload carries `"resource":"0gaze://generate"` (x402 v2, eip155:1874, official USDT, 0.01); VPS merchant source is checksum-identical to local `main` (server.ts, facilitator/*, Dockerfile) and the container was rebuilt 03:56 IST
- [x] Write `WHITECHAIN_FEEDBACK.md` (hard requirement for all Whitechain tracks) — done: `docs/WHITECHAIN_FEEDBACK.md`
- [x] Write the World ID integration debrief (required by both Agent Pass tracks) — done: `docs/WORLDID-DEBRIEF.md`
- [ ] Video uploaded to ETHGlobal.com, plays with audible narration (verify with `ffprobe`: 120–240 s, height ≥720, audio stream present)
- [ ] Submission form saved early on the Hacker Dashboard
- [ ] Sponsor tracks selected: 0G Physical AI, Whitechain Scale, World ID Agent Pass
- [ ] Ask organizers (Discord / hello@ethglobal.com) for a track ruling on the pre-kickoff bench work, citing the timeline above
