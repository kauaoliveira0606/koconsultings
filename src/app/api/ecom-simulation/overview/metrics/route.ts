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
  const revenueHighTicket = sum(inRangeCloser.map((r) => r.revenueHighTicket));
  // Real high-ticket cash by day: EOD Closer first (the confirmed real
  // source for this offer's high-ticket motion — see
  // tables-ecom-simulation.ts), Affiliate EOD's own high-ticket field as
  // fallback (always 0 today, but future-proofs this if that motion ever
  // gets used), and the Marketing Daily Metrics form as a last resort — so
  // a day never gets its cash counted twice across sources, and never goes
  // missing just because one source has nothing for it.
  const htCashDates = new Set([
    ...inRangeMarketing.filter((r) => r.date).map((r) => r.date as string),
    ...inRangeEod.filter((r) => r.date).map((r) => r.date as string),
    ...inRangeCloser.filter((r) => r.date).map((r) => r.date as string),
  ]);
  const cashHighTicket = sumPreferringDatedSources(htCashDates, [
    sumByDate(inRangeCloser, (r) => r.date, (r) => r.cashCollectedHighTicket),
    sumByDate(inRangeEod, (r) => r.date, (r) => r.cashCollectedHighTicket),
    sumByDate(inRangeMarketing, (r) => r.date, (r) => r.cashCollectedHighTicket),
  ]);
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicket !== null
      ? (cashLowTicket ?? 0) + (cashHighTicket ?? 0)
      : null;
  // Real paid opt-in count from the Leads table, not the manually-typed form field.
  const optInsPaid = inRangeLeads.filter((l) => isPaidSource(l.source)).length || null;
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
    cashCollectedHighTicket: cashHighTicket,
    revenueHighTicket,
    costPerAcquisition: costPerAcquisition(adSpend, salesCount || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),
  });
}
