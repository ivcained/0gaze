/**
 * Live integration run: the full agent loop against real components.
 *
 *   signer  = the Dabao emulator (127.0.0.1:7600) or the chip via the relay (:7601)
 *   payment = the real merchant (127.0.0.1:4021) -> Whitechain Sepolia
 *   glasses = RayNeo Air IMU capture bridge (127.0.0.1:7605), bench motion gate
 *
 *   npx tsx run-live.ts [flags] [signerPort] [prompt]
 *
 * Flags:
 *   --zkp                 expect a zkp_proof from a phone client and bind it
 *                         to the spend with a Dabao witness signature
 *   --glasses=<profile>   with no phone client attached, gate the motion tier
 *                         on a live glasses IMU window against the profile
 *   --glasses-tcp=<port>  glasses capture feed (default 7605)
 *   --glasses-seconds=<n> capture window length (default 3)
 *   --price=<usdt>        raise the merchant price for this run (default 0.01)
 */
import { AgentServer } from "./agent-server.js";
import { AgentLoop } from "./loop.js";
import { providerFromEnv } from "./zerog-provider.js";
import { episodeLogFromEnv } from "./episode-log.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);

const zkp = args.includes("--zkp");
const glassesProfile = flag("--glasses");
const glassesTcp = Number(flag("--glasses-tcp") ?? "7605");
const glassesSeconds = Number(flag("--glasses-seconds") ?? "3");
const price = flag("--price");

const positional = args.filter((a) => !a.startsWith("--"));

// The merchant's price is process-wide; when a run needs the motion tier, the
// caller must have started the merchant with MERCHANT_PRICE. A mismatch is
// reported instead of silently paying the wrong tier.
if (price && process.env.MERCHANT_PRICE !== price) {
  console.warn(
    `[agent] --price=${price} was requested but the merchant runs MERCHANT_PRICE=${process.env.MERCHANT_PRICE ?? "(unset)"}; restart the merchant to match`,
  );
}

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
  glasses: glassesProfile
    ? { profilePath: glassesProfile, tcp: glassesTcp, seconds: glassesSeconds }
    : undefined,
});

if (zkp) {
  console.log("[agent] ZKP mode: expecting zkp_proof messages from the phone alongside motion_verdict");
}
if (glassesProfile) {
  console.log(`[agent] glasses gate armed: ${glassesProfile} on 127.0.0.1:${glassesTcp}, ${glassesSeconds}s window`);
}

const prompt = positional[1] ?? "generate a hero image for the EyesOnly demo";
console.log("[agent] prompt:", prompt);
const result = await loop.run(prompt);
console.log("[agent] result:", JSON.stringify(result, null, 2));
await server.close();
process.exit(result.status === "paid" ? 0 : 1);
