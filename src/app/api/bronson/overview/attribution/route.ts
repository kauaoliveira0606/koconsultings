import {
  ATTRIBUTION_START_DATE,
  buildAttributionPeriods,
  computeAttributionBuckets,
} from "@/lib/attribution";
import {
  getAffiliatePortalDaily,
  getBronsonAffiliatePcn,
} from "@/lib/airtable/tables";

export const revalidate = 60;

const BRANDS = ["base44", "wix"];
const FROM = ATTRIBUTION_START_DATE; // 2026-08-01

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAffiliatePortalDaily(),
    getBronsonAffiliatePcn(),
  ]);

  const opts = { periodsFrom: FROM, dataFloor: FROM };
  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month", opts), portalDaily, pcn, BRANDS, FROM),
    week: computeAttributionBuckets(buildAttributionPeriods("week", opts), portalDaily, pcn, BRANDS, FROM),
  });
}
