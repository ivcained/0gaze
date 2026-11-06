/**
 * Motion features from real RayNeo IMU samples.
 *
 * The four features are exactly the four 32-bit values the Circom circuit
 * range-checks and hashes, so the same record can be committed by the ZKP.
 * All values are scaled to non-negative integers below 2^32.
 */
export interface ImuSample {
  /** Host monotonic milliseconds. */
  t: number;
  /** Device tick, unique per sample. */
  tick: number;
  ax: number; ay: number; az: number;
  /** Radians per second. */
  gx: number; gy: number; gz: number;
  /** Degrees per second. */
  gxd: number; gyd: number; gzd: number;
  ps: number;
  valid: number;
}

/** [mean angular rate, variance, max angular rate, still fraction], scaled. */
export type MotionFeatures = [number, number, number, number];

export const FEATURE_SCALE = {
  mean: 1e6,
  variance: 1e4,
  max: 1e6,
  still: 1e6,
} as const;

/** Angular-rate magnitude in degrees per second for one sample. */
export function rateDps(s: ImuSample): number {
  return Math.hypot(s.gxd, s.gyd, s.gzd);
}

const UINT32_MAX = 0xffffffff;

function scaled(value: number, scale: number): number {
  const v = Math.round(Math.max(0, value) * scale);
  return Math.min(v, UINT32_MAX);
}

/** Angular rate in dps above which a sample counts as deliberate movement. */
export const STILL_THRESHOLD_DPS = 3;

export function extractFeatures(samples: ImuSample[]): MotionFeatures {
  if (samples.length === 0) throw new Error("no IMU samples");
  const rates = samples.map(rateDps);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const max = Math.max(...rates);
  const still = rates.filter((r) => r < STILL_THRESHOLD_DPS).length / rates.length;
  return [
    scaled(mean, FEATURE_SCALE.mean),
    scaled(variance, FEATURE_SCALE.variance),
    scaled(max, FEATURE_SCALE.max),
    scaled(still, FEATURE_SCALE.still),
  ];
}

/** Cosine similarity in [0, 1] for non-negative feature vectors. */
export function cosineSimilarity(a: MotionFeatures, b: MotionFeatures): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function motionMatch(
  enrolled: MotionFeatures,
  live: MotionFeatures,
  threshold = 0.92,
): { match: boolean; score: number } {
  const score = cosineSimilarity(enrolled, live);
  return { match: score >= threshold, score };
}

/** Total energy proxy used by the ZKP threshold gate. */
export function featureSum(features: MotionFeatures): number {
  return features.reduce((a, b) => a + b, 0);
}
