import type { NextRequest } from "next/server";
import { askClaude, askClaudeWithJeremy } from "@/lib/claude";
import { jeremyConfigured } from "@/lib/jeremy-mcp";
import { aggregateEntities, getAdsRange, type AdsEntity } from "@/lib/ads-cortana";
import { scoreCreatives } from "@/lib/creative-score";
import { getStoredAlerts } from "@/lib/ad-alerts";
import { getBrain, searchBrain } from "@/lib/brain";
import { ADMIN_COOKIE, SERVICE_TOKEN } from "@/lib/admin-gate";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * "An AI that reads your numbers" (user, 2026-11-10): the Ask Berlin box.
 * Each question is answered from a fresh snapshot of the live numbers plus the
 * most relevant Skills & Knowledge docs. Jeremy AI can be added as a second
 * brain here once it's connected.
 */
const slim = (list: AdsEntity[], n = 12) =>
  list.slice(0, n).map((e) => ({
    name: e.name,
    status: e.status,
    spent: Math.round(e.spend * 100) / 100,
    impressions: e.impressions,
    cpm: e.cpm && Math.round(e.cpm * 100) / 100,
    hookRate: e.hookRate && Math.round(e.hookRate * 1000) / 10,
    holdRate: e.holdRate && Math.round(e.holdRate * 1000) / 10,
    lctr: e.linkCtr && Math.round(e.linkCtr * 1000) / 10,
    lpViews: e.lpViews,
    lpConnect: e.lpConnectRate && Math.round(e.lpConnectRate * 1000) / 10,
    completeRegistrations: e.registrations,
    costPerRegistration: e.costPerOptIn && Math.round(e.costPerOptIn * 100) / 100,
    optInRate: e.optInRate && Math.round(e.optInRate * 1000) / 10,
    scheduled: e.booked,
    costPerSchedule: e.costPerBooked && Math.round(e.costPerBooked * 100) / 100,
    highTicket: e.htSales,
    highTicketRevenue: e.htRevenue,
    roas: e.roas && Math.round(e.roas * 100) / 100,
  }));

async function snapshot(origin: string) {
  const presets = ["today", "yesterday", "last_7_days", "this_month"] as const;
  const ranges = await Promise.all(presets.map((p) => getAdsRange(p)));
  const ads: Record<string, unknown> = {};
  presets.forEach((p, i) => {
    const rows = ranges[i] ?? [];
    ads[p] = {
      campaigns: slim(aggregateEntities(rows.filter((r) => r.level === "campaign"))),
      adSets: slim(aggregateEntities(rows.filter((r) => r.level === "adset"))),
      ads: slim(aggregateEntities(rows.filter((r) => r.level === "ad"))),
    };
  });
  const last7 = ranges[2] ?? [];
  const creative = scoreCreatives(aggregateEntities(last7.filter((r) => r.level === "ad")))
    .filter((s) => s.verdict !== "Not enough spend")
    .map((s) => ({ ad: s.name, score: s.score, verdict: s.verdict, hook: s.pieces.hook.score, body: s.pieces.body.score, cta: s.pieces.cta.score, why: s.why }));
  const alerts = (await getStoredAlerts()).filter((a) => a.active).map((a) => ({ level: a.level, title: a.title, detail: a.detail }));
  const internal = (path: string) =>
    fetch(`${origin}${path}`, { headers: { cookie: `${ADMIN_COOKIE}=${SERVICE_TOKEN}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [pace, overview] = await Promise.all([internal("/api/bronson/ads/pace"), internal("/api/bronson/overview/metrics?preset=this_month")]);
  return { ads, creativeScoresLast7Days: creative, activeAlerts: alerts, pace, overviewThisMonth: overview };
}

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { question?: string; history?: Turn[]; page?: string };
  const question = String(b.question ?? "").trim();
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "The AI isn't configured on this server." }, { status: 500 });

  const origin = new URL(request.url).origin;
  const [data, docs] = await Promise.all([snapshot(origin), getBrain()]);
  const hits = searchBrain(docs, question, 3);
  const knowledge = hits
    .map((h) => docs.find((d) => d.id === h.id))
    .filter(Boolean)
    .map((d) => `### ${d!.title}\n${d!.body.slice(0, 6000)}`)
    .join("\n\n");
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((t) => `${t.role === "user" ? "Q" : "A"}: ${String(t.content).slice(0, 2000)}`).join("\n");
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const system = `You are Berlin, the analyst inside Bronson's marketing dashboard (The Inner Table, a subscription-based e-commerce coaching offer sold through a live masterclass funnel: Meta ads -> masterclass registration -> live masterclass -> booked call -> high ticket close). Answer the operator's question from the live data below. Be direct and specific: name the campaign, ad set or ad, quote the numbers, and say what to do next. Short paragraphs or a few bullets. If the data doesn't answer it, say exactly what's missing instead of guessing.

KPI lines: cost per complete registration $10 good / over $12 bad; opt-in rate 30% good / under 20% bad; hook rate 30%; hold rate 25% good / under 15% bad; link CTR 2% good / under 0.5% bad; CPM under $20 good / over $80 bad; frequency under 2 good / over 3.5 bad; ROAS goal 3x. Rates below are percentages. Today's ad spend updates through the day.

Current time: ${now} ET. Page the operator is on: ${b.page ?? "unknown"}.

LIVE DATA (JSON):
${JSON.stringify(data)}

${knowledge ? `RELEVANT SOPs FROM SKILLS & KNOWLEDGE:\n${knowledge}` : ""}`;

  const user = history ? `Earlier in this chat:\n${history}\n\nQuestion: ${question}` : question;
  try {
    if (jeremyConfigured()) {
      // Jeremy AI's tools are available: Claude brings the numbers, Jeremy AI the marketing judgment.
      try {
        const r = await askClaudeWithJeremy({
          system: `${system}\n\nYou also have Jeremy AI's tools (names start with jeremy__). Jeremy AI is the operator's marketing expert: consult it for strategy, offer, funnel, ad and copy judgment, then combine its advice with the live numbers. Say when an answer leans on Jeremy AI.`,
          user,
        });
        if (!r.refused) return Response.json({ answer: r.text, sources: [...hits.map((h) => h.title), ...(r.used.length ? [`Jeremy AI (${[...new Set(r.used)].join(", ")})`] : [])] });
      } catch (e) {
        console.error("Jeremy AI unavailable, answering without it", e);
      }
    }
    const r = await askClaude({ system, user, effort: "medium" });
    if (r.refused) return Response.json({ answer: "I can't answer that one. Try asking it a different way." });
    return Response.json({ answer: r.text, sources: hits.map((h) => h.title) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "The AI request failed" }, { status: 500 });
  }
}
