import { runEncoreNoShow } from "@/lib/reactivation-engine/encore-noshow";

/** Encore no-show engine, every 5 minutes (vercel.json). Does nothing unless the encore_noshow_on setting is "1". */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runEncoreNoShow(Date.now() + 240_000);
  return Response.json({ ok: report.errors.length === 0, ...report });
}
