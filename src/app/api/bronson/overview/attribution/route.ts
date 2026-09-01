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
const START = ATTRIBUTION_START_DATE; // 2026-08-01

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAffiliatePortalDaily(),
    getBronsonAffiliatePcn(),
  ]);

  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month", START), portalDaily, pcn, BRANDS, START),
    week: computeAttributionBuckets(buildAttributionPeriods("week", START), portalDaily, pcn, BRANDS, START),
  });
}
