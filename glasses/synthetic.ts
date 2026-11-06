/**
 * A synthetic but realistic IMU capture of a wearer performing a known
 * sequence of head rotations. Fed through the real segmenter so the whole
 * pipeline is exercised, not the gesture detector's own assumptions.
 *
 * Used by the UI's --demo mode and by the flow tests.
 */
import type { ImuSample } from "./motion.js";
import type { Direction } from "./gestures.js";

const HZ = 496;

export interface SynthOptions {
  /** Base angular rate for the wearer's gestures, in degrees per second. */
  peakDps?: number;
  /** How long each rotation takes. */
  durationMs?: number;
  /** Rest between gestures. */
  idleMs?: number;
  seed?: number;
}

/**
 * Signed angular velocity for a direction, in the device frame:
 * X = nod (up positive), Y = turn (left positive), Z = tilt.
 */
function rateFor(direction: Direction, magnitude: number): [number, number, number] {
  switch (direction) {
    case "up": return [magnitude, 0, 0];
    case "down": return [-magnitude, 0, 0];
    case "left": return [0, magnitude, 0];
    case "right": return [0, -magnitude, 0];
    case "tiltLeft": return [0, 0, magnitude];
    case "tiltRight": return [0, 0, -magnitude];
  }
}

/** Synthesize a capture of the given moves. */
export function synthSequence(moves: Direction[], opts: SynthOptions = {}): ImuSample[] {
  const peak = opts.peakDps ?? 62;
  const durationMs = opts.durationMs ?? 600;
  const idleMs = opts.idleMs ?? 520;
  const out: ImuSample[] = [];
  let t = 0;
  let tick = 1;
  let state = opts.seed ?? 11;
  const noise = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state / 4294967296 - 0.5) * 1.4;
  };

  const push = (g: [number, number, number]) => {
    out.push({
      t: Math.round(t),
      tick: tick++,
      ax: noise() * 0.05,
      ay: 9.62 + noise() * 0.05,
      az: noise() * 0.05,
      gx: (g[0] * Math.PI) / 180,
      gy: (g[1] * Math.PI) / 180,
      gz: (g[2] * Math.PI) / 180,
      gxd: g[0] + noise() * 0.5,
      gyd: g[1] + noise() * 0.5,
      gzd: g[2] + noise() * 0.5,
      ps: 7900,
      valid: 1,
    });
    t += 1000 / HZ;
  };

  const idle = (ms: number) => {
    const n = Math.round((ms / 1000) * HZ);
    for (let i = 0; i < n; i++) push([0, 0, 0]);
  };

  idle(400);
  for (const move of moves) {
    const n = Math.max(8, Math.round((durationMs / 1000) * HZ));
    for (let i = 0; i < n; i++) {
      // Bell profile: the head accelerates, peaks mid-move, then settles.
      const phase = (i / (n - 1)) * Math.PI;
      const rate = peak * Math.sin(phase);
      push(rateFor(move, rate));
    }
    idle(idleMs);
  }
  idle(600);
  return out;
}

/** Write a synthetic capture to NDJSON for --replay. */
export function toNdjson(samples: ImuSample[]): string {
  return samples.map((s) => JSON.stringify(s)).join("\n") + "\n";
}
