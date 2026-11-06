/**
 * Head-motion signature: turning live RayNeo gyro data into discrete,
 * verifiable neck rotations.
 *
 * Device frame (measured on hardware): gravity sits on +Y, so
 *   X = nod  (pitch, look up / down)
 *   Y = turn (yaw, look left / right)
 *   Z = tilt (roll, tilt head left / right)
 *
 * A gesture is one continuous rotation of the head. Its identity is the axis
 * and the signed angle; its personal signature is the dynamics: how fast it
 * starts, how far it goes, how long it holds, how smooth it is.
 */
import type { ImuSample } from "./motion.js";

export type Axis = "nod" | "turn" | "tilt";
/**
 * "up"/"down" still exist as segmenter output (a nod is a nod) but are NOT in
 * the challenge vocabulary: on a worn device people move their eyes, not their
 * head, so pitch is the least reliable axis. Yaw (left/right) and roll
 * (bendLeft/bendRight, ear toward shoulder) are the four calibrated moves.
 */
export type Direction = "left" | "right" | "bendLeft" | "bendRight" | "up" | "down";

export const ALL_DIRECTIONS: Direction[] = ["left", "right", "bendLeft", "bendRight", "up", "down"];

/** The challenge/enrollment vocabulary: two yaw moves, two roll moves. */
export const CARDINALS: Direction[] = ["left", "right", "bendLeft", "bendRight"];

/** Which physical axis family a direction belongs to (calibration tolerance). */
export function familyOf(direction: Direction): "turn" | "tilt" | "nod" {
  if (direction === "left" || direction === "right") return "turn";
  if (direction === "bendLeft" || direction === "bendRight") return "tilt";
  return "nod";
}

export interface Gesture {
  direction: Direction;
  axis: Axis;
  /** Signed integrated rotation in degrees. */
  angleDeg: number;
  /** Net integrated rotation per device axis [nod, turn, tilt], degrees. */
  axisAngles?: [number, number, number];
  peakRateDps: number;
  meanRateDps: number;
  durationMs: number;
  /** 1 = one clean sweep, 0 = rate changed sign constantly. */
  smoothness: number;
  startMs: number;
  samples: number;
}

/** Tunables. Values come from the 496 Hz hardware capture. */
export const GESTURE = {
  /** EMA coefficient per sample for the raw gyro. */
  smoothAlpha: 0.22,
  /** Rate that opens a gesture, in degrees per second. */
  onsetDps: 28,
  /** Rate below which the head is considered settled again. */
  offsetDps: 12,
  /** Consecutive settled time that closes a gesture. */
  settleMs: 90,
  /** A gesture shorter than this is noise. */
  minDurationMs: 130,
  /** A gesture longer than this is not a single intentional rotation. */
  maxDurationMs: 2600,
  /** Minimum integrated angle for a gesture to count. */
  minAngleDeg: 8,
  /** Axis must own this share of total rotation, else the gesture is mixed. */
  axisDominance: 0.55,
  /**
   * Dropped-sample gaps up to this long are bridged by holding the last
   * filtered rate. The 23:00 take lost 27.9% of its samples to gaps >50ms
   * (max 3.6s) under machine load, which chopped a 700ms turn into three
   * fragments and destroyed its integrated angle (13deg instead of 60deg)
   * while leaving the peak rate intact. Longer gaps are refused rather than
   * fabricating motion.
   */
  gapBridgeMs: 250,
} as const;

interface Frame {
  t: number;
  rate: [number, number, number];
  angle: [number, number, number];
}

const AXIS_INDEX: Record<Axis, number> = { nod: 0, turn: 1, tilt: 2 };

function directionFor(axis: Axis, angleDeg: number): Direction {
  const positive = angleDeg >= 0;
  if (axis === "nod") return positive ? "up" : "down";
  if (axis === "turn") return positive ? "left" : "right";
  return positive ? "bendLeft" : "bendRight";
}

/**
 * VertoXR-style stillness calibration: estimate the per-session gyro bias as
 * the per-axis median rate over still samples, so angles integrate real
 * motion instead of accumulating drift. Bench evidence: drift produced a
 * phantom 10.5deg 2.6s "gesture" with smoothness 0.10 during idle wear.
 */
function estimateGyroBias(samples: ImuSample[]): [number, number, number] | null {
  const still = samples.filter((s) => Math.abs(s.gxd) + Math.abs(s.gyd) + Math.abs(s.gzd) < 5);
  if (still.length < 100) return null; // ~200ms at 496 Hz
  const med = (vals: number[]): number => {
    const sorted = [...vals].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return [med(still.map((s) => s.gxd)), med(still.map((s) => s.gyd)), med(still.map((s) => s.gzd))];
}

/** Per-axis gyro bias in degrees per second. */
export type GyroBias = [number, number, number];

/** EMA filter + integration of the gyro into per-axis angles.
 *  An explicit bias (even null) skips the internal stillness estimate; this
 *  lets the live server hold one bias across short rolling windows. */
export function integrateSamples(samples: ImuSample[], bias?: GyroBias | null): Frame[] {
  const frames: Frame[] = [];
  if (samples.length === 0) return frames;

  if (bias === undefined) bias = estimateGyroBias(samples);
  const rate = (s: ImuSample): [number, number, number] =>
    bias ? [s.gxd - bias[0], s.gyd - bias[1], s.gzd - bias[2]] : [s.gxd, s.gyd, s.gzd];

  let filtered: [number, number, number] = rate(samples[0]);
  let angle: [number, number, number] = [0, 0, 0];
  let previous = samples[0].t;
  const a = GESTURE.smoothAlpha;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const raw: [number, number, number] = rate(s);
    if (i > 0) {
      const dtMs = s.t - previous;
      if (dtMs > 0 && dtMs < 50) {
        const dt = dtMs / 1000;
        for (let k = 0; k < 3; k++) {
          filtered[k] += a * (raw[k] - filtered[k]);
          angle[k] += filtered[k] * dt;
        }
      } else if (dtMs >= 50 && dtMs <= GESTURE.gapBridgeMs) {
        // Bridge a dropout: hold the last filtered rate across the gap so the
        // rotation is not lost, then resume filtering from the new sample.
        const dt = dtMs / 1000;
        for (let k = 0; k < 3; k++) angle[k] += filtered[k] * dt;
        for (let k = 0; k < 3; k++) filtered[k] += a * (raw[k] - filtered[k]);
      }
      // dtMs > gapBridgeMs: unbridgeable, integrate nothing (see gap test).
    }
    previous = s.t;
    frames.push({ t: s.t, rate: [...filtered] as [number, number, number], angle: [...angle] as [number, number, number] });
  }
  return frames;
}

function magnitude(rate: [number, number, number]): number {
  return Math.hypot(rate[0], rate[1], rate[2]);
}

/** Result of segmenting one buffer of samples. */
export interface Segmentation {
  gestures: Gesture[];
  /** Onset time of a sweep still in progress at the buffer edge, else null. */
  activeSince: number | null;
  /** Bias measured from stillness in THIS buffer (null if too few still samples). */
  bias: GyroBias | null;
}

function segmentCore(samples: ImuSample[], bias: GyroBias | null, closeTrailing: boolean): Segmentation {
  const frames = integrateSamples(samples, bias);
  const out: Gesture[] = [];
  let activeSince: number | null = null;
  if (frames.length === 0) return { gestures: out, activeSince, bias: null };

  let active = false;
  let startIndex = 0;
  let settledSince: number | null = null;

  const close = (endIndex: number) => {
    if (endIndex <= startIndex) return;
    const slice = frames.slice(startIndex, endIndex + 1);
    const gesture = describeGesture(slice, samples[startIndex].t);
    if (gesture) out.push(gesture);
  };

  for (let i = 0; i < frames.length; i++) {
    const mag = magnitude(frames[i].rate);
    if (!active) {
      if (mag >= GESTURE.onsetDps) {
        active = true;
        startIndex = i;
        settledSince = null;
      }
      continue;
    }
    if (mag < GESTURE.offsetDps) {
      if (settledSince === null) settledSince = frames[i].t;
      if (frames[i].t - settledSince >= GESTURE.settleMs) {
        close(i);
        active = false;
        settledSince = null;
      }
    } else {
      settledSince = null;
    }
  }
  if (active) {
    if (closeTrailing) {
      close(frames.length - 1);
    } else {
      activeSince = frames[startIndex].t;
    }
  }
  return { gestures: out, activeSince, bias: null };
}

/**
 * Segment a stream into gestures: activity opens one, sustained stillness
 * closes it. Returns gestures in time order. A sweep still in progress at
 * the end of the buffer is force-closed and emitted — right for whole-file
 * captures (calibration, evidence replay) where the wearer held still before
 * the window ended.
 */
export function segmentGestures(samples: ImuSample[]): Gesture[] {
  const measured = estimateGyroBias(samples);
  return segmentCore(samples, measured, true).gestures;
}

/**
 * Streaming-safe segmentation for a LIVE rolling buffer.
 *
 * A sweep still in progress at the buffer edge is NOT emitted: the edge is
 * just "now", not a settled end. Emitting it produces partial gestures —
 * a clean 25° turn chopped into two 10° fragments that then fail the
 * envelope match (the live-take "not accurate" symptom). The pending onset
 * is reported instead, so the caller keeps those samples for the next tick.
 *
 * `priorBias` is reused when this buffer holds too little stillness to
 * estimate one (a window that is mostly motion), so integration never runs
 * on raw, drifting rates mid-challenge.
 */
export function segmentLive(samples: ImuSample[], priorBias: GyroBias | null = null): Segmentation {
  const measured = estimateGyroBias(samples);
  const seg = segmentCore(samples, measured ?? priorBias, false);
  seg.bias = measured;
  return seg;
}

/** Quiet margin kept before a pending sweep's onset, for bias estimation. */
export const BASELINE_MS = 700;

/** A pending sweep older than this can never pass maxDurationMs; abandon it. */
export const ACTIVE_CAP_MS = GESTURE.maxDurationMs + GESTURE.settleMs + 300;

/**
 * Trim policy for the live rolling buffer. Never cut inside a sweep in
 * progress (losing its start under-integrates the angle), never keep an
 * already-emitted gesture (it would be scored twice), and bound idle memory
 * by age. Returns the buffer to keep for the next tick.
 */
export function rollBuffer(buffer: ImuSample[], seg: Segmentation, windowMs: number): ImuSample[] {
  if (buffer.length === 0) return buffer;
  const newest = buffer[buffer.length - 1].t;
  let cutoff = newest - windowMs;
  if (seg.activeSince !== null && newest - seg.activeSince <= ACTIVE_CAP_MS) {
    cutoff = Math.min(cutoff, seg.activeSince - BASELINE_MS);
  }
  if (seg.gestures.length > 0) {
    const last = seg.gestures[seg.gestures.length - 1];
    cutoff = Math.max(cutoff, last.startMs + last.durationMs + 1);
  }
  return buffer.filter((x) => x.t >= cutoff);
}

/** Turn one segment of frames into a labelled gesture, or null if it is noise. */
export function describeGesture(frames: Frame[], startMs: number): Gesture | null {
  if (frames.length < 4) return null;
  const durationMs = frames[frames.length - 1].t - frames[0].t;
  if (durationMs < GESTURE.minDurationMs || durationMs > GESTURE.maxDurationMs) return null;

  // Net rotation per axis across the segment.
  const first = frames[0].angle;
  const last = frames[frames.length - 1].angle;
  const net: [number, number, number] = [last[0] - first[0], last[1] - first[1], last[2] - first[2]];
  const abs: [number, number, number] = [Math.abs(net[0]), Math.abs(net[1]), Math.abs(net[2])];
  const total = abs[0] + abs[1] + abs[2];
  if (total <= 0) return null;

  const index = abs.indexOf(Math.max(...abs));
  if (abs[index] / total < GESTURE.axisDominance) return null;
  if (abs[index] < GESTURE.minAngleDeg) return null;

  const axis: Axis = index === 0 ? "nod" : index === 1 ? "turn" : "tilt";
  const rates = frames.map((f) => Math.abs(f.rate[AXIS_INDEX[axis]]));
  const peakRateDps = Math.max(...rates);
  const meanRateDps = rates.reduce((a, b) => a + b, 0) / rates.length;

  // Sign agreement: a clean sweep keeps one rotation direction the whole way.
  const signed = frames.map((f) => f.rate[AXIS_INDEX[axis]]);
  const positive = signed.filter((r) => r > 0).length;
  const smoothness = Math.abs(positive - (signed.length - positive)) / signed.length;

  return {
    direction: directionFor(axis, net[index]),
    axis,
    angleDeg: net[index],
    axisAngles: net,
    peakRateDps,
    meanRateDps,
    durationMs,
    smoothness,
    startMs,
    samples: frames.length,
  };
}

/**
 * Classify a gesture against a wearer's calibrated direction vectors.
 *
 * The hardcoded axis signs are a guess about the device frame; calibration
 * replaces the guess with what THIS wearer's head actually did when asked to
 * look left. Returns the best-matching calibrated direction, or null when the
 * movement does not resemble any of them (e.g. a nod during a yaw challenge).
 */
export function classifyDirection(
  gesture: Gesture,
  vectors: Partial<Record<Direction, [number, number, number]>>,
  minDot = 0.55,
): Direction | null {
  const net = gesture.axisAngles;
  if (!net) return null;
  const mag = Math.hypot(net[0], net[1], net[2]);
  if (mag < 1e-6) return null;
  let best: Direction | null = null;
  let bestDot = minDot;
  for (const [dir, vec] of Object.entries(vectors) as [Direction, [number, number, number]][]) {
    const vmag = Math.hypot(vec[0], vec[1], vec[2]);
    if (vmag < 1e-6) continue;
    const dot = (net[0] * vec[0] + net[1] * vec[1] + net[2] * vec[2]) / (mag * vmag);
    if (dot > bestDot) {
      bestDot = dot;
      best = dir;
    }
  }
  return best;
}

/** Peak-hold rate, used by the UI's live meter. */
export function liveRate(samples: ImuSample[], windowMs = 120): number {
  if (samples.length === 0) return 0;
  const cutoff = samples[samples.length - 1].t - windowMs;
  let peak = 0;
  for (let i = samples.length - 1; i >= 0 && samples[i].t >= cutoff; i--) {
    peak = Math.max(peak, Math.hypot(samples[i].gxd, samples[i].gyd, samples[i].gzd));
  }
  return peak;
}
