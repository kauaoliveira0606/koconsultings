import { airtableListFresh } from "@/lib/airtable/client";

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
};

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
      };
    })
    .filter((d) => d.title)
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

type DocInput = { title: string; type: BrainType; category?: string; summary?: string; body: string; source?: string };
const today = () => new Date().toISOString().slice(0, 10);

export async function addDoc(d: DocInput) {
  const res = await write("POST", [
    { fields: { Title: d.title, Type: d.type, Category: d.category ?? "", Summary: d.summary ?? "", Body: d.body, Source: d.source ?? "Added in Berlin", Updated: today() } },
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
  await write("PATCH", [{ id, fields: f }]);
}

export async function deleteDoc(id: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${pat()}` } });
  if (!res.ok) throw new Error(`Airtable DELETE failed (${res.status})`);
}
