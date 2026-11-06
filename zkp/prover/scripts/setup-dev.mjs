/**
 * Dev trusted-setup for the 0Gaze motion circuit.
 *
 * NOT FOR PRODUCTION. Uses random local entropy contributions so the whole
 * ceremony runs unattended. For anything real, run a proper multi-party
 * powers-of-tau ceremony (or reuse an existing per-bucket Hermes/ptau file).
 *
 * Usage: node scripts/setup-dev.mjs
 * Requires: circom 2.x on PATH, and `npm install` already run here.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const zkey0 = path.join(build, "motion_proof_0000.zkey");
const zkey1 = path.join(build, "motion_proof_0001.zkey");
const zkeyF = path.join(build, "motion_proof_final.zkey");

// 2. Use the official Hermes phase-1 artifact. Do not regenerate phase 2
// locally: the previous hand-rolled prepare-phase2 path produced a malformed
// section table and made groth16 setup wait forever.
const ptauF = path.join(build, "powersOfTau28_hez_final_16.ptau");
const ptauChecksum = "6a6277a2f74e1073601b4f9fed6e1e55226917efb0f0db8a07d98ab01df1ccf43eb0e8c3159432acd4960e2f29fe84a4198501fa54c8dad9e43297453efec125";
if (!existsSync(ptauF)) {
  run("curl", ["-fL", "--retry", "3", "--retry-all-errors", "-o", ptauF,
    "https://raw.githubusercontent.com/b58p/circuits/main/powersOfTau28_hez_final_16.ptau"]);
}
const actualChecksum = createHash("blake2b512").update(readFileSync(ptauF)).digest("hex");
if (actualChecksum !== ptauChecksum) {
  throw new Error("Hermes ptau checksum mismatch");
}
console.log("Hermes ptau checksum verified");

// 3. Circuit-specific phase 2 + random contribution + zkey verify
snarkjs(["groth16", "setup", path.join(build, "motion_proof.r1cs"), ptauF, zkey0]);
snarkjs(["zkey", "contribute", zkey0, zkey1,
  "--name=0gaze-dev-1", `-e=${randomBytes(32).toString("hex")}`]);
snarkjs(["zkey", "beacon", zkey1, zkeyF,
  randomBytes(32).toString("hex"), "10", "-n=0gaze-dev-beacon"]);
snarkjs(["zkey", "verify", path.join(build, "motion_proof.r1cs"), ptauF, zkeyF]);
snarkjs(["zkey", "export", "verificationkey", zkeyF,
  path.join(build, "verification_key.json")]);

console.log("\nDone. Artifacts in", build);
console.log("Run the e2e test with: node scripts/e2e-test.mjs");
