/**
 * Gesture segmentation and signature tests.
 *
 * The synthetic generator mimics measured hardware: 496 Hz ticks, gravity on
 * +Y, gyro noise around 0.6 dps, and a bell-shaped velocity profile for a real
 * head rotation.
 */
import { describe, it, expect } from "vitest";
import {
  segmentGestures,
  integrateSamples,
  describeGesture,
  liveRate,
  classifyDirection,
  CARDINALS,
  GESTURE,
  type Gesture,
} from "./gestures.js";
import type { ImuSample } from "./motion.js";

const HZ = 496;

interface Segment {
  axis: "nod" | "turn" | "tilt";
  peakDps: number;
  durationMs: number;
}

/** Build a realistic IMU stream: idle noise plus the given rotations. */
export function synth(segments: Segment[], idleMs = 400, seed = 7): ImuSample[] {
  const out: ImuSample[] = [];
  let tick = 1;
  let t = 0;
  let state = seed;
  const noise = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state / 4294967296 - 0.5) * 1.2;
  };
  const step = 1000 / HZ;
  const push = (g: [number, number, number]) => {
    out.push({
      t: Math.round(t),
      tick: tick++,
      ax: noise() * 0.1,
      ay: 9.62 + noise() * 0.1,
      az: noise() * 0.1,
      gx: (g[0] * Math.PI) / 180,
      gy: (g[1] * Math.PI) / 180,
      gz: (g[2] * Math.PI) / 180,
      gxd: g[0] + noise() * 0.5,
      gyd: g[1] + noise() * 0.5,
      gzd: g[2] + noise() * 0.5,
      ps: 7900,
      valid: 1,
    });
    t += step;
  };
  const idle = (ms: number) => {
    for (let i = 0; i < (ms / 1000) * HZ; i++) push([0, 0, 0]);
  };

  idle(idleMs);
  for (const s of segments) {
    const n = Math.max(8, Math.round((s.durationMs / 1000) * HZ));
    for (let i = 0; i < n; i++) {
      // Bell profile: smooth onset, peak in the middle, smooth settle.
      const phase = (i / (n - 1)) * Math.PI;
      const rate = s.peakDps * Math.sin(phase);
      const g: [number, number, number] = [0, 0, 0];
      if (s.axis === "nod") g[0] = rate;
      else if (s.axis === "turn") g[1] = -rate; // turn right = negative
      else g[2] = rate;
      push(g);
    }
    idle(500);
  }
  return out;
}

const one = (s: Segment): ImuSample[] => synth([s]);

describe("real hardware sanity", () => {
  it("keeps the configured rate assumption close to the device", () => {
    // The bridge measured 496.5 Hz on the Air 3S Pro.
    expect(HZ).toBeGreaterThan(450);
    expect(HZ).toBeLessThan(520);
  });
});

describe("integrateSamples", () => {
  it("assigns gravity to the Y axis as measured", () => {
    const samples = one({ axis: "turn", peakDps: 40, durationMs: 600 });
    expect(samples[0].ay).toBeGreaterThan(9);
  });

  it("integrates a known rotation to roughly the right angle", () => {
    // A 600 ms bell peaking at 60 dps integrates to about 60*0.6*2/pi = 23 deg.
    const samples = one({ axis: "nod", peakDps: 60, durationMs: 600 });
    const frames = integrateSamples(samples);
    const net = frames[frames.length - 1].angle[0] - frames[0].angle[0];
    expect(net).toBeGreaterThan(18);
    expect(net).toBeLessThan(28);
  });

  it("subtracts the per-session gyro bias estimated from stillness", () => {
    // VertoXR-style stillness calibration: a constant +3 dps yaw bias must
    // not inflate the integrated angle of a real gesture.
    const clean = one({ axis: "turn", peakDps: 55, durationMs: 700 });
    const biased = clean.map((s) => ({ ...s, gyd: s.gyd + 3, gy: s.gy + (3 * Math.PI) / 180 }));
    const netOf = (samples: typeof clean) => {
      const frames = integrateSamples(samples);
      return Math.abs(frames[frames.length - 1].angle[1] - frames[0].angle[1]);
    };
    expect(Math.abs(netOf(biased) - netOf(clean))).toBeLessThan(1.5);
  });

  it("does not integrate dropped-frame gaps", () => {
    const samples = one({ axis: "nod", peakDps: 60, durationMs: 600 });
    // Insert a 2 second gap; a naive integrator would add a huge angle.
    const gapped = [...samples];
    gapped.splice(50, 0, { ...samples[50], t: samples[50].t + 2000 });
    const frames = integrateSamples(gapped);
    const net = Math.abs(frames[frames.length - 1].angle[0] - frames[0].angle[0]);
    expect(net).toBeLessThan(40);
  });
});

describe("segmentGestures", () => {
  it("finds a single nod and labels the direction", () => {
    const g = segmentGestures(one({ axis: "nod", peakDps: 60, durationMs: 600 }));
    expect(g).toHaveLength(1);
    expect(g[0].axis).toBe("nod");
    expect(g[0].direction).toBe("up");
  });

  it("labels a rightward head turn as right", () => {
    const g = segmentGestures(one({ axis: "turn", peakDps: 55, durationMs: 700 }));
    expect(g).toHaveLength(1);
    expect(g[0].direction).toBe("right");
  });

  it("labels a leftward head turn as left", () => {
    const samples = one({ axis: "turn", peakDps: 55, durationMs: 700 }).map((s) => ({
      ...s,
      gyd: -s.gyd,
      gy: -s.gy,
    }));
    const g = segmentGestures(samples);
    expect(g[0].direction).toBe("left");
  });

  it("separates three gestures with idle between them", () => {
    const g = segmentGestures(
      synth([
        { axis: "nod", peakDps: 60, durationMs: 500 },
        { axis: "turn", peakDps: 60, durationMs: 500 },
        { axis: "nod", peakDps: 60, durationMs: 500 },
      ]),
    );
    expect(g).toHaveLength(3);
    expect(g.map((x) => x.axis)).toEqual(["nod", "turn", "nod"]);
  });

  it("ignores idle noise entirely", () => {
    expect(segmentGestures(synth([], 2000))).toHaveLength(0);
  });

  it("rejects a gesture that is too brief to be intentional", () => {
    const g = segmentGestures(one({ axis: "nod", peakDps: 160, durationMs: 45 }));
    expect(g).toHaveLength(0);
  });

  it("rejects a rotation too small to be deliberate", () => {
    const g = segmentGestures(one({ axis: "nod", peakDps: 20, durationMs: 200 }));
    expect(g).toHaveLength(0);
  });

  it("rejects a mixed wobble that has no dominant axis", () => {
    const n = synth([{ axis: "nod", peakDps: 45, durationMs: 400 }]);
    const mixed = n.map((s) => ({ ...s, gyd: s.gxd * 0.95, gy: s.gx * 0.95 }));
    const g = segmentGestures(mixed);
    expect(g).toHaveLength(0);
  });
});

describe("describeGesture", () => {
  const gestureOf = (s: Segment): Gesture => {
    const g = segmentGestures(synth([s]));
    expect(g).toHaveLength(1);
    return g[0];
  };

  it("reports a faster movement with a higher peak rate", () => {
    const slow = gestureOf({ axis: "nod", peakDps: 35, durationMs: 600 });
    const fast = gestureOf({ axis: "nod", peakDps: 90, durationMs: 600 });
    expect(fast.peakRateDps).toBeGreaterThan(slow.peakRateDps);
    expect(fast.angleDeg).toBeGreaterThan(slow.angleDeg);
  });

  it("reports a clean sweep as smooth", () => {
    expect(gestureOf({ axis: "turn", peakDps: 60, durationMs: 600 }).smoothness).toBeGreaterThan(0.9);
  });

  it("refuses to describe a segment shorter than the minimum duration", () => {
    const frames = integrateSamples(one({ axis: "nod", peakDps: 60, durationMs: 600 }));
    expect(describeGesture(frames.slice(0, 3), 0)).toBeNull();
  });
});

describe("liveRate", () => {
  it("is zero for an empty window", () => {
    expect(liveRate([])).toBe(0);
  });

  it("reports the peak inside the recent window only", () => {
    const samples = one({ axis: "nod", peakDps: 70, durationMs: 500 });
    // The stream ends with 500 ms of idle, so sample the movement itself.
    const during = samples.filter((s) => Math.abs(s.gxd) > 20);
    expect(liveRate(during, 120)).toBeGreaterThan(GESTURE.offsetDps);
    // And the trailing idle tail must read as still.
    expect(liveRate(samples, 120)).toBeLessThan(GESTURE.onsetDps);
  });
});

describe("the guided pattern vocabulary", () => {
  it("offers four moves the wearer can actually perform on a worn device", () => {
    // Yaw and roll only: pitch (nod) is unreliable worn — people move their
    // eyes, not their head — so up/down are segmenter outputs, never prompts.
    expect(CARDINALS).toEqual(["left", "right", "bendLeft", "bendRight"]);
  });
});

describe("classifyDirection", () => {
  const gestureWith = (axisAngles: [number, number, number]): Gesture => ({
    direction: "left",
    axis: "turn",
    angleDeg: axisAngles[1],
    axisAngles,
    peakRateDps: 50,
    meanRateDps: 30,
    durationMs: 600,
    smoothness: 0.95,
    startMs: 0,
    samples: 300,
  });

  it("matches the calibrated vector even when the raw label would be wrong", () => {
    // Device frame flipped: this wearer's measured "left" is negative yaw.
    const vectors = { left: [0, -1, 0] as [number, number, number] };
    expect(classifyDirection(gestureWith([0, -18, 2]), vectors)).toBe("left");
  });

  it("returns null when the movement resembles nothing calibrated", () => {
    const vectors = {
      left: [0, 1, 0] as [number, number, number],
      right: [0, -1, 0] as [number, number, number],
    };
    expect(classifyDirection(gestureWith([20, 1, 0]), vectors)).toBeNull();
  });

  it("falls back gracefully without axisAngles", () => {
    const g = gestureWith([0, 0, 0]);
    delete (g as { axisAngles?: unknown }).axisAngles;
    expect(classifyDirection(g, { left: [0, 1, 0] })).toBeNull();
  });
});
