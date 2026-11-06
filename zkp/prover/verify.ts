/**
 * EyesOnly motion-gate verifier.
 *
 * Verifies a Groth16 proof against the circuit verification key and the
 * public signals: [enrolled_hash_hi, enrolled_hash_lo, threshold, challenge].
 * The agent (or the Dabao chip policy check) calls this before signing.
 */
import * as snarkjs from "snarkjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_VKEY = path.join(__dirname, "build/verification_key.json");

export interface VerifyResult {
  valid: boolean;
  /** Decoded public signals, only meaningful when valid === true. */
  public?: {
    enrolledHashHi: string;
    enrolledHashLo: string;
    threshold: string;
    challenge: string;
  };
}

export async function verifyMotion(
  proof: snarkjs.Groth16Proof,
  publicSignals: string[],
  vkeyPath: string = DEFAULT_VKEY,
): Promise<VerifyResult> {
  const vkey = JSON.parse(await readFile(vkeyPath, "utf8"));
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!valid) return { valid: false };
  return {
    valid: true,
    public: {
      enrolledHashHi: publicSignals[0],
      enrolledHashLo: publicSignals[1],
      threshold: publicSignals[2],
      challenge: publicSignals[3],
    },
  };
}

/**
 * Verify with caller-supplied expectations — binds the proof to THIS spend
 * decision so a proof generated for a different challenge/enrollment fails.
 */
export async function verifyMotionForDecision(
  proof: snarkjs.Groth16Proof,
  publicSignals: string[],
  expected: { enrolledHashHi: string; enrolledHashLo: string; challenge: string },
  vkeyPath: string = DEFAULT_VKEY,
): Promise<boolean> {
  const r = await verifyMotion(proof, publicSignals, vkeyPath);
  if (!r.valid || !r.public) return false;
  return (
    r.public.enrolledHashHi === expected.enrolledHashHi &&
    r.public.enrolledHashLo === expected.enrolledHashLo &&
    r.public.challenge === expected.challenge
  );
}

// CLI: node verify.ts proof.json publicSignals.json [vkey.json]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [proofFile, signalsFile, vkeyFile] = process.argv.slice(2);
  if (!proofFile || !signalsFile) {
    console.error("usage: verify.ts <proof.json> <publicSignals.json> [vkey.json]");
    process.exit(1);
  }
  const proof = JSON.parse(await readFile(proofFile, "utf8"));
  const signals = JSON.parse(await readFile(signalsFile, "utf8"));
  const r = await verifyMotion(proof, signals, vkeyFile ?? DEFAULT_VKEY);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.valid ? 0 : 1);
}
