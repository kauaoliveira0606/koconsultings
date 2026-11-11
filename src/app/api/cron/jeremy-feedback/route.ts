import { runFeedback } from "@/lib/jeremy-feedback";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Daily (8:30 AM ET) and weekly (Monday) Jeremy AI feedback. ?type=daily|weekly */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(request.url).searchParams.get("type") === "weekly" ? "weekly" : "daily";
  try {
    return Response.json(await runFeedback(type));
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
