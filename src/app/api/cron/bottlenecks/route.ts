import { latestBottlenecks, runBottlenecks } from "@/lib/bottlenecks";
import { easternDateString } from "@/lib/date-range";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Each morning (7:30 AM ET): fresh bottleneck analysis. Runs at most once a day however it's hit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const last = await latestBottlenecks();
  if (last && last.date === easternDateString()) return Response.json({ ok: true, skipped: "already ran today" });
  const r = await runBottlenecks();
  return Response.json({ ok: true, date: r.date });
}
