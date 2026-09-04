import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalLeads, getAvalMarketingDailyMetrics, getAvalAffiliateEod } from "@/lib/airtable/tables-aval";
import {
  averageOrderValue,
  cashCollectedPerOptIn,
  costPerAcquisition,
  highTicketPitchRate as highTicketPitchRateOf,
  leadToCloseRate,
  pickupRate,
  pitchRate as pitchRateOf,
  sum,
  upsellBookingRate as upsellBookingRateOf,
} from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, affiliateEod] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const cashLowTicket = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicket));
  const cashHighTicket = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicket));
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicket !== null
      ? (cashLowTicket ?? 0) + (cashHighTicket ?? 0)
      : null;
  const optInsPaid = sum(inRangeMarketing.map((r) => r.optInsPaid));

  // Paid / Organic splits from the Marketing Daily Metrics form
  const salesLtPaid = sum(inRangeMarketing.map((r) => r.salesLowTicketPaid));
  const salesLtOrganic = sum(inRangeMarketing.map((r) => r.salesLowTicketOrganic));
  const cashLtPaid = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicketPaid));
  const cashLtOrganic = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicketOrganic));
  const cashHtPaid = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicketPaid));
  const cashHtOrganic = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicketOrganic));

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
    salesLowTicketPaid: salesLtPaid,
    salesLowTicketOrganic: salesLtOrganic,
    cashLowTicketPaid: cashLtPaid,
    cashLowTicketOrganic: cashLtOrganic,
    cashHighTicketPaid: cashHtPaid,
    cashHighTicketOrganic: cashHtOrganic,
    dials,
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
  });
}
