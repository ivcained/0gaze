/**
 * Decisive experiment: does gravity-referenced rotation separate the four
 * vocabulary moves better than raw device-frame rotation?
 *
 * Segments windows by total rate magnitude only (basis-independent, so neither
 * basis gets an advantage), then computes the net rotation of each window in
 * both bases and reports which one labels the move correctly and how cleanly.
 *
 * Ground truth: the calibration session at the head of the recording ran the
 * four moves in order, four reps each, so the i-th large clean window belongs
 * to a known direction.
 *
 *   npx tsx corpus/diagnose-basis.ts <ndjson> <headFraction>
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { ImuSample } from "../motion.js";

type Vec3 = [number, number, number];

const path = process.argv[2] ?? "corpus/recording-2026-11-06.ndjson";
/** Seconds of device time to analyze from the head of the recording. */
const headSeconds = Number(process.argv[3] ?? "600");

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v: Vec3): Vec3 | null => {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m < 1e-9 ? null : [v[0] / m, v[1] / m, v[2] / m];
};

// ---- load the head of the recording (stop early; the file is ~490MB) --------
const region: ImuSample[] = [];
let t0: number | null = null;
const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let s: ImuSample;
  try { s = JSON.parse(line); } catch { continue; }
  if (s.valid !== 1) continue;
  if (t0 === null) t0 = s.t;
  if (s.t - t0 > headSeconds * 1000) break;
  region.push(s);
  if (region.length % 100000 === 0) process.stderr.write(`\r  loaded ${region.length}`);
}
rl.close();
process.stderr.write("\n");

console.log(`analyzing head ${headSeconds}s = ${region.length} samples from ${path}`);

// ---- device tilt from the accelerometer -------------------------------------
function meanTilt(ss: ImuSample[]): { roll: number; pitch: number } {
  let r = 0, p = 0, n = 0;
  for (const s of ss) {
    const m = Math.hypot(s.ax, s.ay, s.az);
    if (m < 4 || m > 16) continue; // reject samples with linear acceleration
    r += Math.atan2(s.az, s.ay) * 180 / Math.PI;
    p += Math.atan2(-s.ax, Math.hypot(s.ay, s.az)) * 180 / Math.PI;
    n++;
  }
  return n ? { roll: r / n, pitch: p / n } : { roll: 0, pitch: 0 };
}
const tilt = meanTilt(region);
console.log(`mean device tilt in this region: roll ${tilt.roll.toFixed(1)}deg, pitch ${tilt.pitch.toFixed(1)}deg\n`);

// ---- gravity-aligned basis, frozen during motion ----------------------------
/**
 * The up-vector comes from the accelerometer, updated only while the head is
 * nearly still and smoothed slowly. A deliberate ear-to-shoulder bend really
 * does rotate the device ~35deg relative to gravity in ~0.7s, so tracking that
 * mid-move would corrupt the decomposition; freezing lets the estimate settle
 * in the idle gap before each gesture and hold through it.
 */
const STILL_DPS = 20;
const ALPHA = 0.01;
const ups: Vec3[] = new Array(region.length);
let up: Vec3 = norm([region[0]?.ax ?? 0, region[0]?.ay ?? 1, region[0]?.az ?? 0]) ?? [0, 1, 0];
for (let i = 0; i < region.length; i++) {
  const s = region[i];
  const rate = Math.hypot(s.gxd, s.gyd, s.gzd);
  if (rate < STILL_DPS) {
    const meas = norm([s.ax, s.ay, s.az]);
    if (meas) up = norm([up[0] + ALPHA * (meas[0] - up[0]), up[1] + ALPHA * (meas[1] - up[1]), up[2] + ALPHA * (meas[2] - up[2])]) ?? up;
  }
  ups[i] = up;
}

/** Decompose a device-frame rate into [pitch(lateral), yaw(vertical), roll(forward)]. */
function align(rate: Vec3, i: number): Vec3 {
  const u = ups[i];
  // Forward: device +Z projected perpendicular to up (glasses' forward axis).
  const z: Vec3 = [0, 0, 1];
  let f: Vec3 | null = norm([z[0] - dot(z, u) * u[0], z[1] - dot(z, u) * u[1], z[2] - dot(z, u) * u[2]]);
  if (!f) f = norm([1 - dot([1, 0, 0], u) * u[0], -dot([1, 0, 0], u) * u[1], -dot([1, 0, 0], u) * u[2]]);
  if (!f) return rate;
  const r = cross(f, u); // lateral axis, right-handed with the level case (X)
  return [dot(rate, r), dot(rate, u), dot(rate, f)];
}

// ---- basis-independent segmentation ----------------------------------------
const ONSET = 28, OFFSET = 12, SETTLE_MS = 90, MIN_MS = 130, MIN_ANGLE = 8;
interface Win { start: number; end: number; }
const wins: Win[] = [];
let open = -1, settledAt = -1;
for (let i = 0; i < region.length; i++) {
  const s = region[i];
  const rate = Math.hypot(s.gxd, s.gyd, s.gzd);
  if (open < 0) {
    if (rate > ONSET) open = i;
  } else if (rate < OFFSET) {
    if (settledAt < 0) settledAt = i;
    else if (s.t - region[settledAt].t >= SETTLE_MS) {
      wins.push({ start: open, end: settledAt });
      open = -1; settledAt = -1;
    }
  } else settledAt = -1;
}

/** Net integrated rotation over a window in a chosen basis. */
function netAngle(w: Win, basis: "device" | "gravity"): { v: Vec3; dur: number } {
  const acc: Vec3 = [0, 0, 0];
  let prev = region[w.start].t;
  for (let i = w.start; i <= w.end; i++) {
    const s = region[i];
    const dt = (s.t - prev) / 1000;
    prev = s.t;
    if (dt <= 0 || dt > 0.05) continue;
    const rate: Vec3 = basis === "device" ? [s.gxd, s.gyd, s.gzd] : align([s.gxd, s.gyd, s.gzd], i);
    acc[0] += rate[0] * dt; acc[1] += rate[1] * dt; acc[2] += rate[2] * dt;
  }
  return { v: acc, dur: region[w.end].t - region[w.start].t };
}

const LABEL_DEV = (i: number, v: Vec3) => (i === 0 ? (v[0] >= 0 ? "up" : "down") : i === 1 ? (v[1] >= 0 ? "left" : "right") : v[2] >= 0 ? "bendLeft" : "bendRight");

function describe(v: Vec3): { axis: number; angle: number; dominance: number; label: string } {
  const m = Math.hypot(v[0], v[1], v[2]);
  let axis = 0;
  if (Math.abs(v[1]) > Math.abs(v[axis])) axis = 1;
  if (Math.abs(v[2]) > Math.abs(v[axis])) axis = 2;
  return { axis, angle: v[axis], dominance: m > 1e-9 ? Math.abs(v[axis]) / m : 0, label: LABEL_DEV(axis, v) };
}

// ---- report -----------------------------------------------------------------
const rows = wins
  .map((w) => {
    const d = netAngle(w, "device");
    const g = netAngle(w, "gravity");
    return { w, d, g, dd: describe(d.v), gd: describe(g.v) };
  })
  .filter((r) => r.d.dur >= MIN_MS && Math.abs(r.dd.angle) >= MIN_ANGLE);

console.log(`${rows.length} windows (>= ${MIN_MS}ms, >= ${MIN_ANGLE}deg):`);
console.log("idx  dur(ms)  | device: label      angle  dom   | gravity: label      angle  dom   | agree");
rows.forEach((r, i) => {
  const agree = r.dd.label === r.gd.label ? "same" : "DIFFERS";
  console.log(
    `${String(i).padStart(3)}  ${String(r.d.dur).padStart(6)}  | ` +
    `${r.dd.label.padEnd(9)} ${r.dd.angle.toFixed(1).padStart(7)} ${r.dd.dominance.toFixed(2).padStart(5)}   | ` +
    `${r.gd.label.padEnd(9)} ${r.gd.angle.toFixed(1).padStart(7)} ${r.gd.dominance.toFixed(2).padStart(5)}   | ${agree}`,
  );
});

const disagree = rows.filter((r) => r.dd.label !== r.gd.label).length;
const domDev = rows.reduce((a, r) => a + r.dd.dominance, 0) / (rows.length || 1);
const domGrav = rows.reduce((a, r) => a + r.gd.dominance, 0) / (rows.length || 1);
console.log(`\nmean axis dominance: device ${domDev.toFixed(3)}  gravity ${domGrav.toFixed(3)}`);
console.log(`labels differing between bases: ${disagree}/${rows.length}`);
