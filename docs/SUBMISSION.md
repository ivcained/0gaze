# ETHGlobal Mumbai 2026 submission

## Project

**Name:** 0Gaze

**One-line pitch:** A private AI agent that thinks on 0G, pays through a Dabao hardware signer with x402, and takes its spend approvals through guided head-motion challenges shown only inside the wearer's AR glasses.

**Public repository:** https://github.com/ivcained/0gaze

**Live deployment:** https://0gaze.tech/ — the product page plus the live paid API at https://0gaze.tech/generate (returns a real x402 402 quote to anyone; `curl -i https://0gaze.tech/generate`). Mirror of the page: https://ivcained.github.io/0gaze/

## Event window and honest build timeline

Hacking began **Thursday Nov 5, 2026, 21:00 IST** (opening ceremony 20:00, per https://ethglobal.com/events/mumbai). The repository history is exactly what happened, and we state the split plainly:

**Before kickoff (Nov 4–5 daytime, bench preparation):** Dabao board bring-up and flashing, the USB-HID relay, the Whitechain merchant/facilitator and EIP-3009 verification, the agent loop skeleton, the 0G inference provider, and the first Groth16 circuit. This is plumbing and hardware bring-up; none of the product's approval experience existed yet.

**During the hackathon (Nov 5 21:00 onward):** the entire product differentiator —
- the real RayNeo glasses IMU bridge (496.5 Hz measured, evidence committed under `glasses/evidence/`),
- the gesture segmenter, per-wearer motion signature, and challenge derivation,
- the arming gate that makes the nod-of-assent unscoreable,
- the fullscreen see-through approval UI on the glasses display,
- the guided head-motion challenge wired end-to-end into the agent's spend gate,
- the real-chip guided-approval settlement and the 0G Storage episode uploads,
- the relay's automatic HID recovery.

Nothing has been backdated, squashed, or re-timestamped. If the team's track placement needs a ruling, we will state this same split to the organizers.

## Use of AI tools (required disclosure)

Development was heavily AI-assisted, driven by Hermes Agent (Nous Research). The specification, design documents, adversarial review reports, and delegation briefs that shaped the build are committed in this repository: `concepts_brief.md`, `docs/designs/0gaze.md`, `goldfish_review_report.md`, and `research/`. All on-chain work follows the ethskills production checklist.

## Submission requirements

| Requirement | Status | Evidence / next step |
|---|---|---|
| Public GitHub repository | Done | https://github.com/ivcained/0gaze |
| Frequent public commits | Done and ongoing | Continuous history; every verified change pushed |
| Live deployment accessible publicly | Done | https://0gaze.tech/ — product page + live 402 paid API (`curl -i https://0gaze.tech/generate`) |
| Demo video on ETHGlobal.com | **Pending — record tonight** | 2–4 min, ≥720p, narration, no music; script below |
| Completed submission form | **Pending** | Fill early on the Hacker Dashboard; edit until deadline |

## Sponsor submissions

1. **0G Physical AI** — real sealed inference inside the decision loop, per-request trace IDs, episode journal pinned to 0G Storage (root `0xaaa3cc310afb8eb4191104d2260ef943d76bb99bd5848ade564e7253920e80d2`), and local safe-stop.
2. **World ID Agent Pass** — above-cap identity gate and the denied path. Proofs are explicitly mocked where the hackathon requires it.
3. **Whitechain Scale** — hardware-signed EIP-3009 USDT payments settling through our facilitator on Whitechain Sepolia.

## Live proof transactions

- First hardware-signed x402 payment: https://explorer.testnet.whitechain.io/tx/0xc765630294e801e2c1cf80efa4dfd9a1206b6533a5976969a01ff71190d690ca
- Real 0G inference paid by the chip: https://explorer.testnet.whitechain.io/tx/0x2cb94dd11edcb3c2ee11c7e304e974bfa847de99a24c911901089d3379266e2e
- Full agent loop with safe-stop: https://explorer.testnet.whitechain.io/tx/0x23c28fd3557b1125f705c4499218327b9d894e715ac4d8e4ba8bdb7eee29d376
- **Guided head-motion approval, signed on the chip** (the demo centerpiece): https://explorer.testnet.whitechain.io/tx/0xeabe0a76a36746477e763c004ca8d8f78e3fe62e31651d6413848a3eab6a8441

## Demo video script (target 2:45, record tonight)

1. **0:00–0:20 — Problem.** An agent that thinks and spends needs a key. Seed phrases and phone popups are the wrong shape for someone wearing the future.
2. **0:20–0:50 — The glasses moment (screen-record the 1470×956 mirror).** A payment request appears on the glasses: 0.10 USDT for 0G inference. The wearer performs the guided head sequence — look down, look left, look right — the ring fills, the check lands: Signed. No phone anywhere in frame.
3. **0:50–1:20 — The hardware trust.** Same flow from the terminal: the Dabao chip address, the challenge verdict, the settlement receipt on the Whitechain explorer (tx above).
4. **1:20–1:50 — The denial path.** Wrong motion three times: Declined, nothing signed. Stay-still timeout: nothing signed. Fail-closed is the product.
5. **1:50–2:15 — ZKP + 0G.** Real Groth16 proof verifying, the Dabao witness binding, and the episode journal root on 0G Storage.
6. **2:15–2:45 — Close.** Three-tier spend rule, roadmap in one line (signed Mac app with a 2-of-3 Safe vault and recovery key), repo and live page links.

Record narration only, no music. Capture at least 1280×720; 1920×1080 preferred.

## Final pre-submit checks

- [ ] Public page loads signed-out and every transaction link resolves
- [ ] Video uploaded to ETHGlobal.com, plays with audible narration
- [ ] Submission form saved early on the Hacker Dashboard
- [ ] Sponsor tracks selected: 0G Physical AI, World ID Agent Pass, Whitechain Scale
- [ ] Ask organizers (Discord / hello@ethglobal.com) for a track ruling on the pre-kickoff bench work, citing the timeline above
