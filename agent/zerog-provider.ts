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
  tee?: unknown;
  receipt?: unknown;
}

export class ZeroGProvider implements InferenceProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private cost: bigint;
  private maxTokens: number;

  constructor(opts: ZeroGOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://router-api.0g.ai/v1";
    this.model = opts.model ?? "glm-5.2";
    this.cost = opts.cost ?? 10_000n;
    this.maxTokens = opts.maxTokens ?? 512;
  }

  async generate(prompt: string): Promise<InferenceResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: this.maxTokens,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`0G inference failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("0G returned no content");
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
      model: process.env.ZERO_G_MODEL ?? "glm-5.2",
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
