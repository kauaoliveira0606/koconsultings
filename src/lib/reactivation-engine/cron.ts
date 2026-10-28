import type { ReactivationOffer } from "@/lib/airtable/reactivation";
import { checkOptOuts, runReplies, runSends, type RunReport } from "./engine";

/** One cron run for one offer: replies, the opt-out check, then sends. */
export async function runReactivationCron(offer: ReactivationOffer, request: Request): Promise<Response> {
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
    () => runReplies(offer, report),
    () => checkOptOuts(offer, report),
    // New leads every run for both offers (user, 2026-10-28: Aval "we can handle
    // a lot more than 20", Bronson "just get everybody").
    () => runSends(offer, true, started + 240_000, report),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      console.error(`reactivation cron step failed (${offer})`, e);
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return Response.json(report, { status: report.errors.length ? 500 : 200 });
}
