import { WebSocketServer, type WebSocket } from "ws";
import { ApprovalGate, type ApprovalRequest, type PhoneMessage } from "./gate.js";
import { classifySpend } from "./tiers.js";
import { WorldIdVerifier, signApprovalForWorldId } from "./worldid.js";

export interface AgentOptions {
  port?: number;
  host?: string;
  motionTimeoutMs?: number;
  worldIdTimeoutMs?: number;
  signTimeoutMs?: number;
}

export interface SpendRequest {
  amount: bigint;
  token: "USDT";
  chain: string;
  purpose: string;
}

/**
 * The agent's WebSocket server: the other end of the phone handshake.
 * One phone connection at a time. Every spend goes through the gate; the
 * phone answers with verdicts and the signer's signature.
 */
export class AgentServer {
  private wss: WebSocketServer;
  private gate: ApprovalGate;
  private phone: WebSocket | null = null;
  private reqCounter = 0;
  /** ZKP proofs sent by the phone alongside motion_verdict, keyed by spend id (--zkp mode). */
  private zkpProofs = new Map<string, unknown>();

  constructor(opts: AgentOptions = {}) {
    this.wss = new WebSocketServer({ port: opts.port ?? 7602, host: opts.host ?? "127.0.0.1" });
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.gate = new ApprovalGate((msg) => this.sendToPhone(msg), opts);
    this.gate.worldIdVerifier = new WorldIdVerifier();
  }

  private onConnection(ws: WebSocket) {
    if (this.phone) {
      // one phone at a time: replace the old connection
      this.phone.close();
    }
    this.phone = ws;
    ws.on("message", (data) => this.onMessage(ws, data));
    ws.on("close", () => {
      if (this.phone === ws) this.phone = null;
    });
  }

  private onMessage(ws: WebSocket, data: WebSocket.RawData) {
    let msg: unknown;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "bad_json" }));
      return;
    }
    if (!msg || typeof msg !== "object" || !("type" in msg)) {
      ws.send(JSON.stringify({ type: "error", code: "bad_message" }));
      return;
    }
    // zkp_proof rides alongside motion_verdict; stash it for the loop's witness step
    if ((msg as { type: string }).type === "zkp_proof" && "id" in msg) {
      this.zkpProofs.set(String((msg as { id: unknown }).id), msg);
      return;
    }
    this.gate.handleMessage(msg as PhoneMessage);
  }

  /** The ZKP proof the phone sent for a spend, if any (--zkp mode). */
  getZkpProof(id: string): unknown {
    return this.zkpProofs.get(id);
  }

  private sendToPhone(msg: unknown) {
    this.phone?.send(JSON.stringify(msg));
  }

  /** Send an out-of-band status update to the phone (e.g. after signing). */
  notify(msg: unknown): boolean {
    if (!this.phone) return false;
    this.phone.send(JSON.stringify(msg));
    return true;
  }

  /** Ask for approval to spend. Resolves with the gate's verdict. */
  async approve(req: SpendRequest): Promise<
    | { approved: true; how: "auto" | "motion" | "worldid"; signature?: `0x${string}`; id: string }
    | { approved: false; reason: string; id: string }
  > {
    const id = `spend-${++this.reqCounter}-${Date.now()}`;
    const tier = classifySpend(req.amount);
    const approval: ApprovalRequest = { id, ...req, tier };

    // For worldid tier, include the RP signature so the World App can bind the proof
    let extra: Record<string, unknown> = {};
    if (tier === "worldid") {
      const nonce = crypto.randomUUID();
      const rpSig = signApprovalForWorldId(`eyesonly-spend-${id}`, nonce);
      if (rpSig) {
        extra = {
          world_id_rp_context: {
            rp_id: process.env.WORLD_ID_RP_ID ?? "",
            nonce: rpSig.nonce,
            created_at: rpSig.created_at,
            expires_at: rpSig.expires_at,
            signature: rpSig.sig,
          },
          action: `eyesonly-spend-${id}`,
        };
      }
    }

    const outcome = await this.gate.request(approval);
    return { ...outcome, id };
  }

  get connected(): boolean {
    return this.phone !== null;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
