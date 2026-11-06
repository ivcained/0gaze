# Keep ImuService — it's instantiated by the system from the manifest,
# not from code, so R8/ProGuard would otherwise strip it.
-keep class com.0gaze.imu.** { *; }

# Gson reflection on our own data classes only; nothing else needed.
-keepattributes Signature, *Annotation*
