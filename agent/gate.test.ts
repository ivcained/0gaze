import { describe, it, expect, vi } from "vitest";
import { ApprovalGate, type ApprovalRequest, type PhoneMessage } from "./gate.js";

function setup(opts = {}) {
  const sent: unknown[] = [];
  const gate = new ApprovalGate((m) => sent.push(m), {
    motionTimeoutMs: 50,
    worldIdTimeoutMs: 50,
    signTimeoutMs: 50,
    ...opts,
  });
  const req = (tier: ApprovalRequest["tier"], amount = 10_000n): ApprovalRequest => ({
    id: "req-1",
    amount,
    token: "USDT",
    chain: "eip155:1874",
    purpose: "0G image generation",
    tier,
  });
  return { gate, sent, req };
}

const SIG = "0x" + "ab".repeat(65) as `0x${string}`;

describe("ApprovalGate", () => {
  it("auto-pays below the floor without sending anything", async () => {
    const { gate, sent, req } = setup();
    const out = await gate.request(req("auto"));
    expect(out).toEqual({ approved: true, how: "auto" });
    expect(sent).toHaveLength(0);
  });

  it("sends an approval_request for above-floor spends", async () => {
    const { gate, sent, req } = setup();
    const p = gate.request(req("motion"));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "approval_request", id: "req-1", amount: "10000" });
    gate.handleMessage({ type: "sign_result", id: "req-1", signature: SIG });
    await p;
  });

  it("motion match then signature approves", async () => {
    const { gate, req } = setup();
    const p = gate.request(req("motion"));
    gate.handleMessage({ type: "motion_verdict", id: "req-1", match: true, score: 0.91 });
    gate.handleMessage({ type: "sign_result", id: "req-1", signature: SIG });
    const out = await p;
    expect(out).toEqual({ approved: true, how: "motion", signature: SIG });
  });

  it("motion mismatch escalates to World ID, then approves on verification", async () => {
    const { gate, req } = setup();
    const p = gate.request(req("motion"));
    gate.handleMessage({ type: "motion_verdict", id: "req-1", match: false, score: 0.2 });
    gate.handleMessage({ type: "worldid_verdict", id: "req-1", status: "verified" });
    gate.handleMessage({ type: "sign_result", id: "req-1", signature: SIG });
    expect(await p).toMatchObject({ approved: true, signature: SIG });
  });

  it("mismatch plus World ID denial fails closed", async () => {
    const { gate, req } = setup();
    const p = gate.request(req("motion"));
    gate.handleMessage({ type: "motion_verdict", id: "req-1", match: false });
    gate.handleMessage({ type: "worldid_verdict", id: "req-1", status: "denied" });
    expect(await p).toEqual({ approved: false, reason: "worldid_denied" });
  });

  it("worldid tier waits for verification after a motion match", async () => {
    const { gate, req } = setup();
    const p = gate.request(req("worldid", 30_000_000n));
    gate.handleMessage({ type: "motion_verdict", id: "req-1", match: true });
    // no signature yet: must still be pending until World ID answers
    let settled = false;
    p.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    gate.handleMessage({ type: "worldid_verdict", id: "req-1", status: "verified" });
    gate.handleMessage({ type: "sign_result", id: "req-1", signature: SIG });
    expect(await p).toMatchObject({ approved: true });
  });

  it("times out and fails closed", async () => {
    const { gate, req } = setup({ motionTimeoutMs: 20 });
    const out = await gate.request(req("motion"));
    expect(out).toEqual({ approved: false, reason: "timeout" });
  });

  it("a signing failure fails closed", async () => {
    const { gate, req } = setup();
    const p = gate.request(req("motion"));
    gate.handleMessage({ type: "motion_verdict", id: "req-1", match: true });
    gate.handleMessage({ type: "sign_result", id: "req-1", error: "board unavailable" });
    expect(await p).toEqual({ approved: false, reason: "sign_failed" });
  });

  it("ignores messages for unknown ids", () => {
    const { gate } = setup();
    const msg: PhoneMessage = { type: "sign_result", id: "nope", signature: SIG };
    expect(gate.handleMessage(msg)).toBe(false);
  });
});
