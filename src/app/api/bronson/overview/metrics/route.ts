import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getLeads, getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { getEodDialer } from "@/lib/airtable/tables";
import {
  averageOrderValue,
  cashCollectedPerOptIn,
  costPerAcquisition,
  leadToCloseRate,
  pickupRate,
  sum,
} from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, dialer] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getEodDialer(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeDialer = dialer.filter((r) => isDateInRange(r.date, range));

  const salesCount = sum(inRangeMarketing.map((r) => r.salesLowTicket)) ?? 0;
  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const cashLowTicket = sum(inRangeMarketing.map((r) => r.cashCollectedLowTicket));
  const cashHighTicket = sum(inRangeMarketing.map((r) => r.cashCollectedHighTicket));
  const totalCashCollected =
    cashLowTicket !== null || cashHighTicket !== null
      ? (cashLowTicket ?? 0) + (cashHighTicket ?? 0)
      : null;
  const optInsPaid = sum(inRangeMarketing.map((r) => r.optInsPaid));
  const pickups = sum(inRangeDialer.map((r) => r.pickups));
  const dials = sum(inRangeDialer.map((r) => r.outboundDials));

  return Response.json({
    sales: salesCount,
    adSpend,
    totalCashCollected,
    cashCollectedLowTicket: cashLowTicket,
    pickupRate: pickupRate(pickups, dials),
    pickups,
    softwarePitched: null,
    pitchRate: null,
    cashCollectedPerOptInPaid: cashCollectedPerOptIn(totalCashCollected, optInsPaid),
    averageOrderValue: averageOrderValue(totalCashCollected, salesCount || null),
    highTicketPitchRate: null,
    upsellBookingRate: null,
    costPerAcquisition: costPerAcquisition(adSpend, salesCount || null),
    leadToCloseRate: leadToCloseRate(salesCount || null, inRangeLeads.length || null),
  });
}
