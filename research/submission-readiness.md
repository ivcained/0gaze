# 0Gaze — ETHGlobal Submission Readiness Audit

**Auditor stance:** adversarial. Default verdict NEEDS WORK; nothing accepted on the strength of a document claim.
**Date:** 2026-11-06 · **Repo:** /Users/lc/Projects/0gaze @ `7de314e` (main) · **Remote:** https://github.com/ivcained/0gaze
**Method:** every item below was checked with a command or URL on this machine. Anything not checkable is marked UNVERIFIED, not assumed.

---

## 1. What I verified with real execution

### Test suites (run by me, not taken on trust)

| Suite | Command | Result |
|---|---|---|
| agent | `cd agent && npm test` | **29/29 passed** (4 files: tiers, cbor, gate, agent-server), vitest 3.2.7 |
| glasses | `cd glasses && npm test` | **29/29 passed locally** (motion 11, gestures 18) — see MAJOR-1: 18 of these tests live in untracked files |
| merchant | `cd merchant && npm test` | **10/10 passed**, vitest 5.1.0 |
| relay | `cd relay && ~/dabao-venv312/bin/python -m pytest -q` | **16/16 passed** |
| zkp | `cd zkp/prover && node scripts/setup-dev.mjs && node scripts/e2e-test.mjs` | **All checks passed**: real Groth16 keygen (snarkjs, protocol confirmed `groth16`), real proof generated with 4 public signals, valid proof verifies, wrong-challenge rejected, tampered publicSignals rejected, below-threshold window unprovable (the `ERROR: 4 Error in template` line is the expected constraint failure for the negative test) |

### Repository and authorship

- `git remote -v` → `https://github.com/ivcained/0gaze.git`; `curl -sI https://github.com/ivcained/0gaze` → **HTTP 200**, GitHub API confirms `"private": false`. **Public repo: verified.**
- Last 30 commits all authored `ivcained <86070833+ivcained@users.noreply.github.com>`; GitHub API confirms user id 86070833 = `ivcained`. **Authorship: verified**, no local-user commits.
- `git rev-parse HEAD` == `git ls-remote origin main` == `7de314e1c6ae…`. Remote main is in sync with local HEAD commit.
- Remote README fetched over raw.githubusercontent.com is byte-identical to local README (`diff` clean). **Rendered content matches local tree for tracked files.**

### On-chain claims

All three proof transactions in docs/SUBMISSION.md resolve on the Whitechain Sepolia explorer API (`/api/v2/transactions/<hash>`):

- `0xc765…90ca` → status `ok`, method `transferWithAuthorization`, 2026-11-05T06:19:56Z
- `0x2cb9…66e2` → status `ok`, method `transferWithAuthorization`, 2026-11-05T10:02:41Z
- `0x23c2…d376` → status `ok`, method `transferWithAuthorization`, 2026-11-05T10:10:16Z

`transferWithAuthorization` is the EIP-3009 USDT settle path. **Real settled transactions: verified.** These are testnet USDT on Sepolia, which the README correctly frames as the burner model.

### 0G inference

- `agent/zerog-provider.ts` calls the real `router-api.0g.ai/v1/chat/completions` and extracts `x_0g_trace.request_id` / `provider_identity` / billing. No mock in this path.
- `data/episodes.ndjson` contains a real episode with `requestId: "28a37a4e-…"`, `providerIdentity: "anonymous2"`, `costUsdMicro`, and txHash `0x23c2…d376` matching the explorer. **Real 0G request IDs: verified in the log.**

### IMU / glasses

- `glasses/capture.ts` implements a real TCP bridge capture path plus NDJSON replay; `glasses/imubridge.cpp` is a real RayNeo SDK bridge (VID 0x1BBB).
- However: the glasses tests run on a **synthetic generator** ("mimics measured hardware: 496 Hz ticks" — gestures.test.ts). No recorded hardware NDJSON exists in the repo (`find . -name '*.ndjson'` returns only `data/episodes.ndjson`). The 496 Hz figure rests on a code comment ("The bridge measured 496.5 Hz"). Episode log from 2026-11-06 shows `approval.reason: "glasses_unavailable"`. **Real-hardware IMU capture at 496 Hz: UNVERIFIED from repo evidence** — plausible, honestly structured, but not provable by a judge from what's committed.

### Live deployment

- `https://ivcained.github.io/0gaze/` → **HTTP 200, loads publicly** (verified via curl and content extraction). Content matches `site/` and links the real explorer txs. Deployed by `.github/workflows/pages.yml` on every main push.
- It is a **static, read-only proof/landing page**. No running agent, merchant, or approval flow is publicly reachable.

### World ID honesty

Design doc (line 67, 121) and SUBMISSION.md state plainly that World ID proofs are mocked for the hackathon. This is disclosed, not hidden. Good.

---

## 2. Findings against the four finalist requirements

### Req 1 — Live deployment: **AT RISK (MAJOR-2)**
A public URL exists and loads. But it is a static proof page, not the deployed product. The requirement's wording ("Not a link to a demo video, a GitHub repository, or slides") exists to filter out exactly this kind of artifact if a judge reads it strictly. For a hardware product a fully interactive deployment is impossible, but nothing runnable is public.

### Req 2 — Demo video on ETHGlobal.com: **BLOCKER-1**
SUBMISSION.md itself lists this "Pending". No video file exists in the repo. ETHGlobal.com upload cannot be checked externally → UNVERIFIED, and by the project's own checklist, not done.

### Req 3 — Completed submission form: **BLOCKER-2**
SUBMISSION.md lists this "Pending". Not externally verifiable → UNVERIFIED, self-declared incomplete.

### Req 4 — Public GitHub repo: **MET, with MAJOR-1**
Public, reachable, correct authorship, real reviewable code. But the public tree is stale relative to local work (below).

---

## 3. Gap list

### BLOCKER

**BLOCKER-1 — No demo video (Req 2).** Hard requirement; currently pending.
- *Close:* Record per the SUBMISSION.md outline (2:45 target, narration only, no music), capture ≥1280×720, verify with `ffprobe` (duration 120–240 s, height ≥720, audio stream present), upload to ETHGlobal.com, play it back signed-out.
- *Estimate:* 3–4 h.

**BLOCKER-2 — Submission form not completed (Req 3).** Hard requirement; pending per the project's own checklist.
- *Close:* Fill every field on ETHGlobal.com (links, description, sponsor tracks: 0G Physical AI, World ID Agent Pass, Whitechain Scale), save early, screenshot the confirmation.
- *Estimate:* 1 h.

### MAJOR

**MAJOR-1 — Public repo does not match the working tree.** `git status` shows `glasses/gestures.ts`, `glasses/gestures.test.ts`, `glasses/signature.ts` **untracked** and `zkp/prover/scripts/demo-chip.mjs` **modified, uncommitted**. Confirmed via raw.githubusercontent.com: both new files return 404 on `main`. Consequence: a judge cloning the public repo gets an 11-test glasses suite, not the 29 that pass locally, and the gesture/signature code the demo leans on is invisible to manual review.
- *Close:* `git add glasses/gestures.ts glasses/gestures.test.ts glasses/signature.ts zkp/prover/scripts/demo-chip.mjs && git commit && git push`.
- *Estimate:* 0.25 h. (Cheapest gap, highest leverage — do it first.)

**MAJOR-2 — Live deployment is a static proof page, not the product (Req 1 strict reading).** Verified live and public, but nothing is runnable by a judge.
- *Close (minimum):* Deploy the merchant demo API to a public host (the VPS) so `GET /generate` returns a real 402 quote to anyone; link it from the proof page with a curl one-liner judges can run. *Stretch:* hosted agent-loop replay endpoint showing a logged episode with its requestId and txHash.
- *Estimate:* 3–6 h.

**MAJOR-3 — The headline UX (glasses-only approval) has no buildable artifact.** Unity is not installed on this machine (`/Applications` has no Unity); no APK exists anywhere in the repo (`find -iname '*.apk'` empty); the app README says the Ffalcon XR SDK is not yet imported and the app runs on the `Input.gyro` bench fallback; `app/android-imu` (the Kotlin IMU service) has never been compiled — UNVERIFIED that it builds at all. Video segment 2 and the entire "approval renders only in the glasses" claim currently rest on code judges cannot run.
- *Close:* Install Unity Hub + 2022.3 LTS, open `app/`, build an Android APK (bench fallback acceptable if labeled), screen-record the approval card flow; separately run `gradle build` in `app/android-imu` to prove compilation. Label fallback vs. real-SDK paths in the video honestly.
- *Estimate:* 4–8 h (Unity install and Android SDK setup dominate).

**MAJOR-4 — "Real RayNeo IMU at 496 Hz" is not provable from the repo.** Tests use synthetic samples; no hardware capture is committed; the latest episode fell back with `glasses_unavailable`.
- *Close:* Capture a real window via the bridge (`capture.ts --tcp`), commit the NDJSON plus the measured sample-rate output, and point the glasses README at the file.
- *Estimate:* 1 h (hardware on hand).

### MINOR

**MINOR-1 — 0G Storage write failed in the real run.** Episode log shows `storageError: insufficient funds`. "0G Storage holds ciphertext" is claimed as an invariant but the logged run couldn't persist.
- *Close:* Top up the 0G storage balance, rerun the loop, commit the successful episode line.
- *Estimate:* 0.5 h.

**MINOR-2 — Hardware naming inconsistency.** gestures.test.ts comment says "Air 3S Pro"; app README and android-imu say "Air 4 Pro". Judges read closely.
- *Close:* One line clarifying both models share VID/PID (glasses README already implies this).
- *Estimate:* 0.1 h.

**MINOR-3 — Dev powers-of-tau for the Groth16 setup.** `setup-dev.mjs` generates a local ceremony — correct for a hackathon, but state it in the zkp README so no judge thinks a production trusted setup is claimed.
- *Close:* One sentence in `zkp/README.md`.
- *Estimate:* 0.1 h.

---

## 4. Honesty assessment of load-bearing claims

| Claim | Verdict |
|---|---|
| Groth16 proof really verifies | **TRUE** — ran the prover; real snarkjs Groth16, tamper/wrong-challenge rejection verified |
| Real x402 settlement on chain | **TRUE** — 3 txs verified on explorer, all `ok`, all EIP-3009 `transferWithAuthorization` |
| 0G inference with real request IDs | **TRUE** — real API client + real requestId/providerIdentity in committed episode log |
| Real RayNeo IMU at 496 Hz | **UNVERIFIED** — code path is real, tests are synthetic, no hardware capture committed |
| Dabao signs over USB HID | **UNVERIFIED in this audit** — relay suite (16/16) passes and tx signatures exist onchain, but I have no Dabao attached; the on-chain signatures are consistent with the claim |
| Three-tier spend gate | **TRUE (logic)** — gate.test.ts 9/9 including denial paths |
| Glasses-only approval UI | **UNVERIFIED** — no APK, Unity absent, bench fallback only |
| World ID gate | **MOCKED, disclosed honestly** in design doc and SUBMISSION.md |

No claim in the docs was found to be false. The disclosures (mocked World ID, burner model, dev ceremony) are unusually candid for a hackathon repo. The risk is not deception; it is unfinished hard requirements and a stale public tree.

---

## 5. Final verdict

**NEEDS WORK.** Two of four finalist requirements (demo video, submission form) are self-declared pending and cannot be verified — either one missing is an automatic rejection. The public repo is stale against local work (MAJOR-1, 15-minute fix, do it now), the live deployment satisfies Req 1 only under a charitable reading, and the two most demo-able claims (glasses UI, real IMU capture) lack committed proof. Everything I could execute passed — 84 JS/pytest tests plus the ZKP e2e — and every on-chain and 0G claim I could check independently checked out. Total estimated time to close all gaps: ~13–20 h, of which BLOCKERs + MAJOR-1 are ~4.5 h.
