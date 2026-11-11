import { airtableListFresh } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";
import { addTask, AI_ASSIGNEE } from "@/lib/office";
import { snapshotText } from "@/lib/berlin-snapshot";

/**
 * Jeremy AI's daily feedback and weekly process review (user, 2026-11-11:
 * "giving daily feedback on everything, analyzing our entire process").
 * Jeremy AI pulls the numbers itself through its Berlin connection. Each run is
 * saved in Airtable "Jeremy Feedback", shown on Overview + the Feedback tab,
 * put in the Office as a Review item, and posted to Discord when a webhook is set.
 */
const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tbljVE1MhYrfBNpt1";

export type Feedback = { id: string; title: string; type: "daily" | "weekly"; date: string; feedback: string; created: string };

const PROMPTS = {
  daily: `Daily feedback for Bronson / The Inner Table (subscription-based e-commerce coaching sold through a live masterclass funnel).

The live numbers from the Berlin dashboard are attached below as JSON (ads by campaign, ad set and ad for today, yesterday, last 7 days and this month; pace; creative scores; active alerts; overview). Rates are percentages.

Give me:
1. Yesterday in 3 lines: spend, registrations and cost per registration, calls booked, cash.
2. Ads: what to scale, fix or kill today, by name, with the number that decides it.
3. Creative and copy: the weakest piece (hook, body, CTA, page) and exactly what to test next.
4. Funnel and sales: where people are dropping (opt-in, show, booking, close) and the fix.
5. The 3 things to do today, in order.

Be blunt and specific. Short lines.`,
  weekly: `Weekly process review for Bronson / The Inner Table.

The live numbers from the Berlin dashboard are attached below as JSON (ads by campaign, ad set and ad; pace; creative scores; alerts; overview). Use your own knowledge for what good looks like.

Analyze the whole process end to end: ads and creative testing, the masterclass funnel (registration, show, retention to pitch, booking), the sales team (connection, show, close), copy, and how the team and the AI queue are working. Compare it with the SOPs and with what good looks like.

Give me: what's working (keep), what's broken (with the number), the 3 biggest changes for next week in order of impact, and any SOP that should be updated.`,
};

async function save(f: Omit<Feedback, "id">) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ fields: { Title: f.title, Type: f.type, Date: f.date, Feedback: f.feedback, Created: f.created } }], typecast: true }),
  });
  if (!res.ok) throw new Error(`Saving feedback failed (${res.status})`);
}

async function postDiscord(title: string, text: string) {
  const url = process.env.DISCORD_BRONSON_FEEDBACK_WEBHOOK ?? process.env.DISCORD_BRONSON_ALERTS_WEBHOOK;
  if (!url) return false;
  // Discord caps a message at 2,000 characters: send in chunks.
  const chunks: string[] = [];
  let rest = `**${title}**\n\n${text}`;
  while (rest.length) {
    chunks.push(rest.slice(0, 1900));
    rest = rest.slice(1900);
  }
  for (const content of chunks.slice(0, 5)) {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "Jeremy AI", content }) });
  }
  return true;
}

export async function runFeedback(type: "daily" | "weekly", opts: { force?: boolean } = {}) {
  if (!jeremyConfigured()) return { ok: false, reason: "Jeremy AI not connected" };
  const date = easternDateString();
  // Scheduled runs happen at most once per day (daily) or per 6 days (weekly), however the
  // cron URL gets hit, so a copied request can't run up AI costs. Buttons pass force.
  if (!opts.force) {
    const recent = (await getFeedback()).find((f) => f.type === type);
    const cutoff = type === "daily" ? date : new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
    if (recent && recent.date >= cutoff) return { ok: false, reason: `Already ran (${recent.date})` };
  }
  const title = type === "daily" ? `Jeremy AI daily feedback · ${date}` : `Jeremy AI weekly process review · week of ${date}`;
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.koconsultings.com";
  const data = await snapshotText(origin).catch(() => "");
  const { text } = await askJeremy(`${PROMPTS[type]}${data ? `\n\nLIVE NUMBERS:\n${data}` : ""}`, null, 270_000);
  if (!text.trim()) return { ok: false, reason: "Empty reply" };
  await save({ title, type, date, feedback: text, created: new Date().toISOString() });
  try {
    await addTask({
      task: title,
      description: `${text.slice(0, 90_000)}\n\nRead it, then approve, or deny with what to change.`,
      department: "Marketing",
      role: "AI",
      assignee: AI_ASSIGNEE,
      status: "Review",
      priority: type === "weekly" ? "High" : "Normal",
    });
  } catch {
    // The feedback is saved even if the Office write fails.
  }
  const discord = await postDiscord(title, text);
  return { ok: true, discord };
}

export async function getFeedback(): Promise<Feedback[]> {
  const recs = await airtableListFresh(BASE, TABLE);
  return recs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        title: String(f.Title ?? ""),
        type: (f.Type === "weekly" ? "weekly" : "daily") as "daily" | "weekly",
        date: String(f.Date ?? ""),
        feedback: String(f.Feedback ?? ""),
        created: String(f.Created ?? ""),
      };
    })
    .filter((f) => f.feedback)
    .sort((a, b) => b.created.localeCompare(a.created));
}
