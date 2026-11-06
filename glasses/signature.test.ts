/** Tests for the per-wearer signature, challenge derivation, and matching. */
import { describe, it, expect } from "vitest";
import {
  buildSignature,
  buildEnvelope,
  matchAgainstEnvelope,
  challengeForSpend,
  describeChallenge,
  canonicalEnvelopes,
  TOLERANCE,
  type DirectionEnvelope,
} from "./signature.js";
import type { Gesture, Direction } from "./gestures.js";

function g(direction: Direction, angleDeg: number, peak = 60, durationMs = 600): Gesture {
  const axis: Gesture["axis"] =
    direction === "up" || direction === "down" ? "nod" : direction === "left" || direction === "right" ? "turn" : "tilt";
  return {
    direction,
    axis,
    angleDeg,
    peakRateDps: peak,
    meanRateDps: peak * 0.6,
    durationMs,
    smoothness: 0.95,
    startMs: 0,
    samples: 300,
  };
}

/** A plausible wearer: small, slow leftward turns relative to rightward ones. */
const wearer: Gesture[] = [
  g("left", 18, 45, 720),
  g("left", 20, 48, 700),
  g("left", 16, 42, 760),
  g("left", 19, 46, 710),
  g("right", 31, 68, 560),
  g("right", 33, 70, 545),
  g("right", 30, 66, 570),
  g("up", 22, 50, 640),
  g("up", 24, 52, 620),
  g("down", 26, 58, 600),
  g("down", 25, 56, 610),
];

describe("buildEnvelope", () => {
  it("summarises angle, speed and duration with spread", () => {
    const env = buildEnvelope(wearer, "left")!;
    expect(env.reps).toBe(4);
    expect(env.angleMedian).toBeCloseTo(18.5, 1);
    expect(env.peakMedian).toBeGreaterThan(40);
    expect(env.durationMedian).toBeGreaterThan(700);
    expect(env.angleMad).toBeGreaterThan(0);
  });

  it("returns null for a direction never performed", () => {
    expect(buildEnvelope(wearer, "tiltLeft")).toBeNull();
  });
});

describe("buildSignature", () => {
  const sig = buildSignature(wearer, new Date("2026-11-06T00:00:00Z"));

  it("records only the directions actually performed", () => {
    expect(Object.keys(sig.directions).sort()).toEqual(["down", "left", "right", "up"]);
  });

  it("is deterministic in its hash for the same gesture set", () => {
    const again = buildSignature(wearer, new Date("2026-11-06T00:00:00Z"));
    expect(again.signatureHash).toBe(sig.signatureHash);
  });

  it("changes the commitment when the salt changes", () => {
    const other = buildSignature(wearer);
    expect(other.commitment).not.toBe(sig.commitment);
    expect(other.signatureHash).toBe(sig.signatureHash);
  });

  it("keeps the raw salt out of the commitment hash", () => {
    expect(sig.commitment).not.toContain(sig.salt);
    expect(sig.signatureHash).not.toContain(sig.salt);
  });

  it("canonical form is order-independent", () => {
    const a = canonicalEnvelopes({ up: sig.directions.up!, down: sig.directions.down! });
    const b = canonicalEnvelopes({ down: sig.directions.down!, up: sig.directions.up! });
    expect(a).toBe(b);
  });
});

describe("matchAgainstEnvelope", () => {
  const leftEnv = buildSignature(wearer).directions.left!;

  it("accepts a genuine repeat of the wearer's own motion", () => {
    const m = matchAgainstEnvelope(g("left", 18, 46, 700), leftEnv);
    expect(m.score).toBeGreaterThan(TOLERANCE.passScore);
    expect(m.reasons).toHaveLength(0);
  });

  it("rejects a wild swing far outside their envelope", () => {
    const m = matchAgainstEnvelope(g("left", 95, 200, 300), leftEnv);
    expect(m.score).toBeLessThan(TOLERANCE.passScore);
    expect(m.reasons.length).toBeGreaterThan(0);
  });

  it("rejects a tiny twitch", () => {
    const m = matchAgainstEnvelope(g("left", 4, 20, 200), leftEnv);
    expect(m.score).toBeLessThan(TOLERANCE.passScore);
  });

  it("scores a near-miss above a far-miss", () => {
    const near = matchAgainstEnvelope(g("left", 22, 50, 690), leftEnv);
    const far = matchAgainstEnvelope(g("left", 60, 140, 340), leftEnv);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it("does not punish a very consistent wearer into brittleness", () => {
    // Five identical reps give a mad of 0; the floor must still allow variation.
    const tight: Gesture[] = Array.from({ length: 5 }, () => g("up", 20, 50, 600));
    const env: DirectionEnvelope = buildEnvelope(tight, "up")!;
    const m = matchAgainstEnvelope(g("up", 24, 56, 640), env);
    expect(m.score).toBeGreaterThan(TOLERANCE.passScore);
  });
});

describe("challengeForSpend", () => {
  it("is deterministic for the same spend and secret", () => {
    const a = challengeForSpend("spend-1-123", "secret");
    const b = challengeForSpend("spend-1-123", "secret");
    expect(a).toEqual(b);
  });

  it("differs across spends and secrets", () => {
    const a = challengeForSpend("spend-1-123", "secret");
    const b = challengeForSpend("spend-2-456", "secret");
    const c = challengeForSpend("spend-1-123", "other-secret");
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("is always three cardinal moves", () => {
    for (let i = 0; i < 50; i++) {
      const seq = challengeForSpend(`spend-${i}`, "s");
      expect(seq).toHaveLength(3);
      for (const d of seq) expect(["left", "right", "up", "down"]).toContain(d);
    }
  });

  it("never returns three identical moves", () => {
    for (let i = 0; i < 200; i++) {
      const seq = challengeForSpend(`spend-${i}`, "s");
      expect(new Set(seq).size).toBeGreaterThan(1);
    }
  });

  it("describes the sequence in the wearer's language", () => {
    expect(describeChallenge(["left", "up", "down"])).toEqual(["Look left", "Look up", "Look down"]);
  });
});
