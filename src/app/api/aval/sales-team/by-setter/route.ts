import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import { getAvalEodDialer } from "@/lib/airtable/tables-aval";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const rows = await getAvalEodDialer();
  const inRange = rows.filter((r) => isDateInRange(r.date, range));

  const bySetter = new Map<string, typeof inRange>();
  for (const row of inRange) {
    const setter = row.setterName ?? row.name ?? "Unknown";
    if (!bySetter.has(setter)) bySetter.set(setter, []);
    bySetter.get(setter)!.push(row);
  }

  const setters = Array.from(bySetter.entries()).map(([setter, setterRows]) => {
    const outboundDials = sum(setterRows.map((r) => r.outboundDials));
    const pickups = sum(setterRows.map((r) => r.pickups));
    return {
      setter,
      outboundDials,
      pickups,
      pickupRate: pickupRate(pickups, outboundDials),
      callsBookedSet: sum(setterRows.map((r) => r.callsBookedSet)),
    };
  });

  setters.sort((a, b) => (b.outboundDials ?? 0) - (a.outboundDials ?? 0));

  return Response.json({ setters });
}
