import Anthropic from "@anthropic-ai/sdk";

/*
 * Thin wrapper around the Anthropic SDK. The key is read from
 * ANTHROPIC_API_KEY by the SDK itself — never hardcoded, never logged. When
 * the variable is missing the AI features degrade to the rule-based layer
 * (see routes/aiAnalytics.ts), so the app never depends on the key to boot.
 */

export const AI_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  return client;
}

/** The model declined (safety classifier) — rare for hotel numbers, but handled. */
export class AiRefusedError extends Error {
  constructor() {
    super("AI declined the request");
    this.name = "AiRefusedError";
  }
}

export async function askClaude(opts: {
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ text: string; model: string }> {
  const res = await getClient().messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    // Adaptive thinking is the default on Opus 5; effort sets how deep.
    output_config: { effort: opts.effort ?? "medium" },
    // The system prompt is stable and cached; the volatile data lives in the user turn.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") throw new AiRefusedError();
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, model: res.model };
}

export { Anthropic };
