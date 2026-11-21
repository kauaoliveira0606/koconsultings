import {
  buildAttributionPeriods,
  computeAttributionBuckets,
} from "@/lib/attribution";
import {
  getAaronAffiliatePcn,
  getAaronAffiliatePortalDaily,
} from "@/lib/airtable/tables-aaron";

export const revalidate = 60;

export const BRANDS = ["base44"];
// Aaron only started this motion in Sep 2026 — no standalone August bucket.
// Its first four closes are dated Aug 31 (the start of the Sep push / the
// portal's Aug 31–Sep 6 payout week), so data counts from Aug 31.
const PERIODS_FROM = "2026-09-01";
export const DATA_FLOOR = "2026-08-31";

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAaronAffiliatePortalDaily(),
    getAaronAffiliatePcn(),
  ]);

  const opts = { periodsFrom: PERIODS_FROM, dataFloor: DATA_FLOOR };
  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month", opts), portalDaily, pcn, BRANDS, DATA_FLOOR),
    week: computeAttributionBuckets(buildAttributionPeriods("week", opts), portalDaily, pcn, BRANDS, DATA_FLOOR),
  });
}
