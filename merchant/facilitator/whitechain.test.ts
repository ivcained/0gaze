import { describe, it, expect } from "vitest";
import { hashDomain, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  verifyPayment,
  buildRequirements,
  EIP712_DOMAIN,
  DOMAIN_SEPARATOR_ONCHAIN,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  USDT,
  type PaymentPayload,
} from "./whitechain.js";

const payer = privateKeyToAccount(generatePrivateKey());
const PAY_TO = "0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE" as const;
const NOW = 1_800_000_000n;

async function signedPayment(overrides: Partial<{
  from: `0x${string}`; to: `0x${string}`; value: bigint;
  validAfter: bigint; validBefore: bigint; nonce: Hex; network: string;
}> = {}): Promise<PaymentPayload> {
  const auth = {
    from: payer.address,
    to: PAY_TO,
    value: 10_000n, // 0.01 USDT
    validAfter: NOW - 60n,
    validBefore: NOW + 60n,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    ...overrides,
  };
  const signature = await payer.signTypedData({
    domain: EIP712_DOMAIN,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: auth,
  });
  return {
    x402Version: 2,
    scheme: "exact",
    network: overrides.network ?? "eip155:1874",
    payload: { signature, authorization: auth },
  };
}

const expect0 = { payTo: PAY_TO, minAmount: 10_000n };

describe("EIP-712 domain", () => {
  it("matches the onchain DOMAIN_SEPARATOR pinned from the contract", () => {
    const sep = hashDomain({
      domain: { name: EIP712_DOMAIN.name, version: EIP712_DOMAIN.version, chainId: BigInt(EIP712_DOMAIN.chainId), verifyingContract: EIP712_DOMAIN.verifyingContract },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
    });
    expect(sep.toLowerCase()).toBe(DOMAIN_SEPARATOR_ONCHAIN.toLowerCase());
  });
});

describe("verifyPayment", () => {
  it("accepts a valid signed authorization", async () => {
    const p = await signedPayment();
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r).toEqual({ ok: true, signer: payer.address });
  });

  it("rejects a payment to the wrong payee", async () => {
    const p = await signedPayment({ to: "0x0000000000000000000000000000000000000001" });
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong payee");
  });

  it("rejects underpayment", async () => {
    const p = await signedPayment({ value: 1n });
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("underpaid");
  });

  it("rejects an expired authorization", async () => {
    const p = await signedPayment({ validAfter: NOW - 120n, validBefore: NOW - 1n });
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects a not-yet-valid authorization", async () => {
    const p = await signedPayment({ validAfter: NOW + 10n });
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not yet valid");
  });

  it("rejects a tampered authorization (signature no longer matches)", async () => {
    const p = await signedPayment();
    p.payload.authorization.value = 20_000n;
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("signer is not the payer");
  });

  it("rejects the wrong network", async () => {
    const p = await signedPayment();
    p.network = "eip155:84532";
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong network");
  });

  it("rejects a malformed signature", async () => {
    const p = await signedPayment();
    p.payload.signature = "0xdeadbeef" as Hex;
    const r = await verifyPayment(p, expect0, undefined, NOW);
    expect(r.ok).toBe(false);
  });
});

describe("buildRequirements", () => {
  it("advertises the pinned asset, network and domain extra", () => {
    const r = buildRequirements({ payTo: PAY_TO, amountUsdt: "0.01" });
    expect(r.network).toBe("eip155:1874");
    expect(r.asset).toBe(USDT);
    expect(r.maxAmountRequired).toBe("10000");
    expect(r.extra).toEqual({ name: "Tether USD", version: "1" });
  });
});
