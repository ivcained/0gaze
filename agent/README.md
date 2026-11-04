# agent

## Overview

The agent loop on the Mac. Watches the balance, decides what it needs, requests approval per the three-tier spend rule, signs through the phone gate, pays, and records an episode per decision. Enters safe-stop when 0G is unreachable.

## Interface

- `loop.ts` - the loop: watch balance → decide → (0G unreachable → safe-stop) → request approval per tier → sign → pay → record. Auto-pays below the $0.05 floor are always logged.
- `zerog.ts` - 0G Private Computer client (OpenAI-compatible API); records the request ID of every call.
- `memory.ts` - 0G Storage read/write: encrypted motion profile blob + episode log + enrollment identity binding (World ID nullifier ↔ Dabao address ↔ profile hash).
- `rpc.ts` - chain reads through Anon-RPC where the network is supported; logs which calls route through it.
- `swap.ts` - Uniswap Trading API quote + tx build for treasury top-ups; hands the tx to the phone gate (never signs directly).

## Invariants

- The agent never holds a signing key and never signs directly.
- Safe-stop never fakes a decision (0G Physical AI hard requirement).
- Every decision produces an episode-log entry with its 0G request ID.

## Side Effects

- Network: 0G API, 0G Storage, Anon-RPC, Uniswap API, the phone WebSocket; triggers onchain payments via the merchant/facilitator.

## Verification

- Run: `npx tsc --noEmit` (repo root)
