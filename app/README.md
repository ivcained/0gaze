# EyesOnly app (RayNeo Air 4 Pro + Android phone)

The phone runs this Unity app with the glasses plugged in. It connects to the
agent's WebSocket, shows payment approvals **only in the glasses**, and
answers with motion-gate verdicts. Signing happens on the Dabao chip; the
agent reports the result back.

## Open in Unity

1. Unity Hub → Open → select the `app/` directory (this folder)
2. Unity 2022.3 LTS or 6000.x. If Hub offers a version mismatch, pick any
   installed LTS — the scene is intentionally minimal and the UI is built in
   code at runtime (`Bootstrap.cs`), so nothing version-specific is stored.
3. Platform: Android (File → Build Settings → Android → Switch Platform)
4. Build and run on the Android phone, glasses plugged into its USB-C port

## RayNeo / Ffalcon SDK

The Air 4 Pro's XR features (head pose, display) come from the Ffalcon Unity
XR SDK (Android-only). Import their `.unitypackage` from
https://rayneo-en.gitbook.io/rayneo-devdoc/air-series/unity-sdk and add their
XR rig to the scene. Until then the app runs on the bench fallback:
`Input.gyro` for motion, a plain camera for display.

## What you see

- The agent sends an `approval_request` over the WebSocket → the card appears
  in the glasses (world-space canvas, 1.2m in front of the head, dark panel)
- The motion gate samples 3s of head movement and answers match / mismatch
- The agent signs on the Dabao and sends back `sign_result` → the card shows
  the settled tx hash, then fades

## Configure

- `Bootstrap.agentUrl` (in the scene, on the camera): the agent's WebSocket
  address, default `ws://127.0.0.1:7602`. On the bench, the phone and the Mac
  must be on the same network; use the Mac's LAN IP.
- `MotionGate.windowSeconds`, `MotionGate.matchThreshold`: the sampling window
  and the similarity threshold (default 0.85).

## Files

- `Assets/Scripts/Bootstrap.cs` — builds the canvas, texts, and wiring at runtime
- `Assets/Scripts/PayClient.cs` — WebSocket client, message routing
- `Assets/Scripts/ApprovalCard.cs` — the world-space approval card
- `Assets/Scripts/MotionGate.cs` — head-motion sampling and profile match
- `Assets/Scenes/EyesOnly.unity` — one camera + one Bootstrap, nothing else
