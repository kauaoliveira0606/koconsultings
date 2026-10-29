import type { RunReport } from "./engine";
import { runNoShowReplies, runNoShowTouches, runPendingSeats } from "./no-show";
import {
  nextSession,
  runCallbacks,
  runCheckIns,
  runShowRateReplies,
  syncRegistrants,
  type MasterclassOffer,
} from "./show-rate";

/**
 * One run of an offer's show-rate cron (every 5 minutes, vercel.json): syncs
 * masterclass registrants from GHL, answers their texts as the host, and on
 * event day at 4pm ET checks in with them. Also runs the no-show engine (texts
 * after the class, saves seats for the next one). Nothing is sent while each
 * engine's switch is OFF (the offer's Show Rate and No-Shows tabs).
 */
export async function runShowRateCron(offer: MasterclassOffer, request: Request): Promise<Response> {
  // Same gate as the reactivation crons.
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const session = await nextSession(offer);
  const report: RunReport & { session: string; errors: string[]; synced?: { added: number; outcomes: number } } = {
    session: session.label,
    firstTexts: 0,
    followUps: 0,
    replies: 0,
    skipped: {},
    errors: [],
  };
  // Each step on its own, so a failed sync never blocks the replies.
  const steps = [
    async () => {
      report.synced = await syncRegistrants(offer, session);
    },
    () => runShowRateReplies(offer, session, report),
    () => runNoShowReplies(offer, report),
    () => runPendingSeats(offer, report),
    () => runCallbacks(offer, session, started + 240_000, report),
    () => runCheckIns(offer, session, started + 240_000, report),
    () => runNoShowTouches(offer, started + 240_000, report),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      console.error(`show-rate cron step failed (${offer})`, e);
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return Response.json(report, { status: report.errors.length ? 500 : 200 });
}
