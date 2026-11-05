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
import { EpisodeLog } from "./episode-log.js";

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

    // 2. run the inference to learn the cost
    const result = await this.opts.provider.generate(prompt);
    const amount = result.cost;
    const tier = classifySpend(amount);
    this.log(`inference done, cost ${amount} base units -> tier: ${describeTier(tier)}`);

    // 3. the approval gate
    const approval = await this.opts.server.approve({
      amount,
      token: "USDT",
      chain: req.network,
      purpose: result.purpose,
    });
    if (!approval.approved) {
      this.log(`payment denied (${approval.reason})`);
      if (this.episodeLog) {
        await this.episodeLog.record({
          prompt,
          artifactSha256: this.episodeLog.sha256(result.artifact),
          tier,
          approval: { reason: approval.reason },
          network: req.network,
          merchant: this.opts.merchantUrl,
        });
      }
      return { status: "denied", tier, reason: approval.reason };
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
        approval: { how: approval.how },
        signerAddress: address,
        txHash: settlement.txHash,
        network: req.network,
        merchant: this.opts.merchantUrl,
      });
      this.log(`episode ${ep.episodeId}${ep.storageRootHash ? ` → 0G Storage ${ep.storageRootHash}` : " (local)"}`);
    }

    return { status: "paid", tier, txHash: settlement.txHash, artifact: result.artifact };
  }
}
