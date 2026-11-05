import { WebSocketServer, type WebSocket } from "ws";
import { ApprovalGate, type ApprovalRequest, type PhoneMessage } from "./gate.js";
import { classifySpend } from "./tiers.js";

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

  constructor(opts: AgentOptions = {}) {
    this.wss = new WebSocketServer({ port: opts.port ?? 7602, host: opts.host ?? "127.0.0.1" });
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.gate = new ApprovalGate((msg) => this.sendToPhone(msg), opts);
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
    this.gate.handleMessage(msg as PhoneMessage);
  }

  private sendToPhone(msg: unknown) {
    this.phone?.send(JSON.stringify(msg));
  }

  /** Ask for approval to spend. Resolves with the gate's verdict. */
  async approve(req: SpendRequest): Promise<
    | { approved: true; how: "auto" | "motion" | "worldid"; signature?: `0x${string}`; id: string }
    | { approved: false; reason: string; id: string }
  > {
    const id = `spend-${++this.reqCounter}-${Date.now()}`;
    const tier = classifySpend(req.amount);
    const approval: ApprovalRequest = { id, ...req, tier };
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
