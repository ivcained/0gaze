/**
 * Bench motion gate: when no phone client is attached, the agent reads the
 * glasses' own IMU stream (through the capture bridge) and decides the motion
 * tier locally. Keeps the same fail-closed contract as the phone gate.
 */
import { verifyMotionWindow, type MotionVerification } from "../glasses/verifyWindow.js";

export interface GlassesGateOptions {
  profilePath: string;
  tcp: number;
  seconds: number;
}

export interface GlassesDecision {
  approved: boolean;
  reason?: string;
  verification?: MotionVerification;
}

export async function decideWithGlasses(
  opts: GlassesGateOptions,
  log: (...a: unknown[]) => void = (...a) => console.log("[glasses]", ...a),
): Promise<GlassesDecision> {
  try {
    const verification = await verifyMotionWindow({
      profilePath: opts.profilePath,
      tcp: opts.tcp,
      seconds: opts.seconds,
    });
    log(
      `motion window ${verification.samples} samples, score ${verification.score.toFixed(4)} ` +
        `(threshold ${verification.threshold}) -> ${verification.match ? "MATCH" : "mismatch"}`,
    );
    return verification.match
      ? { approved: true, verification }
      : { approved: false, reason: "glasses_motion_mismatch", verification };
  } catch (e) {
    log(`glasses gate unavailable: ${(e as Error).message}`);
    return { approved: false, reason: "glasses_unavailable" };
  }
}
