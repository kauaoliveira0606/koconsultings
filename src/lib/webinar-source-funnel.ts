import type {
  BookingRow,
  ConnectedCallRow,
  MarketingDailyMetricRow,
  MasterclassRegistrantRow,
} from "@/lib/airtable/tables";
import { safeDivide, sum } from "@/lib/metrics";
import { connectedBookingIds, countedBookings, isConnectable, type BookingSource } from "@/lib/booking-source";
import type { WebinarRun } from "@/lib/webinar-schedule";
import { addDaysToDateString } from "@/lib/date-range";

/**
 * One webinar's funnel split paid vs organic, all automatic (user,
 * 2026-10-19). Front end: WebinarJam registrants -> attended live -> stayed
 * until the pitch (Bronson 50 min+, Aval 1 hour+) -> Calendly bookings. Back end, once the
 * call is on the calendar: a 1+ min GHL call before it (connected) -> the
 * lead's Post Call Note (showed, closed, cash). The source is the lead's
 * paid / organic tag (ad campaign UTM = paid).
 *
 * A booking belongs to the latest webinar held on or before the day it was
 * made, so calls booked the days after a webinar count toward it; bookings
 * from before the first webinar belong to none. Ad spend only buys paid
 * traffic, so every cost metric is over the paid count alone.
 */
export type SourceFunnel = {
  registered: number;
  attended: number;
  stayed: number;
  booked: number;
  canceled: number;
  connected: number;
  connectable: number;
  /** Booked calls whose time has passed, not canceled by the lead: the ones that could have shown. */
  due: number;
  showed: number;
  closed: number;
  cashCollected: number;
  /** Most people in the live room at the same moment (WebinarJam live room). */
  peakRoom: number | null;
  /** People in the live room at the pitch minute. */
  roomAtPitch: number | null;
  /** Room at the pitch ÷ peak room. */
  retentionUntilPitch: number | null;
  showRate: number | null;
  /**
   * Concurrent show rate: peak live room ÷ registered (user, 2026-11-06). An
   * estimate, since WebinarJam only gives the first join time + total time
   * watched, not every leave and rejoin.
   */
  concurrentShowRate: number | null;
  bookingRate: number | null;
  connectionRate: number | null;
  /** Calls that showed ÷ calls due so far. */
  callShowRate: number | null;
  /** Closed ÷ calls that showed. */
  closeRate: number | null;
  /** Paid only: the webinar's ad spend ÷ paid live attendees. */
  costPerAttendee: number | null;
  /** Paid only: the webinar's ad spend ÷ paid peak live room. */
  costPerConcurrentAttendee: number | null;
  /** Paid only: the webinar's ad spend ÷ paid bookings. */
  costPerBookedCall: number | null;
  /** Paid only: the webinar's ad spend ÷ paid calls that showed. */
  costPerLiveCall: number | null;
};

/** One booked call, for the paid vs organic call list. */
export type BookedCall = {
  id: string;
  name: string | null;
  email: string | null;
  bookedDate: string;
  callTime: string | null;
  /** "Paid", "Organic", or "Unknown" (the booker never registered for the webinar). */
  source: string;
  status: "Upcoming" | "Due" | "Canceled (Lead)" | "Canceled (Host)";
  connected: boolean;
  /** The lead's latest post call note outcome since booking. */
  outcome: string | null;
  cashCollected: number;
  /** Fathom recordings from the lead's post call notes since booking, oldest first. */
  fathomLinks: string[];
};

export type WebinarSourceRow = {
  number: number;
  date: string;
  promoStart: string;
  status: "done" | "upcoming";
  adSpend: number | null;
  paid: SourceFunnel;
  organic: SourceFunnel;
  total: SourceFunnel;
  /** Every booked call counted toward this webinar, newest call first. */
  calls: BookedCall[];
};

/** The Post Call Note fields the back end needs. */
export type CallNote = {
  date: string | null;
  leadName?: string | null;
  fathomLink?: string | null;
  leadEmail: string | null;
  callOutcome: string | null;
  cashCollected: number | null;
};

/** A call that happened: anything logged except a no show or a reschedule. */
const SHOWED = (outcome: string) => outcome !== "No Show" && outcome !== "Reschedule";
/** Same closed outcomes as the rest of the dashboard (wasClosed). */
const CLOSED = (outcome: string) => outcome === "Closed (PIF)" || outcome === "Payment Plan";

type Counts = Pick<
  SourceFunnel,
  "registered" | "attended" | "stayed" | "booked" | "canceled" | "connected" | "connectable" | "due" | "showed" | "closed" | "cashCollected"
>;

const zero = (): Counts => ({
  registered: 0,
  attended: 0,
  stayed: 0,
  booked: 0,
  canceled: 0,
  connected: 0,
  connectable: 0,
  due: 0,
  showed: 0,
  closed: 0,
  cashCollected: 0,
});

type Room = { peakRoom: number | null; roomAtPitch: number | null };
const noRoom: Room = { peakRoom: null, roomAtPitch: null };

/**
 * Live room for one group of attendees: the most in the room together, and
 * how many were there at the pitch minute (user, 2026-11-04). A person is in
 * the room from enteredAt up to, not including, leftAt. Null when the rows
 * carry no live room times (the Airtable fallback).
 */
function room(people: MasterclassRegistrantRow[], pitchAt: number | undefined): Room {
  const spans = people.filter(
    (p): p is MasterclassRegistrantRow & { enteredAt: number; leftAt: number } =>
      typeof p.enteredAt === "number" && typeof p.leftAt === "number",
  );
  if (!spans.length || pitchAt === undefined) return noRoom;
  // Leaves before joins at the same second, so a hand-off isn't counted twice.
  const events = spans
    .filter((p) => p.leftAt > p.enteredAt)
    .flatMap((p) => [
      [p.enteredAt, 1],
      [p.leftAt, -1],
    ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let peak = 0;
  for (const [, d] of events) peak = Math.max(peak, (now += d));
  return { peakRoom: peak, roomAtPitch: spans.filter((p) => p.enteredAt <= pitchAt && p.leftAt > pitchAt).length };
}

function finish(c: Counts, adSpend: number | null, r: Room = noRoom): SourceFunnel {
  return {
    ...c,
    ...r,
    retentionUntilPitch: r.roomAtPitch === null ? null : safeDivide(r.roomAtPitch, r.peakRoom || null),
    showRate: safeDivide(c.attended, c.registered || null),
    concurrentShowRate: r.peakRoom === null ? null : safeDivide(r.peakRoom, c.registered || null),
    bookingRate: safeDivide(c.booked, c.stayed || null),
    connectionRate: safeDivide(c.connected, c.connectable || null),
    callShowRate: safeDivide(c.showed, c.due || null),
    closeRate: safeDivide(c.closed, c.showed || null),
    costPerAttendee: adSpend ? safeDivide(adSpend, c.attended || null) : null,
    costPerConcurrentAttendee: adSpend && r.peakRoom ? safeDivide(adSpend, r.peakRoom) : null,
    costPerBookedCall: adSpend ? safeDivide(adSpend, c.booked || null) : null,
    costPerLiveCall: adSpend ? safeDivide(adSpend, c.showed || null) : null,
  };
}

const plus = (a: Counts, b: Counts): Counts =>
  Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof Counts] + b[k as keyof Counts]])) as Counts;

/** Newest webinar first, planned ones included. */
export function webinarSourceRows(
  runs: WebinarRun[],
  marketing: MarketingDailyMetricRow[],
  registrants: MasterclassRegistrantRow[],
  bookings: BookingRow[],
  calls: ConnectedCallRow[],
  notes: CallNote[],
  today: string,
  /** Seconds into the session the pitch starts; needed for the live room numbers. */
  pitchAtSeconds?: number,
): WebinarSourceRow[] {
  const now = Date.now();
  const dates = [...runs].map((r) => r.date).sort();
  const webinarFor = (day: string) => [...dates].reverse().find((d) => d <= day) ?? null;

  const counts = new Map<string, Record<BookingSource, Counts>>();
  const at = (date: string) => {
    let c = counts.get(date);
    if (!c) counts.set(date, (c = { Paid: zero(), Organic: zero() }));
    return c;
  };

  // Each session's live attendees, by source, for the room numbers.
  const attendees = new Map<string, Record<BookingSource, MasterclassRegistrantRow[]>>();
  for (const r of registrants) {
    if (!r.sessionDate || (r.source !== "Paid" && r.source !== "Organic")) continue;
    if (typeof r.enteredAt === "number") {
      let a = attendees.get(r.sessionDate);
      if (!a) attendees.set(r.sessionDate, (a = { Paid: [], Organic: [] }));
      a[r.source].push(r);
    }
    const c = at(r.sessionDate)[r.source];
    c.registered += 1;
    if (r.stage === "Attended" || r.stage === "Stayed Until Pitch") c.attended += 1;
    if (r.stage === "Stayed Until Pitch") c.stayed += 1;
  }

  // Post Call Notes by lead email, oldest first.
  const notesByEmail = new Map<string, CallNote[]>();
  for (const n of notes) {
    const email = n.leadEmail?.trim().toLowerCase();
    if (!email || !n.date) continue;
    notesByEmail.set(email, [...(notesByEmail.get(email) ?? []), n]);
  }

  const counted = countedBookings(bookings);
  const conn = connectedBookingIds(counted, calls);
  const callLists = new Map<string, BookedCall[]>();
  for (const b of counted) {
    const w = webinarFor(b.bookedDate!);
    if (!w) continue;
    const after = (b.email ? notesByEmail.get(b.email) ?? [] : []).filter((n) => n.date! >= b.bookedDate!);
    const latest = [...after].sort((x, y) => x.date!.localeCompare(y.date!)).at(-1);
    const source = b.source === "Paid" || b.source === "Organic" ? b.source : "Unknown";
    callLists.set(w, [
      ...(callLists.get(w) ?? []),
      {
        id: b.id,
        name: b.name ?? after.find((n) => n.leadName)?.leadName ?? null,
        email: b.email ?? null,
        bookedDate: b.bookedDate!,
        callTime: b.callTime,
        source,
        status: b.canceled
          ? b.canceledBy === "Invitee"
            ? "Canceled (Lead)"
            : "Canceled (Host)"
          : b.callTime && new Date(b.callTime).getTime() > now
            ? "Upcoming"
            : "Due",
        connected: conn.has(b.id),
        outcome: latest?.callOutcome ?? null,
        cashCollected: after.reduce((s, n) => s + (n.cashCollected ?? 0), 0),
        fathomLinks: [
          ...new Set(
            [...after]
              .sort((x, y) => x.date!.localeCompare(y.date!))
              // Reps sometimes paste two recordings into one field.
              .flatMap((n) => (n.fathomLink ?? "").split(/[\s,]+/).filter((l) => l.startsWith("http"))),
          ),
        ],
      },
    ]);
    if (b.source !== "Paid" && b.source !== "Organic") continue;
    const c = at(w)[b.source];
    c.booked += 1;
    if (b.canceled) c.canceled += 1;
    if (isConnectable(b)) {
      c.connectable += 1;
      if (conn.has(b.id)) c.connected += 1;
    }
    // A call still ahead, or one the lead canceled themselves, can't count against show rate.
    if (isConnectable(b) && !!b.callTime && new Date(b.callTime).getTime() <= now) c.due += 1;
    // The lead's notes from the day they booked on: showed if any call happened,
    // closed if any closed, and the cash they logged.
    if (after.some((n) => !!n.callOutcome && SHOWED(n.callOutcome))) c.showed += 1;
    if (after.some((n) => !!n.callOutcome && CLOSED(n.callOutcome))) c.closed += 1;
    c.cashCollected += after.reduce((s, n) => s + (n.cashCollected ?? 0), 0);
  }

  return runs
    .map((run, i) => {
      const days = marketing.filter((m) => m.date && m.date >= run.promoStart && m.date <= run.date);
      const adSpend = sum(days.map((m) => m.adSpendMeta));
      const c = counts.get(run.date) ?? { Paid: zero(), Organic: zero() };
      const status = run.date < today ? ("done" as const) : ("upcoming" as const);
      // Before the webinar runs, nobody could have shown up yet: blank, not 0%.
      const held = (f: SourceFunnel): SourceFunnel => (status === "upcoming" ? { ...f, showRate: null, concurrentShowRate: null } : f);
      const a = attendees.get(run.date) ?? { Paid: [], Organic: [] };
      return {
        number: i + 1,
        date: run.date,
        promoStart: run.promoStart,
        status,
        adSpend,
        paid: held(finish(c.Paid, adSpend, room(a.Paid, pitchAtSeconds))),
        organic: held(finish(c.Organic, null, room(a.Organic, pitchAtSeconds))),
        total: held(finish(plus(c.Paid, c.Organic), null, room([...a.Paid, ...a.Organic], pitchAtSeconds))),
        calls: (callLists.get(run.date) ?? []).sort((x, y) => (y.callTime ?? "").localeCompare(x.callTime ?? "")),
      };
    })
    .reverse();
}

/**
 * Paid calls booked in a range and how many showed, by the same rules as a
 * webinar's paid funnel: the lead's Post Call Notes from the day they booked
 * on, matched by email. Feeds Cost Per Live Call on the Overview.
 */
export function paidCallsShowed(bookings: BookingRow[], notes: CallNote[], inRange: (day: string) => boolean): { booked: number; showed: number } {
  const showedEmails = new Map<string, string[]>();
  for (const n of notes) {
    const email = n.leadEmail?.trim().toLowerCase();
    if (!email || !n.date || !n.callOutcome || !SHOWED(n.callOutcome)) continue;
    showedEmails.set(email, [...(showedEmails.get(email) ?? []), n.date]);
  }
  const paid = countedBookings(bookings).filter((b) => b.source === "Paid" && !!b.bookedDate && inRange(b.bookedDate));
  const showed = paid.filter((b) => (b.email ? showedEmails.get(b.email.trim().toLowerCase()) ?? [] : []).some((d) => d >= b.bookedDate!));
  return { booked: paid.length, showed: showed.length };
}

/** One day on the Webinars tab's daily chart. */
export type WebinarDay = {
  date: string;
  adSpend: number;
  /** VIP cash (form) + cash the webinar's booked leads logged in post call notes that day. */
  cashCollected: number;
  vipCash: number;
  callCash: number;
};

/**
 * Daily ad spend vs cash collected from the first webinar's promo start
 * through today (user, 2026-11-04). Call cash is dated by the post call note,
 * counted once per note even if the lead booked twice. Today is left off
 * until the form has a row for it, so a day that isn't logged yet doesn't
 * read as $0.
 */
export function webinarDaily(
  runs: WebinarRun[],
  marketing: MarketingDailyMetricRow[],
  bookings: BookingRow[],
  notes: CallNote[],
  today: string,
): WebinarDay[] {
  const start = [...runs].map((r) => r.promoStart).sort()[0];
  if (!start) return [];
  const dates = [...runs].map((r) => r.date).sort();
  const days = new Map<string, WebinarDay>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, adSpend: 0, cashCollected: 0, vipCash: 0, callCash: 0 }));
    return d;
  };
  for (const m of marketing) {
    if (!m.date || m.date < start || m.date > today) continue;
    const d = day(m.date);
    d.adSpend += m.adSpendMeta ?? 0;
    d.vipCash += (m.vipCashPaid ?? 0) + (m.vipCashOrganic ?? 0);
  }
  const notesByEmail = new Map<string, CallNote[]>();
  for (const n of notes) {
    const email = n.leadEmail?.trim().toLowerCase();
    if (email && n.date) notesByEmail.set(email, [...(notesByEmail.get(email) ?? []), n]);
  }
  const counted = new Set<CallNote>();
  for (const b of countedBookings(bookings)) {
    if (!b.email || !dates.some((d) => d <= b.bookedDate!)) continue;
    for (const n of notesByEmail.get(b.email.trim().toLowerCase()) ?? []) {
      if (n.date! < b.bookedDate! || n.date! > today || counted.has(n) || !n.cashCollected) continue;
      counted.add(n);
      day(n.date!).callCash += n.cashCollected;
    }
  }
  const out: WebinarDay[] = [];
  const last = days.has(today) && marketing.some((m) => m.date === today) ? today : addDaysToDateString(today, -1);
  for (let d = start; d <= last; d = addDaysToDateString(d, 1)) {
    const row = days.get(d) ?? { date: d, adSpend: 0, cashCollected: 0, vipCash: 0, callCash: 0 };
    out.push({ ...row, cashCollected: row.vipCash + row.callCash });
  }
  return out;
}
