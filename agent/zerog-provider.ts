/**
 * 0G Private Computer provider: OpenAI-compatible router at router-api.0g.ai.
 * Every request is sealed (TEE) and returns a signed receipt, which the
 * merchant records alongside the payment.
 *
 *   const p = new ZeroGProvider({ apiKey: process.env.ZERO_G_API_KEY });
 *   const { artifact, cost } = await p.generate("a hero image ...");
 */
import type { InferenceProvider, InferenceResult } from "./loop.js";

export interface ZeroGOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** USDT base units charged for one call (default 0.01 = the merchant price). */
  cost?: bigint;
  maxTokens?: number;
}

interface ChatCompletion {
  id?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { total_tokens?: number };
  x_0g_trace?: {
    billing?: { total_cost_usd_micro?: string };
    provider?: string;
    provider_identity?: string;
    request_id?: string;
  };
}

/** 0G per-request trace: the episode-log anchor the Physical AI track wants. */
export interface ZeroGTrace {
  requestId: string;
  providerIdentity: string;
  totalCostUsdMicro: string;
}

export class ZeroGProvider implements InferenceProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private cost: bigint;
  private maxTokens: number;
  /** Trace of the most recent call, for the episode log. */
  lastTrace: ZeroGTrace | null = null;

  constructor(opts: ZeroGOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://router-api.0g.ai/v1";
    this.model = opts.model ?? "gemini-3.5-flash";
    this.cost = opts.cost ?? 10_000n;
    this.maxTokens = opts.maxTokens ?? 1024;
  }

  async generate(prompt: string): Promise<InferenceResult> {
    const body = JSON.stringify({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: this.maxTokens,
    });
    // A transient DNS/network blip must not kill a live take: retry
    // transport-level failures with backoff before giving up.
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          const reason = err instanceof Error ? err.message : String(err);
          console.log(`[0g] transport failure (attempt ${attempt}/3): ${reason} — retrying in ${attempt * 2}s`);
          await new Promise((r) => setTimeout(r, attempt * 2000));
        }
      }
    }
    if (!res) {
      const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
      throw new Error(`0G inference unreachable after 3 attempts: ${reason}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`0G inference failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("0G returned no content");
    const t = data.x_0g_trace;
    if (t) {
      this.lastTrace = {
        requestId: t.request_id ?? data.id ?? "",
        providerIdentity: t.provider_identity ?? "unknown",
        totalCostUsdMicro: t.billing?.total_cost_usd_micro ?? "0",
      };
      console.log(
        `[0g] request ${this.lastTrace.requestId} via ${this.lastTrace.providerIdentity} cost $${(
          Number(this.lastTrace.totalCostUsdMicro) / 1e6
        ).toFixed(6)}`
      );
    }
    return {
      artifact: text,
      cost: this.cost,
      purpose: `0G sealed inference (${this.model})`,
    };
  }
}

/**
 * Pick a provider from the environment: real 0G when a key is present,
 * otherwise a clearly-labelled stub so the demo still runs offline.
 */
export function providerFromEnv(): InferenceProvider {
  const key = process.env.ZERO_G_API_KEY;
  if (key) {
    return new ZeroGProvider({
      apiKey: key,
      model: process.env.ZERO_G_MODEL ?? "gemini-3.5-flash",
    });
  }
  return {
    async generate(prompt: string) {
      return {
        artifact: `sealed result for "${prompt}" (stub 0G inference — set ZERO_G_API_KEY)`,
        cost: 10_000n,
        purpose: "0G sealed inference (stub)",
      };
    },
  };
}
