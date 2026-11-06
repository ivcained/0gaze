# scripts

## Overview

Bench, demo, and verification entry points. Everything a judge or a fresh engineer runs to prove the system works. (The historical `verify-e2e.sh` / `demo.sh` names in older docs were never shipped; this is the real inventory.)

## Inventory

- `demo-video.sh` - one-command take staging for the demo video.
  - `bash scripts/demo-video.sh --check` - preflight only, touches nothing on screen.
  - `bash scripts/demo-video.sh` - preflight, start missing services (relay, merchant at 0.10 USDT, glasses UI), open the approval UI and agent Terminal in mirrored-display mode.
  - `bash scripts/demo-video.sh --extended` - same, but first un-mirrors the glasses so the approval UI renders on the glasses display ONLY (the Mac never shows the payment card). Mandatory for takes that back the "approvals appear only in the glasses" claim. Prints the dual-display recording checklist.
- `glasses-only-proof.sh` - guarded end-to-end proof of the glasses-only path: refuses while a take is live, flips to extended, opens a test card on the glasses display, verifies window placement via `glasses-display wincheck`, restores the mirror. ~40 s.
- `glasses-display` (+ `glasses-display.c`) - RayNeo display helper. Subcommands:
  - `info` - every online display: id, bounds, mirror state, active index.
  - `origin` / `bounds` - the glasses display's origin / full rect (fails loudly while mirrored).
  - `extend` - un-mirror the glasses into an independent display (works from any mirror state; reads the ONLINE display list).
  - `mirror` - restore the hardware mirror (glasses mirrors built-in).
  - `wincheck` - list on-screen windows with bounds and which display each sits on (window metadata; no Screen Recording permission needed).
  - Rebuild: `clang -O2 glasses-display.c -framework ApplicationServices -framework CoreFoundation -o glasses-display`
- `pay-from-board.sh` - funding/ops helper for the bench board wallet.

## Verification (no hardware needed)

- Unit suites: `cd agent && npm test`; `cd glasses && npm test`; `cd merchant && npm test`; `cd relay && ~/dabao-venv312/bin/python -m pytest -q`
- ZKP end-to-end: `cd zkp/prover && node scripts/setup-dev.mjs && node scripts/e2e-test.mjs`
- Public deployment: `curl -i https://0gaze.tech/generate` (expect HTTP 402 with an x402 quote)
- Site UI lint: `cd site && npm run lint:ui` with the site served on port 7654

## Verification (hardware: Dabao + RayNeo attached)

- Glasses-only path: `bash scripts/glasses-only-proof.sh` (expect `PROOF PASS`)
- Full take: `bash scripts/demo-video.sh --extended` (calibrate first; see `glasses/README.md`)

## Invariants

- Scripts fail loudly (non-zero exit) on any failed check; they never print secrets (the merchant env is sourced in a subshell so the facilitator key never lands in `ps` argv).
- Never run calibrate.ts while the UI server is up (single-client bridge; the UI steals samples).
- A recorded-video fallback is never presented as a live run at a sponsor booth.

## Side Effects

- Drives the relay, merchant, glasses UI, and Chrome; `--extended` and the proof script change the display configuration (un-mirror/mirror); payment helpers print explorer links.
