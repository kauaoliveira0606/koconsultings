import { runReactivationCron } from "@/lib/reactivation-engine/cron";

/**
 * Aval reactivation engine, every 5 minutes (vercel.json): answers replies,
 * sends approved drafts and due follow-ups, and once an hour looks for new
 * cold Base44 leads to text. Only texts 9am to 9pm in the lead's time, and
 * nothing goes out while the engine is OFF on /aval/reactivation.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runReactivationCron("aval", request);
}
