# facilitator

## Overview

Verifies EIP-3009 `transferWithAuthorization` signatures and submits them onchain from a faucet-funded testnet key, so the paying agent needs no gas. The Dabao signs the payment as EIP-712 typed data (ERC-4527 data type 2, v=27/28).

## Interface

- `whitechain.ts` - `verify(payload)` and `settle(authorization, signature)` against USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on Whitechain Sepolia (chain ID 1874). EIP-3009 support on this contract confirmed by explorer ABI on 2026-11-04.
- `hedera.ts` - STRETCH, gated on the Hedera EVM/EIP-3009 spike (see design Open Questions).
- `whitechain.test.ts` - vitest: good/bad signatures, replay rejection, wrong-chain/wrong-token rejection.

## Invariants

- EIP-712 domain: name/version from the token contract, chainId 1874, verifyingContract = the USDT address above.
- The facilitator key comes from an env var, is faucet-funded, testnet only, and never commits to the repo.
- The token is a USDC-style fiat-token contract behind a proxy despite the USDT ticker; do not assume no-bool-return USDT semantics here.

## Side Effects

- Onchain writes (Whitechain Sepolia); RPC reads.

## Verification

- Run: `npx vitest run merchant/facilitator/`
