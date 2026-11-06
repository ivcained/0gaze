/**
 * x402 client: the payer side. Asks the merchant what it requires (402 flow),
 * builds the EIP-3009 typed data, and submits the payment with the burner's
 * signature.
 */
export interface PaymentRequirements {
  network: string;
  asset: string;
  payTo: string;
  maxAmountRequired: string; // base units
  extra?: { name: string; version: string; [k: string]: unknown };
}

export interface SettledPayment {
  success: boolean;
  txHash?: string;
  network?: string;
  receipt?: unknown;
}

export class X402Client {
  constructor(
    private merchantUrl: string,
    private opts: { quoteTimeoutMs?: number; payTimeoutMs?: number } = {}
  ) {}

  /** GET the resource; on 402 parse the PAYMENT-REQUIRED header (x402 v2 envelope). */
  async requirements(): Promise<PaymentRequirements> {
    let res: Response;
    try {
      res = await fetch(this.merchantUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(this.opts.quoteTimeoutMs ?? 10_000),
      });
    } catch (e) {
      throw new Error(`merchant unreachable: ${(e as Error).message}`);
    }
    const b64 = res.headers.get("payment-required");
    if (!b64) {
      throw new Error(`merchant did not demand payment (HTTP ${res.status})`);
    }
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString());
    const req = parsed.accepts?.[0] ?? parsed;
    // The 402 response is authoritative; a malformed quote must fail loudly
    // here, not as a NaN signature or a payment to an undefined address.
    for (const field of ["network", "asset", "payTo", "maxAmountRequired"] as const) {
      if (!req[field]) throw new Error(`merchant 402 quote is missing '${field}'`);
    }
    if (!/^\d+$/.test(String(req.maxAmountRequired))) {
      throw new Error(`merchant 402 quote has a non-numeric maxAmountRequired: ${req.maxAmountRequired}`);
    }
    return {
      network: req.network,
      asset: req.asset,
      payTo: req.payTo,
      maxAmountRequired: String(req.maxAmountRequired),
      extra: req.extra,
    };
  }

  /** Parse the chain id out of the merchant's CAIP-2 network (eip155:1874). */
  private chainIdOf(req: PaymentRequirements): number {
    const m = /^eip155:(\d+)$/.exec(req.network);
    if (!m) throw new Error(`merchant network is not a CAIP-2 eip155 id: ${req.network}`);
    return Number(m[1]);
  }

  /** Build the EIP-3009 typed data for an authorization from -> payTo. */
  buildTypedData(
    req: PaymentRequirements,
    from: string,
    amount: bigint,
    opts: { validAfter?: bigint; validBefore?: bigint; nonce?: Uint8Array } = {}
  ): {
    typedData: {
      types: Record<string, { name: string; type: string }[]>;
      primaryType: string;
      domain: Record<string, string | number>;
      message: Record<string, string>;
    };
    authorization: {
      from: string; to: string; value: bigint; validAfter: bigint; validBefore: bigint; nonce: `0x${string}`;
    };
  } {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const validAfter = opts.validAfter ?? now - 30n;
    const validBefore = opts.validBefore ?? now + 600n;
    const nonce = opts.nonce ?? crypto.getRandomValues(new Uint8Array(32));
    const nonceHex = ("0x" + Buffer.from(nonce).toString("hex")) as `0x${string}`;
    const domain = {
      name: (req.extra?.name as string) ?? "Tether USD",
      version: (req.extra?.version as string) ?? "1",
      // The merchant's 402 quote is authoritative for the chain, not a constant.
      chainId: this.chainIdOf(req),
      verifyingContract: req.asset,
    };
    const message = {
      from,
      to: req.payTo,
      value: amount.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce: nonceHex,
    };
    const types = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };
    return { typedData: { types, primaryType: "TransferWithAuthorization", domain, message }, authorization: { from, to: req.payTo, value: amount, validAfter, validBefore, nonce: nonceHex } };
  }

  /** POST the payment. Returns the settlement from PAYMENT-RESPONSE. */
  async pay(authorization: {
    from: string; to: string; value: bigint; validAfter: bigint; validBefore: bigint; nonce: `0x${string}`;
  }, signature: Uint8Array | string, network: string): Promise<SettledPayment> {
    const sigHex = typeof signature === "string"
      ? (signature.startsWith("0x") ? signature : "0x" + signature)
      : "0x" + Buffer.from(signature).toString("hex");
    const payment = {
      x402Version: 2,
      scheme: "exact",
      network,
      payload: {
        signature: sigHex,
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce: authorization.nonce,
        },
      },
    };
    let res: Response;
    try {
      res = await fetch(this.merchantUrl, {
        headers: { "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(payment)).toString("base64") },
        // Settlement waits for an onchain tx — generous but bounded; a wedged
        // merchant/RPC must fail the run, not hang the take forever.
        signal: AbortSignal.timeout(this.opts.payTimeoutMs ?? 120_000),
      });
    } catch (e) {
      throw new Error(`settlement request failed: ${(e as Error).message}`);
    }
    const body = await res.text();
    const b64 = res.headers.get("payment-response");
    const settlement: SettledPayment = b64
      ? JSON.parse(Buffer.from(b64, "base64").toString())
      : { success: res.ok, receipt: body.slice(0, 500) };
    if (!res.ok && !settlement.txHash) {
      throw new Error(`payment failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    return settlement;
  }
}
