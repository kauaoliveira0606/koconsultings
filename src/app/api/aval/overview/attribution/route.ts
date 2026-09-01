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

export async function GET() {
  const [portalDaily, pcn] = await Promise.all([
    getAvalAffiliatePortalDaily(),
    getAvalAffiliatePcn(),
  ]);

  return Response.json({
    brands: BRANDS,
    month: computeAttributionBuckets(buildAttributionPeriods("month"), portalDaily, pcn, BRANDS),
    week: computeAttributionBuckets(buildAttributionPeriods("week"), portalDaily, pcn, BRANDS),
  });
}
