import {
  buildAttributionPeriods,
  computeAttributionBuckets,
} from "@/lib/attribution";
import {
  getAvalAffiliatePcn,
  getAvalAffiliatePortalDaily,
} from "@/lib/airtable/tables-aval";

export const revalidate = 60;

const BRANDS = ["base44"];
// Aval only started running this motion in Sep 2026 — no August data.
const START = "2026-09-01";

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAvalAffiliatePortalDaily(),
    getAvalAffiliatePcn(),
  ]);

  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month", START), portalDaily, pcn, BRANDS, START),
    week: computeAttributionBuckets(buildAttributionPeriods("week", START), portalDaily, pcn, BRANDS, START),
  });
}
