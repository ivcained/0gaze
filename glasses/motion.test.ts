/** Tests for the real-hardware motion feature math. */
import { describe, it, expect } from "vitest";
import {
  extractFeatures,
  cosineSimilarity,
  motionMatch,
  featureSum,
  rateDps,
  STILL_THRESHOLD_DPS,
  type ImuSample,
} from "./motion.js";

function sample(gxd: number, gyd = 0, gzd = 0, tick = 1): ImuSample {
  return {
    t: tick, tick,
    ax: 0, ay: 9.8, az: 0,
    gx: 0, gy: 0, gz: 0,
    gxd, gyd, gzd,
    ps: 5000, valid: 1,
  };
}

describe("rateDps", () => {
  it("is the Euclidean magnitude of the gyro vector", () => {
    expect(rateDps(sample(3, 4, 0))).toBeCloseTo(5, 6);
  });
});

describe("extractFeatures", () => {
  it("returns four uint32-safe integers", () => {
    const f = extractFeatures([sample(1), sample(10), sample(2), sample(20)]);
    expect(f).toHaveLength(4);
    for (const v of f) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("computes mean, variance, max and still fraction", () => {
    const f = extractFeatures([sample(0), sample(0), sample(10), sample(10)]);
    expect(f[0]).toBe(5 * 1e6); // mean 5 dps
    expect(f[1]).toBe(25 * 1e4); // variance 25
    expect(f[2]).toBe(10 * 1e6); // max 10 dps
    expect(f[3]).toBe(0.5 * 1e6); // half below threshold
  });

  it("saturates instead of overflowing uint32", () => {
    const f = extractFeatures([sample(1e9)]);
    expect(f[0]).toBe(0xffffffff);
    expect(f[2]).toBe(0xffffffff);
  });

  it("rejects an empty window", () => {
    expect(() => extractFeatures([])).toThrow(/no IMU samples/);
  });

  it("treats slow drift as still", () => {
    const f = extractFeatures([sample(STILL_THRESHOLD_DPS - 0.5)]);
    expect(f[3]).toBe(1e6);
  });
});

describe("similarity and matching", () => {
  const enrolled = extractFeatures([sample(2), sample(4), sample(6), sample(8)]);

  it("matches an identical window", () => {
    expect(cosineSimilarity(enrolled, enrolled)).toBeCloseTo(1, 12);
    expect(motionMatch(enrolled, enrolled).match).toBe(true);
  });

  it("rejects a flat, still window", () => {
    const still = extractFeatures([sample(0), sample(0), sample(0), sample(0)]);
    const m = motionMatch(enrolled, still);
    expect(m.match).toBe(false);
    expect(m.score).toBeLessThan(0.7);
  });

  it("is monotonic in movement intensity", () => {
    const near = extractFeatures([sample(3), sample(4), sample(5), sample(7)]);
    const far = extractFeatures([sample(50), sample(55), sample(60), sample(70)]);
    const nearScore = motionMatch(enrolled, near).score;
    const farScore = motionMatch(enrolled, far).score;
    expect(nearScore).toBeGreaterThan(farScore);
  });

  it("returns zero for two zero vectors", () => {
    const zero: [number, number, number, number] = [0, 0, 0, 0];
    expect(cosineSimilarity(zero, zero)).toBe(0);
  });
});

describe("featureSum", () => {
  it("sums the four integer features", () => {
    expect(featureSum([1, 2, 3, 4])).toBe(10);
  });
});
