/** Shared profile record and circuit-compatible hash. */
import { createHash } from "node:crypto";
import type { MotionFeatures } from "./motion.js";

export interface MotionProfile {
  version: 1;
  createdAt: string;
  source: "rayneo-air-imu";
  seconds: number;
  samples: number;
  features: MotionFeatures;
  /** SHA-256 over the four features packed big-endian uint32. */
  featureHash: string;
  threshold: number;
}

/** Must match WindowHash in zkp/circuits/motion_proof.circom. */
export function featureHash(features: MotionFeatures): string {
  const buf = Buffer.alloc(16);
  features.forEach((v, i) => buf.writeUInt32BE(v >>> 0, i * 4));
  return createHash("sha256").update(buf).digest("hex");
}
