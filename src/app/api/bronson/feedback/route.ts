import type { NextRequest } from "next/server";
import { getFeedback, runFeedback } from "@/lib/jeremy-feedback";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ feedback: await getFeedback() });
}

/** Run one now from the Feedback tab. */
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { type?: string };
  try {
    const r = await runFeedback(b.type === "weekly" ? "weekly" : "daily", { force: true });
    if (!r.ok) return Response.json({ error: r.reason }, { status: 400 });
    return Response.json({ feedback: await getFeedback() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
