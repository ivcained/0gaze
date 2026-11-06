/**
 * Verify a live glasses window against an enrolled profile.
 *
 *   npx tsx verify.ts --profile profile.json --tcp 7605 --seconds 3
 */
import { verifyMotionWindow } from "./verifyWindow.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const profilePath = arg("--profile", "profile.json")!;
const seconds = Number(arg("--seconds", "3"));
const tcp = arg("--tcp") ? Number(arg("--tcp")) : undefined;
const file = arg("--file");

const result = await verifyMotionWindow({ profilePath, seconds, tcp, file });
console.log(JSON.stringify({
  samples: result.samples,
  profileHash: result.profileHash,
  liveHash: result.liveHash,
  liveEnergy: result.liveEnergy,
  score: Number(result.score.toFixed(4)),
  threshold: result.threshold,
  match: result.match,
}, null, 2));
process.exit(result.match ? 0 : 1);
