import {
  buildAttributionPeriods,
  computeAttributionBuckets,
} from "@/lib/attribution";
import {
  getAffiliatePortalDaily,
  getBronsonAffiliatePcn,
} from "@/lib/airtable/tables";

export const revalidate = 60;

const BRANDS = ["base44", "wix"];

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAffiliatePortalDaily(),
    getBronsonAffiliatePcn(),
  ]);

  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month"), portalDaily, pcn, BRANDS),
    week: computeAttributionBuckets(buildAttributionPeriods("week"), portalDaily, pcn, BRANDS),
  });
}
