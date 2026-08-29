import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange } from "@/lib/date-range";
import {
  getRippySetterEod,
  getRippyEoc,
  getRippyBase44Closes,
  isHighTicketClose,
} from "@/lib/google-sheets/tables-rippy";
import { pickupRate, sum } from "@/lib/metrics";

export const revalidate = 60;

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

  const outboundDials = sum(eodInRange.map((r) => r.outboundDials));
  const pickups = sum(eodInRange.map((r) => r.pickups));
  const base44CashCollected = sum(base44InRange.map((r) => r.cashCollected));
  const highTicketCloseRows = eocInRange.filter((r) => isHighTicketClose(r.callOutcome));
  const highTicketCashCollected = sum(eocInRange.map((r) => r.cashCollected));

  return Response.json({
    outboundDials,
    pickups,
    pickupRate: pickupRate(pickups, outboundDials),
    base44Pitched: sum(eodInRange.map((r) => r.base44Pitched)),
    base44Closes: base44InRange.length,
    base44CashCollected,
    highTicketShowed: sum(eodInRange.map((r) => r.highTicketCallsShowed)),
    highTicketBooked: sum(eodInRange.map((r) => r.highTicketCallsBooked)),
    highTicketCloses: highTicketCloseRows.length,
    highTicketCashCollected,
    totalCashCollected: sum([base44CashCollected, highTicketCashCollected]),
  });
}
