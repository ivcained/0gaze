/**
 * Per-wearer head-motion signature.
 *
 * Enrollment performs each direction several times; from those we keep a
 * robust envelope per direction (median and spread of angle, peak rate and
 * duration). A later gesture matches when it falls inside that person's own
 * envelope, weighted by how tightly they normally perform the move.
 *
 * This is a behavioural signature, not a biometric. It distinguishes "this is
 * how this person turns their head" from "someone is waving the glasses
 * around" and nothing more.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { CARDINALS, familyOf, type Direction, type Gesture } from "./gestures.js";

export interface DirectionEnvelope {
  reps: number;
  angleMedian: number;
  angleMad: number;
  peakMedian: number;
  peakMad: number;
  durationMedian: number;
  durationMad: number;
}

export interface MotionSignature {
  version: 1;
  createdAt: string;
  source: "rayneo-air-imu";
  directions: Partial<Record<Direction, DirectionEnvelope>>;
  /**
   * Per-wearer calibration: the mean unit rotation vector [nod, turn, tilt]
   * measured when this wearer performed each prompted direction. Replaces the
   * hardcoded device-frame sign guess with what their head actually did.
   */
  vectors: Partial<Record<Direction, [number, number, number]>>;
  /** SHA-256 of the canonical envelope JSON. Never leaves the wearer's device. */
  signatureHash: string;
  /** Public commitment: hash plus a salt, safe to publish. */
  commitment: string;
  salt: string;
}

export const TOLERANCE = {
  /** Minimum absolute allowance, so a very consistent wearer is not brittle. */
  angleFloorDeg: 9,
  peakFloorDps: 18,
  durationFloorMs: 420,
  /** Multiplier on the measured spread (median absolute deviation). */
  spread: 2.6,
  /** A gesture must score at least this to count as theirs. */
  passScore: 0.6,
} as const;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mad(values: number[], centre: number): number {
  if (values.length === 0) return 0;
  return median(values.map((v) => Math.abs(v - centre)));
}

export function buildEnvelope(gestures: Gesture[], direction: Direction): DirectionEnvelope | null {
  const reps = gestures.filter((g) => g.direction === direction);
  if (reps.length === 0) return null;
  const angles = reps.map((g) => Math.abs(g.angleDeg));
  const peaks = reps.map((g) => g.peakRateDps);
  const durations = reps.map((g) => g.durationMs);
  const angleMedian = median(angles);
  const peakMedian = median(peaks);
  const durationMedian = median(durations);
  return {
    reps: reps.length,
    angleMedian,
    angleMad: mad(angles, angleMedian),
    peakMedian,
    peakMad: mad(peaks, peakMedian),
    durationMedian,
    durationMad: mad(durations, durationMedian),
  };
}

export function canonicalEnvelopes(
  directions: Partial<Record<Direction, DirectionEnvelope>>,
): string {
  const ordered: Record<string, unknown> = {};
  for (const d of CARDINALS) {
    const env = directions[d];
    if (!env) continue;
    ordered[d] = {
      angle: round(env.angleMedian),
      angleSpread: round(env.angleMad),
      peak: round(env.peakMedian),
      peakSpread: round(env.peakMad),
      duration: round(env.durationMedian),
      durationSpread: round(env.durationMad),
      reps: env.reps,
    };
  }
  return JSON.stringify(ordered);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function buildSignature(gestures: Gesture[], now = new Date()): MotionSignature {
  const directions: Partial<Record<Direction, DirectionEnvelope>> = {};
  const vectors: Partial<Record<Direction, [number, number, number]>> = {};
  for (const d of CARDINALS) {
    const env = buildEnvelope(gestures, d);
    if (env) directions[d] = env;
    const vec = meanUnitVector(gestures.filter((g) => g.direction === d));
    if (vec) vectors[d] = vec;
  }
  const canonical = canonicalEnvelopes(directions);
  const signatureHash = createHash("sha256").update(canonical).digest("hex");
  const salt = randomBytes(16).toString("hex");
  // A commitment lets the verifier check a claim without the raw envelope.
  const commitment = createHash("sha256").update(signatureHash + salt).digest("hex");
  return {
    version: 1,
    createdAt: now.toISOString(),
    source: "rayneo-air-imu",
    directions,
    vectors,
    signatureHash,
    commitment,
    salt,
  };
}

/** Mean unit rotation vector across a set of repetitions. */
function meanUnitVector(gestures: Gesture[]): [number, number, number] | null {
  const nets = gestures.map((g) => g.axisAngles).filter((a): a is [number, number, number] => Boolean(a));
  if (nets.length === 0) return null;
  const mean: [number, number, number] = [0, 0, 0];
  for (const n of nets) {
    const mag = Math.hypot(n[0], n[1], n[2]);
    if (mag < 1e-6) continue;
    mean[0] += n[0] / mag;
    mean[1] += n[1] / mag;
    mean[2] += n[2] / mag;
  }
  const mmag = Math.hypot(mean[0], mean[1], mean[2]);
  if (mmag < 1e-6) return null;
  return [mean[0] / mmag, mean[1] / mmag, mean[2] / mmag];
}

export interface DirectionMatch {
  direction: Direction;
  score: number;
  angleDelta: number;
  peakDelta: number;
  durationDelta: number;
  reasons: string[];
}

/** How well one performed gesture fits the wearer's envelope for that move. */
export function matchAgainstEnvelope(g: Gesture, env: DirectionEnvelope): DirectionMatch {
  const reasons: string[] = [];
  const angleTol = Math.max(TOLERANCE.angleFloorDeg, env.angleMad * TOLERANCE.spread);
  const peakTol = Math.max(TOLERANCE.peakFloorDps, env.peakMad * TOLERANCE.spread);
  const durTol = Math.max(TOLERANCE.durationFloorMs, env.durationMad * TOLERANCE.spread);

  const angleDelta = Math.abs(Math.abs(g.angleDeg) - env.angleMedian);
  const peakDelta = Math.abs(g.peakRateDps - env.peakMedian);
  const durationDelta = Math.abs(g.durationMs - env.durationMedian);

  const scoreFor = (delta: number, tol: number) => Math.max(0, 1 - delta / (tol * 2));

  const scores = [
    scoreFor(angleDelta, angleTol),
    scoreFor(peakDelta, peakTol),
    scoreFor(durationDelta, durTol),
  ];
  // Angle carries the most weight: it is the most intentional dimension.
  const score = scores[0] * 0.5 + scores[1] * 0.3 + scores[2] * 0.2;

  if (angleDelta > angleTol) reasons.push(`angle off by ${angleDelta.toFixed(0)}deg (tolerance ${angleTol.toFixed(0)})`);
  if (peakDelta > peakTol) reasons.push(`speed off by ${peakDelta.toFixed(0)}dps (tolerance ${peakTol.toFixed(0)})`);
  if (durationDelta > durTol) reasons.push(`duration off by ${durationDelta.toFixed(0)}ms`);

  return {
    direction: g.direction,
    score: Number(score.toFixed(3)),
    angleDelta,
    peakDelta,
    durationDelta,
    reasons,
  };
}

/** Deterministic challenge for a spend: same payment always asks the same moves. */
export function challengeForSpend(spendId: string, secret: string, moves = 3): Direction[] {
  const digest = createHmac("sha256", secret).update(spendId).digest();
  const out: Direction[] = [];
  for (let i = 0; i < moves; i++) {
    out.push(CARDINALS[digest[i] % CARDINALS.length]);
  }
  // Reject a sequence with no direction change: it defeats the "specific
  // rotation" purpose. Deterministically re-roll rather than randomly.
  if (out.every((d) => d === out[0])) out[out.length - 1] = CARDINALS[(CARDINALS.indexOf(out[0]) + 2) % CARDINALS.length];
  return out;
}

export function describeChallenge(sequence: Direction[]): string[] {
  return sequence.map((d) => {
    switch (d) {
      case "up": return "Look up";
      case "down": return "Look down";
      case "left": return "Look left";
      case "right": return "Look right";
      case "bendLeft": return "Bend left";
      case "bendRight": return "Bend right";
    }
  });
}
