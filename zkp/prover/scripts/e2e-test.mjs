/**
 * End-to-end dev test: build witness -> prove -> verify -> negative cases.
 * Run after scripts/setup-dev.mjs.
 */
import { proveMotion, profileHash, hashToLimbs } from "../prove.ts";
import { verifyMotion, verifyMotionForDecision } from "../verify.ts";

const features = [1_250_000, 980_000, 1_100_000, 870_000]; // scaled x1e6
const threshold = 4_000_000; // sum = 4.2e6 >= 4.0e6
const challenge = 12345678901234567890n;
const enrolledHash = profileHash(features);

const ok = (name, cond) => {
  console.log(cond ? "pass" : "fail", name);
  if (!cond) process.exitCode = 1;
};

const { proof, publicSignals } = await proveMotion({
  features, enrolledHash, threshold, challenge,
});
console.log("proof generated, publicSignals:", publicSignals);

const v = await verifyMotion(proof, publicSignals);
ok("valid proof verifies", v.valid);

const limbs = hashToLimbs(enrolledHash);
ok(
  "bound to challenge+enrollment",
  await verifyMotionForDecision(proof, publicSignals, {
    enrolledHashHi: limbs.hi.toString(),
    enrolledHashLo: limbs.lo.toString(),
    challenge: challenge.toString(),
  }),
);
ok(
  "wrong challenge rejected",
  !(await verifyMotionForDecision(proof, publicSignals, {
    enrolledHashHi: limbs.hi.toString(),
    enrolledHashLo: limbs.lo.toString(),
    challenge: "999",
  })),
);

// Tampered public signal must be rejected
const tampered = [...publicSignals];
tampered[3] = "999";
ok("tampered publicSignals rejected", !(await verifyMotion(proof, tampered)).valid);

// Below-threshold window must be rejected inside the circuit (proving throws)
let threw = false;
try {
  await proveMotion({
    features: [1, 2, 3, 4], enrolledHash: profileHash([1, 2, 3, 4]),
    threshold: 100, challenge,
  });
} catch {
  threw = true;
}
ok("below-threshold window cannot be proven", threw);

console.log(process.exitCode ? "\nfailures above" : "\nAll checks passed");
process.exit(process.exitCode ?? 0); // snarkjs keeps wasm workers alive
