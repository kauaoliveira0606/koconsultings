import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getBronsonAffiliateEod } from "@/lib/airtable/tables";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getBronsonAffiliateEod();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const byRep = new Map<string, typeof inRange>();
  for (const row of inRange) {
    const rep = row.repName ?? "Unknown";
    if (!byRep.has(rep)) byRep.set(rep, []);
    byRep.get(rep)!.push(row);
  }

  const reps = Array.from(byRep.entries()).map(([rep, repRows]) => {
    const outboundDials = sum(repRows.map((r) => r.outboundDials));
    const pickups = sum(repRows.map((r) => r.pickups));
    return {
      rep,
      outboundDials,
      pickups,
      pickupRate: pickupRate(pickups, outboundDials),
      totalSales: sum(repRows.map((r) => r.softwareClosed)),
      cashCollected: sum([
        sum(repRows.map((r) => r.cashCollectedAffiliate)),
        sum(repRows.map((r) => r.cashCollectedHighTicket)),
      ]),
      totalTalkTimeMinutes: sum(repRows.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
    };
  });

  reps.sort((a, b) => (b.cashCollected ?? 0) - (a.cashCollected ?? 0));

  return Response.json({ reps });
}
