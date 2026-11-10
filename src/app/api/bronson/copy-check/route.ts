import type { NextRequest } from "next/server";
import { checkCopy } from "@/lib/copy-check";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Copy check: rule scan + AI review against the Bronson rules. */
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { text?: string; kind?: string };
  const text = String(b.text ?? "").trim();
  if (!text) return Response.json({ error: "Paste some copy first." }, { status: 400 });
  if (text.length > 60_000) return Response.json({ error: "That's too long for one check; split it up." }, { status: 400 });
  try {
    return Response.json(await checkCopy(text, String(b.kind ?? "")));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Check failed" }, { status: 500 });
  }
}
