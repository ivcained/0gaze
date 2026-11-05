/**
 * Live integration run: the full agent loop against real components.
 *
 *   signer  = the Dabao emulator (127.0.0.1:7600) or the chip via the relay (:7601)
 *   payment = the real merchant (127.0.0.1:4021) -> Whitechain Sepolia
 *
 *   npx tsx run-live.ts [signerPort]   # default 7600 (emulator)
 */
import { AgentServer } from "./agent-server.js";
import { AgentLoop, type InferenceProvider } from "./loop.js";

const signerPort = Number(process.argv[2] ?? 7600);

/** Stub 0G provider: returns a fixed artifact at the merchant's price. */
const provider: InferenceProvider = {
  async generate(prompt: string) {
    return {
      artifact: `sealed result for "${prompt}" (stub 0G inference)`,
      cost: 10_000n, // 0.01 USDT: below the $0.05 floor -> auto tier
      purpose: "0G sealed inference",
    };
  },
};

const server = new AgentServer({ port: 7602 });
const loop = new AgentLoop({
  merchantUrl: "http://127.0.0.1:4021/generate",
  signerHost: "127.0.0.1",
  signerPort,
  server,
  provider,
});

const prompt = process.argv[3] ?? "generate a hero image for the EyesOnly demo";
console.log("[agent] prompt:", prompt);
const result = await loop.run(prompt);
console.log("[agent] result:", JSON.stringify(result, null, 2));
await server.close();
process.exit(result.status === "paid" ? 0 : 1);
