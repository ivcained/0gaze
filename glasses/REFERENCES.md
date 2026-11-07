# External references — what we verified, adopted, and rejected

## informalTechCode/RayNeo-Air-Series-3DoF-Scaffold (Apache-2.0)
https://github.com/informalTechCode/RayNeo-Air-Series-3DoF-Scaffold
Android proof-of-concept for RayNeo Air-series sensor access; protocol understanding
credited to the Monado rayneo driver (BSL-1.0), src/xrt/drivers/rayneo/.

**Verified match (2026-11-07):** their `RayNeoProtocol.kt` packet layout — magic
0x99, sensor packet 0x65, response 0xC8, command packet 0x66, VID 0x1BBB / PID
0xAF50, accel at offset 4, gyro at 16, temperature 28, magnetometer 32, device
tick 40, proximity 44 — is identical to what `glasses/imubridge.cpp` parses.
Our bridge's protocol handling is correct per this Monado-derived reference.
Commands we use: 0 (acquire device info), 1 (open IMU), 2 (close IMU).

**Evaluated, not adopted: `OrientationFilter.kt`.** A quaternion integrator with
accelerometer gravity correction (Mahony/complementary style), built for
continuous orientation rendering (their CubeRenderer holds a stable cube for
minutes, where gyro drift dominates). Our use is 700 ms gesture sweeps matched
against a calibrated signature; drift over that window is negligible. Measured
on a 490 MB recording of real worn head motion
(`corpus/diagnose-basis.ts`, 2026-11-06): gravity-aligned vs device-frame
classification dominance 1.00 vs 0.98 — a 0.02 difference, i.e. noise for
classification. We keep plain gyro integration with per-session median-bias
correction. If we later render orientation-stable AR content on the glasses,
their filter is the right reference.

**Noted for later:** the sensor packet also carries magnetometer (offset 32),
proximity (44), and light data our bridge currently drops. Not needed for
gestures; could serve an absolute yaw reference or presence detection later.
Adding fields means rebuilding + restarting the bridge — deliberately deferred
until after demo recording, never mid-session.

## rohitsangwan01/Verto_XR
Flutter/Unity glasses app. Adopted earlier (2026-11-06): its still-sample
gyro-bias estimation became `estimateGyroBias()` in `glasses/gestures.ts`
(subtracts per-axis median rate from still samples before integration).
