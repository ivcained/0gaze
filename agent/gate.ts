/**
 * Approval gate: the agent's side of the phone handshake.
 *
 * The agent never signs without a verdict. It sends an approval_request and
 * waits. Per the design:
 *   auto tier     -> approved without asking (caller logs the payment)
 *   motion tier   -> motion_verdict(true) -> approved; the caller signs
 *   worldid tier  -> motion_verdict(true) + worldid_verdict(verified) -> approved
 * A motion mismatch escalates to World ID (the tripwire, not the lock); a
 * worldid denial fails closed. Timeouts fail closed. After approval the
 * caller signs via the chip and notifies the phone with a sign_result.
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
  | { type: "worldid_proof"; id: string; proof: Record<string, unknown> }
  | { type: "sign_result"; id: string; signature?: `0x${string}`; error?: string };

export type ApprovalOutcome =
  | { approved: true; how: "auto" | "motion" | "worldid"; signature?: `0x${string}` }
  | { approved: false; reason: "motion_mismatch" | "worldid_denied" | "worldid_expired" | "sign_failed" | "timeout" };

interface Pending {
  resolve: (o: ApprovalOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
  stage: "await_motion" | "await_worldid" | "await_worldid_proof" | "await_signature";
  how: "motion" | "worldid";
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
  worldIdVerifier: import("./worldid.js").WorldIdVerifier | null = null;

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
      this.pending.set(req.id, { resolve, timer, stage: "await_motion", how: "motion" });
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
        const req = this.requestFor(msg.id);
        if (req?.tier === "worldid") {
          p.how = "worldid";
          this.stage(msg.id, p, "await_worldid_proof", this.opts.worldIdTimeoutMs);
        } else {
          this.finish(msg.id, { approved: true, how: "motion" });
        }
      } else {
        // tripwire: a mismatch demands a fresh World ID check
        p.how = "worldid";
        this.stage(msg.id, p, "await_worldid_proof", this.opts.worldIdTimeoutMs);
      }
      return true;
    }

    if (msg.type === "worldid_verdict") {
      // Legacy path: phone pre-verifies and sends verdict directly
      if (msg.status === "verified") {
        this.finish(msg.id, { approved: true, how: p.how });
      } else {
        this.finish(msg.id, { approved: false, reason: msg.status === "denied" ? "worldid_denied" : "worldid_expired" });
      }
      return true;
    }

    if (msg.type === "worldid_proof") {
      // The phone sent the raw proof — the agent verifies it server-side
      if (p.stage !== "await_worldid_proof") return true;
      const verifier = this.worldIdVerifier;
      if (!verifier || !verifier.configured) {
        this.finish(msg.id, { approved: false, reason: "worldid_denied" });
        return true;
      }
      // Async verification — don't block handleMessage
      verifier.verify(msg.proof as never).then((result: import("./worldid.js").WorldIdVerifyResult) => {
        if (result.success) {
          this.finish(msg.id, { approved: true, how: p.how });
        } else {
          this.finish(msg.id, { approved: false, reason: "worldid_denied" });
        }
      }).catch(() => {
        this.finish(msg.id, { approved: false, reason: "worldid_denied" });
      });
      return true;
    }

    if (msg.type === "sign_result") {
      // Future path: the phone drives the signing itself (S3 bridge product path).
      if (msg.signature) {
        this.finish(msg.id, { approved: true, how: p.how, signature: msg.signature });
      } else {
        this.finish(msg.id, { approved: false, reason: "sign_failed" });
      }
      return true;
    }

    return true;
  }

  private requests = new Map<string, ApprovalRequest>();

  private requestFor(id: string) {
    return this.requests.get(id);
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
