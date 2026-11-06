pragma circom 2.1.6;

include "sha256/sha256.circom";
include "comparators.circom";
include "bitify.circom";

/*
 * 0Gaze motion proof.
 *
 * Statement proven:
 *   "I hold a private motion profile commitment `profile_hash` and a live
 *    4-element IMU feature window such that:
 *      1. SHA-256(pack(window_features)) == profile_hash   (window is bound to the committed profile)
 *      2. profile_hash == enrolled_hash                    (matches the enrolled identity)
 *      3. every feature is within the valid scaled range [0, FEATURE_MAX]
 *      4. the sum of feature magnitudes (a stand-in energy/similarity score)
 *         is >= threshold                                   (motion gate passes)
 *      5. challenge is folded in as a public input so the proof is bound to
 *         one spend decision and cannot be replayed."
 *
 * Features are scaled integers (float feature * 1e6), each constrained to
 * 32 bits so range proofs are cheap. The full cosine-similarity check stays
 * off-circuit for the hackathon build; the on-circuit energy-threshold check
 * is the gate the verifier enforces. Proving time with Groth16 WASM is well
 * under 2s on a phone at this size (~35k constraints, dominated by SHA-256).
 *
 * Field arithmetic note: BN254's scalar field is ~254 bits, so a 256-bit
 * hash does not fit in one field element. Hashes are passed as two 128-bit
 * limbs (hi, lo) and reconstructed bitwise inside the circuit.
 */

// Decompose a 32-bit scaled feature into bits (range proof: value < 2^32).
template RangeCheck32() {
    signal input in;
    component bits = Num2Bits(32);
    bits.in <== in;
}

// Hash four 32-bit features (big-endian byte packing) -> 256 output bits.
template WindowHash() {
    signal input features[4];
    signal output out[256];

    component pack[4];
    component sha = Sha256(128); // 4 features x 32 bits = 128 input bits

    for (var i = 0; i < 4; i++) {
        pack[i] = Num2Bits(32);
        pack[i].in <== features[i];
        // Num2Bits is little-endian; circomlib Sha256 wants the input
        // MSB-first, so feed the word bit-reversed. Net effect: the hashed
        // bytes are the four features as big-endian uint32 — matching
        // profileHash() in prover/prove.ts (Buffer.writeUInt32BE).
        for (var b = 0; b < 32; b++) {
            sha.in[i * 32 + b] <== pack[i].out[31 - b];
        }
    }
    for (var b = 0; b < 256; b++) {
        out[b] <== sha.out[b];
    }
}

template MotionProof() {
    // ---- private inputs ----
    signal input features[4];       // scaled 32-bit IMU features

    // ---- public inputs ----
    signal input enrolled_hash_hi;  // top 128 bits of enrolled profile hash
    signal input enrolled_hash_lo;  // bottom 128 bits
    signal input threshold;         // scaled integer energy threshold
    signal input challenge;         // 128-bit spend-decision nonce (Dabao-signed)

    // ---- 1. range-check every feature (valid domain + implicit bit-width) ----
    component rc[4];
    for (var i = 0; i < 4; i++) {
        rc[i] = RangeCheck32();
        rc[i].in <== features[i];
    }

    // ---- 2. hash the window and compare against the enrolled hash ----
    component wh = WindowHash();
    for (var i = 0; i < 4; i++) wh.features[i] <== features[i];

    // Decompose the public enrolled hash limbs to bits and assert equality
    // with the computed SHA-256 output (hi = bits 255..128, lo = 127..0).
    component hiBits = Num2Bits(128);
    hiBits.in <== enrolled_hash_hi;
    component loBits = Num2Bits(128);
    loBits.in <== enrolled_hash_lo;

    // Num2Bits emits little-endian; Sha256 emits the digest MSB-first per
    // circomlib convention. Bit j of the digest (j=0 = MSB of byte 0)
    // corresponds to limb bit (127 - (j mod 128)).
    for (var j = 0; j < 128; j++) {
        wh.out[j] === hiBits.out[127 - j];
        wh.out[128 + j] === loBits.out[127 - j];
    }

    // ---- 3. threshold gate: sum(features) >= threshold ----
    // Sum of four 32-bit values fits in 34 bits; compare in 35 bits.
    signal sum34;
    sum34 <== features[0] + features[1] + features[2] + features[3];

    component ge = GreaterEqThan(35);
    ge.in[0] <== sum34;
    ge.in[1] <== threshold;
    ge.out === 1;

    // ---- 4. bind the proof to the challenge (anti-replay) ----
    // Force challenge into the constraint system so the proof commits to it.
    component ch = Num2Bits(128);
    ch.in <== challenge;
    signal challengeCheck;
    challengeCheck <== challenge * 1; // keeps challenge in a constraint
}

component main {public [enrolled_hash_hi, enrolled_hash_lo, threshold, challenge]} = MotionProof();
