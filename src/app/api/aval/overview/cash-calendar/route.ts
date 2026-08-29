import type { NextRequest } from "next/server";
import {
  getAvalLeads,
  getAvalEodCloser,
  getAvalFollowUpPayments,
  getAvalPostCallNotes,
} from "@/lib/airtable/tables-aval";
import { filterByMonth, monthTotal, type CashByDay } from "@/lib/cash-calendar";
import { cashBySourceByDay } from "@/lib/airtable/lead-source-lookup";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) {
    return Response.json({ error: "month query param (YYYY-MM) is required" }, { status: 400 });
  }

  const [closer, followUps, leads, notes] = await Promise.all([
    getAvalEodCloser(),
    getAvalFollowUpPayments(),
    getAvalLeads(),
    getAvalPostCallNotes(),
  ]);

  const byDayAll: CashByDay = {};
  for (const row of closer) {
    if (!row.date || row.totalCashCollected === null) continue;
    byDayAll[row.date] = (byDayAll[row.date] ?? 0) + row.totalCashCollected;
  }
  for (const row of followUps) {
    if (!row.date || row.cashCollected === null) continue;
    byDayAll[row.date] = (byDayAll[row.date] ?? 0) + row.cashCollected;
  }

  const byDay = filterByMonth(byDayAll, month);

  const notesClosed = notes
    .filter((r) => r.cashCollected !== null)
    .map((r) => ({ leadEmail: r.leadEmail, cpaCash: r.cashCollected, date: r.date }));
  const bySourceDay = cashBySourceByDay(leads, notesClosed);
  const bySourceForMonth: typeof bySourceDay = {};
  for (const [date, value] of Object.entries(bySourceDay)) {
    if (date.startsWith(month)) bySourceForMonth[date] = value;
  }

  return Response.json({ byDay, total: monthTotal(byDay), bySourceDay: bySourceForMonth });
}
