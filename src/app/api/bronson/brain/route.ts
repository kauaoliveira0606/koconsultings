import type { NextRequest } from "next/server";
import { AREAS, PILLARS } from "@/lib/areas";
import { BRAIN_TYPES, METRICS, addDoc, appendKnowledge, deleteDoc, deleteDocs, getBrain, liteDocs, searchBrain, updateDoc, type BrainType } from "@/lib/brain";

export const dynamic = "force-dynamic";

/**
 * Skills & Knowledge library. GET returns the list without bodies (user, 2026-11-12:
 * 493 docs made the tab load 5.7 MB); ?id= returns one full doc, ?contains= the ids
 * whose text has that phrase (full-text filter), ?full=1 every doc with bodies
 * (export script, ad formats), ?q= ranked search. POST adds / updates / deletes.
 */
export async function GET(request: NextRequest) {
  const docs = await getBrain();
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  if (q) return Response.json({ results: searchBrain(docs, q, 20) });
  const id = sp.get("id");
  if (id) {
    const doc = docs.find((d) => d.id === id);
    return doc ? Response.json({ doc }) : Response.json({ error: "Not found" }, { status: 404 });
  }
  const contains = sp.get("contains")?.trim().toLowerCase();
  if (contains) return Response.json({ ids: docs.filter((d) => `${d.title}\n${d.summary}\n${d.body}`.toLowerCase().includes(contains)).map((d) => d.id) });
  const type = sp.get("type");
  const pick = type ? docs.filter((d) => d.type === type) : docs;
  return Response.json({ docs: sp.get("full") ? pick : liteDocs(pick), metrics: METRICS.map(({ tag, label }) => ({ tag, label })), areas: AREAS.map(({ id, label, about, focus, pillar }) => ({ id, label, about, pillar, feedback: Boolean(focus) })), pillars: PILLARS });
}

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (b[k] === undefined ? undefined : String(b[k]));
  const type = (BRAIN_TYPES as readonly string[]).includes(String(b.type)) ? (b.type as BrainType) : undefined;
  try {
    if (b.action === "add") {
      if (!s("title")?.trim() || !s("body")?.trim()) return Response.json({ error: "Title and body are required" }, { status: 400 });
      await addDoc({
        title: s("title")!.trim(),
        type: type ?? "Note",
        category: s("category"),
        summary: s("summary"),
        body: s("body")!,
        learnsFrom: s("learnsFrom") || "Added in Berlin",
        sections: Array.isArray(b.sections) ? (b.sections as unknown[]).map(String) : undefined,
      });
    } else if (b.action === "update") {
      const covers = Array.isArray(b.covers) ? (b.covers as unknown[]).map((c) => String(c).trim().toLowerCase()).filter(Boolean) : undefined;
      const sections = Array.isArray(b.sections) ? (b.sections as unknown[]).map((c) => String(c).trim()).filter(Boolean) : undefined;
      await updateDoc(String(b.id), { title: s("title"), type, category: s("category"), summary: s("summary"), body: s("body"), learnsFrom: s("learnsFrom"), covers, sections });
    } else if (b.action === "append") {
      if (!s("text")?.trim()) return Response.json({ error: "Paste the new knowledge first" }, { status: 400 });
      await appendKnowledge(String(b.id), s("text")!, s("source")?.trim() ?? "");
    } else if (b.action === "delete") {
      await deleteDoc(String(b.id));
    } else if (b.action === "deleteMany") {
      const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map(String).filter((x) => /^rec[A-Za-z0-9]+$/.test(x)) : [];
      if (!ids.length) return Response.json({ error: "Nothing selected" }, { status: 400 });
      await deleteDocs(ids);
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Save failed" }, { status: 500 });
  }
  return Response.json({ docs: liteDocs(await getBrain()) });
}
