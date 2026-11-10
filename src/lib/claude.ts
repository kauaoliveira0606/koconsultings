import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude for Berlin's built-in AI (copy check, Ask box). Uses ANTHROPIC_API_KEY
 * from Vercel. Server-side refusal fallback is on ("default" routing), so a
 * request the main model declines is retried on a fallback model in the same call.
 */
export const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

type Opts = {
  system: string;
  user: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** JSON schema for structured output; the reply is then parsed JSON. */
  schema?: Record<string, unknown>;
};

export async function askClaude(o: Opts): Promise<{ text: string; json: unknown; refused: boolean }> {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: o.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: o.system,
    messages: [{ role: "user", content: o.user }],
    output_config: {
      effort: o.effort ?? "medium",
      ...(o.schema ? { format: { type: "json_schema", schema: o.schema } } : {}),
    },
  } as Parameters<ReturnType<typeof anthropic>["beta"]["messages"]["create"]>[0]);
  const msg = res as Anthropic.Beta.BetaMessage;
  if (msg.stop_reason === "refusal") return { text: "", json: null, refused: true };
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown = null;
  if (o.schema) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { text, json, refused: false };
}
