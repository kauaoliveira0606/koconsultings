import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getLeads,
  getMarketingDailyMetrics,
  getAffiliateEod,
  getPostCallNotes,
  getEodCloser,
  wasPitched,
  wasClosed,
} from "@/lib/airtable/tables-ecom-simulation";
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
} from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, affiliateEod, postCallNotes, eodCloser] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getAffiliateEod(),
    getPostCallNotes(),
    getEodCloser(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));
  const inRangePostCallNotes = postCallNotes.filter((r) => isDateInRange(r.date, range));
  const inRangeCloser = eodCloser.filter((r) => isDateInRange(r.date, range));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const cashLowTicket = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicket));
  const cashHighTicketForm = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicket));
  const cashHighTicketCloser = sum(inRangeCloser.map((r) => r.cashCollectedHighTicket));
  const revenueHighTicket = sum(inRangeCloser.map((r) => r.revenueHighTicket));
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicketForm !== null || cashHighTicketCloser !== null
      ? (cashLowTicket ?? 0) + (cashHighTicketForm ?? 0) + (cashHighTicketCloser ?? 0)
      : null;
  const optInsPaid = sum(inRangeMarketing.map((r) => r.optInsPaid));
  const pickups = sum(inRangeEod.map((r) => r.pickups));
  const dials = sum(inRangeEod.map((r) => r.outboundDials));
  const softwarePitched = sum(inRangeEod.map((r) => r.softwarePitched));

  const highTicketPitched = inRangePostCallNotes.filter(wasPitched).length;
  const highTicketClosed = inRangePostCallNotes.filter(wasClosed).length;
  const highTicketCallsBooked = sum(inRangeCloser.map((r) => r.callsBooked));
  const highTicketCallsShowed = sum(inRangeCloser.map((r) => r.callsShowed));

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
    // High-ticket closer motion (Post Call Note + EOD Closer), active since
    // 2026-09-13 — see tables-ecom-simulation.ts.
    highTicketPitchRate: highTicketPitchRateOf(highTicketPitched, salesCount || null),
    highTicketCloseRate: safeDivide(highTicketClosed, highTicketPitched || null),
    highTicketPitched,
    highTicketClosed,
    highTicketCallsBooked,
    highTicketCallsShowed,
    cashCollectedHighTicket: cashHighTicketCloser,
    revenueHighTicket,
    costPerAcquisition: costPerAcquisition(adSpend, salesCount || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),
  });
}
