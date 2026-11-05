/**
 * Live integration run: the full agent loop against real components.
 *
 *   signer  = the Dabao emulator (127.0.0.1:7600) or the chip via the relay (:7601)
 *   payment = the real merchant (127.0.0.1:4021) -> Whitechain Sepolia
 *
 *   npx tsx run-live.ts [--zkp] [signerPort] [prompt]
 *                            # default port 7600 (emulator)
 *
 *   --zkp  ZKP verification mode: the phone is expected to send a zkp_proof
 *          message alongside motion_verdict, and the Dabao signs a
 *          MotionProofWitness binding the proof to this spend decision.
 */
import { AgentServer } from "./agent-server.js";
import { AgentLoop } from "./loop.js";
import { providerFromEnv } from "./zerog-provider.js";
import { episodeLogFromEnv } from "./episode-log.js";

const args = process.argv.slice(2);
const zkp = args.includes("--zkp");
const positional = args.filter((a) => a !== "--zkp");

const signerPort = Number(positional[0] ?? 7600);

const provider = providerFromEnv();
const episodeLog = await episodeLogFromEnv(new URL("../data/episodes.ndjson", import.meta.url).pathname);

const server = new AgentServer({ port: 7602 });
const loop = new AgentLoop({
  merchantUrl: "http://127.0.0.1:4021/generate",
  signerHost: "127.0.0.1",
  signerPort,
  server,
  provider,
  episodeLog,
  zkp,
});

if (zkp) {
  console.log("[agent] ZKP mode: expecting zkp_proof messages from the phone alongside motion_verdict");
}

const prompt = positional[1] ?? "generate a hero image for the EyesOnly demo";
console.log("[agent] prompt:", prompt);
const result = await loop.run(prompt);
console.log("[agent] result:", JSON.stringify(result, null, 2));
await server.close();
process.exit(result.status === "paid" ? 0 : 1);
