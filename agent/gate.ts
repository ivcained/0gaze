/**
 * Approval gate: the agent's side of the phone handshake.
 *
 * The agent never signs. It sends an approval_request to the phone and waits
 * for verdicts. Per the design:
 *   auto tier     -> approved without asking (caller logs the payment)
 *   motion tier   -> motion_verdict(true) required, then sign_result
 *   worldid tier  -> motion_verdict(true), then worldid_verdict(verified), then sign_result
 * A motion mismatch escalates to World ID (the tripwire, not the lock); a
 * worldid denial fails closed. Timeouts fail closed.
 */
import type { SpendTier } from "./tiers.js";

export interface ApprovalRequest {
  id: string;
  amount: bigint;
  token: "USDT";
  chain: string;
  purpose: string;
  tier: SpendTier;
}

export type PhoneMessage =
  | { type: "motion_verdict"; id: string; match: boolean; score?: number }
  | { type: "worldid_verdict"; id: string; status: "verified" | "denied" | "expired" }
  | { type: "sign_result"; id: string; signature?: `0x${string}`; error?: string };

export type ApprovalOutcome =
  | { approved: true; how: "auto" | "motion" | "worldid"; signature?: `0x${string}` }
  | { approved: false; reason: "motion_mismatch" | "worldid_denied" | "worldid_expired" | "sign_failed" | "timeout" };

interface Pending {
  resolve: (o: ApprovalOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
  stage: "await_motion" | "await_worldid" | "await_signature";
}

export interface GateOptions {
  motionTimeoutMs?: number;
  worldIdTimeoutMs?: number;
  signTimeoutMs?: number;
}

export class ApprovalGate {
  private pending = new Map<string, Pending>();
  private send: (msg: unknown) => void;
  private opts: Required<GateOptions>;

  constructor(send: (msg: unknown) => void, opts: GateOptions = {}) {
    this.send = send;
    this.opts = {
      motionTimeoutMs: opts.motionTimeoutMs ?? 15_000,
      worldIdTimeoutMs: opts.worldIdTimeoutMs ?? 120_000,
      signTimeoutMs: opts.signTimeoutMs ?? 15_000,
    };
  }

  async request(req: ApprovalRequest): Promise<ApprovalOutcome> {
    if (req.tier === "auto") return { approved: true, how: "auto" };

    this.requests.set(req.id, req);
    return new Promise<ApprovalOutcome>((resolve) => {
      const timer = setTimeout(
        () => this.finish(req.id, { approved: false, reason: "timeout" }),
        this.opts.motionTimeoutMs
      );
      this.pending.set(req.id, { resolve, timer, stage: "await_motion" });
      this.send({ type: "approval_request", ...req, amount: req.amount.toString() });
    });
  }

  /** Feed a message from the phone. Returns false when the id is unknown. */
  handleMessage(msg: PhoneMessage): boolean {
    const p = this.pending.get(msg.id);
    if (!p) return false;

    if (msg.type === "motion_verdict") {
      if (msg.match) {
        if (p.stage !== "await_motion") return true; // stale, ignore
        this.advanceToWorldIdOrSign(msg.id, p);
      } else {
        // tripwire: a mismatch demands a fresh World ID check
        this.stage(msg.id, p, "await_worldid", this.opts.worldIdTimeoutMs);
      }
      return true;
    }

    if (msg.type === "worldid_verdict") {
      if (msg.status === "verified") {
        this.stage(msg.id, p, "await_signature", this.opts.signTimeoutMs);
      } else {
        this.finish(msg.id, { approved: false, reason: msg.status === "denied" ? "worldid_denied" : "worldid_expired" });
      }
      return true;
    }

    if (msg.type === "sign_result") {
      if (msg.signature) {
        const how = p.stage === "await_signature" ? "motion" : "motion";
        this.finish(msg.id, { approved: true, how, signature: msg.signature });
      } else {
        this.finish(msg.id, { approved: false, reason: "sign_failed" });
      }
      return true;
    }

    return true;
  }

  private advanceToWorldIdOrSign(id: string, p: Pending) {
    // The phone decides whether a World ID check is needed next (tier worldid);
    // the agent simply waits for whichever verdict arrives.
    const req = this.requestFor(id);
    if (req?.tier === "worldid") {
      this.stage(id, p, "await_worldid", this.opts.worldIdTimeoutMs);
    } else {
      this.stage(id, p, "await_signature", this.opts.signTimeoutMs);
    }
  }

  private requests = new Map<string, ApprovalRequest>();

  private requestFor(id: string) {
    return this.requests.get(id);
  }

  remember(req: ApprovalRequest) {
    this.requests.set(req.id, req);
  }

  private stage(id: string, p: Pending, stage: Pending["stage"], timeoutMs: number) {
    clearTimeout(p.timer);
    p.stage = stage;
    p.timer = setTimeout(() => this.finish(id, { approved: false, reason: "timeout" }), timeoutMs);
  }

  private finish(id: string, outcome: ApprovalOutcome) {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    this.requests.delete(id);
    p.resolve(outcome);
  }
}
