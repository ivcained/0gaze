/**
 * The wearer's glasses are the approval surface: the agent asks the glasses
 * UI to issue a head-motion challenge, waits for the wearer to perform it,
 * and only then lets the spend proceed.
 *
 * Fail-closed everywhere: no socket, timeout, wrong motion, or denial all
 * block the payment.
 */
import WebSocket from "ws";

export interface GlassesSpend {
  id: string;
  amount: string;
  purpose: string;
  chain: string;
}

export interface GlassesChallengeOptions {
  url: string;
  spend: GlassesSpend;
  /** Sequence override; otherwise the server derives it deterministically. */
  sequence?: string[];
  timeoutMs?: number;
  log?: (...a: unknown[]) => void;
}

export interface GlassesChallengeResult {
  approved: boolean;
  reason?: string;
  sequence?: string[];
  scores?: number[];
  attempts?: number;
}

export async function requestGlassesApproval(
  opts: GlassesChallengeOptions,
): Promise<GlassesChallengeResult> {
  const log = opts.log ?? ((...a: unknown[]) => console.log("[glasses-ui]", ...a));
  const timeoutMs = opts.timeoutMs ?? 90_000;

  return new Promise<GlassesChallengeResult>((resolve) => {
    let settled = false;
    let lastAttempts: number | undefined;
    let lastSequence: string[] | undefined;

    const finish = (result: GlassesChallengeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* socket may already be gone */ }
      resolve(result);
    };

    const timer = setTimeout(() => {
      log("no response from the wearer before the deadline");
      finish({ approved: false, reason: "wearer_timeout", sequence: lastSequence });
    }, timeoutMs);

    const ws = new WebSocket(opts.url);

    ws.on("open", () => {
      log("asking the wearer for a head-motion challenge");
      ws.send(JSON.stringify({
        type: "challenge",
        spendId: opts.spend.id,
        sequence: opts.sequence,
        spend: opts.spend,
      }));
    });

    ws.on("message", (raw) => {
      let msg: { type?: string; state?: Record<string, unknown>; verdict?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "state" || msg.type === "gesture") {
        const s = msg.state;
        if (s && s.phase === "challenge") {
          lastAttempts = s.attempts as number;
          lastSequence = s.sequence as string[];
          if (s.index && (s.index as number) > 0) {
            log(`move ${s.index} accepted`);
          }
          if (s.lastRejected) {
            log(`attempt ${s.attempts}: rejected, restarting the sequence`);
          }
        }
      }

      if (msg.type === "verdict") {
        const s = msg.state ?? {};
        if (msg.verdict === "approved") {
          log("wearer's motion verified");
          finish({
            approved: true,
            sequence: (s.sequence as string[]) ?? lastSequence,
            scores: s.scores as number[],
            attempts: lastAttempts,
          });
        } else {
          log(`wearer declined or failed verification (${String(s.reason)})`);
          finish({
            approved: false,
            reason: String(s.reason ?? "denied"),
            sequence: lastSequence,
            attempts: lastAttempts,
          });
        }
      }
    });

    ws.on("error", (e) => {
      log(`glasses UI unreachable: ${e.message}`);
      finish({ approved: false, reason: "glasses_ui_unavailable" });
    });
    ws.on("close", () => {
      if (!settled) {
        log("glasses UI closed the connection mid-approval");
        finish({ approved: false, reason: "glasses_ui_closed", sequence: lastSequence });
      }
    });
  });
}
