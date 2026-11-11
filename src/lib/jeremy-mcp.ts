/**
 * Jeremy AI over MCP (user, 2026-11-11). Minimal MCP client (Streamable HTTP,
 * JSON-RPC 2.0) so the dashboard can call Jeremy AI's tools with any auth
 * header, not only "Authorization: Bearer". Configure in Vercel:
 *   JEREMY_MCP_URL     the server URL
 *   JEREMY_MCP_HEADER  header name (e.g. Authorization, x-api-key)
 *   JEREMY_MCP_VALUE   header value (e.g. "Bearer abc…" or the raw key)
 */
export type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };

export function jeremyConfigured(): boolean {
  return Boolean(process.env.JEREMY_MCP_URL);
}

let session: string | null = null;
let nextId = 1;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  const name = process.env.JEREMY_MCP_HEADER;
  const value = process.env.JEREMY_MCP_VALUE;
  if (name && value) h[name] = value;
  if (session) h["Mcp-Session-Id"] = session;
  return h;
}

/** Reads a JSON-RPC reply that may come back as plain JSON or as an SSE stream. */
async function readReply(res: Response, id: number): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (type.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim());
        if (msg.id === id) return msg;
      } catch {
        // keep-alive or partial line
      }
    }
    throw new Error("Jeremy AI sent no reply in the event stream");
  }
  return JSON.parse(text);
}

async function rpc(method: string, params: Record<string, unknown> = {}, notify = false): Promise<unknown> {
  const url = process.env.JEREMY_MCP_URL;
  if (!url) throw new Error("Jeremy AI isn't connected (JEREMY_MCP_URL not set)");
  const id = nextId++;
  const body = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params };
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(60_000) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) session = sid;
  if (notify) return null;
  if (!res.ok) throw new Error(`Jeremy AI answered HTTP ${res.status}${res.status === 401 || res.status === 403 ? " (check the header and value)" : ""}`);
  const msg = await readReply(res, id);
  if (msg.error) throw new Error(`Jeremy AI error: ${JSON.stringify(msg.error).slice(0, 300)}`);
  return msg.result;
}

let ready: Promise<void> | null = null;
async function connect() {
  if (!ready) {
    ready = (async () => {
      session = null;
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Berlin", version: "1.0.0" } });
      await rpc("notifications/initialized", {}, true);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export async function listJeremyTools(): Promise<McpTool[]> {
  await connect();
  const r = (await rpc("tools/list")) as { tools?: McpTool[] };
  return r.tools ?? [];
}

/** Calls one Jeremy AI tool and returns its text content. */
export async function callJeremyTool(name: string, args: Record<string, unknown>): Promise<string> {
  await connect();
  try {
    const r = (await rpc("tools/call", { name, arguments: args })) as { content?: { type: string; text?: string }[]; isError?: boolean };
    const text = (r.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`)).join("\n");
    return r.isError ? `Jeremy AI tool error: ${text}` : text;
  } catch (e) {
    // A dropped session: reconnect once.
    ready = null;
    await connect();
    const r = (await rpc("tools/call", { name, arguments: args })) as { content?: { type: string; text?: string }[] };
    if (!r) throw e;
    return (r.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`)).join("\n");
  }
}

/** Calls a Jeremy AI tool and returns its raw text (JSON string when the tool returns JSON). */
export async function callJeremyRaw(name: string, args: Record<string, unknown>): Promise<string> {
  return callJeremyTool(name, args);
}
