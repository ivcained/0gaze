# Glasses motion gate

Real RayNeo Air IMU data, not simulated. The bridge opens the glasses over USB
HID using the community SDK, enables the IMU, and streams one JSON record per
device tick to stdout and (optionally) to a TCP client on port 7605.

## What is verified

- Glasses enumerating at VID 0x1BBB, PID 0xAF50 (Air 3S Pro / Air 4 Pro share
  this identity)
- Real IMU stream: 2,483 samples in 5 seconds (~497 Hz), unique device ticks
- Enrollment from a real 8-second window (3,977 samples)
- Live verification against that profile
- Motion-tier payment gated by the live window, signed by the Dabao chip,
  settled on Whitechain Sepolia

## Layout

- `imubridge.cpp` — native capture bridge (stdout JSONL + TCP feed)
- `capture.ts` — capture a window from the TCP feed or a recorded NDJSON file
- `motion.ts` — four features + cosine similarity, matching the Circom circuit
- `profile.ts` — enrollment record + circuit-compatible SHA-256 feature hash
- `verifyWindow.ts` — the shared verification routine used by the agent gate
- `enroll.ts` / `verify.ts` — command-line enrollment and verification
- `../agent/glasses-gate.ts` — the bench motion gate inside the agent loop
- `sdk/` — the community SDK source (MIT), kept as a separate upstream checkout

## Run

1. Fetch and build the community SDK once:

   ```sh
   cd glasses
   git clone --depth 1 https://github.com/verncat/RayNeo-Air-3S-Pro-OpenVR sdk
   cd sdk
   cmake -B build -DRAYNEO_BUILD_EXAMPLES=ON -DRAYNEO_BUILD_OPENVR_DRIVER=OFF
   cmake --build build --config Release
   cd ..
   clang++ -std=c++17 -O2 imubridge.cpp -I sdk/include -L sdk/build -lRayNeoSDK \
     -Wl,-rpath,$PWD/sdk/build -o imubridge
   ```

2. Plug in the glasses and enroll:

   ```sh
   ./imubridge --tcp 7605
   # in another terminal:
   npx tsx enroll.ts --tcp 7605 --seconds 10 --out profile.json
   ```

3. Verify a live window:

   ```sh
   npx tsx verify.ts --profile profile.json --tcp 7605 --seconds 3
   ```

4. Gate a real payment:

   ```sh
   cd ../merchant && MERCHANT_PRICE=0.10 npx tsx server.ts
   # in another terminal, with the Dabao relay running:
   cd ../agent && npx tsx run-live.ts --glasses=../glasses/profile.json 7601
   ```

## Safety and scope

- This is a presence / liveness signal, not a cryptographic identity. Motion is
  recordable and replayable; the spend is still gated by the Dabao key and, above
  the cap, by World ID.
- The ZKP circuit commits to the feature window and binds it to a challenge. It
  does not prove a biometric identity; do not claim that it does.
- A missing or mismatched motion window fails closed: no payment signature.
- The phone is not required for the bench demo: the agent reads the glasses
  directly through the capture bridge.
