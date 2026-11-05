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
  log?: (...a: unknown[]) => void;
}

export class AgentLoop {
  private signer: DabaoSigner;
  private x402: X402Client;
  private log: (...a: unknown[]) => void;

  constructor(private opts: LoopOptions) {
    this.signer = new DabaoSigner(opts.signerHost, opts.signerPort);
    this.x402 = new X402Client(opts.merchantUrl);
    this.log = opts.log ?? ((...a) => console.log("[agent]", ...a));
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
    return { status: "paid", tier, txHash: settlement.txHash, artifact: result.artifact };
  }
}
