import { AREAS, PILLARS } from "@/lib/areas";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, SERVICE_TOKEN } from "@/lib/admin-gate";
import { AD_FORMATS } from "@/lib/berlin/ad-formats";
import { aggregateEntities, getAdsRange } from "@/lib/ads-cortana";
import { scoreCreatives } from "@/lib/creative-score";
import { checkCopy } from "@/lib/copy-check";
import { getSalesByAd } from "@/lib/sales-attribution";
import { resolveRange, type RangePreset } from "@/lib/date-range";
import { getBrain, searchBrain, addDoc, type BrainType } from "@/lib/brain";
import { getOffice, addTask, setTaskStatus, TASK_STATUSES, AI_ASSIGNEE, type TaskStatus, type TaskPriority } from "@/lib/office";

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
  // The dashboard APIs sit behind the login; this server-to-server call uses the service key.
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json", cookie: `${ADMIN_COOKIE}=${SERVICE_TOKEN}` },
  });
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
    run: async () => {
      // Newest first: formats added in Skills & Knowledge (type Format), then the core library.
      const added = (await getBrain())
        .filter((d) => d.type === "Format")
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .map((d) => ({ id: d.id, name: d.title, tldr: d.summary, added: d.updated, new: true }));
      return [...added, ...AD_FORMATS.map((f) => ({ id: f.id, name: f.name, tldr: f.tldr, goals: f.goals, production: f.production, length: f.length }))];
    },
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
      if (!f) {
        const added = (await getBrain()).find((d) => d.type === "Format" && (d.id.toLowerCase() === q || d.title.toLowerCase().includes(q)));
        if (added) return added;
      }
      if (!f) throw new Error(`No ad format matches "${args.id}". Use list_ad_formats to see ids.`);
      return f;
    },
  },
  {
    name: "get_ads_pace",
    description:
      "3-hour pace for Bronson ads: opt-ins, booked calls and cash in the last three finished hours vs the prior 3h and yesterday, opt-ins by hour today vs yesterday, and a budget call per campaign (scale / hold / watch / cut) from cost per opt-in. Today's spend is not available (Cortana posts spend next morning).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: (_args, origin) => fetchJson(`${origin}/api/bronson/ads/pace`),
  },
  {
    name: "get_campaigns_and_ads",
    description:
      "Every Bronson Meta campaign and ad for the range, sorted by spend: spend, CPM, link CTR, hook, hold, LP connect, opt-ins, opt-in rate, cost per opt-in, booked calls, calls held, sales, revenue, ROAS, frequency.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: async (args, origin) => {
      const d = await fetchJson(`${origin}/api/bronson/ads?preset=${preset(args)}`);
      const slim = (rows: Record<string, unknown>[]) => rows.map(({ daily: _daily, ...rest }) => rest);
      return { campaigns: slim(d.campaigns ?? []), ads: slim(d.ads ?? []), lastSpendDate: d.lastSpendDate };
    },
  },
  {
    name: "get_funnel_analytics",
    description: "Bronson webinar funnel step by step for the range (impressions -> clicks -> landing page -> opt-in -> attended -> stayed -> booked -> showed -> closed -> cash), with conversion rates and cost per step. source: paid | organic | total.",
    inputSchema: {
      type: "object",
      properties: { preset: presetProp, source: { type: "string", enum: ["paid", "organic", "total"] } },
      additionalProperties: false,
    },
    run: (args, origin) =>
      fetchJson(`${origin}/api/bronson/funnels/analytics?preset=${preset(args)}&source=${["paid", "organic", "total"].includes(String(args.source)) ? args.source : "paid"}`),
  },
  {
    name: "get_creative_scores",
    description:
      "Every ad scored piece by piece (hook, body/hold, CTA/click, result = cost per registration) with a verdict (Scale / Fix the hook / Fix the body / Fix the CTA / Kill) and what to test next. Use it to write the next batch of ads from what worked.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: async (args) => {
      const rows = await getAdsRange(typeof args.preset === "string" ? args.preset : "last_7_days");
      return rows ? scoreCreatives(aggregateEntities(rows.filter((r) => r.level === "ad"))) : [];
    },
  },
  {
    name: "get_sales_by_ad",
    description: "Every sale in the range with the ad that made it (Cortana, by hour), the amount, and the customer/closer/offer from the matching post call note. Unmatched non-high-ticket sales are VIP or other online purchases.",
    inputSchema: { type: "object", properties: { preset: presetProp }, additionalProperties: false },
    run: async (args) => getSalesByAd(resolveRange(preset(args) as RangePreset)),
  },
  {
    name: "check_copy",
    description:
      "Check copy before it ships (ads, scripts, pages, emails): banned-word scan plus a review against the Bronson rules and ad creative framework. Returns ship / fix / block, every problem quoted, and a fixed version. Run this on anything you write for Bronson before putting it in Review.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, kind: { type: "string", description: "e.g. Ad script, YouTube script, Landing page, Email" } },
      required: ["text"],
      additionalProperties: false,
    },
    run: async (args) => checkCopy(String(args.text ?? ""), String(args.kind ?? "")),
  },
  {
    name: "search_knowledge",
    description:
      "Search the Skills & Knowledge library (Claude skills, SOPs, client copy rules, processes). Do this BEFORE starting any task: find the SOP or skill that covers it and follow it. Returns titles, types, ids and a snippet.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    run: async (args) => searchBrain(await getBrain(), String(args.query ?? ""), 8),
  },
  {
    name: "get_knowledge",
    description: "Read one document from the Skills & Knowledge library in full. Pass its id (from search_knowledge / list_knowledge) or its exact title.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Document id or exact title" } }, required: ["id"], additionalProperties: false },
    run: async (args) => {
      const key = String(args.id ?? "").trim().toLowerCase();
      const docs = await getBrain();
      const d = docs.find((x) => x.id.toLowerCase() === key || x.title.toLowerCase() === key) ?? docs.find((x) => x.title.toLowerCase().includes(key));
      if (!d) throw new Error(`No document matches "${args.id}". Use search_knowledge.`);
      return d;
    },
  },
  {
    name: "list_knowledge",
    description: "List every document in the Skills & Knowledge library (id, title, type, category, summary). Types: Skill, SOP, Rules, Process, Note.",
    inputSchema: { type: "object", properties: { type: { type: "string", enum: ["Skill", "SOP", "Rules", "Process", "Format", "Note"] } }, additionalProperties: false },
    run: async (args) =>
      (await getBrain()).filter((d) => !args.type || d.type === args.type).map(({ id, title, type, category, summary }) => ({ id, title, type, category, summary })),
  },
  {
    name: "add_knowledge",
    description: "Add a document to the Skills & Knowledge library: a new SOP, training notes, a process, an improvement to how something is done, or a new ad format (type Format: what it is, why it works, beat-by-beat structure, template, example). New formats show up first in list_ad_formats. Keep one topic per document. Type Skill = a tool Claude runs; every Skill body MUST start with a breakdown block: '<!-- breakdown -->' then '### What it is', '### When to use it', '### When not to use it', '### What you give it', '### What you get back', '### How it works', '### Rules it follows', '### Works with', '### How to run it', then '<!-- /breakdown -->', then the full skill file. Everything else (SOPs, course lessons, transcripts, rules) is the Knowledge base.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: ["Skill", "SOP", "Rules", "Process", "Format", "Note"] },
        category: { type: "string" },
        summary: { type: "string" },
        body: { type: "string", description: "Markdown" },
        sections: {
          type: "array",
          items: { type: "string", enum: AREAS.map((a) => a.id) },
          description: "Area ids it belongs in. Pillars: " + PILLARS.map((p) => `${p.label} = ${AREAS.filter((a) => a.pillar === p.id).map((a) => a.id).join("/")}`).join("; ") + ". Omit to auto-sort from the title.",
        },
      },
      required: ["title", "type", "body"],
      additionalProperties: false,
    },
    run: async (args) => ({
      ok: true,
      id: await addDoc({
        title: String(args.title),
        type: String(args.type) as BrainType,
        category: args.category ? String(args.category) : "",
        summary: args.summary ? String(args.summary) : "",
        body: String(args.body),
        source: "Added by Claude",
        ...(Array.isArray(args.sections) && args.sections.length ? { sections: (args.sections as unknown[]).map(String) } : {}),
      }),
    }),
  },
  {
    name: "list_office_tasks",
    description:
      "The Office board. Returns open tasks with id, task, description, assignee, status (Up Next / Doing / Blocked / Review / Done), priority and any review note. Tasks assigned to 'AI' are your queue: before working one, search_knowledge for the SOP or skill that covers it and follow it. Pick up 'Up Next', set 'Doing' while working, then 'Review' with a result for a human to approve. A 'Denied:' review note means redo it.",
    inputSchema: {
      type: "object",
      properties: { only_ai: { type: "boolean", description: "Only tasks assigned to the AI. Default true." } },
      additionalProperties: false,
    },
    run: async (args) => {
      const { tasks } = await getOffice();
      const onlyAi = args.only_ai !== false;
      return tasks.filter((t) => !t.done && (!onlyAi || t.assignee === AI_ASSIGNEE));
    },
  },
  {
    name: "add_office_task",
    description: "Add a task to the Office board. Defaults to the AI queue (assignee 'AI', status 'Up Next'). Use for work you found that needs doing, or to flag something Blocked for a person.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        description: { type: "string" },
        assignee: { type: "string", description: "'AI' or a person's name. Default 'AI'." },
        department: { type: "string", description: "Default 'Marketing'." },
        role: { type: "string", description: "Default 'AI'." },
        status: { type: "string", enum: ["Up Next", "Doing", "Blocked", "Review"] },
        priority: { type: "string", enum: ["High", "Normal", "Low"] },
      },
      required: ["task"],
      additionalProperties: false,
    },
    run: async (args) => {
      const id = await addTask({
        task: String(args.task),
        description: args.description ? String(args.description) : "",
        assignee: args.assignee ? String(args.assignee) : AI_ASSIGNEE,
        department: args.department ? String(args.department) : "Marketing",
        role: args.role ? String(args.role) : "AI",
        status: (TASK_STATUSES as readonly string[]).includes(String(args.status)) ? (args.status as TaskStatus) : "Up Next",
        priority: ["High", "Normal", "Low"].includes(String(args.priority)) ? (args.priority as TaskPriority) : "Normal",
      });
      return { ok: true, id };
    },
  },
  {
    name: "update_office_task",
    description:
      "Move an Office task: status 'Doing' when you start, 'Review' with a result when you finish (a human approves or denies it), 'Blocked' with a result explaining what you need. You cannot mark AI work Done yourself; that's the human's approval.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["Up Next", "Doing", "Blocked", "Review"] },
        result: { type: "string", description: "What you did, or what you need if Blocked." },
      },
      required: ["id", "status"],
      additionalProperties: false,
    },
    run: async (args) => {
      const status = String(args.status);
      if (!["Up Next", "Doing", "Blocked", "Review"].includes(status)) throw new Error("status must be Up Next, Doing, Blocked or Review");
      await setTaskStatus(String(args.id), status as TaskStatus, args.result !== undefined ? { result: String(args.result) } : {});
      return { ok: true };
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
          instructions: "Berlin exposes the Bronson marketing dashboard and its Office AI queue. Read live pace, campaigns, ads, funnel, spend, revenue, ROAS and cash. Work the AI queue: list_office_tasks, set Doing, finish with Review + result for human approval.",
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

export function GET(req: NextRequest) {
  // MCP clients GET with Accept: text/event-stream to open a server-to-client stream.
  // This server has none, so per the MCP spec answer 405 (a 200 JSON page can confuse clients).
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  return Response.json(
    { name: "Berlin MCP", transport: "streamable-http", hint: "POST JSON-RPC 2.0 here; add ?token=... to authenticate." },
    { status: 200 },
  );
}
