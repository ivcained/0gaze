/**
 * Demo failure notifications: when anything in a live take goes wrong, the
 * operator must see WHAT and HOW TO FIX IT on every surface they might be
 * looking at — the Terminal, a macOS banner, and the glasses display.
 *
 * Raw stack traces are for logs; the take is for humans.
 */
import { spawn } from "node:child_process";

export interface FailureClass {
  stage: string;
  hint: string;
}

/** Map an error to the demo stage it broke and the operator fix. */
export function classifyFailure(cause: string): FailureClass {
  // Order matters: port-specific failures must outrank generic transport
  // errors ("fetch failed" matches everything network-shaped).
  const stages: { pattern: RegExp; stage: string; hint: string }[] = [
    {
      pattern: /760[01]|signer|dabao|hid|board unavailable|board closed/i,
      stage: "Dabao signer unreachable",
      hint: "Replug the board and short-press PROG once (not hold); the relay reopens on the next request",
    },
    {
      pattern: /4021|merchant|payment quote|402 verify|x402 quote/i,
      stage: "x402 payment quote failed",
      hint: "Merchant down — bash scripts/demo-video.sh restarts it at 0.10 USDT",
    },
    {
      pattern: /7610|glasses|challenge timed out|motion challenge|imu/i,
      stage: "Glasses challenge timed out",
      hint: "The wearer did not complete the sequence — check glasses USB and run calibrate.ts",
    },
    {
      pattern: /router-api\.0g\.ai|0G inference|ENOTFOUND|EAI_AGAIN/i,
      stage: "0G inference unreachable",
      hint: "Wi-Fi/DNS blip — the agent retries 3x automatically; rerun the take if it persists",
    },
    {
      pattern: /settle|facilitator|whitechain|rpc|transferWithAuthorization/i,
      stage: "On-chain settlement failed",
      hint: "Whitechain Sepolia RPC hiccup — the payment did not move; rerun the take",
    },
  ];
  for (const s of stages) if (s.pattern.test(cause)) return { stage: s.stage, hint: s.hint };
  return {
    stage: "Agent loop failed",
    hint: "See the cause below and the full log the take was teed into",
  };
}

/** A boxed, colorized failure card in the Terminal — never a bare stack trace. */
export function failureCard(stage: string, cause: string, hint: string): void {
  const line = "\u2500".repeat(56);
  console.error(`\n\u001b[41;1m \u2715 DEMO TAKE FAILED \u001b[0m`);
  console.error(`\u001b[31m${line}\u001b[0m`);
  console.error(`  stage   \u001b[1m${stage}\u001b[0m`);
  const causeLine = cause.split("\n")[0].slice(0, 180);
  console.error(`  cause   ${causeLine}`);
  console.error(`  fix     ${hint}`);
  console.error(`\u001b[31m${line}\u001b[0m\n`);
}

/** macOS banner notification. Must never crash the demo when unavailable. */
export function notifyMac(title: string, message: string, sound = "Basso"): void {
  try {
    const script =
      `display notification ${JSON.stringify(message.slice(0, 220))} ` +
      `with title ${JSON.stringify(title.slice(0, 60))} sound name "${sound}"`;
    const child = spawn("osascript", ["-e", script], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Notifications are best-effort by definition.
  }
}

/**
 * Push the failure onto the glasses display via the UI server's control
 * socket, so the wearer sees the run stopped instead of a silent idle card.
 */
export async function postAgentError(
  uiUrl: string | undefined,
  stage: string,
  message: string,
): Promise<void> {
  if (!uiUrl) return;
  try {
    const mod = await import("ws");
    const WebSocket = mod.WebSocket ?? (mod as { default?: typeof mod.WebSocket }).default!;
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(uiUrl);
      const timer = setTimeout(() => { try { ws.terminate(); } catch {} resolve(); }, 3000);
      ws.on("open", () => {
        try {
          ws.send(JSON.stringify({ type: "agent-error", stage, message: message.slice(0, 300) }));
        } catch {}
        clearTimeout(timer);
        ws.close();
        resolve();
      });
      ws.on("error", () => { clearTimeout(timer); resolve(); });
    });
  } catch {
    // The UI being down must not mask the real failure.
  }
}
