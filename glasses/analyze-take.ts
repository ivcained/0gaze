/**
 * Scratch analyzer: replay a tail window of the bridge recording through the
 * real segmenter and print the gesture timeline. Usage:
 *   npx tsx analyze-tmp.ts <lastSeconds> [ndjsonPath]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { segmentGestures } from "./gestures.js";
import type { ImuSample } from "./motion.js";

const lastSeconds = Number(process.argv[2] ?? "120");
const path = process.argv[3] ?? "/tmp/bridge-loop.ndjson";

const all: ImuSample[] = [];
const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let s: ImuSample;
  try { s = JSON.parse(line); } catch { continue; }
  if (s.valid !== 1) continue;
  all.push(s);
}
if (all.length === 0) { console.log("no samples"); process.exit(0); }
const tMax = all[all.length - 1].t;
const from = tMax - lastSeconds * 1000;
const samples = all.filter((s) => s.t >= from);
console.log(`${all.length} total samples; t range ${(tMax - all[0].t) / 1000 | 0}s; analyzing last ${lastSeconds}s = ${samples.length} samples`);

const gestures = segmentGestures(samples);
console.log(`${gestures.length} gestures detected:`);
const t0 = samples[0].t;
for (const g of gestures) {
  const rel = ((g.startMs > 1e12 ? g.startMs - t0 : g.startMs) / 1000).toFixed(1);
  console.log(
    `+${rel.padStart(6)}s  ${g.direction.padEnd(10)} ${g.axis.padEnd(5)} angle=${g.angleDeg.toFixed(1).padStart(6)}  peak=${g.peakRateDps.toFixed(0).padStart(4)}  dur=${String(g.durationMs).padStart(5)}ms  smooth=${g.smoothness.toFixed(2)}`,
  );
}
