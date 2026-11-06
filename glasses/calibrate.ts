/**
 * glasses/calibrate.ts — measure THIS wearer's head-motion axes before any
 * challenge runs. The segmenter's axis signs are a device-frame guess; this
 * tool replaces the guess with measurements.
 *
 * For each of the four vocabulary moves (look left, look right, bend left,
 * bend right) it captures two live repetitions, reports the dominant axis,
 * sign and angle it actually saw, and writes a MotionSignature (envelopes +
 * calibrated direction vectors) that the UI server and agent load.
 *
 * Run with the glasses worn and imubridge streaming, and with the UI server
 * STOPPED (calibration owns the bridge's TCP feed):
 *   npx tsx calibrate.ts --tcp 7605 --out signature.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { captureWindow } from "./capture.js";
import { CARDINALS, familyOf, segmentGestures, type Direction, type Gesture } from "./gestures.js";
import { labelFor } from "./flow.js";
import { buildSignature } from "./signature.js";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const tcpPort = Number(arg("tcp", "7605"));
const replayPath = process.argv.find((a) => a.startsWith("--replay="))?.slice(9)
  ?? (process.argv.includes("--replay") ? process.argv[process.argv.indexOf("--replay") + 1] : undefined);
const outPath = resolve(arg("out", "signature.json"));
const reps = Number(arg("reps", "2"));
const windowSeconds = Number(arg("window", "3"));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Preflight: the bridge must be streaming, and the UI server must be down —
 * the bridge is single-client and hands the feed to the newest connection, so
 * a reconnecting UI server would steal samples mid-capture.
 */
async function preflight(): Promise<void> {
  const net = await import("node:net");
  const probe = (port: number) =>
    new Promise<boolean>((resolve) => {
      const s = net.createConnection({ host: "127.0.0.1", port });
      const t = setTimeout(() => { s.destroy(); resolve(false); }, 800);
      s.on("connect", () => { clearTimeout(t); s.destroy(); resolve(true); });
      s.on("error", () => { clearTimeout(t); resolve(false); });
    });

  if (!(await probe(tcpPort))) {
    console.error(`\nimubridge is not streaming on 127.0.0.1:${tcpPort}. Start it first (glasses plugged in and worn):`);
    console.error(`  cd ~/Projects/eyesonly/glasses && DYLD_LIBRARY_PATH=$PWD/sdk/build ./imubridge --tcp ${tcpPort} --seconds 7200 &\n`);
    process.exit(1);
  }
  if (await probe(7610)) {
    console.error("\nThe glasses UI server is running on 7610 and will steal the IMU feed mid-capture.");
    console.error("Stop it first (the demo script restarts it afterward):");
    console.error("  kill $(lsof -ti :7610)\n");
    process.exit(1);
  }
}

/** Wait for Enter, then capture and extract the best family-matching gesture. */
async function captureRep(direction: Direction): Promise<Gesture | null> {
  await rl.question(`  Press ENTER, then ${labelFor(direction).toUpperCase()} and hold briefly... `);
  const samples = await captureWindow(
    replayPath ? { file: replayPath, seconds: windowSeconds } : { tcp: tcpPort, seconds: windowSeconds },
  );
  const gestures = segmentGestures(samples);
  // The wearer's movement defines the label: take the strongest gesture from
  // the prompted axis family, whatever sign the device reported.
  const family = familyOf(direction);
  const candidates = gestures
    .filter((g) => g.axis === family)
    .sort((a, b) => Math.abs(b.angleDeg) - Math.abs(a.angleDeg));
  if (candidates.length > 0) return { ...candidates[0], direction };
  // Nothing in the family: report the strongest gesture of any kind so the
  // operator can see what the device actually measured.
  const any = [...gestures].sort((a, b) => Math.abs(b.angleDeg) - Math.abs(a.angleDeg))[0];
  if (any) {
    console.log(`    ! measured ${any.direction} (${any.axis}, ${any.angleDeg.toFixed(1)} deg) — not the prompted axis; repeat cleaner`);
  } else {
    console.log(`    ! no gesture detected in ${samples.length} samples — move more deliberately`);
  }
  return null;
}

async function main(): Promise<void> {
  await preflight();
  console.log("Glasses calibration — four moves, two reps each.");
  console.log("Sit naturally. Each rep: press ENTER, perform the move, return to center.\n");

  const recorded: Gesture[] = [];
  const table: { rep: string; axis: string; sign: string; angle: string; peak: string }[] = [];

  for (const dir of CARDINALS) {
    console.log(`${labelFor(dir)}:`);
    for (let i = 0; i < reps; i++) {
      let gesture = await captureRep(dir);
      // One retry per rep keeps calibration moving without silent gaps.
      if (!gesture) gesture = await captureRep(dir);
      if (gesture) {
        recorded.push(gesture);
        table.push({
          rep: `${labelFor(dir)} #${i + 1}`,
          axis: gesture.axis,
          sign: gesture.angleDeg >= 0 ? "+" : "-",
          angle: gesture.angleDeg.toFixed(1) + " deg",
          peak: gesture.peakRateDps.toFixed(0) + " dps",
        });
      }
    }
  }

  console.log("\nMeasured axes:");
  console.table(table);

  if (recorded.length < CARDINALS.length) {
    console.error(`Only ${recorded.length} reps captured (need at least one per direction) — signature not written.`);
    process.exitCode = 1;
    return;
  }

  const signature = buildSignature(recorded);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(signature, null, 2) + "\n");
  console.log(`\nCalibrated signature written to ${outPath}`);
  console.log(`Directions: ${Object.keys(signature.directions).join(", ")}`);
  console.log(`Vectors:    ${Object.keys(signature.vectors).join(", ")}`);
  console.log(`Commitment: ${signature.commitment.slice(0, 16)}...`);
  console.log(`\nLoad it in the demo: ui-server.ts --profile=${outPath}`);
}

main()
  .catch((err) => {
    console.error("calibration failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
