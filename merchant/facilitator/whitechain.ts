/**
 * Whitechain Sepolia USDT facilitator: verify EIP-3009 authorizations and
 * settle them onchain, paying gas so the agent needs none.
 *
 * Domain pinned by evidence (2026-11-05): token name "Tether USD", version "1",
 * chainId 1874, verifyingContract 0xcedf...55a7. The locally computed
 * EIP-712 domain separator equals the contract's DOMAIN_SEPARATOR().
 */
import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  recoverTypedDataAddress,
  parseUnits,
} from "viem";

export const WHITECHAIN_SEPOLIA = {
  chainId: 1874,
  caip2: "eip155:1874",
  rpc: "https://rpc.testnet.whitechain.io",
  explorer: "https://explorer.testnet.whitechain.io",
} as const;

export const USDT: Address = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
export const USDT_DECIMALS = 6;
export const DOMAIN_SEPARATOR_ONCHAIN =
  "0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25" as Hex;

export const EIP712_DOMAIN = {
  name: "Tether USD",
  version: "1",
  chainId: WHITECHAIN_SEPOLIA.chainId,
  verifyingContract: USDT,
} as const;

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface Authorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
}

export interface PaymentPayload {
  x402Version: 2;
  scheme: "exact";
  network: string;
  payload: { signature: Hex; authorization: Authorization };
}

export type VerifyResult =
  | { ok: true; signer: Address }
  | { ok: false; reason: string };

const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "authorizationState", type: "function", stateMutability: "view", inputs: [
      { name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }], outputs: [{ type: "bool" }] },
] as const;

const tokenWriteAbi = [
  {
    name: "transferWithAuthorization",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/** Requirements a 402 response advertises for one paid resource. */
export function buildRequirements(opts: { payTo: Address; amountUsdt: string; maxTimeoutSeconds?: number }) {
  return {
    scheme: "exact" as const,
    network: WHITECHAIN_SEPOLIA.caip2,
    asset: USDT,
    payTo: opts.payTo,
    maxAmountRequired: parseUnits(opts.amountUsdt, USDT_DECIMALS).toString(),
    maxTimeoutSeconds: opts.maxTimeoutSeconds ?? 300,
    resource: "0gaze://generate",
    description: "One generated artifact, paid per request",
    mimeType: "image/svg+xml",
    extra: { name: EIP712_DOMAIN.name, version: EIP712_DOMAIN.version },
  };
}

/**
 * Verify an EIP-3009 authorization. Pure signature/field checks plus optional
 * onchain checks (nonce unused, payer balance) when a client is supplied.
 */
export async function verifyPayment(
  payment: PaymentPayload,
  expected: { payTo: Address; minAmount: bigint },
  client?: PublicClient,
  now = BigInt(Math.floor(Date.now() / 1000))
): Promise<VerifyResult> {
  const { authorization: a, signature } = payment.payload;

  if (payment.x402Version !== 2) return { ok: false, reason: "unsupported x402Version" };
  if (payment.scheme !== "exact") return { ok: false, reason: "unsupported scheme" };
  if (payment.network !== WHITECHAIN_SEPOLIA.caip2) return { ok: false, reason: "wrong network" };
  if (a.to.toLowerCase() !== expected.payTo.toLowerCase()) return { ok: false, reason: "wrong payee" };
  if (a.value < expected.minAmount) return { ok: false, reason: "underpaid" };
  if (now < a.validAfter) return { ok: false, reason: "not yet valid" };
  if (now > a.validBefore) return { ok: false, reason: "expired" };

  let signer: Address;
  try {
    signer = await recoverTypedDataAddress({
      domain: EIP712_DOMAIN,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: a.from,
        to: a.to,
        value: a.value,
        validAfter: a.validAfter,
        validBefore: a.validBefore,
        nonce: a.nonce,
      },
      signature,
    });
  } catch {
    return { ok: false, reason: "malformed signature" };
  }
  if (signer.toLowerCase() !== a.from.toLowerCase()) return { ok: false, reason: "signer is not the payer" };

  if (client) {
    const used = await client.readContract({
      address: USDT, abi: erc20Abi, functionName: "authorizationState", args: [a.from, a.nonce],
    });
    if (used) return { ok: false, reason: "nonce already used" };

    const balance = await client.readContract({
      address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [a.from],
    });
    if (balance < a.value) return { ok: false, reason: "insufficient payer balance" };
  }

  return { ok: true, signer };
}

/** Split a 65-byte signature into v/r/s and submit transferWithAuthorization. */
export async function settlePayment(
  wallet: WalletClient<Transport, Chain, Account>,
  payment: PaymentPayload
): Promise<Hex> {
  const sig = payment.payload.signature.slice(2);
  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  let v = parseInt(sig.slice(128, 130), 16);
  if (v < 27) v += 27;
  const a = payment.payload.authorization;

  return wallet.writeContract({
    chain: wallet.chain,
    address: USDT,
    abi: tokenWriteAbi,
    functionName: "transferWithAuthorization",
    args: [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, v, r, s],
  });
}
