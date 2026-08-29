import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getAvalLeads,
  getAvalMarketingDailyMetrics,
  getAvalEodDialer,
  getAvalEodCloser,
  getAvalFollowUpPayments,
} from "@/lib/airtable/tables-aval";
import { costPerAcquisition, leadToCloseRate, pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [marketing, leads, dialer, closer, followUps] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalEodDialer(),
    getAvalEodCloser(),
    getAvalFollowUpPayments(),
  ]);

  const inRangeMarketing = marketing.filter((r) => isDateInRange(r.date, range));
  const inRangeLeads = leads.filter((l) => isDateInRange(l.createdAt, range));
  const inRangeDialer = dialer.filter((r) => isDateInRange(r.date, range));
  const inRangeCloser = closer.filter((r) => isDateInRange(r.date, range));
  const inRangeFollowUps = followUps.filter((r) => isDateInRange(r.date, range));

  const adSpend = sum(inRangeMarketing.map((r) => r.adSpendMeta));
  const outboundDials = sum(inRangeDialer.map((r) => r.outboundDials));
  const pickups = sum(inRangeDialer.map((r) => r.pickups));
  const sales = sum(inRangeCloser.map((r) => r.dealsClosed));
  const totalCashCollected = sum([
    sum(inRangeCloser.map((r) => r.totalCashCollected)),
    sum(inRangeFollowUps.map((r) => r.cashCollected)),
  ]);

  return Response.json({
    sales,
    adSpend,
    totalCashCollected,
    pickupRate: pickupRate(pickups, outboundDials),
    pickups,
    outboundDials,
    costPerAcquisition: costPerAcquisition(adSpend, sales),
    leadToCloseRate: leadToCloseRate(sales, inRangeLeads.length || null),
  });
}
