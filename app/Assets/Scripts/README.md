# Scripts

## Overview

All Unity C# application code. The approval card renders on the glasses display only; the phone screen shows a neutral idle screen with no payment details.

## Interface

- `AgentClient.cs` - WebSocket client to the agent; message types: `approval_request`, `motion_verdict`, `worldid_verdict`, `sign_result`.
- `ApprovalCard.cs` - eyes-only approval UI: amount, token, recipient, purpose, countdown.
- `MotionGate.cs` - enrollment capture (5 min), 128-dim feature vector (per-axis angular-velocity histograms, spectral energy bands, jerk), cosine similarity, calibrated threshold; profile blob AES-GCM under an Android Keystore key.
- `PayClient.cs` - builds the EIP-3009 typed-data payload, sends sign requests over WiFi (bench) or BLE (stretch), attaches the returned signature as `PAYMENT-SIGNATURE`.
- `BleBridge.cs` - STRETCH: Android BLE to the S3; matches the firmware's chunk framing.
- `WorldIdGate.cs` - World ID Agent Pass via deep link to the World app; mocked proofs at the hackathon; deny path is a first-class UI state.

## Invariants

- No payment details ever render on the phone screen (the World app's own verification UI is the only exception).
- Plaintext biometric data never leaves the phone; only the encrypted profile blob and match booleans exit.
- A motion false-reject escalates to World ID; it never blocks forever.

## Side Effects

- Renders to the glasses display; reads the head-tracking IMU stream; BLE and WiFi radios; Android Keystore.

## Verification

- Run: Unity Build (Android), then `scripts/verify-e2e.sh` drives the motion self-test over ADB.
