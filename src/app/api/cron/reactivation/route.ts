import { runReactivationCron } from "@/lib/reactivation-engine/cron";

/**
 * Aval reactivation engine, every 5 minutes (vercel.json): answers replies,
 * sends approved drafts and due follow-ups, and texts new cold Base44 leads
 * up to the daily cap. US numbers 9am to 10pm Eastern, others 9am to 9pm
 * their time, and
 * nothing goes out while the engine is OFF on /aval/reactivation.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runReactivationCron("aval", request);
}
