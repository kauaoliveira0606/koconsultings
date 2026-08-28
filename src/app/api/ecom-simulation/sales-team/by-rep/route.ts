import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getEodDialer } from "@/lib/airtable/tables-ecom-simulation";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import { sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getEodDialer();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  // Grouped by Setter Name (a controlled singleSelect) rather than the free-text
  // Name field — see PLAN.md open item #2, verify against real data before relying
  // on this if Setter Name turns out to be sparsely filled.
  const byRep = new Map<string, typeof inRange>();
  for (const row of inRange) {
    const rep = row.setterName ?? row.name ?? "Unknown";
    if (!byRep.has(rep)) byRep.set(rep, []);
    byRep.get(rep)!.push(row);
  }

  const reps = Array.from(byRep.entries()).map(([rep, repRows]) => ({
    rep,
    outboundDials: sum(repRows.map((r) => r.outboundDials)),
    pickups: sum(repRows.map((r) => r.pickups)),
    convosOver2Min: sum(repRows.map((r) => r.convosOver2Min)),
    totalTalkTimeMinutes: sum(repRows.map((r) => parseDurationMinutes(r.totalTalkTimeRaw))),
  }));

  reps.sort((a, b) => (b.outboundDials ?? 0) - (a.outboundDials ?? 0));

  return Response.json({ reps });
}
