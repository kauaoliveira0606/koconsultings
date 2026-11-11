import { airtableListFresh } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";
import { snapshotText } from "@/lib/berlin-snapshot";
import { getBrain } from "@/lib/brain";
import { AREAS, FEEDBACK_AREAS } from "@/lib/areas";
import { compactScorecard, internal, leadQuality } from "@/lib/bottlenecks";
import type { WeeklyScorecardPayload } from "@/lib/weekly-scorecard";

/**
 * Jeremy AI's feedback on every business area (user, 2026-11-11: "have Jeremy
 * give feedback on every single little area possible ... separate this by
 * section"). Saved in the Jeremy Feedback table with Type "area" and the Area id.
 */
const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tbljVE1MhYrfBNpt1";

export type AreaFeedback = { id: string; area: string; date: string; created: string; text: string };

export async function getAreaFeedback(): Promise<AreaFeedback[]> {
  const recs = await airtableListFresh(BASE, TABLE);
  return recs
    .map((r) => ({ id: r.id, f: r.fields as Record<string, unknown> }))
    .filter(({ f }) => f.Type === "area" && f.Area && f.Feedback)
    .map(({ id, f }) => ({ id, area: String(f.Area), date: String(f.Date ?? ""), created: String(f.Created ?? ""), text: String(f.Feedback) }))
    .sort((a, b) => b.created.localeCompare(a.created));
}

/** Shared context (built once per run): live numbers, this week's scorecard, lead quality. */
async function context() {
  const [snap, scorecard, quality] = await Promise.all([
    snapshotText("https://www.koconsultings.com").catch(() => ""),
    internal<WeeklyScorecardPayload>("/api/bronson/overview/weekly-scorecard"),
    leadQuality().catch(() => null),
  ]);
  return `LIVE AD NUMBERS (JSON):\n${snap}\n\nTHIS WEEK'S SCORECARD (JSON, percent rows are fractions):\n${JSON.stringify(compactScorecard(scorecard))}\n\nLEAD QUALITY, last 30 days of post call notes (JSON):\n${JSON.stringify(quality)}`;
}

export async function runAreaFeedback(areaId: string, ctx?: string): Promise<AreaFeedback> {
  if (!jeremyConfigured()) throw new Error("Jeremy AI isn't connected");
  const area = AREAS.find((a) => a.id === areaId);
  if (!area || !area.focus) throw new Error("Unknown area");
  const docs = (await getBrain()).filter((d) => d.sections.includes(area.id) && d.type !== "Note");
  const sopList = docs.slice(0, 15).map((d) => `- ${d.title}${d.summary ? `: ${d.summary.slice(0, 160)}` : ""}`).join("\n");
  const message = `Feedback on one area of Bronson's business (The Inner Table, subscription-based e-commerce coaching sold through a live masterclass funnel): **${area.label}**.

Focus: ${area.focus}

Use the numbers below. Give me:
1. Where this area stands right now, in 2-3 lines with the numbers.
2. What's broken or weakest, and why.
3. Exactly what to change, step by step, in order of impact. Name the SOP from our library below when one applies (or say there isn't one).
4. One thing that's working and should not be touched.

If the data doesn't cover this area well, say what to track. Be blunt, specific and short. Plain text, short lines.

OUR SOPs FOR THIS AREA:
${sopList || "(none yet)"}

${ctx ?? (await context())}`;
  const { text } = await askJeremy(message, null, 240_000);
  if (!text.trim()) throw new Error("Jeremy AI returned nothing");
  const date = easternDateString();
  const created = new Date().toISOString();
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ fields: { Title: `Jeremy AI · ${area.label} · ${date}`, Type: "area", Area: area.id, Date: date, Feedback: text, Created: created } }], typecast: true }),
  });
  const json = (await res.json()) as { records?: { id: string }[] };
  return { id: json.records?.[0]?.id ?? "", area: area.id, date, created, text };
}

/** Every business area once a day (skips areas already done today). Stops before the function time limit. */
export async function runAllAreas(budgetMs = 11 * 60_000) {
  const started = Date.now();
  const today = easternDateString();
  const done = new Set((await getAreaFeedback()).filter((f) => f.date === today).map((f) => f.area));
  const ctx = await context();
  const ran: string[] = [];
  const failed: string[] = [];
  for (const a of FEEDBACK_AREAS) {
    if (done.has(a.id)) continue;
    if (Date.now() - started > budgetMs) break;
    try {
      await runAreaFeedback(a.id, ctx);
      ran.push(a.id);
    } catch {
      failed.push(a.id);
    }
  }
  return { ran, failed, skipped: [...done] };
}
