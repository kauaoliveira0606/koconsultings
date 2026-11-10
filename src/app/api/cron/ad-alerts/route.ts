import { runAlertCheck } from "@/lib/ad-alerts";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Hourly ad alert check (vercel.json cron). Same auth as the warm cron. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runAlertCheck());
}
