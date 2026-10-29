import { runShowRateCron } from "@/lib/reactivation-engine/show-rate-cron";

/** Bronson's show-rate + no-show engines, every 5 minutes (vercel.json). */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return runShowRateCron("bronsonMasterclass", request);
}
