import type { NextRequest } from "next/server";
import { AD_FORMATS } from "@/lib/berlin/ad-formats";

/**
 * Berlin for Claude — a minimal Model Context Protocol server (Streamable HTTP,
 * JSON-RPC 2.0, stateless). It exposes the Bronson dashboard's read data as MCP
 * tools so the operator's own Claude can pull live numbers. Tools self-fetch the
 * app's existing public API routes, so there is one source of truth.
 *
 * Connect it in Claude as a custom connector:
 *   URL: https://www.koconsultings.com/api/berlin/mcp?token=<BERLIN_MCP_TOKEN>
 */

export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";
const PRESETS = ["today", "yesterday", "last_3_days", "last_7_days", "last_30_days", "this_month", "last_month", "all_time"];

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, origin: string) => Promise<unknown>;
};

const presetProp = {
  type: "string",
  enum: PRESETS,
  description: "Date range preset. Defaults to last_30_days.",
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Upstream ${url} failed (${res.status})`);
  return res.json();
}

function preset(args: Record<string, unknown>): string {
  const p = typeof args.preset === "string" && PRESETS.includes(args.preset) ? args.preset : "last_30_days";
  return p;
}

const TOOLS: Tool[] = [
  {
    name: "get_ads_by_source",
    description:
      "Bronson's ad spend and attributed revenue by traffic source (from Cortana): ad spend, paid revenue, paid ROAS, cost per paid lead, and the per-source table.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: (args, origin) => fetchJson(`${origin}/api/bronson/ads?preset=${preset(args)}`),
  },
  {
    name: "get_overview_metrics",
    description: "Bronson's headline overview metrics for the range: revenue, cash, spend, ROAS, closes and related KPIs.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: (args, origin) => fetchJson(`${origin}/api/bronson/overview/metrics?preset=${preset(args)}`),
  },
  {
    name: "get_live_cash_today",
    description: "Today's live cash collected for Bronson (PCN + affiliate), polled from the CRM. No arguments.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: (_args, origin) => fetchJson(`${origin}/api/bronson/overview/live-cash`),
  },
  {
    name: "get_revenue_by_source_pnl",
    description: "Bronson paid vs organic PNL and revenue breakdown for the range.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: (args, origin) => fetchJson(`${origin}/api/bronson/overview/pnl?preset=${preset(args)}`),
  },
  {
    name: "list_ad_formats",
    description:
      "List the Krueger-method ad formats (the creative playbook): id, name, one-line summary, goals, production style and length. Use get_ad_format for the full breakdown.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () =>
      AD_FORMATS.map((f) => ({ id: f.id, name: f.name, tldr: f.tldr, goals: f.goals, production: f.production, length: f.length })),
  },
  {
    name: "get_ad_format",
    description:
      "Full breakdown of one Krueger ad format: why it works, the beat-by-beat structure, a fill-in template, opening hooks, a complete example script, and mistakes to avoid. Pass the format id or name.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Format id or name, e.g. 'contrarian-deep-dive' or 'Contrarian Deep Dive'." } },
      required: ["id"],
      additionalProperties: false,
    },
    run: async (args) => {
      const q = String(args.id ?? "").toLowerCase().trim();
      const f = AD_FORMATS.find((x) => x.id === q || x.name.toLowerCase() === q || x.id.includes(q) || x.name.toLowerCase().includes(q));
      if (!f) throw new Error(`No ad format matches "${args.id}". Use list_ad_formats to see ids.`);
      return f;
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function authorized(req: NextRequest): boolean {
  const required = process.env.BERLIN_MCP_TOKEN;
  if (!required) return true; // not configured yet -> open (lock by setting the env var)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === required || fromHeader === required;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return rpcError(null, -32001, "Unauthorized: missing or wrong token");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const origin = new URL(req.url).origin;
  const handle = async (msg: { id?: unknown; method?: string; params?: Record<string, unknown> }): Promise<Response | null> => {
    const { id, method, params } = msg;
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "Berlin", version: "1.0.0" },
          instructions: "Berlin exposes the Bronson marketing dashboard. Use the tools to read live spend, revenue, ROAS and cash.",
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return null; // notification: no response
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, {
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        });
      case "tools/call": {
        const name = params?.name as string;
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
        try {
          const data = await tool.run(args, origin);
          return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
        } catch (err) {
          return rpcResult(id, {
            content: [{ type: "text", text: `Error running ${name}: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          });
        }
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  };

  // Single request (notifications return 202 with no body).
  if (!Array.isArray(body)) {
    const res = await handle(body as { id?: unknown; method?: string; params?: Record<string, unknown> });
    return res ?? new Response(null, { status: 202 });
  }
  // Batch.
  const responses = (await Promise.all(body.map((m) => handle(m)))).filter(Boolean);
  if (responses.length === 0) return new Response(null, { status: 202 });
  const payloads = await Promise.all(responses.map((r) => (r as Response).json()));
  return Response.json(payloads);
}

export function GET() {
  return Response.json(
    { name: "Berlin MCP", transport: "streamable-http", hint: "POST JSON-RPC 2.0 here; add ?token=... to authenticate." },
    { status: 200 },
  );
}
