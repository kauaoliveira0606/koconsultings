/**
 * Closer Leaderboard on the Sales Team tab: one column per high ticket
 * closer, ranked by cash collected.
 *
 * Funnel counts and cash come from each closer's own EOD Closer form entries
 * (one per closer per day), since that is the only place every booked call is
 * counted, including no-shows and cancellations:
 *
 *   Leads      everyone booked with them: calls booked + cancelled calls
 *   Calls      calls booked
 *   Show       calls showed
 *   Qualified  calls showed minus disqualified calls
 *   Won        deals closed
 *   Revenue    total cash collected
 *
 * Commission is the closer's high ticket commission month to date, taken from
 * the Commissions tab's own math (cash after fees). The two hourly rates use
 * one showed call as one hour.
 */
import type { NextRequest } from "next/server";
import { airtableListAll } from "@/lib/airtable/client";
import { COMMISSIONS_OFFERS, getCommissions } from "@/lib/airtable/commissions";
import { parseDateOnly, parseNumericText } from "@/lib/airtable/parse";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, resolveRange, type ResolvedRange } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";

// Same table ID in every offer's base (the bases were cloned from one template).
const EOD_CLOSER_TABLE_ID = "tbl0xIvtCZIjemZRZ";

export type CloserStats = {
  closer: string;
  leads: number;
  calls: number;
  show: number;
  qualified: number;
  won: number;
  dqRate: number | null;
  showRate: number | null;
  qualifiedShowRate: number | null;
  showToClose: number | null;
  leadsToClose: number | null;
  revenue: number;
  revenuePerCall: number | null;
  revPerLead: number | null;
  /** Previous calendar month, whatever range is selected. */
  lastMonthRevPerLead: number | null;
  /** High ticket closer commission, this calendar month so far. */
  commissionMtd: number;
  /** Commission this month ÷ calls showed this month: what the closer earns per showed call. */
  effectiveHourlyRate: number | null;
  /** Cash collected ÷ calls showed, in the selected range: what the company collects per showed call. */
  companyHourlyRate: number | null;
};

export type CloserLeaderboardResponse = {
  /** Ranked by cash collected in the range, best first. */
  closers: CloserStats[];
  team: CloserStats;
};

type Tally = { leads: number; calls: number; show: number; dq: number; won: number; cash: number };
const emptyTally = (): Tally => ({ leads: 0, calls: 0, show: 0, dq: 0, won: 0, cash: 0 });

/** "jack andrews", "Jack Andrews " and "JACK ANDREWS" are one closer. */
const closerKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

function stats(
  closer: string,
  range: Tally,
  lastMonth: Tally,
  month: Tally,
  commissionMtd: number
): CloserStats {
  const qualified = Math.max(0, range.show - range.dq);
  return {
    closer,
    leads: range.leads,
    calls: range.calls,
    show: range.show,
    qualified,
    won: range.won,
    dqRate: safeDivide(range.dq, range.show || null),
    showRate: safeDivide(range.show, range.calls || null),
    qualifiedShowRate: safeDivide(qualified, range.calls || null),
    showToClose: safeDivide(range.won, range.show || null),
    leadsToClose: safeDivide(range.won, range.leads || null),
    revenue: range.cash,
    revenuePerCall: safeDivide(range.cash, range.calls || null),
    revPerLead: safeDivide(range.cash, range.leads || null),
    lastMonthRevPerLead: safeDivide(lastMonth.cash, lastMonth.leads || null),
    commissionMtd,
    effectiveHourlyRate: safeDivide(commissionMtd, month.show || null),
    companyHourlyRate: safeDivide(range.cash, range.show || null),
  };
}

export function closerLeaderboardGet(offer: keyof typeof COMMISSIONS_OFFERS) {
  return async (request: NextRequest) => {
    const range = parseRangeFromRequest(request);
    const thisMonth = resolveRange("this_month");
    const lastMonth = resolveRange("last_month");
    const config = COMMISSIONS_OFFERS[offer];
    const [records, commissions] = await Promise.all([
      airtableListAll<Record<string, unknown>>(config.baseId, EOD_CLOSER_TABLE_ID),
      getCommissions(config, thisMonth),
    ]);

    const names = new Map<string, string>();
    const tallies = new Map<string, { range: Tally; lastMonth: Tally; month: Tally }>();
    const add = (tally: Tally, f: Record<string, unknown>) => {
      const n = (field: string) => parseNumericText(f[field]) ?? 0;
      tally.calls += n("Calls Booked");
      tally.leads += n("Calls Booked") + n("Cancelled Calls");
      tally.show += n("Calls Showed");
      tally.dq += n("Disqualified Calls");
      tally.won += n("Deals Closed");
      tally.cash += n("Total Cash Collected");
    };
    const windows: [keyof NonNullable<ReturnType<typeof tallies.get>>, ResolvedRange][] = [
      ["range", range],
      ["lastMonth", lastMonth],
      ["month", thisMonth],
    ];
    for (const { fields: f } of records) {
      const name = typeof f["Closer Name"] === "string" ? f["Closer Name"].trim() : "";
      if (!name) continue;
      const key = closerKey(name);
      if (!names.has(key)) names.set(key, name);
      const entry =
        tallies.get(key) ?? { range: emptyTally(), lastMonth: emptyTally(), month: emptyTally() };
      const date = parseDateOnly(f.Date);
      for (const [window, bounds] of windows) {
        if (isDateInRange(date, bounds)) add(entry[window], f);
      }
      tallies.set(key, entry);
    }

    const commissionByCloser = new Map<string, number>();
    for (const row of commissions.highTicket) {
      commissionByCloser.set(closerKey(row.rep), row.closerCommission);
    }

    const closers = [...tallies.entries()]
      .map(([key, t]) =>
        stats(names.get(key) ?? key, t.range, t.lastMonth, t.month, commissionByCloser.get(key) ?? 0)
      )
      // Only closers with something in the range or a commission this month.
      .filter((c) => c.leads > 0 || c.revenue > 0 || c.commissionMtd > 0)
      .sort((a, b) => b.revenue - a.revenue || b.won - a.won || a.closer.localeCompare(b.closer));

    const total = { range: emptyTally(), lastMonth: emptyTally(), month: emptyTally() };
    for (const t of tallies.values()) {
      for (const [window] of windows) {
        for (const k of Object.keys(total[window]) as (keyof Tally)[]) total[window][k] += t[window][k];
      }
    }
    const team = stats(
      "Team",
      total.range,
      total.lastMonth,
      total.month,
      closers.reduce((sum, c) => sum + c.commissionMtd, 0)
    );

    return Response.json({ closers, team } satisfies CloserLeaderboardResponse);
  };
}
