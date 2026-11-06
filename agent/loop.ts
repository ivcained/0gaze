/**
 * The agent loop: inference -> approval -> hardware signature -> x402 payment.
 *
 *   run(prompt)
 *     1. the provider returns an artifact and its cost
 *     2. the approval gate decides: auto / motion / World ID
 *     3. the Dabao signs the EIP-3009 authorization
 *     4. the merchant verifies and settles onchain
 */
import { DabaoSigner } from "./dabao-client.js";
import { X402Client, type PaymentRequirements } from "./x402-client.js";
import { AgentServer } from "./agent-server.js";
import { classifySpend, describeTier } from "./tiers.js";
import { EpisodeLog, type MotionEvidence } from "./episode-log.js";
import { decideWithGlasses } from "./glasses-gate.js";
import {
  signMotionWitness,
  checkZkpProofStructure,
  toBytes32,
  type MotionWitness,
} from "./zkp-witness.js";
import { createHash, randomUUID } from "node:crypto";

export interface InferenceResult {
  artifact: string;
  cost: bigint; // base units
  purpose: string;
}

export interface InferenceProvider {
  generate(prompt: string): Promise<InferenceResult>;
}

export interface LoopResult {
  status: "paid" | "denied" | "error";
  tier?: string;
  txHash?: string;
  artifact?: string;
  reason?: string;
}

export interface LoopOptions {
  merchantUrl: string;
  signerHost: string;
  signerPort: number;
  server: AgentServer;
  provider: InferenceProvider;
  episodeLog?: EpisodeLog;
  /** Enable ZKP mode: bind the phone's motion proof to the spend via a Dabao witness signature. */
  zkp?: boolean;
  /** When no phone client is attached, read the glasses' own IMU stream. */
  glasses?: { profilePath: string; tcp: number; seconds: number };
  log?: (...a: unknown[]) => void;
}

export class AgentLoop {
  private signer: DabaoSigner;
  private x402: X402Client;
  private log: (...a: unknown[]) => void;
  private episodeLog: EpisodeLog | null;

  constructor(private opts: LoopOptions) {
    this.signer = new DabaoSigner(opts.signerHost, opts.signerPort);
    this.x402 = new X402Client(opts.merchantUrl);
    this.log = opts.log ?? ((...a) => console.log("[agent]", ...a));
    this.episodeLog = opts.episodeLog ?? null;
  }

  async run(prompt: string): Promise<LoopResult> {
    // 1. what does the merchant want?
    let req: PaymentRequirements;
    try {
      req = await this.x402.requirements();
    } catch (e) {
      return { status: "error", reason: `merchant unreachable: ${(e as Error).message}` };
    }

    // 2. run the inference to produce the artifact for this merchant request
    const result = await this.opts.provider.generate(prompt);
    // The merchant's 402 requirement is authoritative for what is owed; the
    // provider's own cost is bookkeeping, not the amount to authorize.
    const amount = BigInt(req.maxAmountRequired);
    const tier = classifySpend(amount);
    this.log(`inference done; merchant requires ${amount} base units -> tier: ${describeTier(tier)}`);

    // 3. the approval gate
    let approval: { approved: boolean; how?: "auto" | "motion" | "worldid"; id: string; reason?: string };
    let motionEvidence: MotionEvidence | undefined;
    const glassesPath = tier === "motion" && this.opts.glasses && !this.opts.server.connected;
    if (glassesPath) {
      this.log("no phone client; reading the glasses' own IMU stream");
      const decision = await decideWithGlasses(
        {
          profilePath: this.opts.glasses!.profilePath,
          tcp: this.opts.glasses!.tcp,
          seconds: this.opts.glasses!.seconds,
        },
        this.log,
      );
      approval = decision.approved
        ? { approved: true, how: "motion", id: `glasses-${Date.now()}` }
        : { approved: false, id: `glasses-${Date.now()}`, reason: decision.reason };
      if (decision.verification) {
        const v = decision.verification;
        motionEvidence = {
          source: "rayneo-air-imu",
          score: Number(v.score.toFixed(4)),
          samples: v.samples,
          liveHash: v.liveHash,
          profileHash: v.profileHash,
        };
      }
    } else {
      approval = await this.opts.server.approve({
        amount,
        token: "USDT",
        chain: req.network,
        purpose: result.purpose,
      });
    }
    if (!approval.approved) {
      this.log(`payment denied (${approval.reason ?? "denied"})`);
      if (this.episodeLog) {
        await this.episodeLog.record({
          prompt,
          artifactSha256: this.episodeLog.sha256(result.artifact),
          tier,
          approval: { reason: approval.reason ?? "denied" },
          motion: motionEvidence,
          network: req.network,
          merchant: this.opts.merchantUrl,
        });
      }
      return { status: "denied", tier, reason: approval.reason };
    }

    // 3.5 ZKP witness binding (--zkp mode): the chip attests the motion
    // proof's public signals for THIS spend before it signs the payment.
    let witnessFields: { motionProofHash?: string; witnessSignature?: string; challenge?: string } = {};
    if (this.opts.zkp && (approval.how === "motion" || approval.how === "worldid")) {
      // a. per-spend challenge: hashed uuid -> bytes32
      const challenge = "0x" + createHash("sha256").update(randomUUID()).digest("hex");

      // b. the phone's ZKP proof (sent alongside motion_verdict)
      const zkpMsg = this.opts.server.getZkpProof(approval.id) as
        | { proof?: unknown; publicSignals?: string[] }
        | undefined;
      let enrolledHash = "0x" + "0".repeat(64);
      let threshold: string = "0";
      let motionProofHash: string | undefined;
      if (zkpMsg && checkZkpProofStructure(zkpMsg)) {
        motionProofHash = createHash("sha256").update(JSON.stringify(zkpMsg.proof)).digest("hex");
        enrolledHash = toBytes32(zkpMsg.publicSignals[0]);
        threshold = zkpMsg.publicSignals[1];
        this.log(`zkp motion proof accepted (proof hash ${motionProofHash.slice(0, 16)}…)`);
      } else {
        this.log("no zkp proof from phone; witnessing a zero enrolled hash");
      }

      // c. the Dabao signs the witness: proof signals + challenge + spend id
      const witness: MotionWitness = { enrolledHash, threshold, challenge, spendId: approval.id };
      const witnessSig = await signMotionWitness(this.signer, witness);
      this.log(`dabao signed the motion witness for ${approval.id}`);

      // d. carried into the episode log below
      witnessFields = {
        motionProofHash,
        witnessSignature: "0x" + Buffer.from(witnessSig).toString("hex"),
        challenge,
      };
    }

    // 4. the chip signs
    const address = await this.signer.getAddress();
    const { typedData, authorization } = this.x402.buildTypedData(req, address, amount);
    this.log(`asking the Dabao (${address}) to sign the authorization`);
    const signature = await this.signer.signTypedData(typedData);

    // 5. pay and settle
    const settlement = await this.x402.pay(authorization, signature);
    this.log(`settled: ${settlement.txHash}`);
    this.opts.server.notify({
      type: "sign_result",
      id: approval.id,
      signature: "0x" + Buffer.from(signature).toString("hex"),
      txHash: settlement.txHash,
      settled: true,
    });

    // 6. the episode log: one record per decision, 0G request id anchored
    if (this.episodeLog) {
      const trace = (this.opts.provider as { lastTrace?: { requestId: string; providerIdentity: string; totalCostUsdMicro: string } }).lastTrace;
      const ep = await this.episodeLog.record({
        prompt,
        artifactSha256: this.episodeLog.sha256(result.artifact),
        model: trace ? undefined : (this.opts.provider.constructor.name),
        requestId: trace?.requestId,
        providerIdentity: trace?.providerIdentity,
        costUsdMicro: trace?.totalCostUsdMicro,
        tier,
        approval: { how: approval.how ?? "motion" },
        signerAddress: address,
        txHash: settlement.txHash,
        network: req.network,
        merchant: this.opts.merchantUrl,
        motion: motionEvidence,
        ...witnessFields,
      });
      this.log(`episode ${ep.episodeId}${ep.storageRootHash ? ` → 0G Storage ${ep.storageRootHash}` : " (local)"}`);
    }

    return { status: "paid", tier, txHash: settlement.txHash, artifact: result.artifact };
  }
}
