/**
 * Dev trusted-setup for the EyesOnly motion circuit.
 *
 * NOT FOR PRODUCTION. Uses random local entropy contributions so the whole
 * ceremony runs unattended. For anything real, run a proper multi-party
 * powers-of-tau ceremony (or reuse an existing per-bucket Hermes/ptau file).
 *
 * Usage: node scripts/setup-dev.mjs
 * Requires: circom 2.x on PATH, and `npm install` already run here.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "build");
const circuits = path.join(root, "../circuits");
const circom = path.join(circuits, "motion_proof.circom");
const snarkjsCli = path.join(root, "node_modules/snarkjs/build/cli.cjs");

const run = (cmd, args) => {
  console.log("$", cmd, ...args);
  execFileSync(cmd, args, { stdio: "inherit" });
};
const snarkjs = (args) => run("node", [snarkjsCli, ...args]);

mkdirSync(build, { recursive: true });

// 1. Compile (needs circom installed: https://docs.circom.io/getting-started/installation/)
if (!existsSync(path.join(build, "motion_proof_js", "motion_proof.wasm"))) {
  run("circom", [
    circom,
    "--r1cs", "--wasm", "--sym",
    "-o", build,
    "-l", path.join(root, "node_modules/circomlib/circuits"),
  ]);
} else {
  console.log("WASM already built, skipping circom compile");
}

// circom emits CommonJS glue; this package is "type": "module"
writeFileSync(
  path.join(build, "motion_proof_js", "package.json"),
  '{"type":"commonjs"}\n',
);

const ptau0 = path.join(build, "pot16_0000.ptau");
const ptau1 = path.join(build, "pot16_0001.ptau");
const ptauF = path.join(build, "pot16_final.ptau");
const zkey0 = path.join(build, "motion_proof_0000.zkey");
const zkey1 = path.join(build, "motion_proof_0001.zkey");
const zkeyF = path.join(build, "motion_proof_final.zkey");

// 2. Powers of tau (2^16 covers ~32k constraints x2)
snarkjs(["powersoftau", "new", "bn128", "16", ptau0, "-v"]);
snarkjs(["powersoftau", "contribute", ptau0, ptau1,
  "--name=eyesonly-dev", `-e=${randomBytes(32).toString("hex")}`]);
snarkjs(["powersoftau", "prepare", "phase2", ptau1, ptauF, "-v"]);

// 3. Circuit-specific phase 2 + random contribution + zkey verify
snarkjs(["groth16", "setup", path.join(build, "motion_proof.r1cs"), ptauF, zkey0]);
snarkjs(["zkey", "contribute", zkey0, zkey1,
  "--name=eyesonly-dev-1", `-e=${randomBytes(32).toString("hex")}`]);
snarkjs(["zkey", "beacon", zkey1, zkeyF,
  randomBytes(32).toString("hex"), "10", "-n=eyesonly-dev-beacon"]);
snarkjs(["zkey", "verify", path.join(build, "motion_proof.r1cs"), ptauF, zkeyF]);
snarkjs(["zkey", "export", "verificationkey", zkeyF,
  path.join(build, "verification_key.json")]);

console.log("\nDone. Artifacts in", build);
console.log("Run the e2e test with: node scripts/e2e-test.mjs");
