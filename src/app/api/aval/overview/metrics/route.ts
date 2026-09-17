import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getAvalLeads,
  getAvalMarketingDailyMetrics,
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
} from "@/lib/airtable/tables-aval";
import { isPaidSource } from "@/lib/airtable/lead-source-lookup";
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
  sumByDate,
  sumPreferringDatedSources,
  upsellBookingRate as upsellBookingRateOf,
} from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, affiliateEod, eodCloser] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));
  const inRangeCloser = eodCloser.filter((r) => isDateInRange(r.date, range));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const cashLowTicket = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicket));
  // Real high-ticket cash by day: Affiliate EOD first (the setters log it
  // directly), EOD Closer as fallback for days EOD has nothing, and the
  // Marketing Daily Metrics form's manually-typed value only as a last
  // resort. Aval's form never actually has this field filled in, so before
  // this fix every bit of high-ticket cash was silently missing from Total
  // Cash Collected — same preference the Weekly Scorecard already uses.
  const htCashDates = new Set([
    ...inRangeMarketing.filter((r) => r.date).map((r) => r.date as string),
    ...inRangeEod.filter((r) => r.date).map((r) => r.date as string),
    ...inRangeCloser.filter((r) => r.date).map((r) => r.date as string),
  ]);
  const cashHighTicket = sumPreferringDatedSources(htCashDates, [
    sumByDate(inRangeEod, (r) => r.date, (r) => r.cashCollectedHighTicket),
    sumByDate(inRangeCloser, (r) => r.date, (r) => r.cashCollectedHighTicket),
    sumByDate(inRangeMarketing, (r) => r.date, (r) => r.cashCollectedHighTicket),
  ]);
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicket !== null
      ? (cashLowTicket ?? 0) + (cashHighTicket ?? 0)
      : null;
  // Real paid-lead count from the Leads table, not the manually-typed form field.
  const optInsPaid = inRangeLeads.filter((l) => isPaidSource(l.source)).length || null;

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

  // Refund / Chargeback — added to the form 2026-09, so this only has data
  // from that point forward.
  const refundCount = sum(inRangeMarketing.map((r) => r.refundCount));
  const refundDollars = sum(inRangeMarketing.map((r) => r.refundDollars));
  const chargebackCount = sum(inRangeMarketing.map((r) => r.chargebackCount));
  const chargebackDollars = sum(inRangeMarketing.map((r) => r.chargebackDollars));
  const refundChargebackDollars =
    refundDollars !== null || chargebackDollars !== null
      ? (refundDollars ?? 0) + (chargebackDollars ?? 0)
      : null;
  const highTicketDealsClosedPaid = sum(inRangeMarketing.map((r) => r.highTicketDealsClosedPaid));

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
    cacHighTicketPaid: safeDivide(adSpend, highTicketDealsClosedPaid || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),

    refundCount,
    refundDollars,
    chargebackCount,
    chargebackDollars,
    refundChargebackDollars,
    refundChargebackRate: safeDivide(refundChargebackDollars, totalCashCollected),
  });
}
