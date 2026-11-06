/** Tests for the enrollment and challenge state machine. */
import { describe, it, expect } from "vitest";
import { SessionFlow, nextDirection, labelFor, INTER_MOVE_MS } from "./flow.js";
import type { Gesture, Direction } from "./gestures.js";
import { buildSignature, TOLERANCE } from "./signature.js";

function g(direction: Direction, angleDeg = 20, peak = 50, durationMs = 620): Gesture {
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

/** Feed gestures with a realistic gap between them, on one shared clock. */
let clock = 1_000_000;
function feed(flow: SessionFlow, gestures: Gesture[]): ReturnType<SessionFlow["onGesture"]>[] {
  flow.armCapture();
  return gestures.map((gesture) => {
    clock += 900;
    return flow.onGesture(gesture, clock);
  });
}

const spend = { id: "spend-1", amount: "100000", purpose: "image", chain: "eip155:1874" };

describe("enrollment", () => {
  it("walks all four directions in order", () => {
    const flow = new SessionFlow({ repsPerDirection: 2 });
    const s = flow.startEnrollment();
    expect(s.direction).toBe("left");

    feed(flow, [g("left"), g("left")]);
    expect(nextDirection(flow.current)).toBe("right");
    feed(flow, [g("right"), g("right")]);
    expect(nextDirection(flow.current)).toBe("bendLeft");
    feed(flow, [g("bendLeft"), g("bendLeft")]);
    expect(nextDirection(flow.current)).toBe("bendRight");
  });

  it("signals completion only after every direction is captured", () => {
    const flow = new SessionFlow({ repsPerDirection: 2 });
    flow.startEnrollment();
    const results = feed(flow, [
      g("left"), g("left"), g("right"), g("right"),
      g("bendLeft"), g("bendLeft"), g("bendRight"),
    ]);
    expect(results.some((r) => r.enrolled)).toBe(false);
    const last = feed(flow, [g("bendRight")]);
    expect(last[0].enrolled).toBe(true);
  });

  it("ignores a movement in the wrong direction without consuming a rep", () => {
    const flow = new SessionFlow({ repsPerDirection: 2 });
    flow.startEnrollment();
    feed(flow, [g("up")]); // asked for left
    const s = flow.current as { completed: Record<string, number>; rep: number };
    expect(s.completed.left ?? 0).toBe(0);
    expect(s.rep).toBe(0);
    expect(nextDirection(flow.current)).toBe("left");
  });

  it("counts repetitions separately per direction", () => {
    const flow = new SessionFlow({ repsPerDirection: 2 });
    flow.startEnrollment();
    feed(flow, [g("left"), g("left"), g("right")]);
    const s = flow.current as { completed: Record<string, number> };
    expect(s.completed.left).toBe(2);
    expect(s.completed.right).toBe(1);
  });

  it("ignores a second gesture that arrives too soon to be separate", () => {
    const flow = new SessionFlow({ repsPerDirection: 4 });
    flow.startEnrollment();
    flow.armCapture();
    flow.onGesture(g("left"), 1_000);
    flow.onGesture(g("left"), 1_000 + INTER_MOVE_MS - 10);
    const s = flow.current as { rep: number };
    expect(s.rep).toBe(1);
  });

  it("produces a signature from the captured set", () => {
    const flow = new SessionFlow({ repsPerDirection: 2 });
    flow.startEnrollment();
    feed(flow, [g("left"), g("left"), g("right"), g("right"), g("bendLeft"), g("bendLeft"), g("bendRight"), g("bendRight")]);
    const s = flow.current as { captured: Gesture[] };
    const sig = buildSignature(s.captured);
    expect(Object.keys(sig.directions).sort()).toEqual(["bendLeft", "bendRight", "left", "right"]);
    expect(sig.signatureHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("challenge", () => {
  /** A flow with an enrolled signature whose envelopes match the test gestures. */
  function enrolledFlow(reps = 2): SessionFlow {
    const flow = new SessionFlow({ repsPerDirection: reps, maxAttempts: 3 });
    flow.startEnrollment();
    feed(flow, [g("left"), g("left"), g("right"), g("right"), g("bendLeft"), g("bendLeft"), g("bendRight"), g("bendRight")]);
    const s = flow.current as { captured: Gesture[] };
    flow.takeSignature(buildSignature(s.captured));
    flow.reset();
    return flow;
  }

  it("advances one move at a time", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "up", "down"]);
    const r1 = feed(flow, [g("left")]);
    expect(r1[0].approved).toBeUndefined();
    expect(nextDirection(flow.current)).toBe("up");
  });

  it("approves when the full sequence matches", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "bendLeft", "right"]);
    const results = feed(flow, [g("left"), g("bendLeft"), g("right")]);
    expect(results[2].approved).toBe(true);
    expect(flow.current.phase).toBe("approved");
  });

  it("fails the attempt on a wrong direction and resets to the first move", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "bendLeft", "right"]);
    feed(flow, [g("left")]);
    // A wrong turn that is NOT the return-mirror of the accepted move burns
    // the attempt (mirrors are suppressed separately).
    feed(flow, [g("bendRight")]);
    const s = flow.current as { index: number; attempts: number; phase: string };
    expect(s.phase).toBe("challenge");
    expect(s.index).toBe(0);
    expect(s.attempts).toBe(2);
    expect(nextDirection(flow.current)).toBe("left");
  });

  it("denies after the attempt budget is spent", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "up", "down"]);
    feed(flow, [g("right")]);
    feed(flow, [g("right")]);
    const last = feed(flow, [g("right")]);
    expect(last[0].denied).toBe(true);
    expect(flow.current.phase).toBe("denied");
  });

  it("denies motion that is not the enrolled wearer's", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    // Same direction, wildly different dynamics.
    const wild = g("left", 120, 240, 180);
    const r = feed(flow, [wild]);
    expect(r[0].approved).toBeUndefined();
    const s = flow.current as { lastRejected: { match: { score: number } } };
    expect(s.lastRejected.match.score).toBeLessThan(TOLERANCE.passScore);
  });

  it("scoring uses the enrolled envelope, not a global constant", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    // The wearer's own left turn is ~20 deg at 50 dps; a 21 deg 52 dps repeat passes.
    const r = feed(flow, [g("left", 21, 52, 610)]);
    expect(r[0].approved).toBe(true);
  });

  it("records the match evidence for the episode log", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "right"]);
    feed(flow, [g("left"), g("right")]);
    const s = flow.current as { matches: { score: number }[]; gestures: Gesture[] };
    expect(s.matches).toHaveLength(2);
    expect(s.gestures).toHaveLength(2);
    expect(s.matches[0].score).toBeGreaterThan(0.5);
  });

  it("reports the spend alongside the approval", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    feed(flow, [g("left")]);
    const s = flow.current as { spend: typeof spend };
    expect(s.spend.id).toBe("spend-1");
  });

  it("cancels into a denial", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "up"]);
    const d = flow.cancel("wearer_declined");
    expect(d.phase).toBe("denied");
    expect(d.reason).toBe("wearer_declined");
    expect(flow.current.phase).toBe("denied");
  });

  it("does not accept a challenge before enrollment", () => {
    const flow = new SessionFlow();
    flow.startChallenge(spend, ["left"]);
    const r = feed(flow, [g("left")]);
    expect(r[0].approved).toBe(true); // no envelope means direction-only
  });

  it("ignores the return-to-center sweep after an accepted move", () => {
    // The 21:29 bench take was denied by exactly this: every accepted move
    // was followed by its mirror (the head returning to center), which
    // burned a wrong_direction attempt. Three mirrors, three attempts, dead.
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "bendLeft", "right"]);
    feed(flow, [g("left")]);
    feed(flow, [g("right", 16, 49, 560)]); // the return sweep
    const s = flow.current as { index: number; attempts: number };
    expect(s.index).toBe(1);
    expect(s.attempts).toBe(1);
    const r = feed(flow, [g("bendLeft"), g("right")]);
    expect(r[1].approved).toBe(true);
  });

  it("a full-size opposite move is not swallowed by the return rule", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left", "right"]);
    const r = feed(flow, [g("left"), g("right", 30, 55, 650)]);
    expect(r[1].approved).toBe(true);
  });

  it("ignores fidget junk without burning an attempt", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    // A messy multi-axis fidget: real moves measure smoothness >= 0.9.
    const junk: Gesture = { ...g("right"), smoothness: 0.3, angleDeg: 15 };
    flow.armCapture();
    flow.onGesture(junk, 5_000_000);
    let s = flow.current as { attempts: number; index: number };
    expect(s.attempts).toBe(1);
    expect(s.index).toBe(0);
    const r = flow.onGesture(g("left"), 5_001_000);
    expect(r.approved).toBe(true);
  });

  it("ignores sub-threshold micro moves without burning an attempt", () => {
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    flow.armCapture();
    // An 8deg clean sweep is settling motion, not a deliberate move.
    flow.onGesture(g("right", 8, 30, 400), 6_000_000);
    const s = flow.current as { attempts: number; index: number };
    expect(s.attempts).toBe(1);
    expect(s.index).toBe(0);
  });

  it("ignores natural nods without burning an attempt", () => {
    // Idle wear produces constant 8-23deg pitch bobs; they are not
    // vocabulary moves and must not count against the wearer.
    const flow = enrolledFlow();
    flow.startChallenge(spend, ["left"]);
    feed(flow, [g("down", 20, 45, 600)]);
    const s = flow.current as { index: number; attempts: number };
    expect(s.index).toBe(0);
    expect(s.attempts).toBe(1);
    const r = feed(flow, [g("left")]);
    expect(r[0].approved).toBe(true);
  });
});

describe("the nod-of-assent", () => {
  it("cannot be scored as the first move of a challenge", () => {
    const flow = new SessionFlow({ maxAttempts: 3 });
    flow.startEnrollment();
    feed(flow, [g("left"), g("left")]);
    flow.takeSignature(buildSignature((flow.current as { captured: Gesture[] }).captured));
    flow.reset();

    flow.startChallenge(spend, ["up", "left", "down"]);
    // The wearer nods "yes" at the request card. This must be discarded.
    const nodded = flow.onGesture(g("up"), 2_000_000);
    expect(nodded.ignored).toBe("before_armed");
    expect(flow.ignoredGestures).toBe(1);

    const s = flow.current as { index: number; attempts: number };
    expect(s.index).toBe(0);
    expect(s.attempts).toBe(1);
  });

  it("accepts the same move once capture is armed", () => {
    const flow = new SessionFlow();
    flow.startChallenge(spend, ["left"]);
    flow.armCapture();
    const r = flow.onGesture(g("left"), 2_000_000);
    expect(r.approved).toBe(true);
  });

  it("disarms capture again on every new challenge", () => {
    const flow = new SessionFlow();
    flow.startChallenge(spend, ["left"]);
    flow.armCapture();
    expect(flow.captureArmed).toBe(true);
    flow.startChallenge(spend, ["left"]);
    expect(flow.captureArmed).toBe(false);
  });

  it("disarms capture when enrollment starts", () => {
    const flow = new SessionFlow();
    flow.startEnrollment();
    expect(flow.captureArmed).toBe(false);
    const r = flow.onGesture(g("left"), 1_000);
    expect(r.ignored).toBe("before_armed");
  });
});

describe("labels", () => {
  it("names every direction in human language", () => {
    expect(labelFor("left")).toBe("Look left");
    expect(labelFor("bendRight")).toBe("Bend right");
  });
});
