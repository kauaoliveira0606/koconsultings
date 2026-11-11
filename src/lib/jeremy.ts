import { callJeremyRaw, jeremyConfigured, listJeremyTools, type McpTool } from "@/lib/jeremy-mcp";

/**
 * Talking to Jeremy AI directly (user, 2026-11-11: "have it work throughout the
 * whole process"). Jeremy AI's persona MCP server (persona-mcp.utari.ai) has
 * send_message (start / continue a conversation), get_response (fetch a reply
 * still being written) and persona_info. Jeremy AI itself has Berlin connected,
 * so it can pull any dashboard number on its own while it answers.
 */
export { jeremyConfigured };

type Reply = { text: string; conversationId: string | null; done: boolean; runId: string | null };

/** Pull text, ids and status out of whatever shape the tool returned (JSON in a text block, or plain text). */
function parse(raw: string): Reply {
  let j: Record<string, unknown> | null = null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") j = v as Record<string, unknown>;
  } catch {
    j = null;
  }
  if (!j) return { text: raw, conversationId: null, done: true, runId: null };
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = j![k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };
  const status = (pick("status", "state") ?? "").toLowerCase();
  const text = pick("response", "reply", "message", "text", "content", "output", "answer") ?? "";
  const done = status ? /complete|done|finished|success|succeeded|idle|ready/.test(status) || (!!text && !/pending|running|progress|queued|working/.test(status)) : !!text;
  return { text, conversationId: pick("conversation_id", "conversationId"), done, runId: pick("run_id", "runId") };
}

function argName(tool: McpTool | undefined, candidates: string[], fallback: string): string {
  const props = Object.keys(((tool?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties) ?? {});
  return candidates.find((c) => props.includes(c)) ?? props.find((p) => candidates.some((c) => p.toLowerCase().includes(c))) ?? fallback;
}

/** Sends a message to Jeremy AI and waits (polling get_response) for the full reply. */
export async function askJeremy(message: string, conversationId?: string | null, timeoutMs = 240_000): Promise<{ text: string; conversationId: string | null }> {
  const tools = await listJeremyTools();
  const send = tools.find((t) => t.name === "send_message") ?? tools.find((t) => /send|message|chat|ask/i.test(t.name));
  const get = tools.find((t) => t.name === "get_response") ?? tools.find((t) => /response|result|poll/i.test(t.name));
  if (!send) throw new Error(`Jeremy AI has no send_message tool (tools: ${tools.map((t) => t.name).join(", ")})`);

  const msgKey = argName(send, ["message", "content", "text", "prompt"], "message");
  const convKey = argName(send, ["conversation_id", "conversationId"], "conversation_id");
  const args: Record<string, unknown> = { [msgKey]: message };
  if (conversationId) args[convKey] = conversationId;

  let r = parse(await callJeremyRaw(send.name, args));
  let conv = r.conversationId ?? conversationId ?? null;
  const started = Date.now();
  while (!r.done && get && Date.now() - started < timeoutMs) {
    await new Promise((res) => setTimeout(res, 3000));
    const runKey = argName(get, ["run_id", "runId"], "run_id");
    const gConvKey = argName(get, ["conversation_id", "conversationId"], "conversation_id");
    const gArgs: Record<string, unknown> = {};
    if (r.runId) gArgs[runKey] = r.runId;
    if (conv) gArgs[gConvKey] = conv;
    const next = parse(await callJeremyRaw(get.name, gArgs));
    r = { ...next, runId: next.runId ?? r.runId, text: next.text || r.text };
    conv = next.conversationId ?? conv;
  }
  if (!r.done && !r.text) throw new Error("Jeremy AI is still writing; try again in a minute.");
  return { text: r.text, conversationId: conv };
}
