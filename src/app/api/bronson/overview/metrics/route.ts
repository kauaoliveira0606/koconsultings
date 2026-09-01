import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getLeads,
  getMarketingDailyMetrics,
  getBronsonAffiliateEod,
  getBronsonAffiliatePcn,
  getAffiliatePortalDaily,
} from "@/lib/airtable/tables";
import {
  averageOrderValue,
  cashCollectedPerOptIn,
  costPerAcquisition,
  highTicketPitchRate as highTicketPitchRateOf,
  leadToCloseRate,
  pickupRate,
  pitchRate as pitchRateOf,
  safeDivide,
  sum,
  upsellBookingRate as upsellBookingRateOf,
} from "@/lib/metrics";

// The affiliate portal only pays on Base44 and Wix; the team's PCN log also
// records Constant Contact closes, so both sides are filtered to these two
// brands before the attribution rate is computed. Brand strings are compared
// loosely ("Base 44", "base44", "BASE44" all match).
const BASE44_WIX_BRANDS = new Set(["base44", "wix"]);
const normalizeBrand = (value: string | null): string =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isBase44OrWix = (value: string | null): boolean =>
  BASE44_WIX_BRANDS.has(normalizeBrand(value));

// Flat affiliate payout per closed sale, from the portal's commission_rules
// (base44/wix, monthly/yearly). The PCN table only started recording the
// "CPA (Payout / Cash Collected)" value in Aug 2026, so for older closes we
// fall back to this schedule to keep the cash-basis denominator complete.
const AFFILIATE_FLAT_PAYOUT: Record<string, Record<string, number>> = {
  base44: { monthly: 225, yearly: 275 },
  wix: { monthly: 100, yearly: 350 },
};
const pcnCashCollected = (row: { software: string | null; plan: string | null; cpaCash: number | null }): number | null => {
  if (row.cpaCash !== null) return row.cpaCash;
  const plan = (row.plan ?? "").toLowerCase().trim();
  return AFFILIATE_FLAT_PAYOUT[normalizeBrand(row.software)]?.[plan] ?? null;
};

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, affiliateEod, affiliatePcn, portalDaily] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonAffiliatePcn(),
    getAffiliatePortalDaily(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));

  // Attribution rate — Base44 + Wix. Numerator: what the affiliate portal
  // actually tracked (and will pay) in this range. Denominator: what the team
  // logged as closed in the Affiliate PCN table over the same range. Below
  // 100% means tracking is leaking sales; above 100% usually means portal
  // subscription rebills or the team under-logging closes that month.
  const inRangePortal = portalDaily.filter(
    (r) => isDateInRange(r.date, range) && isBase44OrWix(r.brand)
  );
  const inRangePcnBrands = affiliatePcn.filter(
    (r) => isDateInRange(r.date, range) && isBase44OrWix(r.software)
  );
  const portalPurchases = sum(inRangePortal.map((r) => r.purchases));
  const portalCommission = sum(inRangePortal.map((r) => r.commission));
  const pcnCloses = inRangePcnBrands.length || null;
  const pcnCash = sum(inRangePcnBrands.map((r) => pcnCashCollected(r)));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const cashLowTicket = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicket));
  const cashHighTicket = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicket));
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicket !== null
      ? (cashLowTicket ?? 0) + (cashHighTicket ?? 0)
      : null;
  const optInsPaid = sum(inRangeMarketing.map((r) => r.optInsPaid));
  const pickups = sum(inRangeEod.map((r) => r.pickups));
  const dials = sum(inRangeEod.map((r) => r.outboundDials));
  const softwarePitched = sum(inRangeEod.map((r) => r.softwarePitched));
  const htPitched = sum(inRangeEod.map((r) => r.highTicketCallsPitched));
  const htBooked = sum(inRangeEod.map((r) => r.newHighTicketCallsBooked));

  return Response.json({
    sales: salesCount,
    adSpend,
    totalCashCollected,
    cashCollectedLowTicket: cashLowTicket,
    pickupRate: pickupRate(pickups, dials),
    pickups,
    softwarePitched,
    pitchRate: pitchRateOf(softwarePitched, pickups),
    cashCollectedPerOptInPaid: cashCollectedPerOptIn(totalCashCollected, optInsPaid),
    averageOrderValue: averageOrderValue(totalCashCollected, salesCount || null),
    highTicketPitchRate: highTicketPitchRateOf(htPitched, salesCount || null),
    upsellBookingRate: upsellBookingRateOf(htBooked, htPitched),
    costPerAcquisition: costPerAcquisition(adSpend, salesCount || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),
    attributionRateBase44Wix: safeDivide(portalCommission, pcnCash),
    attributionRatePurchasesBase44Wix: safeDivide(portalPurchases, pcnCloses),
    portalCashCollectedBase44Wix: portalCommission,
    portalPurchasesBase44Wix: portalPurchases,
  });
}
