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
  minCardMs: 1400,
  /** Head must be below the motion floor for this long to arm capture. */
  stillMs: 900,
  /** Rate that counts as still, matching the segmenter's offset threshold. */
  stillDps: 12,
  /** Visible countdown after stillness is confirmed. */
  countdownMs: 900,
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

  /** Peak recent angular rate, measured on the sample timeline. */
  private currentRate(samples: ImuSample[]): number {
    if (samples.length === 0) return 0;
    // Use the newest sample's own timestamp as the anchor. Anchoring on the
    // caller's clock silently reads "still" whenever the two timelines differ
    // (replay, injected fixtures, clock skew), which would arm capture during
    // the nod this gate exists to block.
    const newest = samples[samples.length - 1].t;
    const cutoff = newest - 140;
    let peak = 0;
    for (let i = samples.length - 1; i >= 0 && samples[i].t >= cutoff; i--) {
      peak = Math.max(peak, Math.hypot(samples[i].gxd, samples[i].gyd, samples[i].gzd));
    }
    return peak;
  }

  get elapsedMs(): number {
    return this.lastMs - this.startMs;
  }
}
