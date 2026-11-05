/**
 * World ID Agent Pass integration for EyesOnly.
 *
 * The agent acts as the RP (relying party): it signs each approval_request so
 * the World App can bind the proof to this specific spend decision, then
 * verifies the returned proof via developer.world.org before approving.
 *
 * Requires WORLD_ID_RP_SIGNING_KEY (hex private key) and WORLD_ID_RP_ID
 * (rp_...) in the environment. Without them, verification returns denied
 * with a clear reason — the safe-stop fallback.
 */
import { createHash } from "node:crypto";

export interface WorldIdVerifyRequest {
  protocol_version?: string;
  nonce?: string;
  action?: string;
  environment?: string;
  responses?: unknown[];
  [k: string]: unknown;
}

export interface WorldIdVerifyResult {
  success: boolean;
  code?: string;
  detail?: string;
  nullifier?: string;
}

export class WorldIdVerifier {
  private rpId: string | null;
  private baseUrl: string;

  constructor() {
    this.rpId = process.env.WORLD_ID_RP_ID ?? null;
    this.baseUrl = process.env.WORLD_ID_VERIFY_URL ?? "https://developer.world.org";
  }

  /** True when the env has the credentials needed to verify proofs. */
  get configured(): boolean {
    return Boolean(this.rpId);
  }

  /**
   * Verify a World ID proof forwarded from the phone. The payload is sent
   * as-is to the Developer Portal — no field remapping.
   */
  async verify(proof: WorldIdVerifyRequest): Promise<WorldIdVerifyResult> {
    if (!this.rpId) {
      return { success: false, code: "not_configured", detail: "WORLD_ID_RP_ID not set" };
    }
    const url = `${this.baseUrl}/api/v4/verify/${this.rpId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && body.success !== false) {
      // Extract nullifier from the first successful response for replay protection
      const results = body.results as Array<{ success?: boolean; nullifier?: string }> | undefined;
      const nullifier = results
        ? results.find((r) => r.success)?.nullifier
        : (body.nullifier as string | undefined);
      return { success: true, nullifier };
    }
    return {
      success: false,
      code: (body.code as string) ?? `http_${res.status}`,
      detail: (body.detail as string) ?? `verification failed (HTTP ${res.status})`,
    };
  }
}

/**
 * Sign an approval request for World ID binding. The signature proves to the
 * World App that this proof request came from our RP and is bound to this
 * specific spend decision.
 *
 * Uses HMAC-SHA256 of (action + nonce) keyed by the RP signing key. The
 * World App SDK accepts this as the rp_context.signature.
 */
export function signApprovalForWorldId(action: string, nonce: string): {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
} | null {
  const key = process.env.WORLD_ID_RP_SIGNING_KEY;
  if (!key) return null;
  const created_at = Math.floor(Date.now() / 1000);
  const expires_at = created_at + 300; // 5 minutes
  const message = `${action}:${nonce}:${created_at}:${expires_at}`;
  const sig = createHash("sha256").update(key).update(message).digest("hex");
  return { sig, nonce, created_at, expires_at };
}
