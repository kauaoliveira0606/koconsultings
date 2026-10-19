import type {
  BookingRow,
  ConnectedCallRow,
  MarketingDailyMetricRow,
  MasterclassRegistrantRow,
} from "@/lib/airtable/tables";
import { safeDivide, sum } from "@/lib/metrics";
import { connectedBookingIds, countedBookings, isConnectable, type BookingSource } from "@/lib/booking-source";
import type { WebinarRun } from "@/lib/webinar-schedule";

/**
 * Bronson's webinar funnel split paid vs organic, all automatic (user,
 * 2026-10-19): WebinarJam registrants (Masterclass Registrants table) ->
 * attended live -> stayed until the pitch (watched 1 hour+) -> Calendly
 * bookings -> a 1+ min GHL call before the booked call. The source is the
 * lead's masterclass paid / organic tag (ad campaign UTM = paid).
 *
 * A booking belongs to the latest webinar held on or before the day it was
 * made; bookings from before the first webinar belong to none.
 */
export type SourceFunnel = {
  registered: number;
  attended: number;
  stayed: number;
  booked: number;
  canceled: number;
  connected: number;
  connectable: number;
  showRate: number | null;
  retentionRate: number | null;
  bookingRate: number | null;
  connectionRate: number | null;
  /** Paid only: the webinar's ad spend ÷ paid bookings. */
  costPerBookedCall: number | null;
};

export type WebinarSourceRow = {
  number: number;
  date: string;
  status: "done" | "upcoming";
  adSpend: number | null;
  paid: SourceFunnel;
  organic: SourceFunnel;
  total: SourceFunnel;
};

type Counts = Pick<SourceFunnel, "registered" | "attended" | "stayed" | "booked" | "canceled" | "connected" | "connectable">;

const zero = (): Counts => ({ registered: 0, attended: 0, stayed: 0, booked: 0, canceled: 0, connected: 0, connectable: 0 });

function finish(c: Counts, adSpend: number | null): SourceFunnel {
  return {
    ...c,
    showRate: safeDivide(c.attended, c.registered || null),
    retentionRate: safeDivide(c.stayed, c.attended || null),
    bookingRate: safeDivide(c.booked, c.stayed || null),
    connectionRate: safeDivide(c.connected, c.connectable || null),
    costPerBookedCall: adSpend ? safeDivide(adSpend, c.booked || null) : null,
  };
}

const plus = (a: Counts, b: Counts): Counts => ({
  registered: a.registered + b.registered,
  attended: a.attended + b.attended,
  stayed: a.stayed + b.stayed,
  booked: a.booked + b.booked,
  canceled: a.canceled + b.canceled,
  connected: a.connected + b.connected,
  connectable: a.connectable + b.connectable,
});

/** Newest webinar first, planned ones included. */
export function webinarSourceRows(
  runs: WebinarRun[],
  marketing: MarketingDailyMetricRow[],
  registrants: MasterclassRegistrantRow[],
  bookings: BookingRow[],
  calls: ConnectedCallRow[],
  today: string,
): WebinarSourceRow[] {
  const dates = [...runs].map((r) => r.date).sort();
  const webinarFor = (day: string) => [...dates].reverse().find((d) => d <= day) ?? null;

  const counts = new Map<string, Record<BookingSource, Counts>>();
  const at = (date: string) => {
    let c = counts.get(date);
    if (!c) counts.set(date, (c = { Paid: zero(), Organic: zero() }));
    return c;
  };

  for (const r of registrants) {
    if (!r.sessionDate || (r.source !== "Paid" && r.source !== "Organic")) continue;
    const c = at(r.sessionDate)[r.source];
    c.registered += 1;
    if (r.stage === "Attended" || r.stage === "Stayed Until Pitch") c.attended += 1;
    if (r.stage === "Stayed Until Pitch") c.stayed += 1;
  }

  const counted = countedBookings(bookings);
  const conn = connectedBookingIds(counted, calls);
  for (const b of counted) {
    if (b.source !== "Paid" && b.source !== "Organic") continue;
    const w = webinarFor(b.bookedDate!);
    if (!w) continue;
    const c = at(w)[b.source];
    c.booked += 1;
    if (b.canceled) c.canceled += 1;
    if (isConnectable(b)) {
      c.connectable += 1;
      if (conn.has(b.id)) c.connected += 1;
    }
  }

  return runs
    .map((run, i) => {
      const days = marketing.filter((m) => m.date && m.date >= run.promoStart && m.date <= run.date);
      const adSpend = sum(days.map((m) => m.adSpendMeta));
      const c = counts.get(run.date) ?? { Paid: zero(), Organic: zero() };
      const status = run.date < today ? ("done" as const) : ("upcoming" as const);
      // Before the webinar runs, nobody could have shown up yet: blank, not 0%.
      const held = (f: SourceFunnel): SourceFunnel => (status === "upcoming" ? { ...f, showRate: null } : f);
      return {
        number: i + 1,
        date: run.date,
        status,
        adSpend,
        paid: held(finish(c.Paid, adSpend)),
        organic: held(finish(c.Organic, null)),
        total: held(finish(plus(c.Paid, c.Organic), null)),
      };
    })
    .reverse();
}

/** Range totals: every webinar whose date falls in the range. */
export function sumSourceRows(rows: WebinarSourceRow[]): Pick<WebinarSourceRow, "adSpend" | "paid" | "organic" | "total"> {
  const pick = (r: SourceFunnel): Counts => ({
    registered: r.registered,
    attended: r.attended,
    stayed: r.stayed,
    booked: r.booked,
    canceled: r.canceled,
    connected: r.connected,
    connectable: r.connectable,
  });
  const paid = rows.reduce((a, r) => plus(a, pick(r.paid)), zero());
  const organic = rows.reduce((a, r) => plus(a, pick(r.organic)), zero());
  const adSpend = rows.length ? rows.reduce((n, r) => n + (r.adSpend ?? 0), 0) : null;
  return { adSpend, paid: finish(paid, adSpend), organic: finish(organic, null), total: finish(plus(paid, organic), null) };
}
