# merchant

## Overview

The demo paid API. Serves a paid generation endpoint: answers 402 with x402 payment requirements, verifies the signed payment, settles it onchain through the facilitator, then proxies a 0G image generation call so the paid artifact is visible in the glasses.

## Interface

- `server.ts` - `GET /generate`: 402 + base64-JSON `PAYMENT-REQUIRED` header; retry with `PAYMENT-SIGNATURE` header; success returns 200 + `PAYMENT-RESPONSE` (tx hash, 0G request ID) and the artifact.
- facilitator: [./facilitator/README.md](./facilitator/README.md) - signature verification and onchain settlement per chain.

## Invariants

- Never serve the artifact without a settled payment.
- x402 v2 header names and payload schema exactly as in the design doc (Technical Plan).
- The same nonce never settles twice (replay rejection).

## Side Effects

- Onchain writes via the facilitator; outbound calls to 0G Private Computer.

## Verification

- Run: `npx vitest run` (in `merchant/`)
