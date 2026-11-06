/** Tests for the arming gate that makes the nod-of-assent impossible. */
import { describe, it, expect } from "vitest";
import { ArmingGate, ARMING } from "./arming.js";
import { synthSequence } from "./synthetic.js";
import type { ImuSample } from "./motion.js";

const STILL: ImuSample[] = Array.from({ length: 60 }, (_, i) => ({
  t: 1_000 + i * 2,
  tick: i + 1,
  ax: 0, ay: 9.62, az: 0,
  gx: 0, gy: 0, gz: 0,
  gxd: 0.4, gyd: -0.3, gzd: 0.2,
  ps: 7900, valid: 1,
}));

/** A nod, which is exactly what a wearer does to say "yes". */
const NOD: ImuSample[] = synthSequence(["up"]).filter((s) => Math.abs(s.gxd) > 20);

describe("ArmingGate", () => {
  it("never arms while the request card is still on screen", () => {
    const gate = new ArmingGate(0);
    for (let t = 0; t < ARMING.minCardMs; t += 100) {
      const s = gate.update(STILL, t);
      expect(s.armed).toBe(false);
      expect(s.phase).toBe("card");
    }
  });

  it("waits for genuine stillness after the card", () => {
    const gate = new ArmingGate(0);
    const t = ARMING.minCardMs + 100;
    const s = gate.update(STILL, t);
    expect(s.armed).toBe(false);
    expect(s.phase).toBe("settling");
  });

  it("arms only after stillness and the countdown have both elapsed", () => {
    const gate = new ArmingGate(0);
    const t0 = ARMING.minCardMs;
    gate.update(STILL, t0);
    gate.update(STILL, t0 + ARMING.stillMs + 10);
    const mid = gate.update(STILL, t0 + ARMING.stillMs + 20);
    expect(mid.phase).toBe("countdown");
    expect(mid.armed).toBe(false);
    const end = gate.update(STILL, t0 + ARMING.stillMs + ARMING.countdownMs + 40);
    expect(end.armed).toBe(true);
  });

  it("resets the stillness clock when the wearer moves", () => {
    const gate = new ArmingGate(0);
    const t0 = ARMING.minCardMs;
    gate.update(STILL, t0);
    gate.update(STILL, t0 + ARMING.stillMs - 100);
    // The nod-of-assent arrives here.
    const moving = gate.update(NOD, t0 + ARMING.stillMs - 90);
    expect(moving.armed).toBe(false);
    expect(moving.phase).toBe("settling");
    expect(moving.stillProgress).toBe(0);
  });

  it("restarts the countdown if the wearer moves during it", () => {
    const gate = new ArmingGate(0);
    const t0 = ARMING.minCardMs;
    gate.update(STILL, t0);
    gate.update(STILL, t0 + ARMING.stillMs + 5);
    gate.update(STILL, t0 + ARMING.stillMs + 100);
    const interrupted = gate.update(NOD, t0 + ARMING.stillMs + 200);
    expect(interrupted.armed).toBe(false);
    expect(interrupted.phase).toBe("settling");
  });

  it("auto-arms after the fallback window even with constant motion", () => {
    // A nervous wearer who never freezes must not be locked out: the card has
    // been up long enough that the instinctive nod window has passed.
    const gate = new ArmingGate(0);
    const s = gate.update(NOD, ARMING.autoArmMs + 100);
    expect(s.armed).toBe(true);
    expect(s.phase).toBe("armed");
  });

  it("does not auto-arm before the fallback window", () => {
    const gate = new ArmingGate(0);
    const s = gate.update(NOD, ARMING.autoArmMs - 500);
    expect(s.armed).toBe(false);
  });
});
