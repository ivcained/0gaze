# android-imu — 0Gaze IMU reader service

Standalone Android library (not a Unity component) that reads raw IMU data
from RayNeo Air 4 Pro glasses and streams it to local consumers over a
WebSocket on `localhost:7603`. Replaces the `Input.gyro` bench fallback in
`Assets/Scripts/MotionGate.cs` with real glasses sensor data.

## What it does

- Registers `SensorManager` listeners for `TYPE_ACCELEROMETER`,
  `TYPE_GYROSCOPE`, `TYPE_MAGNETIC_FIELD` at `SENSOR_DELAY_GAME` (~20 ms).
- Polls Ffalcon SDK `MobileState.isWearing()` every 500 ms (reflectively —
  the library builds fine without the SDK; see below).
- Buffers samples into 3-second windows and broadcasts one JSON frame per
  window to every connected WebSocket client:

```json
{
  "type": "imu_window",
  "timestamp": 1730000000000,
  "wearing": true,
  "samples": [
    {"ax":0.01,"ay":9.8,"az":0.2,"gx":0.0,"gy":0.1,"gz":0.0,
     "mx":12.3,"my":-4.5,"mz":40.1,"t":123456}
  ]
}
```

- HTTP endpoints on the same port (localhost-only):
  - `GET /profile` → `{"profile_hash": "<sha256>"}` or 404 if not enrolled
  - `POST /enroll` → body is an `imu_window` frame; computes the motion
    profile (`MotionProfile.kt`), stores it, returns `{"profile_hash": ...}`

## Motion profile

`MotionProfile.compute()` turns a window of samples into a normalized
4-element feature vector:

| index | feature                 | normalization      |
|-------|-------------------------|--------------------|
| 0     | mean angular rate       | / 8.0 rad/s        |
| 1     | angular rate variance   | / 16.0             |
| 2     | max angular rate        | / 12.0 rad/s       |
| 3     | wearing fraction        | clamped [0, 1]     |

`MotionProfile.hash()` returns the SHA-256 hex digest of the vector
(8 decimal places per feature) — that's what enrollment stores and what
`GET /profile` returns.

## Ffalcon SDK (manual import)

The Ffalcon SDK is **not on Maven** — download the `.aar` (v0.2.6+) from the
RayNeo developer documentation, drop it into `android-imu/libs/`, and
uncomment the `implementation(files(...))` line in `build.gradle.kts`.

The code calls `MobileState.isWearing()` **reflectively** inside a
try/catch, so:

- SDK present → real wearing state from the glasses.
- SDK absent → falls back to SensorManager-only and reports
  `wearing: true` (unknown → permissive). Nothing crashes; you just lose the
  wearing signal.

## Integrating with the Unity app

1. Build the AAR: include `android-imu` as a module in your Android project
   (or a standalone Gradle build with the Android Gradle Plugin 8.x +
   Kotlin 1.9).

2. Export the AAR into the Unity project at `Assets/Plugins/Android/`.

3. Declare and start the service from your Unity AndroidManifest / launcher
   activity:

```xml
<service android:name="com.zerogaze.imu.ImuService" android:exported="false"/>
```

```csharp
// C#: start the service from Unity
using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
using (var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity"))
using (var intent = new AndroidJavaObject("android.content.Intent",
        activity, new AndroidJavaClass("com.zerogaze.imu.ImuService")))
{
    activity.Call<AndroidJavaObject>("startService", intent);
}
```

4. In `MotionGate.cs`, replace the `Input.gyro` sampling loop with a
   WebSocket client (e.g. `NativeWebSocket` or `System.Net.WebSockets`)
   connecting to `ws://localhost:7603`. Each `imu_window` frame gives you the
   sample list — feed it into the same mean/variance/max stats the gate
   already computes (the features match `MotionProfile.kt`).

5. Enrollment: collect one window on device, `POST /enroll` with the frame,
   then verify with `GET /profile`.

## Permissions

IMU sensors need no runtime permission. The service binds to
`127.0.0.1` only — no `INTERNET` permission is strictly required for the
loopback socket on most devices, but declaring it is harmless if your
manifest already has it:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

## Notes

- The WebSocket server is hand-rolled on a raw `ServerSocket` (OkHttp is
  client-only). It handles the upgrade handshake and pushes text frames;
  incoming client frames are ignored. Fine for localhost streaming, not a
  general-purpose WS server.
- Ports/paths: `7603`, `/profile`, `/enroll`, WS on `/`.
- If the glasses' IMU is exposed to Android as standard sensors (it is, via
  SensorManager when connected over USB-C), no extra setup is needed.
