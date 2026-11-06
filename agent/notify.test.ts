/**
 * Regression tests for demo failure classification.
 *
 * Each case is a real failure observed on the bench: the DNS blip that killed
 * a live take, the dead signer port, the merchant restart, the glasses
 * timeout. The operator must see the stage and the fix, never a raw trace.
 */
import { describe, it, expect } from "vitest";
import { classifyFailure, failureCard } from "./notify.js";

describe("classifyFailure", () => {
  it("classifies the DNS blip that killed the 2026-11-06 take as 0G inference", () => {
    const cause = `[TypeError: fetch failed] {
  [cause]: Error: getaddrinfo ENOTFOUND router-api.0g.ai
      at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
}`;
    expect(classifyFailure(cause).stage).toBe("0G inference unreachable");
  });

  it("classifies the exhausted retry wrapper as 0G inference", () => {
    const r = classifyFailure("Error: 0G inference unreachable after 3 attempts: fetch failed");
    expect(r.stage).toBe("0G inference unreachable");
  });

  it("classifies a dead signer port as the Dabao, not a generic network error", () => {
    const r = classifyFailure("Error: connect ECONNREFUSED 127.0.0.1:7601 (signer)");
    expect(r.stage).toBe("Dabao signer unreachable");
  });

  it("classifies a dead merchant as the payment quote", () => {
    const r = classifyFailure("TypeError: fetch failed — ECONNREFUSED 127.0.0.1:4021");
    expect(r.stage).toBe("x402 payment quote failed");
  });

  it("classifies a glasses timeout as the challenge", () => {
    const r = classifyFailure("Error: motion challenge timed out after 120000ms");
    expect(r.stage).toBe("Glasses challenge timed out");
  });

  it("classifies a settlement RPC failure", () => {
    const r = classifyFailure("Error: facilitator settlement failed on whitechain rpc");
    expect(r.stage).toBe("On-chain settlement failed");
  });

  it("falls back to the generic stage for unknown failures", () => {
    const r = classifyFailure("TypeError: cannot read property 'foo' of undefined");
    expect(r.stage).toBe("Agent loop failed");
  });

  it("every classified failure carries an operator fix", () => {
    for (const cause of [
      "ENOTFOUND router-api.0g.ai",
      "ECONNREFUSED 127.0.0.1:7601 signer",
      "ECONNREFUSED 127.0.0.1:4021",
      "motion challenge timed out",
      "facilitator settlement failed",
      "something unrecognised",
    ]) {
      expect(classifyFailure(cause).hint.length).toBeGreaterThan(10);
    }
  });
});

describe("failureCard", () => {
  it("prints without throwing", () => {
    expect(() => failureCard("stage", "cause\nsecond line", "hint")).not.toThrow();
  });
});
