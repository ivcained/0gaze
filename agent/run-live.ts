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
 *   --glasses-ui=<ws>     ask the wearer for a guided head-motion challenge on
 *                         the glasses UI (ws://127.0.0.1:7610/ws); the spend
 *                         only proceeds once they perform the sequence
 *   --glasses-ui-timeout=<ms> how long to wait for the wearer (default 120000)
 *   --price=<usdt>        raise the merchant price for this run (default 0.01)
 */
import { AgentServer } from "./agent-server.js";
import { AgentLoop } from "./loop.js";
import { providerFromEnv } from "./zerog-provider.js";
import { episodeLogFromEnv } from "./episode-log.js";
import { classifyFailure, failureCard, notifyMac, postAgentError } from "./notify.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);

const zkp = args.includes("--zkp");
const glassesProfile = flag("--glasses");
const glassesTcp = Number(flag("--glasses-tcp") ?? "7605");
const glassesSeconds = Number(flag("--glasses-seconds") ?? "3");
const glassesUI = flag("--glasses-ui");
const glassesUITimeout = Number(flag("--glasses-ui-timeout") ?? "120000");
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
  glassesUI: glassesUI
    ? { url: glassesUI, timeoutMs: glassesUITimeout, sequence: flag("--sequence")?.split(",") }
    : undefined,
});

if (zkp) {
  console.log("[agent] ZKP mode: expecting zkp_proof messages from the phone alongside motion_verdict");
}
if (glassesProfile) {
  console.log(`[agent] glasses gate armed: ${glassesProfile} on 127.0.0.1:${glassesTcp}, ${glassesSeconds}s window`);
}

if (glassesUI) {
  console.log(`[agent] guided head-motion approval on the glasses UI at ${glassesUI}`);
}

const prompt = positional[1] ?? "generate a hero image for the EyesOnly demo";
console.log("[agent] prompt:", prompt);

try {
  const result = await loop.run(prompt);
  console.log("[agent] result:", JSON.stringify(result, null, 2));
  if (result.status === "paid") {
    notifyMac("0Gaze — payment settled", "Take complete. Settlement receipt is in the terminal.", "Glass");
    await postAgentError(glassesUI, "settled", "paid");
    await server.close();
    process.exit(0);
  }
  const reason = String((result as { reason?: unknown }).reason ?? result.status ?? "unknown");
  failureCard("Payment not settled", `agent loop returned status: ${result.status} (${reason})`, "Nothing was signed for a refused or denied run — see the result JSON above");
  notifyMac("0Gaze — not settled", `Status: ${result.status}. Nothing was paid.`);
  await postAgentError(glassesUI, "Payment not settled", reason);
  await server.close();
  process.exit(1);
} catch (err) {
  const cause = err instanceof Error ? (err.stack ?? err.message) : String(err);
  const { stage, hint } = classifyFailure(cause);
  failureCard(stage, cause, hint);
  notifyMac(`0Gaze — ${stage}`, hint, "Basso");
  await postAgentError(glassesUI, stage, cause);
  await server.close().catch(() => {});
  process.exit(1);
}
