import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { AgentServer } from "./agent-server.js";

let server: AgentServer;
let phone: WebSocket;
const PORT = 7612;

beforeAll(async () => {
  server = new AgentServer({ port: PORT, motionTimeoutMs: 100, worldIdTimeoutMs: 100, signTimeoutMs: 100 });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50); // let the server bind
  });
  phone = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await new Promise<void>((resolve) => phone.on("open", resolve));
});

afterAll(async () => {
  phone.close();
  await server.close();
});

function waitMessage(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    phone.once("message", (d) => resolve(JSON.parse(d.toString())));
  });
}

async function waitRequest(): Promise<Record<string, unknown>> {
  // The first approval_request must arrive before the phone can answer.
  for (let i = 0; i < 50; i++) {
    const m = await waitMessage();
    if (m.type === "approval_request") return m;
  }
  throw new Error("no approval_request arrived");
}

describe("AgentServer", () => {
  it("auto-pays without asking the phone", async () => {
    const out = await server.approve({ amount: 1000n, token: "USDT", chain: "eip155:1874", purpose: "small inference" });
    expect(out).toMatchObject({ approved: true, how: "auto" });
  });

  it("sends an approval_request for motion-tier spends and approves on verdict+signature", async () => {
    const p = server.approve({ amount: 100_000n, token: "USDT", chain: "eip155:1874", purpose: "0G image generation" });
    const req = await waitRequest();
    expect(req).toMatchObject({ type: "approval_request", amount: "100000" });
    phone.send(JSON.stringify({ type: "motion_verdict", id: req.id, match: true }));
    phone.send(JSON.stringify({ type: "sign_result", id: req.id, signature: "0x" + "ab".repeat(65) }));
    const out = await p;
    expect(out).toMatchObject({ approved: true, how: "motion" });
  });

  it("denies on a motion mismatch when World ID is absent", async () => {
    const p = server.approve({ amount: 100_000n, token: "USDT", chain: "eip155:1874", purpose: "unmatched" });
    const req = await waitRequest();
    phone.send(JSON.stringify({ type: "motion_verdict", id: req.id, match: false }));
    phone.send(JSON.stringify({ type: "worldid_verdict", id: req.id, status: "denied" }));
    expect(await p).toMatchObject({ approved: false, reason: "worldid_denied" });
  });

  it("ignores malformed json from the phone", async () => {
    phone.send("not json");
    const out = await waitMessage();
    expect(out).toMatchObject({ type: "error", code: "bad_json" });
  });

  it("rejects a message without a type", async () => {
    phone.send(JSON.stringify({ foo: 1 }));
    const out = await waitMessage();
    expect(out).toMatchObject({ type: "error", code: "bad_message" });
  });

  it("reports its connection state", () => {
    expect(server.connected).toBe(true);
  });
});
