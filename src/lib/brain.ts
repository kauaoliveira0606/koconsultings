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
  /** Only on list (lite) responses, where body is left out: word count and a skill's "When to use it" first line. */
  words?: number;
  useWhen?: string | null;
};

/** First line of a skill's "When to use it" breakdown section, or null when it has none. */
export function useWhenOf(body: string): string | null {
  const m = body.match(/<!-- breakdown -->([\s\S]*?)<!-- \/breakdown -->/);
  if (!m) return null;
  const sec = m[1].split(/^### /m).find((x) => /^when to use/i.test(x));
  if (!sec) return "";
  return sec.split("\n").slice(1).map((l) => l.replace(/^[-*]\s*/, "").trim()).find(Boolean) ?? "";
}

/** The list view: everything but the body (opened docs load it by id). */
export function liteDocs(docs: BrainDoc[]): BrainDoc[] {
  return docs.map((d) => ({ ...d, body: "", words: d.body.trim() ? d.body.trim().split(/\s+/).length : 0, useWhen: d.type === "Skill" ? useWhenOf(d.body) : null }));
}

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
/** Words that say nothing about the topic; matching them made long transcripts outrank the right SOP. */
const STOP = new Set("a an and are as at be but by can could do does for from get got have how i if in into is it its me more most my of on or our out people should so some than that the their them then there these they this to us was we what when where which who why will with would you your about any just like make want need too very really much many also still help".split(" "));

/** Query words worth matching: lowercased, filler dropped, plurals cut to the stem so "emails" finds "email". */
export function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().replace(/[^a-z0-9$%\s-]/g, " ").split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)))];
}

export function searchBrain(docs: BrainDoc[], query: string, limit = 8) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  // Short words must match whole words ("too" was matching "tools"); longer ones match inside words too ("email" in "emails").
  const rx = new Map(terms.map((t) => [t, new RegExp(t.length <= 4 ? `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b` : t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")]));
  const count = (text: string, t: string) => (text.match(rx.get(t)!) ?? []).length;
  // Rare words decide the topic ("cpm" over "high"): weight each by how few docs use it.
  const idf = new Map(terms.map((t) => {
    const re = new RegExp(rx.get(t)!.source);
    const df = docs.filter((d) => re.test(d.title.toLowerCase()) || re.test(d.summary.toLowerCase()) || re.test(d.body.toLowerCase())).length;
    return [t, Math.log(1 + docs.length / Math.max(1, df))];
  }));
  // Neighbouring words together ("pre-call email", "show rate") are worth far more than either alone.
  const pairs = terms.slice(1).map((t, i) => [terms[i], t] as const);
  return docs
    .map((d) => {
      const title = d.title.toLowerCase();
      const summary = d.summary.toLowerCase();
      const body = d.body.toLowerCase();
      // Title and summary matter most; body hits are capped so very long docs don't drown the rest.
      let score = 0;
      for (const t of terms) score += (count(title, t) * 10 + count(summary, t) * 4 + Math.min(count(body, t), 6)) * idf.get(t)!;
      for (const [a, b] of pairs) {
        const re = new RegExp(`${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s-]+${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
        if (re.test(title)) score += 25;
        else if (re.test(summary)) score += 12;
        else if (re.test(body)) score += 6;
      }
      if (title.includes(query.toLowerCase().trim())) score += 30;
      const at = terms.map((t) => body.search(new RegExp(rx.get(t)!.source))).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      const snippet = at === undefined ? d.summary.slice(0, 240) : d.body.slice(Math.max(0, at - 120), at + 200).replace(/\s+/g, " ").trim();
      return { id: d.id, title: d.title, type: d.type, category: d.category, summary: d.summary, snippet, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Docs for an AI answer (Ask Berlin; user, 2026-11-12): ranked like searchBrain, but
 * written playbooks beat raw call/video transcripts (type Note), and a distilled
 * "Playbook" beats everything, so answers come from the SOP rather than small talk.
 */
export function knowledgeFor(docs: BrainDoc[], query: string, limit = 4): BrainDoc[] {
  const weight = (d: BrainDoc) => (/playbook/i.test(d.title) && d.type !== "Note" ? 1.6 : d.type === "Note" ? 0.5 : d.type === "Rules" ? 0.8 : isAgent(d) ? 0.6 : 1);
  return searchBrain(docs, query, 30)
    .map((h) => ({ d: docs.find((x) => x.id === h.id)!, score: h.score }))
    .filter((x) => x.d)
    .map((x) => ({ ...x, score: x.score * weight(x.d) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d);
}

/**
 * The part of a long doc that answers the question: a skill's breakdown, or else
 * the run of paragraphs with the most query-word hits, up to `max` characters.
 */
export function excerptFor(d: BrainDoc, query: string, max = 5000): string {
  const bd = d.body.match(/<!-- breakdown -->([\s\S]*?)<!-- \/breakdown -->/);
  if (bd) return bd[1].trim().slice(0, max);
  if (d.body.length <= max) return d.body;
  const terms = queryTerms(query);
  const paras = d.body.split(/\n{2,}/);
  const hits = paras.map((p) => terms.reduce((n, t) => n + (p.toLowerCase().split(t).length - 1), 0));
  let best = 0, bestScore = -1;
  for (let i = 0; i < paras.length; i++) {
    let len = 0, score = 0;
    for (let j = i; j < paras.length && len < max; j++) { len += paras[j].length + 2; score += hits[j]; }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (bestScore <= 0) return d.body.slice(0, max);
  let out = "", j = best;
  while (j < paras.length && out.length < max) {
    const p = paras[j++];
    const room = max - out.length;
    if (p.length <= room) { out += p + "\n\n"; continue; }
    // A paragraph too long to fit (call transcripts are one block): cut around its first hit.
    const at = terms.map((t) => p.toLowerCase().indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, Math.min(at - Math.floor(room / 4), p.length - room));
    out += (start > 0 ? "[...] " : "") + p.slice(start, start + room) + " [...]";
    break;
  }
  return (best > 0 ? "[...]\n\n" : "") + out.trim();
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
