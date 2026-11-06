/**
 * Enroll a motion profile from real glasses samples.
 *
 *   ./imubridge --tcp 7605
 *   npx tsx enroll.ts --tcp 7605 --seconds 10 --out profile.json
 */
import { writeFileSync } from "node:fs";
import { captureWindow } from "./capture.js";
import { extractFeatures } from "./motion.js";
import { featureHash, type MotionProfile } from "./profile.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const seconds = Number(arg("--seconds", "10"));
const out = arg("--out", "profile.json")!;
const tcp = arg("--tcp") ? Number(arg("--tcp")) : undefined;
const file = arg("--file");

const samples = await captureWindow({ tcp, file, seconds });
const features = extractFeatures(samples);
const profile: MotionProfile = {
  version: 1,
  createdAt: new Date().toISOString(),
  source: "rayneo-air-imu",
  seconds,
  samples: samples.length,
  features,
  featureHash: featureHash(features),
  threshold: Number(arg("--threshold", "0.92")),
};
writeFileSync(out, JSON.stringify(profile, null, 2) + "\n");
console.log(`captured ${samples.length} samples over ${seconds}s`);
console.log("features:", features);
console.log("featureHash:", profile.featureHash);
console.log("wrote", out);
