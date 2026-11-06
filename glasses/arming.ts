/**
 * Arming gate: capture must never be live while the wearer is reading the
 * request or nodding "yes" at it.
 *
 * Two safeguards, both measured against the real IMU stream:
 *   1. The request card is visible for at least MIN_CARD_MS.
 *   2. The head must then be genuinely still for STILL_MS before the first
 *      move is asked for. A nod resets the stillness clock.
 *
 * After that, an arming countdown runs. Any motion during the countdown
 * restarts it, so the nod-of-assent can never be scored as a challenge move.
 */
import type { ImuSample } from "./motion.js";

export const ARMING = {
  /** The card must be on screen at least this long. */
  minCardMs: 1200,
  /** Head must be below the motion floor for this long to arm capture. */
  stillMs: 700,
  /** Mean rate that counts as still. A deliberate nod runs 40-70 dps;
   *  ambient head motion averages ~1.4 dps (measured p50 on hardware). */
  stillDps: 12,
  /** Visible countdown after stillness is confirmed. */
  countdownMs: 700,
  /** Never deadlock: arm anyway after this long. The nod-of-assent risk is
   *  front-loaded (the instinctive nod lands in the first ~2 s); a wearer
   *  who has read the card for 5 s and is still fidgeting gets armed. */
  autoArmMs: 5000,
} as const;

export type ArmingPhase = "card" | "settling" | "countdown" | "armed";

export interface ArmingState {
  phase: ArmingPhase;
  /** 0..1 progress of the stillness requirement. */
  stillProgress: number;
  /** Seconds left in the countdown, for display. */
  countdownSeconds: number;
  /** True once the wearer may start the first move. */
  armed: boolean;
}

export class ArmingGate {
  private startMs: number;
  private stillSince: number | null = null;
  private countdownStarted: number | null = null;
  private lastMs: number;

  constructor(now: number) {
    this.startMs = now;
    this.lastMs = now;
  }

  /** Feed the latest samples and current time; returns what to show. */
  update(samples: ImuSample[], now: number): ArmingState {
    this.lastMs = now;
    const rate = this.currentRate(samples);
    const elapsed = now - this.startMs;

    // Phase 1: the request card. Nothing the wearer does is captured.
    if (elapsed < ARMING.minCardMs) {
      return { phase: "card", stillProgress: 0, countdownSeconds: 0, armed: false };
    }

    // Fallback: a wearer who never freezes must not be locked out forever.
    if (elapsed >= ARMING.autoArmMs) {
      return { phase: "armed", stillProgress: 1, countdownSeconds: 0, armed: true };
    }

    // Phase 2: wait for genuine stillness. Any movement resets the clock.
    if (rate > ARMING.stillDps) {
      this.stillSince = null;
      this.countdownStarted = null;
      return { phase: "settling", stillProgress: 0, countdownSeconds: 0, armed: false };
    }
    if (this.stillSince === null) this.stillSince = now;
    const stillFor = now - this.stillSince;

    if (stillFor < ARMING.stillMs) {
      return {
        phase: "settling",
        stillProgress: Math.min(1, stillFor / ARMING.stillMs),
        countdownSeconds: 0,
        armed: false,
      };
    }

    // Phase 3: a short, visible countdown. Motion restarts it.
    if (this.countdownStarted === null) this.countdownStarted = now;
    const cdFor = now - this.countdownStarted;
    if (cdFor < ARMING.countdownMs) {
      return {
        phase: "countdown",
        stillProgress: 1,
        countdownSeconds: Math.ceil((ARMING.countdownMs - cdFor) / 1000),
        armed: false,
      };
    }

    return { phase: "armed", stillProgress: 1, countdownSeconds: 0, armed: true };
  }

  /** Mean recent angular rate on the sample timeline.
   *  Mean, not peak: a single ambient spike (measured p99 ≈ 26 dps) must not
   *  reset the stillness clock, while a real nod (sustained 40-70 dps) still
   *  towers over the 12 dps floor. */
  private currentRate(samples: ImuSample[]): number {
    if (samples.length === 0) return 0;
    // Anchor on the newest sample's own timestamp: the caller's clock and the
    // device timeline can differ (replay, injected fixtures, clock skew).
    const newest = samples[samples.length - 1].t;
    const cutoff = newest - 140;
    let sum = 0;
    let n = 0;
    for (let i = samples.length - 1; i >= 0 && samples[i].t >= cutoff; i--) {
      sum += Math.hypot(samples[i].gxd, samples[i].gyd, samples[i].gzd);
      n++;
    }
    return n ? sum / n : 0;
  }

  get elapsedMs(): number {
    return this.lastMs - this.startMs;
  }
}
