/**
 * Setter Leaderboard on the Sales Team tab: one card per setter, ranked by
 * cash collected. Same idea as the Closer Leaderboard, for the setting team.
 *
 * Everything comes from each setter's own Affiliate EOD entries (dials,
 * pickups, software pitched and closed, the high ticket calls they pitched,
 * booked, had show and closed, cash, talk time). Commission is their month to
 * date total from the Commissions tab's math: low ticket plus high ticket
 * setter commission. The hourly rates use the hours of talk time they logged.
 */
import type { NextRequest } from "next/server";
import { COMMISSIONS_OFFERS, getCommissions } from "@/lib/airtable/commissions";
import { parseDurationMinutes } from "@/lib/airtable/parse";
import type { BronsonAffiliateEodRow } from "@/lib/airtable/tables";
import { parseRangeFromRequest } from "@/lib/api-range";
import { isDateInRange, resolveRange } from "@/lib/date-range";
import { safeDivide } from "@/lib/metrics";

export type SetterStats = {
  setter: string;
  dials: number;
  pickups: number;
  softwarePitched: number;
  softwareClosed: number;
  talkMinutes: number;
  pickupRate: number | null;
  pitchRate: number | null;
  closeRate: number | null;
  highTicketPitched: number;
  /** Pitched high ticket calls ÷ software closes. */
  highTicketPitchRate: number | null;
  highTicketBooked: number;
  highTicketShowed: number;
  /** Their set calls that showed ÷ their calls on the calendar. */
  highTicketShowRate: number | null;
  highTicketSetClosed: number;
  /** Low ticket + high ticket cash: what the board is ranked on. */
  cash: number;
  cashLowTicket: number;
  cashHighTicket: number;
  cashPerPickup: number | null;
  /** Low ticket + high ticket setter commission, this calendar month so far. */
  commissionMtd: number;
  /** Commission this month ÷ hours of talk time this month. */
  effectiveHourlyRate: number | null;
  /** Cash collected ÷ hours of talk time, in the selected range. */
  companyHourlyRate: number | null;
};

export type SetterLeaderboardResponse = { setters: SetterStats[]; team: SetterStats };

type Tally = {
  dials: number;
  pickups: number;
  pitched: number;
  closed: number;
  talk: number;
  htPitched: number;
  htBooked: number;
  htOnCalendar: number;
  htShowed: number;
  htClosed: number;
  cashLt: number;
  cashHt: number;
};
const emptyTally = (): Tally => ({
  dials: 0,
  pickups: 0,
  pitched: 0,
  closed: 0,
  talk: 0,
  htPitched: 0,
  htBooked: 0,
  htOnCalendar: 0,
  htShowed: 0,
  htClosed: 0,
  cashLt: 0,
  cashHt: 0,
});

function add(t: Tally, r: BronsonAffiliateEodRow) {
  t.dials += r.outboundDials ?? 0;
  t.pickups += r.pickups ?? 0;
  t.pitched += r.softwarePitched ?? 0;
  t.closed += r.softwareClosed ?? 0;
  t.talk += parseDurationMinutes(r.totalTalkTimeRaw) ?? 0;
  t.htPitched += r.highTicketCallsPitched ?? 0;
  t.htBooked += r.newHighTicketCallsBooked ?? 0;
  t.htOnCalendar += r.highTicketCallsOnCalendar ?? 0;
  t.htShowed += r.highTicketCallsShowed ?? 0;
  t.htClosed += r.highTicketSetClosed ?? 0;
  t.cashLt += r.cashCollectedAffiliate ?? 0;
  t.cashHt += r.cashCollectedHighTicket ?? 0;
}

const repKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

function stats(setter: string, range: Tally, month: Tally, commissionMtd: number): SetterStats {
  const cash = range.cashLt + range.cashHt;
  return {
    setter,
    dials: range.dials,
    pickups: range.pickups,
    softwarePitched: range.pitched,
    softwareClosed: range.closed,
    talkMinutes: range.talk,
    pickupRate: safeDivide(range.pickups, range.dials || null),
    pitchRate: safeDivide(range.pitched, range.pickups || null),
    closeRate: safeDivide(range.closed, range.pitched || null),
    highTicketPitched: range.htPitched,
    highTicketPitchRate: safeDivide(range.htPitched, range.closed || null),
    highTicketBooked: range.htBooked,
    highTicketShowed: range.htShowed,
    highTicketShowRate: safeDivide(range.htShowed, range.htOnCalendar || null),
    highTicketSetClosed: range.htClosed,
    cash,
    cashLowTicket: range.cashLt,
    cashHighTicket: range.cashHt,
    cashPerPickup: safeDivide(cash, range.pickups || null),
    commissionMtd,
    effectiveHourlyRate: safeDivide(commissionMtd, month.talk / 60 || null),
    companyHourlyRate: safeDivide(cash, range.talk / 60 || null),
  };
}

export function setterLeaderboardGet(
  offer: keyof typeof COMMISSIONS_OFFERS,
  getAffiliateEod: () => Promise<BronsonAffiliateEodRow[]>
) {
  return async (request: NextRequest) => {
    const range = parseRangeFromRequest(request);
    const thisMonth = resolveRange("this_month");
    const [rows, commissions] = await Promise.all([
      getAffiliateEod(),
      getCommissions(COMMISSIONS_OFFERS[offer], thisMonth),
    ]);

    const names = new Map<string, string>();
    const tallies = new Map<string, { range: Tally; month: Tally }>();
    for (const row of rows) {
      const name = row.repName?.trim();
      if (!name) continue;
      const key = repKey(name);
      if (!names.has(key)) names.set(key, name);
      const entry = tallies.get(key) ?? { range: emptyTally(), month: emptyTally() };
      if (isDateInRange(row.date, range)) add(entry.range, row);
      if (isDateInRange(row.date, thisMonth)) add(entry.month, row);
      tallies.set(key, entry);
    }

    const commissionBySetter = new Map<string, number>();
    for (const row of commissions.byRep) {
      commissionBySetter.set(repKey(row.rep), row.lowTicket + row.highTicketSetter);
    }

    const setters = [...tallies.entries()]
      .map(([key, t]) => stats(names.get(key) ?? key, t.range, t.month, commissionBySetter.get(key) ?? 0))
      // Only setters who did something in the range.
      .filter((s) => s.dials > 0 || s.softwareClosed > 0 || s.cash > 0)
      .sort((a, b) => b.cash - a.cash || b.softwareClosed - a.softwareClosed || a.setter.localeCompare(b.setter));

    const total = { range: emptyTally(), month: emptyTally() };
    for (const t of tallies.values()) {
      for (const window of ["range", "month"] as const) {
        for (const k of Object.keys(total[window]) as (keyof Tally)[]) total[window][k] += t[window][k];
      }
    }
    const team = stats(
      "Team",
      total.range,
      total.month,
      setters.reduce((sum, s) => sum + s.commissionMtd, 0)
    );

    return Response.json({ setters, team } satisfies SetterLeaderboardResponse);
  };
}
