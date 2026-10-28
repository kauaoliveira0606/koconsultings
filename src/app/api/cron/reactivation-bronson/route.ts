import { runReactivationCron } from "@/lib/reactivation-engine/cron";

/**
 * Bronson reactivation engine (old Base44 free course opt-ins in the GHL
 * Affiliate pipeline), every 5 minutes (vercel.json). Same steps as Aval's;
 * nothing goes out while the engine is OFF on /bronson/reactivation.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runReactivationCron("bronson", request);
}
