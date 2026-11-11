import { airtableListFresh } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";
import { askJeremy, jeremyConfigured } from "@/lib/jeremy";
import { addTask, AI_ASSIGNEE } from "@/lib/office";

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

Use your Berlin tools before writing: get_overview_metrics, get_campaigns_and_ads (yesterday and last_7_days), get_creative_scores, get_ads_pace, get_sales_by_ad, and list_office_tasks.

Give me:
1. Yesterday in 3 lines: spend, registrations and cost per registration, calls booked, cash.
2. Ads: what to scale, fix or kill today, by name, with the number that decides it.
3. Creative and copy: the weakest piece (hook, body, CTA, page) and exactly what to test next.
4. Funnel and sales: where people are dropping (opt-in, show, booking, close) and the fix.
5. The 3 things to do today, in order.

Be blunt and specific. Short lines. If something needs doing, also add it to the Office queue with add_office_task.`,
  weekly: `Weekly process review for Bronson / The Inner Table.

Use your Berlin tools first: get_overview_metrics (last_7_days and this_month), get_campaigns_and_ads, get_creative_scores, get_funnel_analytics, get_sales_by_ad, list_office_tasks, and search_knowledge for the SOPs we follow.

Analyze the whole process end to end: ads and creative testing, the masterclass funnel (registration, show, retention to pitch, booking), the sales team (connection, show, close), copy, and how the team and the AI queue are working. Compare it with the SOPs and with what good looks like.

Give me: what's working (keep), what's broken (with the number), the 3 biggest changes for next week in order of impact, and any SOP that should be updated. Add the changes to the Office queue with add_office_task.`,
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

export async function runFeedback(type: "daily" | "weekly") {
  if (!jeremyConfigured()) return { ok: false, reason: "Jeremy AI not connected" };
  const date = easternDateString();
  const title = type === "daily" ? `Jeremy AI daily feedback · ${date}` : `Jeremy AI weekly process review · week of ${date}`;
  const { text } = await askJeremy(PROMPTS[type], null, 270_000);
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
