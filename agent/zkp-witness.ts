/**
 * ZKP witness binder: the Dabao signs the public signals of the motion
 * proof as EIP-712 typed data, cryptographically binding:
 *
 *   this motion proof  +  this spend decision  +  this chip
 *
 * The chip is the witness: its signature over (enrolledHash, threshold,
 * challenge, spendId) proves the same hardware key that signs the x402
 * payment also attested to the ZKP's public signals for this exact spend.
 */
import { verifyTypedData } from "ethers";
import type { DabaoSigner } from "./dabao-client.js";

export const MOTION_WITNESS_DOMAIN = {
  name: "EyesOnly Motion Proof",
  version: "1",
  chainId: 1874,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

export const MOTION_WITNESS_TYPES = {
  MotionProofWitness: [
    { name: "enrolledHash", type: "bytes32" },
    { name: "threshold", type: "uint256" },
    { name: "challenge", type: "bytes32" },
    { name: "spendId", type: "string" },
  ],
};

export interface MotionWitness {
  enrolledHash: string; // bytes32 hex
  threshold: string | number | bigint;
  challenge: string; // bytes32 hex
  spendId: string;
}

/** Snarkjs-style proof payload as sent by the phone. */
export interface ZkpProofPayload {
  proof: unknown;
  publicSignals: string[]; // [enrolledHash, threshold, challenge, ...]
}

/**
 * Structural check of the phone's ZKP proof. Full snark verification needs
 * the circuit's verification key (not available agent-side in the demo), so
 * this validates shape and signal presence; the cryptographic binding to the
 * spend happens through the Dabao's witness signature.
 */
export function checkZkpProofStructure(p: unknown): p is ZkpProofPayload {
  if (!p || typeof p !== "object") return false;
  const payload = p as Partial<ZkpProofPayload>;
  return (
    "proof" in payload &&
    Array.isArray(payload.publicSignals) &&
    payload.publicSignals.length >= 3 &&
    payload.publicSignals.every((s) => typeof s === "string" && s.length > 0)
  );
}

/** Normalize a decimal or hex public signal to 0x-prefixed bytes32. */
export function toBytes32(value: string): string {
  let hex: string;
  if (value.startsWith("0x")) {
    hex = value.slice(2);
  } else {
    try {
      hex = BigInt(value).toString(16);
    } catch {
      hex = value; // already bare hex
    }
  }
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length > 64) {
    throw new Error(`not a bytes32 value: ${value.slice(0, 32)}`);
  }
  return "0x" + hex.toLowerCase().padStart(64, "0");
}

export function buildMotionWitnessTypedData(witness: MotionWitness) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ...MOTION_WITNESS_TYPES,
    },
    primaryType: "MotionProofWitness",
    domain: { ...MOTION_WITNESS_DOMAIN },
    message: {
      enrolledHash: witness.enrolledHash,
      threshold: witness.threshold.toString(),
      challenge: witness.challenge,
      spendId: witness.spendId,
    },
  };
}

/** Ask the Dabao chip to sign the motion witness. Returns the raw 65-byte signature. */
export async function signMotionWitness(signer: DabaoSigner, witness: MotionWitness): Promise<Uint8Array> {
  return signer.signTypedData(buildMotionWitnessTypedData(witness));
}

/** Recover the witness signer and check it is the expected chip address. */
export function verifyMotionWitness(
  signature: Uint8Array | string,
  witness: MotionWitness,
  expectedSigner: string,
): boolean {
  try {
    const sig =
      typeof signature === "string" ? signature : "0x" + Buffer.from(signature).toString("hex");
    const recovered = verifyTypedData(
      MOTION_WITNESS_DOMAIN,
      MOTION_WITNESS_TYPES,
      {
        enrolledHash: witness.enrolledHash,
        threshold: witness.threshold.toString(),
        challenge: witness.challenge,
        spendId: witness.spendId,
      },
      sig,
    );
    return recovered.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
}
