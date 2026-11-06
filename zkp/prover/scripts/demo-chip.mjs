/**
 * Full ZKP demo: real Groth16 proof -> challenge/enrollment verification ->
 * Dabao EIP-712 witness signature -> recovered-signer check.
 *
 * node scripts/demo-chip.mjs [signerPort]   # 7600 emulator, 7601 real chip
 */
import { randomBytes } from "node:crypto";
import { proveMotion, profileHash, hashToLimbs } from "../prove.ts";
import { verifyMotionForDecision } from "../verify.ts";
import { DabaoSigner } from "../../../agent/dabao-client.ts";
import {
  signMotionWitness,
  verifyMotionWitness,
  toBytes32,
} from "../../../agent/zkp-witness.ts";

const signerPort = Number(process.argv[2] ?? 7600);
const features = [1_250_000, 980_000, 1_100_000, 870_000];
const threshold = 4_000_000;
const enrolledHash = profileHash(features);
const challenge = BigInt("0x" + randomBytes(16).toString("hex")); // 128-bit, fits BN254
const spendId = `zkp-demo-${Date.now()}`;

console.log("1. generating Groth16 motion proof");
const { proof, publicSignals } = await proveMotion({
  features,
  enrolledHash,
  threshold,
  challenge,
});
console.log("   proof generated; public signals:", publicSignals);

console.log("2. verifying proof against this challenge and enrollment");
const limbs = hashToLimbs(enrolledHash);
const valid = await verifyMotionForDecision(proof, publicSignals, {
  enrolledHashHi: limbs.hi.toString(),
  enrolledHashLo: limbs.lo.toString(),
  challenge: challenge.toString(),
});
if (!valid) throw new Error("proof did not verify");
console.log("   proof valid");

const witness = {
  enrolledHash: "0x" + enrolledHash,
  threshold,
  challenge: toBytes32(challenge.toString()),
  spendId,
};

console.log(`3. asking signer on port ${signerPort} for its address`);
const signer = new DabaoSigner("127.0.0.1", signerPort);
const address = await signer.getAddress();
console.log("   signer:", address);

console.log("4. signing the MotionProofWitness on the Dabao");
const signature = await signMotionWitness(signer, witness);
console.log("   witness signature:", "0x" + Buffer.from(signature).toString("hex"));

console.log("5. independently recovering the witness signer");
if (!verifyMotionWitness(signature, witness, address)) {
  throw new Error("witness signature did not recover to the signer");
}
console.log("   witness signature valid");

const tampered = { ...witness, spendId: spendId + "-tampered" };
if (verifyMotionWitness(signature, tampered, address)) {
  throw new Error("tampered witness was incorrectly accepted");
}
console.log("   tampered spendId rejected");

console.log(JSON.stringify({
  result: "PASS",
  signer: address,
  spendId,
  enrolledHash: witness.enrolledHash,
  challenge: witness.challenge,
  proofValid: valid,
  witnessValid: true,
}, null, 2));
process.exit(0);
