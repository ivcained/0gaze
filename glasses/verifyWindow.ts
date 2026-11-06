/**
 * One-shot motion verification against an enrolled profile.
 * Shared by the verify CLI and the agent's bench gate.
 */
import { readFileSync } from "node:fs";
import { captureWindow } from "./capture.js";
import { extractFeatures, motionMatch, featureSum, type MotionFeatures } from "./motion.js";
import { featureHash, type MotionProfile } from "./profile.js";

export interface VerifyMotionOptions {
  profilePath: string;
  seconds: number;
  tcp?: number;
  file?: string;
}

export interface MotionVerification {
  match: boolean;
  score: number;
  threshold: number;
  samples: number;
  features: MotionFeatures;
  profileHash: string;
  liveHash: string;
  liveEnergy: number;
  /** Replay evidence, present only when the source is a recorded file. */
  replay?: boolean;
}

export async function verifyMotionWindow(opts: VerifyMotionOptions): Promise<MotionVerification> {
  const profile = JSON.parse(readFileSync(opts.profilePath, "utf8")) as MotionProfile;
  const samples = await captureWindow({
    tcp: opts.tcp,
    file: opts.file,
    seconds: opts.seconds,
  });
  if (samples.length === 0) throw new Error("no live IMU samples");
  const features = extractFeatures(samples);
  const result = motionMatch(profile.features, features, profile.threshold);
  return {
    match: result.match,
    score: result.score,
    threshold: profile.threshold,
    samples: samples.length,
    features,
    profileHash: profile.featureHash,
    liveHash: featureHash(features),
    liveEnergy: featureSum(features),
    replay: Boolean(opts.file),
  };
}
