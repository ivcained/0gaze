/**
 * EyesOnly motion-gate prover.
 *
 * Loads the compiled Groth16 WASM circuit + zkey and produces a proof that
 * the live IMU window hashes to the enrolled profile and clears the motion
 * threshold — without revealing the features or the profile hash.
 *
 * Field layout (BN254 scalar field is < 256 bits, so hashes are split):
 *   enrolled_hash_hi / enrolled_hash_lo : 128-bit limbs of the SHA-256
 *   challenge                            : 128-bit nonce signed by the Dabao
 *                                          chip alongside the spend request
 *   threshold                            : scaled integer (feature * 1e6 units)
 */
import * as snarkjs from "snarkjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MotionProofInput {
  /** 4 scaled integer features (feature * 1e6, must fit in 32 bits each). */
  features: [bigint, bigint, bigint, bigint] | [number, number, number, number];
  /** 32-byte enrolled profile hash (hex string, 0x-prefixed or bare). */
  enrolledHash: string;
  /** Scaled energy threshold the window sum must meet. */
  threshold: bigint | number;
  /** 128-bit (or smaller) challenge nonce for this spend decision. */
  challenge: bigint | string;
}

export interface MotionProofResult {
  proof: snarkjs.Groth16Proof;
  publicSignals: string[];
}

export interface ProverArtifacts {
  wasmPath: string;
  zkeyPath: string;
}

const DEFAULT_ARTIFACTS: ProverArtifacts = {
  wasmPath: path.join(__dirname, "../build/motion_proof_js/motion_proof.wasm"),
  zkeyPath: path.join(__dirname, "../build/motion_proof_final.zkey"),
};

/** Split a 32-byte hash into two 128-bit field-safe limbs. */
export function hashToLimbs(hashHex: string): { hi: bigint; lo: bigint } {
  const hex = hashHex.replace(/^0x/, "");
  if (hex.length !== 64) throw new Error("enrolledHash must be 32 bytes");
  return {
    hi: BigInt("0x" + hex.slice(0, 32)),
    lo: BigInt("0x" + hex.slice(32, 64)),
  };
}

/**
 * Compute the enrolled/profile hash the circuit expects:
 * SHA-256 over the four features packed as big-endian uint32.
 * Must match the circuit's bit packing (MSB-first per 32-bit word).
 */
export function profileHash(features: [number, number, number, number]): string {
  const buf = Buffer.alloc(16);
  features.forEach((f, i) => buf.writeUInt32BE(f >>> 0, i * 4));
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Generate a Groth16 proof for one motion window.
 * Designed to be called from agent/gate.ts when the phone returns its
 * window — or on-device inside the phone's prover worker.
 */
export async function proveMotion(
  input: MotionProofInput,
  artifacts: ProverArtifacts = DEFAULT_ARTIFACTS,
): Promise<MotionProofResult> {
  const { hi, lo } = hashToLimbs(input.enrolledHash);

  const circuitInput = {
    features: input.features.map((f) => f.toString()),
    enrolled_hash_hi: hi.toString(),
    enrolled_hash_lo: lo.toString(),
    threshold: input.threshold.toString(),
    challenge: BigInt(input.challenge).toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    artifacts.wasmPath,
    artifacts.zkeyPath,
  );
  return { proof, publicSignals };
}

/** Load the verification key JSON (for callers that bundle the verifier). */
export async function loadVerificationKey(vkeyPath?: string): Promise<unknown> {
  const p = vkeyPath ?? path.join(__dirname, "../build/verification_key.json");
  return JSON.parse(await readFile(p, "utf8"));
}

// CLI: node prove.ts '<json MotionProofInput>'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: prove.ts \'{"features":[..],"enrolledHash":"..","threshold":..,"challenge":..}\'');
    process.exit(1);
  }
  const parsed = JSON.parse(arg);
  proveMotion(parsed).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
