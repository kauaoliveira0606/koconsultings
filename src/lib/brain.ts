import { airtableListFresh } from "@/lib/airtable/client";
import { areasFor, normalizeArea } from "@/lib/areas";

/**
 * Skills & Knowledge (user, 2026-11-10): every Claude skill, SOP, rules doc and
 * process in one searchable library, stored in Airtable "Brain". The dashboard
 * tab and the Berlin connector (search_knowledge / get_knowledge) both read it,
 * so Claude starts from what already works before doing a task.
 */
const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tbl7o75JG2me4rLgB";

export const BRAIN_TYPES = ["Skill", "SOP", "Rules", "Process", "Format", "Note"] as const;
export type BrainType = (typeof BRAIN_TYPES)[number];
export type BrainDoc = {
  id: string;
  title: string;
  type: BrainType;
  category: string;
  summary: string;
  body: string;
  source: string;
  updated: string;
  /** Where this doc's knowledge comes from (training, files, memory). */
  learnsFrom: string;
  /** Metric tags this doc fixes (e.g. "show rate", "frequency"); feedback and alerts use it to cite the SOP. */
  covers: string[];
  /** Business areas (lib/areas.ts ids). Saved choices win; otherwise worked out from the doc. */
  sections: string[];
};

/**
 * The metrics Berlin can tie an SOP to. Each has the words that identify it in a
 * scorecard row, alert or question. Coverage on the Skills and SOPs page lists
 * which of these have an SOP and which still need one.
 */
export const METRICS: { tag: string; label: string; words: string[] }[] = [
  { tag: "cost per registration", label: "Cost per registration", words: ["cost per registration", "cost per lead", "cpl", "cost per opt"] },
  { tag: "cpm", label: "CPM", words: ["cpm"] },
  { tag: "frequency", label: "Frequency", words: ["frequency"] },
  { tag: "hook rate", label: "Hook rate", words: ["hook rate", "hook"] },
  { tag: "hold rate", label: "Hold rate", words: ["hold rate", "hold"] },
  { tag: "link ctr", label: "Link CTR", words: ["link click", "ctr", "click-through", "lctr"] },
  { tag: "opt-in rate", label: "Opt-in rate", words: ["opt-in rate", "opt in rate", "optin"] },
  { tag: "roas", label: "ROAS", words: ["roas"] },
  { tag: "booking rate", label: "Booking rate", words: ["booking rate", "calls booked", "booked"] },
  { tag: "connection rate", label: "Connection rate", words: ["connection rate", "connected"] },
  { tag: "show rate", label: "Show rate", words: ["show rate", "no-show", "no show", "showed"] },
  { tag: "close rate", label: "Close rate", words: ["close rate", "closed", "closing"] },
  { tag: "lead quality", label: "Lead quality", words: ["lead quality", "disqualified", "can't afford", "couldn't afford"] },
  { tag: "webinar retention", label: "Masterclass retention", words: ["retention", "live attendees", "stayed"] },
  { tag: "email", label: "Email", words: ["email"] },
];

/** Which metric tags a piece of text (scorecard label, alert title) is about. */
export function metricTagsFor(text: string): string[] {
  const t = text.toLowerCase();
  return METRICS.filter((m) => m.words.some((w) => t.includes(w))).map((m) => m.tag);
}

/** An AI agent prompt (general role), as opposed to a real playbook. */
export const isAgent = (d: BrainDoc) => d.category === "Agents" || d.title.startsWith("Agent:");

/**
 * SOPs / skills tagged as fixing a metric (never rules or client notes), real
 * playbooks first: SOP, Process, Format, Skill, and general agents last.
 */
export function sopsFor(docs: BrainDoc[], tag: string): BrainDoc[] {
  const rank = (d: BrainDoc) => (isAgent(d) ? 9 : ({ SOP: 0, Process: 1, Format: 2, Skill: 3 } as Record<string, number>)[d.type] ?? 5);
  return docs.filter((d) => d.type !== "Rules" && d.type !== "Note" && d.covers.includes(tag)).sort((a, b) => rank(a) - rank(b));
}

function pat() {
  const p = process.env.AIRTABLE_PAT;
  if (!p) throw new Error("Missing AIRTABLE_PAT");
  return p;
}

export async function getBrain(): Promise<BrainDoc[]> {
  const recs = await airtableListFresh(BASE, TABLE);
  return recs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      const type = String(f.Type ?? "Note");
      return {
        id: r.id,
        title: String(f.Title ?? ""),
        type: ((BRAIN_TYPES as readonly string[]).includes(type) ? type : "Note") as BrainType,
        category: String(f.Category ?? ""),
        summary: String(f.Summary ?? ""),
        body: String(f.Body ?? ""),
        source: String(f.Source ?? ""),
        updated: String(f.Updated ?? ""),
        learnsFrom: String(f["Learns From"] ?? ""),
        covers: String(f.Covers ?? "")
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
        sections: [...new Set(String(f.Sections ?? "")
          .split(",")
          .map((c) => normalizeArea(c.trim()))
          .filter(Boolean))],
      };
    })
    .filter((d) => d.title)
    .map((d) => (d.sections.length ? d : { ...d, sections: areasFor(d) }))
    .sort((a, b) => BRAIN_TYPES.indexOf(a.type) - BRAIN_TYPES.indexOf(b.type) || a.title.localeCompare(b.title));
}

/** Simple ranked search: title hits weigh most, then summary, then body. Returns a snippet around the first body hit. */
export function searchBrain(docs: BrainDoc[], query: string, limit = 8) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const count = (text: string, t: string) => text.split(t).length - 1;
  return docs
    .map((d) => {
      const title = d.title.toLowerCase();
      const summary = d.summary.toLowerCase();
      const body = d.body.toLowerCase();
      // Title and summary matter most; body hits are capped so very long docs don't drown the rest.
      let score = 0;
      for (const t of terms) score += count(title, t) * 10 + count(summary, t) * 4 + Math.min(count(body, t), 6);
      if (title.includes(query.toLowerCase().trim())) score += 30;
      const at = terms.map((t) => body.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      const snippet = at === undefined ? d.summary.slice(0, 240) : d.body.slice(Math.max(0, at - 120), at + 200).replace(/\s+/g, " ").trim();
      return { id: d.id, title: d.title, type: d.type, category: d.category, summary: d.summary, snippet, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function write(method: "POST" | "PATCH", records: unknown[]) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method,
    headers: { Authorization: `Bearer ${pat()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable ${method} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ records: { id: string }[] }>;
}

type DocInput = { title: string; type: BrainType; category?: string; summary?: string; body: string; source?: string; learnsFrom?: string; covers?: string[]; sections?: string[] };
const today = () => new Date().toISOString().slice(0, 10);

export async function addDoc(d: DocInput) {
  const res = await write("POST", [
    {
      fields: {
        Title: d.title,
        Type: d.type,
        Category: d.category ?? "",
        Summary: d.summary ?? "",
        Body: d.body,
        Source: d.source ?? "Added in Berlin",
        "Learns From": d.learnsFrom ?? d.source ?? "Added in Berlin",
        Covers: (d.covers ?? []).join(", "),
        Sections: (d.sections ?? []).join(", "),
        Updated: today(),
      },
    },
  ]);
  return res.records[0]?.id ?? null;
}

export async function updateDoc(id: string, d: Partial<DocInput>) {
  const f: Record<string, unknown> = { Updated: today() };
  if (d.title !== undefined) f.Title = d.title;
  if (d.type !== undefined) f.Type = d.type;
  if (d.category !== undefined) f.Category = d.category;
  if (d.summary !== undefined) f.Summary = d.summary;
  if (d.body !== undefined) f.Body = d.body;
  if (d.learnsFrom !== undefined) f["Learns From"] = d.learnsFrom;
  if (d.covers !== undefined) f.Covers = d.covers.join(", ");
  if (d.sections !== undefined) f.Sections = d.sections.join(", ");
  await write("PATCH", [{ id, fields: f }]);
}

/**
 * Keep building a skill or SOP: append new knowledge under a dated heading and
 * record where it came from. Body is capped at Airtable's long-text limit.
 */
export async function appendKnowledge(id: string, text: string, source: string) {
  const docs = await getBrain();
  const d = docs.find((x) => x.id === id);
  if (!d) throw new Error("Document not found");
  const added = `\n\n---\n\n## Added ${today()}${source ? ` (from ${source})` : ""}\n\n${text.trim()}`;
  const body = (d.body + added).slice(0, 99_000);
  const learnsFrom = source && !d.learnsFrom.includes(source) ? `${d.learnsFrom}${d.learnsFrom ? "\n" : ""}${source}` : d.learnsFrom;
  await updateDoc(id, { body, learnsFrom });
}

export async function deleteDoc(id: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${pat()}` } });
  if (!res.ok) throw new Error(`Airtable DELETE failed (${res.status})`);
}

/** Delete many at once (Airtable takes 10 per request). */
export async function deleteDocs(ids: string[]) {
  for (let i = 0; i < ids.length; i += 10) {
    const q = ids.slice(i, i + 10).map((id) => `records[]=${encodeURIComponent(id)}`).join("&");
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${q}`, { method: "DELETE", headers: { Authorization: `Bearer ${pat()}` } });
    if (!res.ok) throw new Error(`Airtable DELETE failed (${res.status})`);
  }
}
