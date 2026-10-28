import { checkOptOuts, runReplies, runSends, type RunReport } from "@/lib/reactivation-engine/engine";

/**
 * Aval reactivation engine, every 5 minutes (vercel.json): answers replies,
 * sends approved drafts and due follow-ups, and once an hour looks for new
 * cold Base44 leads to text. Only texts 9am to 9pm in the lead's time, and
 * nothing goes out while the engine is OFF on /aval/overview.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Same gate as /api/cron/warm. This route sends texts, so with no
  // CRON_SECRET it still only answers Vercel's scheduler.
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const report: RunReport & { errors: string[] } = { firstTexts: 0, followUps: 0, replies: 0, skipped: {}, errors: [] };
  // Each step on its own, so a failed reply never blocks the sends.
  const steps = [
    () => runReplies(report),
    () => checkOptOuts(report),
    () => runSends(new Date().getUTCMinutes() < 5, started + 240_000, report),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      console.error("reactivation cron step failed", e);
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return Response.json(report, { status: report.errors.length ? 500 : 200 });
}
