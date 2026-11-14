import { airtableListFresh } from "@/lib/airtable/client";
import { getPostCallNotes } from "@/lib/airtable/tables";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { askClaude } from "@/lib/claude";
import { getBrain, metricTagsFor, sopsFor } from "@/lib/brain";
import { ADMIN_COOKIE, SERVICE_TOKEN } from "@/lib/admin-gate";
import type { WeeklyScorecardPayload } from "@/lib/weekly-scorecard";

/**
 * AI bottleneck analysis on the Scorecard (user, 2026-11-11): read the weekly
 * scorecard, pacing and lead quality, and say what's constraining the business.
 * Deliberately NOT ad-level ("I can study that myself"). Saved in the Jeremy
 * Feedback table as Type "bottleneck"; refreshed each morning and on demand.
 */
const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tbljVE1MhYrfBNpt1";

export type BottleneckReport = { id: string; date: string; created: string; text: string };

export function origin() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.koconsultings.com";
}

export async function internal<T>(path: string): Promise<T | null> {
  return fetch(`${origin()}${path}`, { headers: { cookie: `${ADMIN_COOKIE}=${SERVICE_TOKEN}` }, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);
}

/** The scorecard as compact rows: label, week value, goal, status and the daily values. */
export function compactScorecard(p: WeeklyScorecardPayload | null) {
  if (!p) return null;
  return {
    week: p.weekLabel,
    days: p.dayDates,
    groups: p.groups.map((g) => ({
      group: g.title,
      rows: g.rows.map((r) => ({
        metric: r.label,
        format: r.format,
        week: r.week.value,
        status: r.week.status ?? "no target",
        goal: r.goal === null ? null : `${r.goalDirection === "higher" ? ">=" : "<="} ${r.goal}`,
        daily: r.days.map((d) => d.value),
      })),
    })),
  };
}

export async function leadQuality() {
  const since = addDaysToDateString(easternDateString(), -30);
  const notes = (await getPostCallNotes()).filter((n) => n.date && n.date >= since);
  const recs = await airtableListFresh(BASE, "tbltiRXQvojxiTJaM");
  const extra = new Map(recs.map((r) => [r.id, r.fields as Record<string, unknown>]));
  const count = (vals: (string | null | undefined)[]) =>
    Object.entries(vals.reduce<Record<string, number>>((m, v) => ((m[v || "(blank)"] = (m[v || "(blank)"] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  return {
    window: `last 30 days (since ${since})`,
    callsLogged: notes.length,
    outcomes: count(notes.map((n) => n.callOutcome)),
    objections: count(notes.map((n) => String(extra.get(n.id)?.["Objection (Why not closed)"] ?? "")).filter(Boolean)),
    closerNotes: notes
      .map((n) => String(extra.get(n.id)?.["Prospect Notes"] ?? "").trim())
      .filter((t) => t.length > 15)
      .slice(-15)
      .map((t) => t.slice(0, 300)),
  };
}

const SYSTEM = `You are the operator's analyst for Bronson's company, Ecom MBA (subscription-based e-commerce coaching sold through a live masterclass funnel: Meta ads -> masterclass registration -> live masterclass -> booked call -> setter connection -> call show -> high ticket close -> cash and payment plans).

Find the bottlenecks: the 1 to 3 stages that most limit cash right now. Work from the weekly scorecard (this week and last week), the pacing against monthly goals, and lead quality from post call notes (outcomes, objections, closer notes).

Rules:
- Do NOT talk about individual ads, creatives, hooks or campaigns. The operator studies those himself. Treat ad spend and cost per registration only as funnel inputs.
- Name each bottleneck as a stage, show the number against its goal (and last week), say why it's happening (use lead quality where it explains it), and give the specific fix and who owns it (marketing, setters, closers, operator).
- Say plainly if the data is too thin to judge a stage.
- Call out lead quality explicitly: are the people reaching calls able and ready to buy?
- For each bottleneck, use the matching SOP from "SOPs for off-target metrics" when there is one: name it exactly ("SOP: <title>") and base the fix on its steps. If no SOP covers that stage, write "No SOP yet for <metric>" so the operator knows to add one.

Format in markdown, short lines, no em dashes:
**Biggest bottleneck:** one line.
Then "## 1. <stage>" sections (what's happening, why, fix with the SOP named, owner).
Then "## Lead quality" (3-5 lines).
Then "## On pace?" (2-3 lines on pacing vs goals).`;

export async function runBottlenecks(): Promise<BottleneckReport> {
  const thisWeek = await internal<WeeklyScorecardPayload>("/api/bronson/overview/weekly-scorecard");
  const lastWeek = thisWeek ? await internal<WeeklyScorecardPayload>(`/api/bronson/overview/weekly-scorecard?weekStart=${addDaysToDateString(thisWeek.weekStart, -7)}`) : null;
  const [pacing, quality] = await Promise.all([internal<unknown>("/api/bronson/overview/pacing"), leadQuality()]);
  const data = { thisWeek: compactScorecard(thisWeek), lastWeek: compactScorecard(lastWeek), pacing, leadQuality: quality };
  const sops = await sopContext(thisWeek);
  const r = await askClaude({
    system: SYSTEM,
    user: `Scorecard, pacing and lead quality (JSON; percent rows are fractions, 0.25 = 25%):\n${JSON.stringify(data)}\n\nSOPs for off-target metrics:\n${sops || "(none of the off-target metrics has an SOP yet)"}`,
    effort: "medium",
  });
  if (r.refused || !r.text.trim()) throw new Error("The analysis came back empty. Try again.");
  const date = easternDateString();
  const created = new Date().toISOString();
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ fields: { Title: `Scorecard bottlenecks · ${date}`, Type: "bottleneck", Date: date, Feedback: r.text, Created: created } }], typecast: true }),
  });
  const json = (await res.json()) as { records?: { id: string }[] };
  return { id: json.records?.[0]?.id ?? "", date, created, text: r.text };
}

/** The SOPs tagged for each red / yellow scorecard row (and always lead quality), trimmed to fit. */
async function sopContext(p: WeeklyScorecardPayload | null): Promise<string> {
  const tags = new Set<string>(["lead quality"]);
  for (const g of p?.groups ?? []) for (const r of g.rows) if (r.week.status === "red" || r.week.status === "yellow") metricTagsFor(r.label).forEach((t) => tags.add(t));
  const docs = await getBrain();
  const picked = new Map<string, { title: string; body: string; tags: string[] }>();
  for (const t of tags) for (const d of sopsFor(docs, t).slice(0, 2)) {
    const e = picked.get(d.id) ?? { title: d.title, body: d.body, tags: [] };
    e.tags.push(t);
    picked.set(d.id, e);
  }
  const missing = [...tags].filter((t) => !sopsFor(docs, t).length);
  const blocks = [...picked.values()].slice(0, 8).map((d) => `### ${d.title} (fixes: ${d.tags.join(", ")})\n${d.body.slice(0, 5000)}`);
  return `${blocks.join("\n\n")}${missing.length ? `\n\nNo SOP yet for: ${missing.join(", ")}` : ""}`;
}

export async function latestBottlenecks(): Promise<BottleneckReport | null> {
  const recs = await airtableListFresh(BASE, TABLE);
  const list = recs
    .map((r) => ({ id: r.id, f: r.fields as Record<string, unknown> }))
    .filter(({ f }) => f.Type === "bottleneck" && f.Feedback)
    .map(({ id, f }) => ({ id, date: String(f.Date ?? ""), created: String(f.Created ?? ""), text: String(f.Feedback) }))
    .sort((a, b) => b.created.localeCompare(a.created));
  return list[0] ?? null;
}
