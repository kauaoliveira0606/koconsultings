import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getRippySetterEod,
  getRippyEoc,
  getRippyBase44Closes,
  isHighTicketClose,
  type RippySetterEodRow,
  type RippyEocRow,
  type RippyBase44CloseRow,
} from "@/lib/google-sheets/tables-rippy";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

function groupBy<T>(rows: T[], keyFn: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row) ?? "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);

  const [eodRows, eocRows, base44Rows] = await Promise.all([
    getRippySetterEod(),
    getRippyEoc(),
    getRippyBase44Closes(),
  ]);

  const eodInRange = eodRows.filter((r) => isDateInRange(r.date, range));
  const eocInRange = eocRows.filter((r) => isDateInRange(r.date, range));
  const base44InRange = base44Rows.filter((r) => isDateInRange(r.dateClosed, range));

  const setters = Array.from(
    groupBy<RippySetterEodRow>(eodInRange, (r) => r.name).entries()
  ).map(([name, rows]) => {
    const outboundDials = sum(rows.map((r) => r.outboundDials));
    const pickups = sum(rows.map((r) => r.pickups));
    return {
      name,
      outboundDials,
      pickups,
      pickupRate: pickupRate(pickups, outboundDials),
      base44Pitched: sum(rows.map((r) => r.base44Pitched)),
      highTicketBooked: sum(rows.map((r) => r.highTicketCallsBooked)),
      highTicketShowed: sum(rows.map((r) => r.highTicketCallsShowed)),
    };
  });
  setters.sort((a, b) => (b.outboundDials ?? 0) - (a.outboundDials ?? 0));

  const base44ByCloser = groupBy<RippyBase44CloseRow>(base44InRange, (r) => r.closerName);
  const eocByCloser = groupBy<RippyEocRow>(eocInRange, (r) => r.closerName);
  const closerNames = new Set([...base44ByCloser.keys(), ...eocByCloser.keys()]);

  const closers = Array.from(closerNames).map((name) => {
    const base44 = base44ByCloser.get(name) ?? [];
    const eoc = eocByCloser.get(name) ?? [];
    const highTicketCloseRows = eoc.filter((r) => isHighTicketClose(r.callOutcome));
    const base44CashCollected = sum(base44.map((r) => r.cashCollected));
    const highTicketCashCollected = sum(eoc.map((r) => r.cashCollected));
    return {
      name,
      base44Closes: base44.length,
      base44CashCollected,
      highTicketCloses: highTicketCloseRows.length,
      highTicketCashCollected,
      totalCashCollected: sum([base44CashCollected, highTicketCashCollected]),
    };
  });
  closers.sort((a, b) => (b.totalCashCollected ?? 0) - (a.totalCashCollected ?? 0));

  return Response.json({ setters, closers });
}
