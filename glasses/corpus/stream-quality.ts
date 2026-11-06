/**
 * Stream-integrity diagnostic: is the IMU feed itself degraded?
 *
 * The take replay showed 200ms spikes at 110-138 dps integrating to only
 * 9-22deg, in bursts of three within 300ms. Calibration moves had the same
 * peak rates but 3-5x the angle over 700-1200ms. Fragmented delivery would
 * explain exactly that: the integrator skips gaps > 50ms, so a real turn with
 * dropped samples loses most of its angle while keeping its peaks.
 *
 *   npx tsx corpus/stream-quality.ts <ndjson> [skipSeconds] [seconds]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const path = process.argv[2] ?? "corpus/recording-2026-11-06.ndjson";
const skipSeconds = Number(process.argv[3] ?? 0);
const seconds = Number(process.argv[4] ?? 300);

let t0: number | null = null;
let tStart: number | null = null;
let n = 0;
let prevT = 0;
let prevTick = 0;
const gaps: number[] = [];
let dupTick = 0;
let backTick = 0;
let nonMono = 0;
let maxGap = 0;
let sumGap = 0;
let lastT = 0;
const buckets = { "<=3ms": 0, "4-10ms": 0, "11-50ms": 0, "51-200ms": 0, ">200ms": 0 };

const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let s: { t: number; tick: number; valid: number };
  try { s = JSON.parse(line); } catch { continue; }
  if (s.valid !== 1) continue;
  if (t0 === null) t0 = s.t;
  const rel = (s.t - t0) / 1000;
  if (rel < skipSeconds) continue;
  if (tStart === null) { tStart = s.t; prevT = s.t; prevTick = s.tick; lastT = s.t; n = 1; continue; }
  if (s.t - tStart > seconds * 1000) break;

  n++;
  lastT = s.t;
  const dt = s.t - prevT;
  if (dt < 0) nonMono++;
  else {
    sumGap += dt;
    if (dt > maxGap) maxGap = dt;
    gaps.push(dt);
    if (dt <= 3) buckets["<=3ms"]++;
    else if (dt <= 10) buckets["4-10ms"]++;
    else if (dt <= 50) buckets["11-50ms"]++;
    else if (dt <= 200) buckets["51-200ms"]++;
    else buckets[">200ms"]++;
  }
  if (s.tick === prevTick) dupTick++;
  else if (s.tick < prevTick) backTick++;
  prevT = s.t;
  prevTick = s.tick;
}
rl.close();

const spanS = (lastT - (tStart ?? lastT)) / 1000;
const sorted = gaps.sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0;

console.log(`window: +${skipSeconds}s for ${seconds}s`);
console.log(`samples: ${n} over ${spanS.toFixed(1)}s -> effective ${(n / (spanS || 1)).toFixed(1)} Hz (device nominal ~496)`);
console.log(`mean gap ${(sumGap / (gaps.length || 1)).toFixed(2)}ms  p50 ${pct(0.5)}ms  p95 ${pct(0.95)}ms  p99 ${pct(0.99)}ms  max ${maxGap}ms`);
console.log(`gap buckets:`, buckets);
console.log(`duplicate ticks: ${dupTick}  backwards ticks: ${backTick}  non-monotonic t: ${nonMono}`);
const lostMs = gaps.filter((g) => g > 50).reduce((a, b) => a + b - 2, 0);
console.log(`time lost to >50ms gaps: ${(lostMs / 1000).toFixed(2)}s of ${spanS.toFixed(1)}s (${((lostMs / 1000 / (spanS || 1)) * 100).toFixed(1)}%)`);
