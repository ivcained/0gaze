# WHITECHAIN_FEEDBACK.md

Honest feedback from Team 0Gaze, written at 02:00 on the final night, after
running a full x402 + EIP-3009 payments loop against Whitechain Sepolia
(chainId 1874) for most of a day.

## What worked

1. **The pull-payment shape just worked.** Our differentiator is that a
   hardware chip inside AR glasses signs a USDT spend and a facilitator we run
   settles it, with zero visible crypto steps for the wearer. EIP-3009
   `transferWithAuthorization` on the official Whitechain Sepolia USDT
   deployment is exactly the primitive this needs: the chip (address
   `0xbdF5…b8BE`) never holds chain state and never pays gas; our facilitator
   (`0xb307…CdaB`) verifies the authorization and submits. Six settlements
   landed this way during the event, including a 0.10 USDT payment approved by
   head gestures on the glasses.

2. **The explorer and its API carried our whole evidence pipeline.** We
   automated submission verification against `explorer.testnet.whitechain.io`
   (Blockscout v2 API): every transaction resolvable, method names decoded,
   `raw_input` accessible so we could prove on-chain that the EIP-3009
   authorization's `from` is the chip address. For a hackathon where "show me
   the receipt" is half the judging, that reliability mattered, and after a
   night of scripted access it never flaked.

3. **The public RPC was a non-issue, which is the best compliment.**
   `rpc.testnet.whitechain.io` served a full day of reads, signature
   verification and settlement polls without ever becoming the failure point in
   our logs. When a demo's failure points turn out to be your own hardware and
   nothing on the chain, the chain did its job.

4. **The token contract behaves exactly per spec.** 6 decimals, EIP-3009 with
   a sane `DOMAIN_SEPARATOR` ("Tether USD", version "1"), and the proxy
   implementation additionally exposes `isValidSignature`, which let us sketch
   an EIP-1271 path on top without any Whitechain-specific deviations.

## Where we got stuck, and what the docs were missing

1. **No reference EIP-3009 facilitator.** The largest single chunk of our
   integration work was not the chain, the RPC, or the glasses — it was
   building and self-verifying our own facilitator (see `merchant/facilitator/`).
   It is a small program (verify authorization, submit, pay gas, serve the
   receipt), but getting it wrong silently loses money. A running example or
   even a "facilitators for pull payments" guide in the Whitechain docs would
   cut a day out of a team's schedule and remove the highest-risk part of
   building on this pattern.

2. **Domain parameters had to be read off the contract.** Type-hash, version
   string, and domain separator were discovered by querying the deployed token
   rather than from documentation. One page listing "USDT on Whitechain
   Sepolia: address, decimals, DOMAIN_SEPARATOR, type hash, expiry conventions"
   would have saved us an afternoon of paranoid cross-checking.

3. **A minor x402 seam.** x402's schemas accepted `eip155:1874` without any
   chain-specific work, which was great; but we had to decide ourselves that
   the 402 quote's `payTo` should be the facilitator's submitter address rather
   than the merchant EOA. Contract-level docs beyond the ERC would help teams
   avoid inventing this per project.

## One suggestion

The single highest-leverage addition for the teams building payment agents on
Whitechain: a **"pull payments cookbook"** — EIP-3009 reference facilitator,
parameter sheet, and one end-to-end test. We are happy to contribute ours.
