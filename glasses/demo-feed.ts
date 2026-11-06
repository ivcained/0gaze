/**
 * Deterministic gesture feeding for demos and testing. Instead of replaying a
 * stream on a wall clock (which races the challenge), the harness asks for one
 * gesture at a time and gets exactly one, in order.
 */
import WebSocket from "ws";
import { synthSequence } from "./synthetic.js";
import { segmentGestures } from "./gestures.js";
import type { Direction } from "./gestures.js";

const url = process.argv[2] ?? "ws://127.0.0.1:7610/ws";
const moves = (process.argv[3] ?? "down,left,right").split(",") as Direction[];
const gapMs = Number(process.argv[4] ?? 2600);

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
  const samples = synthSequence([move]);
  const detected = segmentGestures(samples);
  if (detected.length !== 1) {
    console.error(`[demo] expected exactly one gesture for ${move}, got ${detected.length}`);
    process.exit(1);
  }
  const g = detected[0];
  console.log(`[demo] ${++sent}: ${g.direction} (${g.angleDeg.toFixed(1)}deg, ${g.peakRateDps.toFixed(0)}dps)`);
  ws.send(JSON.stringify({ type: "gesture", gesture: g }));
  setTimeout(pump, gapMs);
}

setTimeout(() => {
  console.error("[demo] timed out waiting for a challenge");
  process.exit(1);
}, 45000);
