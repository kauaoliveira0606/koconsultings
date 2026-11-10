import type { NextRequest } from "next/server";
import { BRAIN_TYPES, addDoc, deleteDoc, getBrain, searchBrain, updateDoc, type BrainType } from "@/lib/brain";

export const dynamic = "force-dynamic";

/** Skills & Knowledge library. GET ?q= searches; POST adds / updates / deletes a document. */
export async function GET(request: NextRequest) {
  const docs = await getBrain();
  const q = request.nextUrl.searchParams.get("q");
  if (q) return Response.json({ results: searchBrain(docs, q, 20) });
  return Response.json({ docs });
}

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (b[k] === undefined ? undefined : String(b[k]));
  const type = (BRAIN_TYPES as readonly string[]).includes(String(b.type)) ? (b.type as BrainType) : undefined;
  try {
    if (b.action === "add") {
      if (!s("title")?.trim() || !s("body")?.trim()) return Response.json({ error: "Title and body are required" }, { status: 400 });
      await addDoc({ title: s("title")!.trim(), type: type ?? "Note", category: s("category"), summary: s("summary"), body: s("body")! });
    } else if (b.action === "update") {
      await updateDoc(String(b.id), { title: s("title"), type, category: s("category"), summary: s("summary"), body: s("body") });
    } else if (b.action === "delete") {
      await deleteDoc(String(b.id));
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Save failed" }, { status: 500 });
  }
  return Response.json({ docs: await getBrain() });
}
