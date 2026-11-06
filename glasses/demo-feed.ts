/**
 * Deterministic gesture feeding for demos and testing. Instead of replaying a
 * stream on a wall clock (which races the challenge), the harness asks for one
 * gesture at a time and gets exactly one, in order.
 *
 * Amplitude is calibrated against the wearer's profile when one is present.
 * The flow filters gestures below deliberateFloor(expected) = max(12,
 * angleMedian * 0.55) as ambient motion, so the old fixed synth defaults
 * (~62 dps peak / 600 ms ≈ 22°) silently timed out against a real calibrated
 * signature: every gesture was filtered before it could count as an attempt,
 * on the approval AND the denial path. With a profile, each move is synthesized
 * to land near 85% of its direction's calibrated median angle (a small local
 * search adjusts the peak rate through the real segmenter), which sits inside
 * the envelope tolerance band and comfortably above every floor.
 *
 * Usage: npx tsx demo-feed.ts [wsUrl] [moves] [gapMs] [profilePath|none]
 */
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { synthSequence } from "./synthetic.js";
import { segmentGestures } from "./gestures.js";
import type { Direction } from "./gestures.js";

const url = process.argv[2] ?? "ws://127.0.0.1:7610/ws";
const moves = (process.argv[3] ?? "left,bendLeft,right").split(",") as Direction[];
const gapMs = Number(process.argv[4] ?? 2600);
const profileArg = process.argv[5] ?? "signature.json";

interface DirEnv { angleMedian: number; durationMedian?: number; peakMedian?: number }
let directions: Record<string, DirEnv> | null = null;
if (profileArg !== "none") {
  try {
    const sig = JSON.parse(readFileSync(profileArg, "utf8")) as { directions?: Record<string, DirEnv> };
    directions = sig.directions ?? null;
    if (directions) {
      const summary = Object.entries(directions)
        .map(([k, v]) => `${k} ${v.angleMedian.toFixed(1)}deg`)
        .join(", ");
      console.log(`[demo] profile ${profileArg}: medians ${summary}`);
    }
  } catch {
    console.log(`[demo] no profile at ${profileArg}: default synth amplitude (fine only when the UI is uncalibrated)`);
  }
}

function maxMedian(): number {
  const meds = Object.values(directions ?? {}).map((d) => d.angleMedian).filter(Number.isFinite);
  return meds.length ? Math.max(...meds) : 0;
}

/**
 * Synthesize exactly one gesture for `move`, scaled toward ~85% of the
 * calibrated median angle for that direction. A wrong-direction move targets
 * its own median, which still clears the expected direction's 0.55 floor.
 * Moves absent from the profile (never calibrated, e.g. "up") scale off the
 * largest calibrated median so they clear any floor too.
 */
function synthMove(move: Direction) {
  const env = directions?.[move];
  const median = env?.angleMedian ?? maxMedian();
  const targetDeg = median > 0 ? median * 0.85 : 0;
  const durationMs = env?.durationMedian ? Math.min(1200, Math.max(600, Math.round(env.durationMedian))) : 600;
  let peakDps = env?.peakMedian ?? 62;
  let samples = synthSequence([move], { peakDps, durationMs });
  let detected = segmentGestures(samples);
  if (targetDeg > 0) {
    for (let i = 0; i < 6 && detected.length === 1; i++) {
      const angle = Math.abs(detected[0].angleDeg);
      if (Math.abs(angle - targetDeg) / targetDeg < 0.06) break;
      peakDps = Math.min(400, Math.max(20, peakDps * (targetDeg / Math.max(angle, 1))));
      samples = synthSequence([move], { peakDps, durationMs });
      detected = segmentGestures(samples);
    }
  }
  return { detected, peakDps, durationMs };
}

const ws = new WebSocket(url);
let started = false;
const queue: Direction[] = [...moves];
let sent = 0;

ws.on("open", () => console.log("[demo] connected to the glasses UI"));
ws.on("message", (raw) => {
  let msg: { type?: string; state?: { phase?: string; index?: number; next?: string; armed?: boolean }; armed?: boolean };
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  const s = msg.state;
  if (!s) return;

  // Capture only opens after the arming gate confirms stillness, so the
  // harness must wait for that beat exactly as a real wearer would.
  const armed = msg.type === "arming" ? msg.armed : s.armed;
  if (s.phase === "challenge" && armed && !started) {
    started = true;
    console.log("[demo] challenge is live and capture is armed");
    pump();
  } else if (s.phase === "challenge" && !armed && !started) {
    // No IMU stream is attached in the harness, so the arming gate cannot see
    // stillness. Open capture explicitly, exactly as a still wearer would.
    ws.send(JSON.stringify({ type: "arm" }));
  }
  if (s.phase === "approved" || s.phase === "denied") {
    console.log(`[demo] flow finished: ${s.phase}`);
    ws.close();
    process.exit(0);
  }
});

function pump(): void {
  if (queue.length === 0) {
    console.log("[demo] all gestures sent");
    return;
  }
  const move = queue.shift()!;
  const { detected, peakDps, durationMs } = synthMove(move);
  if (detected.length !== 1) {
    console.error(`[demo] expected exactly one gesture for ${move}, got ${detected.length}`);
    process.exit(1);
  }
  const g = detected[0];
  console.log(`[demo] ${++sent}: ${g.direction} (${g.angleDeg.toFixed(1)}deg, ${g.peakRateDps.toFixed(0)}dps; synth ${peakDps.toFixed(0)}dps/${durationMs}ms)`);
  ws.send(JSON.stringify({ type: "gesture", gesture: g }));
  setTimeout(pump, gapMs);
}

setTimeout(() => {
  console.error("[demo] timed out waiting for a challenge");
  process.exit(1);
}, 45000);
