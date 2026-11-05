/**
 * Demo paid API. Answers 402 with x402 requirements, verifies the EIP-3009
 * payment, settles it, then serves the paid artifact.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import {
  buildRequirements,
  settlePayment,
  verifyPayment,
  USDT_DECIMALS,
  WHITECHAIN_SEPOLIA,
  type PaymentPayload,
} from "./facilitator/whitechain.js";

const whitechainSepolia = defineChain({
  id: WHITECHAIN_SEPOLIA.chainId,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "Whitechain", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [WHITECHAIN_SEPOLIA.rpc] } },
  blockExplorers: { default: { name: "Whitechain", url: WHITECHAIN_SEPOLIA.explorer } },
});

const PORT = Number(process.env.PORT ?? 4021);
const PAY_TO = (process.env.MERCHANT_PAY_TO ?? "0xbdF5180b7Db73BAF2c13352477469d5cD9F2b8BE") as Address;
const PRICE_USDT = process.env.MERCHANT_PRICE ?? "0.01";
const FACILITATOR_KEY = process.env.FACILITATOR_PRIVATE_KEY as Hex | undefined;

const publicClient = createPublicClient({ chain: whitechainSepolia, transport: http(WHITECHAIN_SEPOLIA.rpc) });
const facilitator = FACILITATOR_KEY ? privateKeyToAccount(FACILITATOR_KEY) : undefined;
const wallet = facilitator
  ? createWalletClient({ account: facilitator, chain: whitechainSepolia, transport: http(WHITECHAIN_SEPOLIA.rpc) })
  : undefined;

const app = new Hono();

function artifact(svgBody: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
  <rect width="640" height="360" fill="#161715"/>
  <text x="32" y="72" fill="#d4ff3f" font-family="monospace" font-size="28">EYES ONLY</text>
  <text x="32" y="120" fill="#eeeeee" font-family="monospace" font-size="18">paid artifact #${svgBody}</text>
  <text x="32" y="156" fill="#888888" font-family="monospace" font-size="14">settled on Whitechain Sepolia, USDT</text>
</svg>`;
}

app.get("/health", (c) => c.json({ ok: true, payTo: PAY_TO, price: PRICE_USDT, facilitator: Boolean(facilitator) }));

app.get("/generate", async (c) => {
  const reqs = buildRequirements({ payTo: PAY_TO, amountUsdt: PRICE_USDT });
  const header = c.req.header("PAYMENT-SIGNATURE") ?? c.req.header("X-PAYMENT");

  if (!header) {
    return c.body(null, 402, {
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify({ x402Version: 2, accepts: [reqs] })).toString("base64"),
      "content-type": "application/json",
    });
  }

  let payment: PaymentPayload;
  try {
    payment = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return c.json({ error: "malformed PAYMENT-SIGNATURE header" }, 400);
  }

  const verdict = await verifyPayment(
    payment,
    { payTo: PAY_TO, minAmount: BigInt(reqs.maxAmountRequired) },
    publicClient
  );
  if (!verdict.ok) return c.json({ error: verdict.reason }, 402);

  if (!wallet || !facilitator) {
    return c.json({ error: "facilitator not configured (set FACILITATOR_PRIVATE_KEY)" }, 503);
  }

  let txHash: Hex;
  try {
    txHash = await settlePayment(wallet, facilitator.address, payment);
  } catch (e) {
    return c.json({ error: `settlement failed: ${(e as Error).message}` }, 502);
  }

  const amount = Number(payment.payload.authorization.value) / 10 ** USDT_DECIMALS;
  return c.body(artifact(`${txHash.slice(0, 10)} · ${amount} USDT`), 200, {
    "content-type": "image/svg+xml",
    "PAYMENT-RESPONSE": Buffer.from(JSON.stringify({ success: true, txHash, network: WHITECHAIN_SEPOLIA.caip2 })).toString("base64"),
  });
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`merchant listening on :${info.port} | payTo ${PAY_TO} | price ${PRICE_USDT} USDT`);
  if (!facilitator) console.log("WARNING: FACILITATOR_PRIVATE_KEY unset, settlements will 503");
});
