/**
 * Replay a recorded session through the REAL pipeline (segmenter + flow +
 * the wearer's signature) and report what the challenge would have done.
 *
 * This is the offline substitute for hardware-in-the-loop testing: the
 * recording contains real head motion, so a fix can be validated against the
 * take that actually failed instead of against synthetic gestures.
 *
 * Mirrors ui-server.ts exactly: rolling 2.5s window, processWindow every ~40
 * samples, trim past the last completed gesture.
 *
 *   npx tsx corpus/replay-take.ts <ndjson> [skipSeconds] [takeSeconds] [sequence]
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { segmentGestures } from "../gestures.js";
import { SessionFlow, type FlowState } from "../flow.js";
import type { MotionSignature } from "../signature.js";
import type { ImuSample } from "../motion.js";
import type { Direction } from "../gestures.js";

const path = process.argv[2] ?? "corpus/recording-2026-11-06.ndjson";
const skipSeconds = Number(process.argv[3] ?? 0);
const takeSeconds = Number(process.argv[4] ?? 240);
const sequence = (process.argv[5] ?? "left,bendLeft,right").split(",") as Direction[];
const sigPath = process.argv[6] ?? "signature.json";

// ---- load the window --------------------------------------------------------
const samples: ImuSample[] = [];
let t0: number | null = null;
let tStart: number | null = null;
const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let s: ImuSample;
  try { s = JSON.parse(line); } catch { continue; }
  if (s.valid !== 1) continue;
  if (t0 === null) t0 = s.t;
  const rel = (s.t - t0) / 1000;
  if (rel < skipSeconds) continue;
  if (tStart === null) tStart = s.t;
  if (s.t - tStart > takeSeconds * 1000) break;
  samples.push(s);
}
rl.close();
console.log(`replaying ${samples.length} samples (${((samples.length / 496) | 0)}s) from +${skipSeconds}s`);

// ---- real pipeline ---------------------------------------------------------
const sig = JSON.parse(readFileSync(sigPath, "utf8")) as MotionSignature;
const flow = new SessionFlow({ repsPerDirection: 4, maxAttempts: 5 });
flow.takeSignature(sig);
flow.startChallenge(
  { id: "replay", amount: "100000", purpose: "offline replay", chain: "eip155:1874" },
  sequence,
);
flow.armCapture();

console.log(`signature: ${Object.keys(sig.directions).join(", ")}`);
console.log(`challenge: ${sequence.join(" -> ")}\n`);

const WINDOW_MS = 2500;
let buffer: ImuSample[] = [];
let sinceProcess = 40;
let seen = 0;
const tBase = samples[0].t;

for (const s of samples) {
  buffer.push(s);
  if (++sinceProcess < 40) continue;
  sinceProcess = 0;

  // trim to the rolling window
  const cutoff = buffer[buffer.length - 1].t - WINDOW_MS;
  let drop = 0;
  while (drop < buffer.length && buffer[drop].t < cutoff) drop++;
  if (drop > 0) buffer = buffer.slice(drop);

  const before = flow.current as { index?: number; attempts?: number; phase: string };
  const beforeIndex = before.index ?? -1;
  const beforeAttempts = before.attempts ?? -1;

  const gestures = segmentGestures(buffer);
  for (const g of gestures) {
    seen++;
    const res = flow.onGesture(g, g.startMs);
    const after = flow.current as { index?: number; attempts?: number; phase: string; reason?: string };
    const t = ((g.startMs - tBase) / 1000).toFixed(1);
    let verdict: string;
    if (res.approved) verdict = "APPROVED";
    else if (res.denied) verdict = `DENIED (${after.reason})`;
    else if (res.ignored) verdict = `ignored:${res.ignored}`;
    else if ((after.index ?? -1) > beforeIndex) verdict = "accepted -> move " + ((after.index ?? 0) + 1);
    else if ((after.attempts ?? -1) > beforeAttempts) verdict = "ATTEMPT BURNED";
    else verdict = "filtered (junk/mirror/nod)";
    console.log(
      `+${String(t).padStart(6)}s ${g.direction.padEnd(10)} angle=${g.angleDeg.toFixed(1).padStart(6)} smooth=${g.smoothness.toFixed(2)} dom-peak=${g.peakRateDps.toFixed(0).padStart(4)} -> ${verdict}`,
    );
  }
  if (gestures.length > 0) {
    const last = gestures[gestures.length - 1];
    const lastEnd = last.startMs + last.durationMs;
    buffer = buffer.filter((x) => x.t > lastEnd);
  }
  if (flow.current.phase === "approved" || flow.current.phase === "denied") break;
}

const final = flow.current as FlowState & { reason?: string };
console.log(`\n${seen} gestures reached the flow`);
console.log(`final phase: ${final.phase}${final.reason ? ` (${final.reason})` : ""}`);
process.exitCode = final.phase === "approved" ? 0 : 1;
