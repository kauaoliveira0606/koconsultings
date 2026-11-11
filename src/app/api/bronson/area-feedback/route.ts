import type { NextRequest } from "next/server";
import { getAreaFeedback, runAreaFeedback } from "@/lib/jeremy-areas";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Latest Jeremy AI feedback per area. POST { area } gets fresh feedback for one area now. */
export async function GET() {
  const all = await getAreaFeedback();
  const latest: Record<string, (typeof all)[number]> = {};
  for (const f of all) if (!latest[f.area]) latest[f.area] = f;
  return Response.json({ latest });
}

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { area?: string };
  try {
    return Response.json({ feedback: await runAreaFeedback(String(b.area ?? "")) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
