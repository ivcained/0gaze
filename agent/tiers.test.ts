import { describe, it, expect } from "vitest";
import { classifySpend, describeTier, DEFAULT_TIERS } from "./tiers.js";

describe("classifySpend", () => {
  it("auto-pays below the floor", () => {
    expect(classifySpend(0n)).toBe("auto");
    expect(classifySpend(49_999n)).toBe("auto");
  });

  it("requires the motion gate at and above the floor", () => {
    expect(classifySpend(50_000n)).toBe("motion"); // exactly $0.05
    expect(classifySpend(10_000n, { floor: 9_999n, cap: 1_000_000n })).toBe("motion");
  });

  it("requires World ID above the cap", () => {
    expect(classifySpend(25_000_001n)).toBe("worldid");
  });

  it("keeps the cap itself on the motion tier", () => {
    expect(classifySpend(25_000_000n)).toBe("motion");
  });

  it("respects custom tiers", () => {
    const tight = { floor: 1n, cap: 2n };
    expect(classifySpend(0n, tight)).toBe("auto");
    expect(classifySpend(1n, tight)).toBe("motion");
    expect(classifySpend(2n, tight)).toBe("motion");
    expect(classifySpend(3n, tight)).toBe("worldid");
  });

  it("rejects negative amounts", () => {
    expect(() => classifySpend(-1n)).toThrow(RangeError);
  });

  it("has the documented defaults: $0.05 floor, $25 cap", () => {
    expect(DEFAULT_TIERS.floor).toBe(50_000n);
    expect(DEFAULT_TIERS.cap).toBe(25_000_000n);
  });
});

describe("describeTier", () => {
  it("describes every tier", () => {
    expect(describeTier("auto")).toContain("auto-pay");
    expect(describeTier("motion")).toContain("motion gate");
    expect(describeTier("worldid")).toContain("World ID");
  });
});
