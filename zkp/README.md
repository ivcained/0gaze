# EyesOnly ZKP — motion-proof layer

Upgrades the motion gate (`agent/gate.ts`) so the phone proves motion-match
**without revealing the biometric profile or the raw IMU window**.

## What the circuit proves

`circuits/motion_proof.circom` (Circom 2.x, Groth16 over BN254):

> "I hold a private 4-element IMU feature window such that
> SHA-256(window) == the enrolled profile hash, the window's energy
> (sum of scaled features) is >= threshold T, and this proof is bound to
> challenge C."

- **Private inputs:** `features[4]` — scaled integers (float feature × 1e6),
  each range-constrained to 32 bits.
- **Public inputs:** `enrolled_hash_hi`, `enrolled_hash_lo` (the SHA-256
  profile commitment split into two 128-bit limbs, since the BN254 scalar
  field is < 256 bits), `threshold`, `challenge` (128-bit nonce).
- The `challenge` is the anti-replay binding: the Dabao chip signs
  `(challenge, enrolled_hash, threshold)` as the witness tying the proof to
  one specific spend decision. A proof from a previous decision never
  verifies for a new challenge.
- Constraint count ≈ 35k (dominated by the 128-bit-input SHA-256). Groth16
  WASM proving at this size runs well under 2 s on a phone.

Scope note (hackathon build): full cosine similarity between the window and
the enrolled reference vector requires fixed-point division in-circuit and
blows past the 2 s budget. The on-circuit gate is (hash match) ∧ (energy ≥
threshold); cosine scoring stays off-circuit in `agent/gate.ts` as a
pre-filter. The interface is stable — a cosine circuit can replace the
energy check without changing the prover/verifier API.

## Layout

```
zkp/
  circuits/motion_proof.circom   # the circuit
  prover/
    package.json                 # snarkjs + ethers + circomlib
    prove.ts                     # proveMotion() — callable from agent loop
    verify.ts                    # verifyMotion() / verifyMotionForDecision()
    scripts/setup-dev.mjs        # compile + dev trusted setup (one command)
    scripts/e2e-test.mjs         # prove -> verify -> negative cases
    build/                       # generated artifacts (gitignored)
```

## Setup

Requires **circom 2.x** on PATH (one-time system install — this is a setup
step, not part of the run):

```sh
# https://docs.circom.io/getting-started/installation/
git clone https://github.com/iden3/circom.git && cd circom
cargo build --release && cargo install --path circom
```

Then:

```sh
cd zkp/prover
npm install
npm run setup:dev     # circom compile + powersoftau + zkey contribute + vkey export
npm test              # e2e: proves, verifies, checks tamper/threshold rejection
```

`setup-dev.mjs` runs the whole pipeline with random local entropy
(**dev only — production needs a real multi-party ceremony**):

```sh
circom ../circuits/motion_proof.circom --r1cs --wasm --sym -o build -l node_modules/circomlib/circuits
snarkjs powersoftau new bn128 16 build/pot16_0000.ptau
snarkjs powersoftau contribute build/pot16_0000.ptau build/pot16_0001.ptau --name=dev -e=<random>
snarkjs powersoftau prepare phase2 build/pot16_0001.ptau build/pot16_final.ptau
snarkjs groth16 setup build/motion_proof.r1cs build/pot16_final.ptau build/motion_proof_0000.zkey
snarkjs zkey contribute build/motion_proof_0000.zkey build/motion_proof_0001.zkey --name=dev-1 -e=<random>
snarkjs zkey beacon build/motion_proof_0001.zkey build/motion_proof_final.zkey <random-hex> 10
snarkjs zkey export verificationkey build/motion_proof_final.zkey build/verification_key.json
```

## Integration with the agent loop

```ts
import { proveMotion, hashToLimbs } from "../zkp/prover/prove.js";
import { verifyMotionForDecision } from "../zkp/prover/verify.js";

// phone side (or agent side during the hackathon demo):
const { proof, publicSignals } = await proveMotion({
  features: windowFeatures,          // 4 scaled ints
  enrolledHash,                      // 32-byte hex
  threshold,
  challenge,                         // from the spend request, Dabao-signed
});

// agent side, in place of the plain motion_verdict check in gate.ts:
const limbs = hashToLimbs(enrolledHash);
const ok = await verifyMotionForDecision(proof, publicSignals, {
  enrolledHashHi: limbs.hi.toString(),
  enrolledHashLo: limbs.lo.toString(),
  challenge: challenge.toString(),
});
// ok === true -> same as motion_verdict(true); false -> escalate to World ID
```

Public signal order is fixed by the circuit's `main` component:
`[enrolled_hash_hi, enrolled_hash_lo, threshold, challenge]`.
