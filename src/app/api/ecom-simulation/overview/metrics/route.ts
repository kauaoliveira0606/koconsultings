import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getLeads,
  getMarketingDailyMetrics,
  getAffiliateEod,
  getAffiliatePcn,
  getPostCallNotes,
  getEodCloser,
  wasPitched,
  wasClosed,
} from "@/lib/airtable/tables-ecom-simulation";
import { isPaidSource, normalizeEmail } from "@/lib/airtable/lead-source-lookup";
import {
  average,
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

  const [marketing, leads, affiliateEod, postCallNotes, eodCloser, affiliatePcn] =
    await Promise.all([
      getMarketingDailyMetrics(),
      getLeads(),
      getAffiliateEod(),
      getPostCallNotes(),
      getEodCloser(),
      getAffiliatePcn(),
    ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeEod = affiliateEod.filter((r) => isDateInRange(r.date, range));
  const inRangePostCallNotes = postCallNotes.filter((r) => isDateInRange(r.date, range));
  const inRangeCloser = eodCloser.filter((r) => isDateInRange(r.date, range));
  const inRangePcn = affiliatePcn.filter((r) => isDateInRange(r.date, range));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  // Ads only started running partway through this data and have since
  // paused — a $0/range isn't a tracking bug, it means no paid spend
  // happened in that window. Every paid-derivative metric below keys off
  // this flag so the UI can show "Not Active" instead of a misleading $0.00.
  const adsActive = (adSpend ?? 0) > 0;
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
  const optInsOrganic =
    inRangeLeads.length - (inRangeLeads.filter((l) => isPaidSource(l.source)).length || 0);
  const pickups = sum(inRangeEod.map((r) => r.pickups));
  const dials = sum(inRangeEod.map((r) => r.outboundDials));
  const softwarePitched = sum(inRangeEod.map((r) => r.softwarePitched));

  const highTicketPitched = inRangePostCallNotes.filter(wasPitched).length;
  const highTicketClosed = inRangePostCallNotes.filter(wasClosed).length;
  const highTicketCallsBooked = sum(inRangeCloser.map((r) => r.callsBooked));
  const highTicketCallsShowed = sum(inRangeCloser.map((r) => r.callsShowed));

  // Tier 1 keystone: the single number that captures show rate, close rate,
  // average price, and collections all at once for the high-ticket side.
  const collectedPerBookedCallHT = safeDivide(cashHighTicket, highTicketCallsBooked || null);

  // No affiliate-commission field exists in Airtable yet, so Net Cash is
  // Cash Collected minus Ad Spend only — the fallback the spec calls for.
  const netCash = totalCashCollected !== null ? totalCashCollected - (adSpend ?? 0) : null;

  const costPerCallHT = adsActive ? safeDivide(adSpend, highTicketCallsBooked || null) : null;

  // Time to Close: average days from a lead's opt-in to the call that
  // actually collected cash for them, matched by email across Affiliate PCN
  // (low-ticket) and Post Call Note (high-ticket) closes in this range.
  const leadCreatedAtByEmail = new Map<string, string>();
  for (const l of leads) {
    const email = normalizeEmail(l.email);
    if (!email || !l.createdAt) continue;
    const existing = leadCreatedAtByEmail.get(email);
    if (!existing || l.createdAt < existing) leadCreatedAtByEmail.set(email, l.createdAt);
  }
  const daysBetween = (from: string, to: string) =>
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 864e5;
  const closeLags: number[] = [];
  for (const r of inRangePcn) {
    if (r.cpaCash === null || !r.date) continue;
    const createdAt = leadCreatedAtByEmail.get(normalizeEmail(r.leadEmail) ?? "");
    if (!createdAt) continue;
    const lag = daysBetween(createdAt, r.date);
    if (lag >= 0) closeLags.push(lag);
  }
  for (const r of inRangePostCallNotes) {
    if (r.cashCollected === null || r.cashCollected <= 0 || !r.date) continue;
    const createdAt = leadCreatedAtByEmail.get(normalizeEmail(r.leadEmail) ?? "");
    if (!createdAt) continue;
    const lag = daysBetween(createdAt, r.date);
    if (lag >= 0) closeLags.push(lag);
  }
  const avgDaysToClose = average(closeLags);

  return Response.json({
    // Tier 1 — Keystone
    totalCashCollected,
    collectedPerBookedCallHT,
    netCash,
    adsActive,

    // Tier 2 — Revenue breakdown
    cashCollectedLowTicket: cashLowTicket,
    cashCollectedHighTicket: cashHighTicket,
    adSpend,

    // Tier 3 — Acquisition
    optInsPaid,
    optInsOrganic,
    landingPageConnectRate: average(inRangeMarketing.map((r) => r.landingPageConnectRate)),
    optInRate: average(inRangeMarketing.map((r) => r.optInRate)),

    // Tier 4 — Front-end conversion
    pickups,
    pickupRate: pickupRate(pickups, dials),
    softwarePitched,
    pitchRate: pitchRateOf(softwarePitched, pickups),
    sales: salesCount,
    averageOrderValue: averageOrderValue(totalCashCollected, salesCount || null),
    connectionRate: safeDivide(pickups, (optInsPaid ?? 0) + optInsOrganic || null),

    // Tier 5 — High-ticket backend
    highTicketCallsBooked,
    highTicketCallsShowed,
    highTicketShowRate: safeDivide(highTicketCallsShowed, highTicketCallsBooked || null),
    highTicketPitched,
    highTicketClosed,
    highTicketCloseRate: safeDivide(highTicketClosed, highTicketPitched || null),
    highTicketPitchRate: highTicketPitchRateOf(highTicketPitched, salesCount || null),
    revenueHighTicket,

    // Tier 6 — Unit economics
    costPerAcquisition: costPerAcquisition(adSpend, salesCount || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),
    cashCollectedPerOptInPaid: cashCollectedPerOptIn(totalCashCollected, optInsPaid),
    costPerCallHT,
    avgDaysToClose,

    // Tier 7 — Funnel / marketing health (diagnostic)
    vslViews: sum(inRangeMarketing.map((r) => r.vslViews)),
    vslPlayRate: average(inRangeMarketing.map((r) => r.vslPlayRate)),
    vslEngagementRate: average(inRangeMarketing.map((r) => r.vslEngagementRate)),
    funnelConversionRatePaid: average(inRangeMarketing.map((r) => r.funnelConversionRatePaid)),
    funnelConversionRateOrganic: average(
      inRangeMarketing.map((r) => r.funnelConversionRateOrganic)
    ),
  });
}
