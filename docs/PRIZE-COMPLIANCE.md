# Prize-track compliance audit — 2026-11-07 08:45 IST

Every qualification line from the three sponsor pages, checked against the
repo and live services. Status: MET / GAP (with the fix) / ⏳ (needs the video).

## 0G — Physical AI: Agents with a Body ($5,000)

| Requirement | Status | Evidence |
|---|---|---|
| 0G call inside the decision loop | MET | `agent/zerog-provider.ts` — every take calls router-api.0g.ai in the loop; request IDs journaled (e.g. `6ed5058d…` ↔ tx `0xeabe0a…8441`) |
| Episode log on 0G Storage, request id per decision | MET | `agent/episode-log.ts`; root `0xaaa3cc31…80d2` re-downloaded from 0G testnet nodes 2026-11-07, byte-identical |
| Replayable simulation OR live hardware demo | MET | Live hardware: real RayNeo IMU (496.5 Hz measured) + real Dabao chip; booth demo capable. Plus offline replay tooling (`glasses/corpus/replay-take.ts`) |
| Safe-stop if 0G unreachable; NO faked decisions | MET | Provider retries 3×, then throws; loop journals an error episode and signs nothing. On-chain record: `0x23c28f…d376` |
| Not-wanted: chatbot w/ avatar, pre-recorded motion, 0G only for logs | MET | None apply: live IMU, 0G is the decision model, motion is real-time |
| Personal-device lane fit ("alternative to Meta's Muse, on glasses, memory on 0G Storage, sealed inference") | MET | Exact match — this is the product |
| Submission: repo + README w/ setup | MET | README Setup section added 2026-11-07 |
| Demo video < 3 min | ⏳ | Script is 2:50 (`docs/VIDEO-SCRIPT.md`); record today |
| Live demo link | MET | https://0gaze.tech (+ live 402 at /generate) |
| Contract addresses (if any) | MET (N/A) | None deployed — disclosed in README limitations |
| Team names + Telegram/X contact | ⏳ | User fills in the submission form |
| iAI bonus (0G-account sign-in spending daily credits) | NOT PURSUED | Out of scope for the event window |

## Whitechain — Scale: Payments Nobody Notices ($3,000)

| Requirement | Status | Evidence |
|---|---|---|
| Payer flow with zero visible crypto steps | MET | Chip signs EIP-3009; facilitator pays gas; wearer sees "0.10 USDT → 0G inference" only |
| How business pays gas / relayer gets WBT / drain protection | MET | `merchant/facilitator/README.md` — faucet-funded key, quote-bounded amounts, nonce+expiry replay protection (expanded 2026-11-07) |
| ≥1 USDT payment settled in main flow + explorer link IN README | MET | README "Settlements on Whitechain Sepolia": chip address + `0xeabe0a…8441` (motion-approved 0.10 USDT) + `0xc76563…90ca` |
| Why-onchain line in README | MET | README line 7 (card rail cannot do hardware-rooted per-request human-presence-gated spends) |
| Steady repo progress, not one big upload | MET | 68 commits Nov 4–7, spread across all days/hours |
| README: setup, architecture, limitations | MET | Setup + Current limitations sections added 2026-11-07 |
| WHITECHAIN_FEEDBACK.md | MET | In repo since `04887c5`; includes the pull-payments-cookbook offer |
| Video 2–4 min showing EACH PARTY | ⏳ | 2:50 script; Shot 3 shows the merchant side (curl the public 402 / 0gaze.tech) — the payer (agent+wearer) and merchant both appear |
| Contracts deployed + verified on explorer | GAP — disclosed | No custom contract: EIP-3009 pull payments run through the official USDT token + off-chain facilitator. Disclosed in README limitations and the feedback doc rather than deploying a token-gate contract to check a box. Judge risk acknowledged; the pattern is the track's own recommended idea ("pay per request APIs … settled through a facilitator you run") |
| Won't-place check: payer signs a gas tx / AI chat that never pays | MET | Payer signs a gasless authorization; the AI literally pays per request (five+ settlements) |

## World — World ID Agent Pass ($5,000)

| Requirement | Status | Evidence |
|---|---|---|
| Integrate official World ID Agent Pass | MET | `agent/worldid.ts` — RP-signed approval requests (action+nonce+5-min expiry), server-side v4 verify (developer.world.org/api/v4/verify/{rp_id}), nullifier extraction |
| Complete journey: request → completion → validated result → protected action | MET (code+tests) | `agent/gate.ts` wires verify → spend unlock; event itself runs mocked proofs ("you don't need sandbox app anymore"), and our mock path is disclosed in the debrief |
| Denied / expired / cancelled path, action does not occur | MET | `agent/gate.test.ts`: worldid_denied, worldid_expired, not_configured → spend blocked, fail closed |
| Validate in secure backend; no exposed secrets | MET | Verification server-side; RP key from env; never in repo or client |
| Integration debrief (time-to-first-success, friction, missing docs, one improvement) | MET | `docs/WORLDID-DEBRIEF.md` — includes the device-code pairing suggestion for wearables |
| Meaningful action needing human identity (not a login screen) | MET | World ID gates spends above $25 — the escalation tier of the spend ladder |

## Global submission items

| Item | Status |
|---|---|
| Project name + short description | MET (`docs/SUBMISSION-FORM-ANSWERS.md`) |
| Public GitHub repo, README + setup | MET (github.com/ivcained/0gaze) |
| Demo video < 3 min | ⏳ record today — script + teleprompter ready in the control panel |
| Live demo link | MET (https://0gaze.tech) |
| Contract addresses (if any) | MET (none; disclosed) |
| Team names + Telegram/X | ⏳ user fills the form |
| Sponsor 3-question answers (how/links/feedback) | MET (`docs/SPONSOR-QUESTIONS.md`) |

## Remaining actions (deadline order)

1. **Record the video** (only big ⏳): control panel → glasses OFF → red flash → ON → ✓ → auto-start → look left → settled → explorer tab opens. Keep under 3:00 for 0G (Whitechain allows 2–4).
2. In the video, **show the merchant side once** (Shot 3: `curl -i https://0gaze.tech/generate` or the site) — Whitechain's "each party" line.
3. Optional 3-second cutaway: `cd agent && npm test` passing — visual evidence for the World denied-path requirement.
4. **Fill team contact (Telegram + X) in the submission form** — user only.
