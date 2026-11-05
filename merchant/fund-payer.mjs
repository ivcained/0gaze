/**
 * Fund the payer with test USDT: wrap WBT -> swap on YetiTrade (Uniswap V3)
 * -> transfer USDT to the payer address.
 *
 *   node fund-payer.mjs <payer-address> [amountInWbt] [amountOutUsdt]
 *
 * Requires FACILITATOR_PRIVATE_KEY in .env and WBT for gas.
 */
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import fs from "node:fs";

const RPC = "https://rpc.testnet.whitechain.io";
const chain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "Whitechain", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Whitechain", url: "https://explorer.testnet.whitechain.io" } },
});

const WWBT = "0x4200000000000000000000000000000000000006";
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const SWAP_ROUTER02 = "0xe208cC685cD95D56E8ec6DEC9816476567fc6962";
const QUOTER_V2 = "0x90f28c3a6233713d6Df00E5fa92a3f13EFe36191";
const FACTORY = "0x94aFa2aB80E44163362D2952bdf1E95b81900738";

const payer = process.argv[2];
if (!payer) {
  console.error("usage: node fund-payer.mjs <payer> [amountInWbt=0.5] [amountOutUsdt=2]");
  process.exit(2);
}
const amountIn = parseEther(process.argv[3] ?? "0.5");
const minOut = parseUnits(process.argv[4] ?? "0.5", 6); // floor we require from the swap

const env = Object.fromEntries(
  fs.readFileSync(new URL("./.env", import.meta.url), "utf8")
    .split("\n").filter(Boolean).map((l) => l.split("="))
);
const account = privateKeyToAccount(env.FACILITATOR_PRIVATE_KEY);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const wwbtAbi = [
  { name: "deposit", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
];
const usdtAbi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
];
const routerAbi = [
  {
    name: "exactInputSingle", type: "function", stateMutability: "payable",
    inputs: [{ type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" }, { name: "recipient", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ] }],
    outputs: [{ type: "uint256" }],
  },
];
const factoryAbi = [
  { name: "getPool", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] },
];
const quoterAbi = [
  { name: "quoteExactInputSingle", type: "function", stateMutability: "nonpayable",
    inputs: [{ type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ] }],
    outputs: [{ type: "uint256" }, { type: "uint160" }, { type: "uint32" }, { type: "uint256" }] },
];

const log = (...a) => console.log(...a);

log("facilitator:", account.address, "| WBT:", formatEther(await pub.getBalance({ address: account.address })));

// 1) find a WWBT/USDT pool
let fee;
for (const f of [500, 3000, 10000, 100]) {
  const pool = await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getPool", args: [WWBT, USDT, f] });
  if (pool && pool !== "0x0000000000000000000000000000000000000000") { fee = f; log(`pool found: fee tier ${f} at ${pool}`); break; }
}
if (!fee) { console.error("no WWBT/USDT pool"); process.exit(1); }

// 2) wrap WBT -> WWBT
log("wrapping", formatEther(amountIn), "WBT -> WWBT");
const wrapTx = await wallet.writeContract({ address: WWBT, abi: wwbtAbi, functionName: "deposit", args: [], value: amountIn, account, chain });
await pub.waitForTransactionReceipt({ hash: wrapTx });
log("wrap tx:", wrapTx);

// 3) approve the router
const approveTx = await wallet.writeContract({ address: WWBT, abi: wwbtAbi, functionName: "approve", args: [SWAP_ROUTER02, amountIn], account, chain });
await pub.waitForTransactionReceipt({ hash: approveTx });
log("approve tx:", approveTx);

// 4) quote, then swap with slippage protection
const quote = await pub.simulateContract({
  address: QUOTER_V2, abi: quoterAbi, functionName: "quoteExactInputSingle",
  args: [{ tokenIn: WWBT, tokenOut: USDT, amountIn, fee, sqrtPriceLimitX96: 0n }],
});
const quoted = quote.result[0];
log("quote:", formatUnits(quoted, 6), "USDT for", formatEther(amountIn), "WBT");
const minFromQuote = (quoted * 99n) / 100n;
const amountOutMinimum = minFromQuote > minOut ? minOut : minFromQuote; // require at least our floor
log("amountOutMinimum:", formatUnits(amountOutMinimum, 6), "USDT");

const swapTx = await wallet.writeContract({
  address: SWAP_ROUTER02, abi: routerAbi, functionName: "exactInputSingle",
  args: [{ tokenIn: WWBT, tokenOut: USDT, fee, recipient: account.address, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  account, chain,
});
const rcpt = await pub.waitForTransactionReceipt({ hash: swapTx });
log("swap tx:", swapTx, "| status:", rcpt.status);

const got = await pub.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [account.address] });
log("facilitator USDT after swap:", formatUnits(got, 6));

// 5) send USDT to the payer
const sendAmount = got < minOut ? got : minOut;
if (sendAmount === 0n) { console.error("nothing to send"); process.exit(1); }
const xfer = await wallet.writeContract({ address: USDT, abi: usdtAbi, functionName: "transfer", args: [payer, sendAmount], account, chain });
await pub.waitForTransactionReceipt({ hash: xfer });
log("transfer tx:", xfer, "-> sent", formatUnits(sendAmount, 6), "USDT to", payer);
log("payer USDT balance:", formatUnits(await pub.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [payer] }), 6));
