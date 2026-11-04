# scripts

## Overview

Verification and demo entry points. Everything a judge or a fresh engineer runs to prove the system works.

## Interface

- `verify-e2e.sh` - relay up + token-refusal check; board answers `get-address` with the expected address; merchant 402-then-200 round trip with the tx link printed; motion-gate self-test pass and fail over ADB.
- `demo.sh` - the staged demo sequence: happy-path payment, denied path (wrong wearer), safe-stop branch; recorded-video fallback clearly labeled.

## Invariants

- Scripts fail loudly (non-zero exit) on any failed check; they never print secrets.
- The demo script's video fallback is never presented as a live run at a sponsor booth.

## Side Effects

- Drives ADB, the relay, the merchant, and the board; prints explorer links.

## Verification

- Run: `scripts/verify-e2e.sh`
