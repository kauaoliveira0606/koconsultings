import { ADMIN_COOKIE, adminToken } from "@/lib/admin-gate";

/**
 * Keeps the dashboards fast (user, 2026-10-27: "load and refresh speed is way
 * too slow"). Every 5 minutes (vercel.json) this opens every endpoint the
 * dashboard pages load, so:
 * - the cached Airtable tables never pass their max age (big-table
 *   partitions are hard-expired after 12h, which made the first visitor of
 *   the morning wait 5-12s per section while they were re-read), and
 * - the functions stay warm with the tables in memory.
 * Only read endpoints the pages themselves call on a normal visit are listed
 * here (collected by visiting every tab), never one that posts or writes.
 */
export const maxDuration = 300;

const OFFER_PATHS = [
  "goals?preset=this_month",
  "live-calls",
  "overview/live-cash",
  "overview/metrics?preset=this_month",
  "overview/offer-split?preset=this_month",
  "overview/sales-cycle?preset=this_month",
  "overview/cash-calendar?month={month}",
  "overview/pacing",
  "overview/recent-changes",
  "overview/weekly-scorecard",
  "admin-team/data-check?preset=this_month",
  "admin-team/payouts?preset=this_month",
  "commissions?preset=this_month",
  "payment-plans",
  "upsell-potential",
  "sales-team/closer-leaderboard?preset=this_month",
  "sales-team/setter-leaderboard?preset=this_month",
  "sales-team/speed-to-lead?preset=this_month",
  "webinars/report",
];
const ONLY = {
  aval: [
    "overview/attribution",
    "overview/attribution/by-rep?start={month}-01&end={today}",
    "overview/connection-rate?preset=this_month",
    "overview/lead-sources?preset=this_month",
    "overview/plan-split?preset=this_month",
    "overview/reactivation-results?preset=this_month",
  ],
  bronson: ["overview/pnl?preset=this_month"],
};
const AGENCY_PATHS = [
  "/api/agency/overview/metrics?preset=this_month",
  "/api/agency/overview/cash-calendar?month={month}",
  "/api/agency/expenses?month={month}",
];
/** Two per offer base at a time, under Airtable's 5 requests a second on a cold table. */
const CONCURRENCY = 6;

export async function GET(request: Request) {
  // With CRON_SECRET set in Vercel only its scheduler gets in. Without it,
  // the scheduler's user agent is accepted: the route reads nothing a visitor
  // can't and answers with status codes only, never data.
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? new URL(request.url).host;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const month = today.slice(0, 7);
  // Interleaved so both offers' bases share the load from the start.
  const paths = [
    ...OFFER_PATHS.flatMap((p) => [`/api/bronson/${p}`, `/api/aval/${p}`]),
    ...ONLY.aval.map((p) => `/api/aval/${p}`),
    ...ONLY.bronson.map((p) => `/api/bronson/${p}`),
    ...AGENCY_PATHS,
  ].map((p) => p.replaceAll("{month}", month).replace("{today}", today));

  const cookie = `${ADMIN_COOKIE}=${await adminToken()}`;
  const results: { path: string; status: number; ms: number }[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < paths.length) {
        const path = paths[next++];
        const started = Date.now();
        const status = await fetch(`https://${host}${path}`, { headers: { cookie }, cache: "no-store" })
          .then((res) => res.status)
          .catch(() => 0);
        results.push({ path, status, ms: Date.now() - started });
      }
    }),
  );
  const slow = results.filter((r) => r.ms > 3000 || r.status !== 200);
  return Response.json({ warmed: results.length, slowOrFailed: slow });
}
