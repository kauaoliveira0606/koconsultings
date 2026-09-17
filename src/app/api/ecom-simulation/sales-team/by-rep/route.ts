import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAffiliateEod } from "@/lib/airtable/tables-ecom-simulation";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

/** Per-rep leaderboard, ranked by total cash collected. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAffiliateEod();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const byRep = new Map<string, typeof inRange>();
  for (const row of inRange) {
    const rep = row.repName ?? "Unknown";
    if (!byRep.has(rep)) byRep.set(rep, []);
    byRep.get(rep)!.push(row);
  }

  const reps = Array.from(byRep.entries()).map(([rep, repRows]) => {
    const lowTicketCashCollected = sum(repRows.map((r) => r.cashCollectedLowTicket));
    const highTicketCashCollected = sum(repRows.map((r) => r.cashCollectedHighTicket));
    return {
      rep,
      totalCashCollected: sum([lowTicketCashCollected, highTicketCashCollected]),
      lowTicketCashCollected,
      highTicketCashCollected,
      lowTicketSales: sum(repRows.map((r) => r.softwareClosed)),
      highTicketSales: sum(repRows.map((r) => r.highTicketSetClosed)),
    };
  });

  reps.sort((a, b) => (b.totalCashCollected ?? 0) - (a.totalCashCollected ?? 0));

  return Response.json({ reps });
}
