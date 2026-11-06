/**
 * The authorization flow: a small state machine driven by detected gestures.
 *
 * It is deliberately free of I/O and timers so it can be tested directly; the
 * server feeds it gestures and reads the state back for rendering.
 */
import { CARDINALS, classifyDirection, familyOf, type Direction, type Gesture } from "./gestures.js";
import {
  matchAgainstEnvelope,
  type MotionSignature,
  TOLERANCE,
  type DirectionMatch,
} from "./signature.js";

export type Phase = "idle" | "enroll" | "challenge" | "approved" | "denied";

/** A gesture that arrived while the wearer was still reading the request. */
export interface IgnoredGesture {
  direction: Direction;
  reason: "before_armed";
}

export interface EnrollState {
  phase: "enroll";
  /** The move currently being asked for. */
  direction: Direction;
  /** 0-based repetition index for this direction. */
  rep: number;
  repsPerDirection: number;
  /** How many of each direction are complete. */
  completed: Partial<Record<Direction, number>>;
  captured: Gesture[];
  /** Set briefly after a good rep so the UI can flash a check. */
  lastAccepted: Gesture | null;
  /** Set when a rep was seen but did not resemble the others. */
  lastRejected: DirectionMatch | null;
}

export interface ChallengeState {
  phase: "challenge";
  sequence: Direction[];
  /** Index of the move being asked for now. */
  index: number;
  attempts: number;
  maxAttempts: number;
  /** Gestures accepted so far in this attempt. */
  accepted: Gesture[];
  matches: DirectionMatch[];
  lastRejected: { expected: Direction; received: Direction | null; match: DirectionMatch | null } | null;
  spend: { id: string; amount: string; purpose: string; chain: string };
}

export interface ApprovedState {
  phase: "approved";
  sequence: Direction[];
  gestures: Gesture[];
  matches: DirectionMatch[];
  spend: ChallengeState["spend"];
}

export interface DeniedState {
  phase: "denied";
  reason: string;
  expected: Direction[];
  spend?: ChallengeState["spend"];
}

export type FlowState = { phase: "idle" } | EnrollState | ChallengeState | ApprovedState | DeniedState;

export interface FlowOptions {
  repsPerDirection?: number;
  maxAttempts?: number;
  /** Minimum score for a gesture to count as the wearer's own. */
  passScore?: number;
}

/** Inter-gesture gap the flow waits for before accepting the next move. */
export const INTER_MOVE_MS = 180;

/**
 * After an accepted challenge move the head returns to center, and that
 * return sweep segments as the MIRROR move in the same axis family. Bench
 * recording: left 18.9deg accepted, right 16.6deg 0.9s later; each mirror
 * burned a wrong_direction attempt and three denied the 21:29 take.
 */
export const RECENTER_MS = 2200;

/** The opposite move in the same axis family (the return-to-center sweep). */
export function mirrorOf(direction: Direction): Direction {
  switch (direction) {
    case "left": return "right";
    case "right": return "left";
    case "bendLeft": return "bendRight";
    case "bendRight": return "bendLeft";
    case "up": return "down";
    case "down": return "up";
  }
}

export class SessionFlow {
  private state: FlowState = { phase: "idle" };
  private readonly repsPerDirection: number;
  private readonly maxAttempts: number;
  private readonly passScore: number;
  private signature: MotionSignature | null = null;
  private lastGestureAt = 0;
  /** Last accepted challenge move, for return-to-center suppression. */
  private lastAcceptedMove: { direction: Direction; angleDeg: number; at: number } | null = null;
  /** Capture is disarmed until the arming gate opens it. */
  private armed = false;
  /** Count of gestures discarded because capture was not armed. */
  private ignoredCount = 0;

  constructor(opts: FlowOptions = {}) {
    this.repsPerDirection = opts.repsPerDirection ?? 4;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.passScore = opts.passScore ?? TOLERANCE.passScore;
  }

  /** The arming gate calls this once the wearer is still and ready. */
  armCapture(): void {
    this.armed = true;
    // A gesture that happened before arming must not be scored, and the
    // inter-move guard must not reject the first real move.
    this.lastGestureAt = 0;
  }

  get captureArmed(): boolean {
    return this.armed;
  }

  get ignoredGestures(): number {
    return this.ignoredCount;
  }

  get current(): FlowState {
    return this.state;
  }

  get enrolled(): boolean {
    return this.signature !== null;
  }

  get motionSignature(): MotionSignature | null {
    return this.signature;
  }

  reset(): void {
    this.state = { phase: "idle" };
  }

  /** Result of a completed enrollment, ready to persist. */
  takeSignature(sig: MotionSignature): void {
    this.signature = sig;
  }

  startEnrollment(): EnrollState {
    this.state = {
      phase: "enroll",
      direction: CARDINALS[0],
      rep: 0,
      repsPerDirection: this.repsPerDirection,
      completed: {},
      captured: [],
      lastAccepted: null,
      lastRejected: null,
    };
    this.lastGestureAt = 0;
    // Enrollment still arms through the gate, so the wearer is not captured
    // mid-nod while reading the first instruction.
    this.armed = false;
    return this.state;
  }

  startChallenge(
    spend: ChallengeState["spend"],
    sequence: Direction[],
  ): ChallengeState {
    this.state = {
      phase: "challenge",
      sequence,
      index: 0,
      attempts: 1,
      maxAttempts: this.maxAttempts,
      accepted: [],
      matches: [],
      lastRejected: null,
      spend,
    };
    this.lastGestureAt = 0;
    this.lastAcceptedMove = null;
    // The nod-of-assent is the single most dangerous failure in this design:
    // the wearer nods "yes" at the request card and that nod would otherwise
    // become move 1. Capture stays closed until the arming gate opens it.
    this.armed = false;
    return this.state;
  }

  /**
   * Feed one detected gesture. Returns true when the caller should do
   * something (persist a signature, settle a payment).
   */
  onGesture(gesture: Gesture, now = Date.now()): { enrolled?: boolean; approved?: boolean; denied?: boolean; ignored?: "before_armed" } {
    // Nothing is scored before the arming gate opens. This is what makes the
    // nod-of-assent impossible rather than merely unlikely.
    if (!this.armed) {
      this.ignoredCount += 1;
      return { ignored: "before_armed" };
    }
    // Two gestures arriving nearly together are almost always one movement
    // split by the segmenter; the UI must not score a double-consume.
    if (this.lastGestureAt && now - this.lastGestureAt < INTER_MOVE_MS) return {};
    this.lastGestureAt = now;

    if (this.state.phase === "challenge") {
      // Natural head bobbing (pitch/nod) is not in the challenge vocabulary:
      // ignore it instead of burning an attempt on every nod. The 21:29 take
      // recording shows constant 8-23deg nods during idle wear.
      if (familyOf(gesture.direction) === "nod") return {};

      // Junk filter: fidgets and multi-axis settling motion are not
      // deliberate moves. The 23:00 take recording shows 8-12deg gestures at
      // smoothness 0.13-0.58 interleaved with the real moves, and each one
      // burned a wrong_direction attempt. A deliberate calibrated rotation
      // is a clean single-axis sweep (smoothness >= 0.9 in enrollment) of at
      // least 12deg. Ignoring junk costs the wearer a repeat; counting it
      // costs an attempt.
      if (gesture.smoothness < 0.55 || Math.abs(gesture.angleDeg) < 12) return {};

      // The return-to-center sweep after an accepted move mirrors that move
      // in the same axis family. Ignore the mirror when it follows quickly,
      // is not larger than the accepted move, and is NOT itself the expected
      // next direction (a genuine mirror move that the challenge asks for
      // passes through and the envelope judges its size).
      const last = this.lastAcceptedMove;
      const seq = this.state as ChallengeState;
      const expected = seq.sequence[seq.index];
      if (
        last &&
        gesture.direction !== expected &&
        now - last.at <= RECENTER_MS &&
        gesture.direction === mirrorOf(last.direction) &&
        Math.abs(gesture.angleDeg) <= Math.abs(last.angleDeg) * 1.3
      ) {
        return {};
      }
    }

    if (this.state.phase === "enroll") return this.onEnrollGesture(gesture);
    if (this.state.phase === "challenge") return this.onChallengeGesture(gesture, now);
    return {};
  }

  private onEnrollGesture(gesture: Gesture): { enrolled?: boolean } {
    const s = this.state as EnrollState;
    const expected = s.direction;

    // Calibration semantics: when asked to look left, whatever yaw movement
    // this wearer produced IS their left. Accept the whole axis family and
    // record it under the prompted label, so the device-frame sign guess can
    // never block enrollment — the measured vector becomes the truth.
    if (familyOf(gesture.direction) !== familyOf(expected)) {
      s.lastRejected = null;
      s.lastAccepted = null;
      (s as EnrollState & { wrongWay?: Direction }).wrongWay = gesture.direction;
      return {};
    }
    delete (s as EnrollState & { wrongWay?: Direction }).wrongWay;

    s.captured.push({ ...gesture, direction: expected });
    s.lastAccepted = gesture;
    s.lastRejected = null;
    s.completed[expected] = (s.completed[expected] ?? 0) + 1;
    s.rep += 1;

    if (s.rep >= s.repsPerDirection) {
      const next = CARDINALS[CARDINALS.indexOf(expected) + 1];
      if (!next) {
        // Every direction captured: the caller builds and stores the signature.
        return { enrolled: true };
      }
      s.direction = next;
      s.rep = 0;
    }
    return {};
  }

  private onChallengeGesture(gesture: Gesture, now: number): { approved?: boolean; denied?: boolean } {
    const s = this.state as ChallengeState;
    const expected = s.sequence[s.index];

    // Classify against the wearer's calibrated vectors when available; the raw
    // segmenter label is only a device-frame guess.
    const calibrated = classifyDirection(gesture, this.signature?.vectors ?? {});
    const effective = calibrated ?? gesture.direction;

    if (effective !== expected) {
      s.lastRejected = { expected, received: effective, match: null };
      this.failAttempt("wrong_direction");
      return this.phaseVerdict();
    }

    const env = this.signature?.directions[expected];
    const match = env
      ? matchAgainstEnvelope(gesture, env)
      : { direction: gesture.direction, score: 1, angleDelta: 0, peakDelta: 0, durationDelta: 0, reasons: [] };

    if (match.score < this.passScore) {
      s.lastRejected = { expected, received: gesture.direction, match };
      this.failAttempt("not_your_motion");
      return this.phaseVerdict();
    }

    s.accepted.push(gesture);
    s.matches.push(match);
    s.lastRejected = null;
    s.index += 1;
    this.lastAcceptedMove = { direction: effective, angleDeg: gesture.angleDeg, at: now };

    if (s.index >= s.sequence.length) {
      this.state = {
        phase: "approved",
        sequence: s.sequence,
        gestures: s.accepted,
        matches: s.matches,
        spend: s.spend,
      };
      return { approved: true };
    }
    return {};
  }

  private failAttempt(reason: string): void {
    const s = this.state as ChallengeState;
    s.attempts += 1;
    s.accepted = [];
    s.matches = [];
    s.index = 0;
    if (s.attempts > s.maxAttempts) {
      this.state = {
        phase: "denied",
        reason: `${reason}_after_${s.maxAttempts}_attempts`,
        expected: s.sequence,
        spend: s.spend,
      };
    }
  }

  private phaseVerdict(): { approved?: boolean; denied?: boolean } {
    if (this.state.phase === "denied") return { denied: true };
    return {};
  }

  /** Called by the UI's cancel affordance or a timeout. */
  cancel(reason = "cancelled"): DeniedState {
    const spend = this.state.phase === "challenge" ? this.state.spend : undefined;
    const expected = this.state.phase === "challenge" ? this.state.sequence : [];
    const denied: DeniedState = { phase: "denied", reason, expected, spend };
    this.state = denied;
    return denied;
  }
}

/** Which direction the wearer must perform next, or null when done. */
export function nextDirection(state: FlowState): Direction | null {
  if (state.phase === "enroll") return state.direction;
  if (state.phase === "challenge") return state.sequence[state.index] ?? null;
  return null;
}

/** Human-facing label for a direction. */
export function labelFor(direction: Direction): string {
  switch (direction) {
    case "up": return "Look up";
    case "down": return "Look down";
    case "left": return "Look left";
    case "right": return "Look right";
    case "bendLeft": return "Bend left";
    case "bendRight": return "Bend right";
  }
}
