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

/**
 * Claude with Jeremy AI's MCP tools available (manual tool loop). Each tool the
 * model calls is run against Jeremy AI and the result sent back, up to `maxTurns`.
 * Returns the final text and which Jeremy tools were used.
 */
export async function askClaudeWithJeremy(o: { system: string; user: string; maxTurns?: number; effort?: "low" | "medium" | "high" }) {
  const { listJeremyTools, callJeremyTool } = await import("@/lib/jeremy-mcp");
  const mcpTools = await listJeremyTools();
  const tools = mcpTools.map((t) => ({
    name: `jeremy__${t.name}`.slice(0, 64),
    description: `Jeremy AI: ${t.description ?? t.name}`.slice(0, 1024),
    input_schema: (t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: "object", properties: {} }) as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const byName = new Map(mcpTools.map((t) => [`jeremy__${t.name}`.slice(0, 64), t.name]));
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: o.user }];
  const used: string[] = [];
  for (let turn = 0; turn < (o.maxTurns ?? 6); turn++) {
    const res = (await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: o.system,
      tools,
      messages,
      output_config: { effort: o.effort ?? "medium" },
    } as Parameters<ReturnType<typeof anthropic>["beta"]["messages"]["create"]>[0])) as Anthropic.Beta.BetaMessage;
    if (res.stop_reason === "refusal") return { text: "", used, refused: true };
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !calls.length) {
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
      return { text, used, refused: false };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const c of calls) {
      const real = byName.get(c.name);
      used.push(real ?? c.name);
      try {
        const out = real ? await callJeremyTool(real, (c.input ?? {}) as Record<string, unknown>) : `Unknown tool ${c.name}`;
        results.push({ type: "tool_result", tool_use_id: c.id, content: out.slice(0, 60_000) || "(empty)" });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: c.id, content: e instanceof Error ? e.message : "Tool failed", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "I ran out of steps before finishing. Try a narrower question.", used, refused: false };
}

/** A tool Claude can call during askClaudeWithTools; `run` executes it on our side. */
export type LocalTool = {
  name: string;
  description: string;
  input_schema: Anthropic.Beta.BetaTool.InputSchema;
  run: (input: Record<string, unknown>) => Promise<string>;
};

/** Claude with our own tools (manual tool loop). Returns the final text and the tools it used. */
export async function askClaudeWithTools(o: {
  system: string;
  user: string;
  tools: LocalTool[];
  maxTurns?: number;
  effort?: "low" | "medium" | "high";
  /** After this many ms, tools are switched off and Claude writes up what it has. */
  budgetMs?: number;
}) {
  const byName = new Map(o.tools.map((t) => [t.name, t]));
  const tools = o.tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: o.user }];
  const used: string[] = [];
  const maxTurns = o.maxTurns ?? 8;
  const deadline = Date.now() + (o.budgetMs ?? 10 * 60_000);
  for (let turn = 0; turn < maxTurns; turn++) {
    // Last turn or out of time: no more tools, write the final answer now.
    const final = turn === maxTurns - 1 || Date.now() > deadline;
    if (final) {
      const last = messages[messages.length - 1];
      const note = { type: "text" as const, text: "Time's up for tools. Write the final deliverable now with what you have." };
      if (last.role === "user") last.content = typeof last.content === "string" ? [{ type: "text", text: last.content }, note] : [...last.content, note];
    }
    const res = (await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: o.system,
      tools,
      ...(final ? { tool_choice: { type: "none" } } : {}),
      messages,
      output_config: { effort: o.effort ?? "medium" },
    } as Parameters<ReturnType<typeof anthropic>["beta"]["messages"]["create"]>[0])) as Anthropic.Beta.BetaMessage;
    if (res.stop_reason === "refusal") return { text: "", used, refused: true };
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !calls.length) {
      return { text: res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join(""), used, refused: false };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const c of calls) {
      used.push(c.name);
      const tool = byName.get(c.name);
      try {
        const out = tool ? await tool.run((c.input ?? {}) as Record<string, unknown>) : `Unknown tool ${c.name}`;
        results.push({ type: "tool_result", tool_use_id: c.id, content: out.slice(0, 60_000) || "(empty)" });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: c.id, content: e instanceof Error ? e.message : "Tool failed", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "", used, refused: false, outOfTurns: true };
}
