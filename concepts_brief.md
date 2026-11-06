# 0Gaze (working title; submission alias candidate: 0Gaze)

* **Author:** ivcained
* **Date:** 2026-11-04

## Overview

0Gaze is a consumer product that lets anyone run an AI agent that can hold and spend money, without the usual risks. The wallet key is born inside a Dabao chip and never leaves it. Payment approvals render only in the wearer's RayNeo AR glasses, so no screen, log, or bystander ever sees them. A head-motion profile proves the enrolled human is physically present at each approval, and World ID gates large spends. The agent thinks on 0G (sealed inference), remembers on 0G Storage (user-owned), reads chains through Anon-RPC, pays per request via x402 signed on the chip, settles on Whitechain and Hedera, and tops up its own balance with a Uniswap swap it proposes and the wearer approves.

Target user after the demo: a non-crypto person who wants "a hardware wallet with a motion layer" and an agent that handles things, without knowing what a private key is.

## Analysis

Decisions were made across a full working session with the architecture diagram (v5, all archify gates and visual review passed). The concept's load-bearing observations:

- The Air glasses' only unique property is a display no one else can see. That is the privacy layer.
- The glasses occupy the phone's only USB-C port, which forces the ESP32-S3 as a BLE-to-USB signing bridge. The three hardware pieces justify each other as a set.
- The Dabao burner speaks ERC-4527 CBOR and signs EIP-191, EIP-712, and EIP-1559/7702 transactions, which covers EIP-3009 transferWithAuthorization (the x402 payment primitive) with no custom firmware.
- Motion biometrics are a tripwire, not a lock: unconscious head movement is hard to mimic casually, but a dedicated mimic is possible, so mismatch escalates to World ID rather than blocking alone.
- Zero custom contracts: x402 rides existing USDT/USDC contracts plus a facilitator. Per ethskills: 0-2 contracts for a dApp, not 5-10.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Live demo: wearer approves in glasses, motion gate passes, Dabao signs, x402 payment settles on Whitechain Sepolia and Hedera testnet, under 60 seconds end to end
  * Approvals render in the glasses only; nothing sensitive on the phone screen
  * Motion gate: enrolled wearer passes, a different wearer fails and triggers the World ID denied path on stage
  * Agent pays for its own 0G inference per request; one paid image generation shown in the glasses
  * One Uniswap swap leg (treasury top-up) quoted, approved, hardware-signed, settled
  * Public repo, README with CROPS section, FEEDBACK.md, under-3-minute video
* **Out-of-Scope Non-Goals:**
  * Mainnet and real funds (burner model, testnets and small amounts only)
  * Trading strategies, portfolio logic, Definitive integration
  * Custom smart contracts, account abstraction, ENS submission (bonus requires submission, dropped)
  * Earning loop for 0G Track 4 (v2)
  * iOS (Ffalcon SDK is Android-only)

## Alternatives Weighed

* **Glasses as approval screen only** (rejected: cosmetic, does not survive "why not the phone screen").
* **Phone-OTG direct to Dabao, drop glasses and S3** (rejected: the port conflict is real, and the privacy layer is the product).
* **Challenge-response head gesture as the primary motion check** (rejected as primary: deliberate motions are less individual and raise false rejects; kept as an anti-replay supplement to passive scoring).
* **Arkiv for agent state** (rejected: four judged markdown files plus runnable queries is too heavy for the weekend).
* **Arc** (rejected: every prize forces Arc Studio as the starting point, conflicts with the Unity/hardware stack).
* **Chainlink CRE** (rejected: bolt-on, judges would see through it).
* **Definitive trading** (rejected: pivots the product to trading for one mid-size prize).

## Key Decisions & Staging for Next Steps

* Prize submissions: 0G Physical AI + World ID Agent Pass + Whitechain Scale (owner decision, review round 1). The motion gate is a human-liveness proof, which is World's thesis; Whitechain Scale describes the payment loop verbatim. Integrated but unsubmitted: EF Anon-RPC, Uniswap (treasury swap), ENS, Hedera. Uniswap and Hedera are candidate fourth submissions if the cap allows (Hedera becomes eligible under the auto-approve floor). Verify the cap at the event.
* Settlement: Whitechain Sepolia (USDT, gasless via EIP-3009) and Hedera testnet (USDC via facilitator). Swap leg on a Uniswap-deployed testnet.
* Demo bench: Dabao on the Mac; S3 relays phone BLE to the Mac over WiFi. Product path: S3 as direct USB host to the Dabao.
* The Mac relay speaks the emulator's TCP protocol and forwards to HID, so any network client can sign with zero new protocol code.
* Motion profile features are computed on-device; only a sealed profile lands on 0G Storage; only a match boolean ever leaves.
* Names: 0Gaze (product), 0Gaze (submission alias candidate). Eliminated by collision search: Specter (Bitcoin hardware wallet), Keyshade (secrets manager), Blindspot (Solana privacy layer).
