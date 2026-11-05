package com.eyesonly.imu

import java.security.MessageDigest
import kotlin.math.sqrt

/**
 * MotionProfile — computes a normalized feature vector from a window of IMU
 * samples and hashes it for enrollment.
 *
 * Feature vector (all normalized to roughly [0, 1]):
 *   [0] mean_angular_rate     — mean |gyro| in rad/s, normalized by 8.0 rad/s
 *   [1] angular_rate_variance — variance of |gyro|, normalized by 16.0
 *   [2] max_angular_rate      — peak |gyro|, normalized by 12.0 rad/s
 *   [3] wearing_fraction      — fraction of the window where isWearing() == true
 */
object MotionProfile {

    const val FEATURE_COUNT = 4

    // Normalization constants — chosen so a "normal" head-motion window lands
    // comfortably inside [0, 1]. Clamped after division.
    private const val NORM_MEAN_RATE = 8.0f
    private const val NORM_VAR_RATE = 16.0f
    private const val NORM_MAX_RATE = 12.0f

    data class Features(
        val meanAngularRate: Float,
        val angularRateVariance: Float,
        val maxAngularRate: Float,
        val wearingFraction: Float,
    ) {
        fun toVector(): FloatArray =
            floatArrayOf(meanAngularRate, angularRateVariance, maxAngularRate, wearingFraction)
    }

    /**
     * Compute the normalized feature vector for a window.
     *
     * @param samples gyro/accel/mag samples in the window
     * @param wearingFraction fraction of the window spent wearing the glasses
     *        (computed by ImuService from its 500ms isWearing polls)
     */
    fun compute(samples: List<ImuService.ImuSample>, wearingFraction: Float): Features {
        if (samples.isEmpty()) {
            return Features(0f, 0f, 0f, wearingFraction.coerceIn(0f, 1f))
        }

        val rates = FloatArray(samples.size) { i ->
            val s = samples[i]
            sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz)
        }

        var mean = 0f
        var max = 0f
        for (r in rates) {
            mean += r
            if (r > max) max = r
        }
        mean /= rates.size

        var variance = 0f
        for (r in rates) variance += (r - mean) * (r - mean)
        variance /= rates.size

        return Features(
            meanAngularRate = (mean / NORM_MEAN_RATE).coerceIn(0f, 1f),
            angularRateVariance = (variance / NORM_VAR_RATE).coerceIn(0f, 1f),
            maxAngularRate = (max / NORM_MAX_RATE).coerceIn(0f, 1f),
            wearingFraction = wearingFraction.coerceIn(0f, 1f),
        )
    }

    /** SHA-256 hex digest of the feature vector (8 decimal places per feature). */
    fun hash(features: Features): String {
        val canonical = features.toVector().joinToString(",") { "%.8f".format(it) }
        val digest = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    /** Convenience: compute + hash in one call. */
    fun enrollHash(samples: List<ImuService.ImuSample>, wearingFraction: Float): String =
        hash(compute(samples, wearingFraction))
}
