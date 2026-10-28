import type { AvalAffiliatePcnRow, AvalPostCallNoteRow } from "@/lib/airtable/tables-aval";
import type { ReactivationAiCall, ReactivationLead, ReactivationMessage } from "@/lib/airtable/reactivation";
import {
  addDaysToDateString,
  easternDateString,
  isDateInRange,
  toEasternDateOnly,
  type ResolvedRange,
} from "@/lib/date-range";

/**
 * Reactivation engine numbers for /aval/overview (spec: the kit's DASHBOARD.md).
 *
 * A close is an Affiliate PCN row whose Lead Email or Phone number matches a
 * texted lead, and only if the sale came AFTER that lead's first text. The
 * PCN Date is a day, so a sale on the same day as the first text counts when
 * the note was filed after the text went out. No payment yet (CPA? empty)
 * shows as pending.
 */

export type ConversationStatus = "Texted" | "Replied" | "Booked" | "Closed" | "Not now" | "Opted out";

export type ReactivationResponse = {
  leadsTexted: number;
  replies: number;
  replyRate: number | null;
  callsBooked: number;
  closes: number;
  pendingCloses: number;
  conversion: number | null;
  cashCollected: number;
  aiCost: number;
  roi: number | null;
  optOuts: number;
  optOutRate: number | null;
  daily: { date: string; texts: number; replies: number; closes: number }[];
  byTouch: { touch: number; closes: number; cash: number }[];
  conversations: {
    contactId: string;
    name: string;
    status: ConversationStatus;
    lastMessage: string;
    lastAt: string;
    messages: number;
  }[];
};

function normEmail(v: string | null | undefined): string | null {
  const e = v?.trim().toLowerCase();
  return e || null;
}

/** Last 10 digits, so "+1 (555) 123-4567" and "5551234567" match. */
function normPhone(v: string | null | undefined): string | null {
  const d = v?.replace(/\D/g, "") ?? "";
  return d.length >= 10 ? d.slice(-10) : null;
}

type Close = {
  contactId: string;
  date: string;
  cash: number | null;
  touch: number;
};

type Note = { date: string | null; email: string | null; phone: string | null; createdTime: string };

/**
 * Which texted lead each note belongs to (null when none), only if the call
 * came AFTER that lead's first text. Matched by email or phone.
 */
function matchToTexts(
  leads: ReactivationLead[],
  messages: ReactivationMessage[],
  notes: Note[]
): ({ contactId: string; touch: number } | null)[] {
  const sentByLead = new Map<string, ReactivationMessage[]>();
  for (const m of messages) {
    if (m.direction !== "out" || m.status !== "sent" || !m.sentAt) continue;
    const list = sentByLead.get(m.contactId) ?? [];
    list.push(m);
    sentByLead.set(m.contactId, list);
  }
  for (const list of sentByLead.values()) list.sort((a, b) => a.sentAt!.localeCompare(b.sentAt!));

  // Only leads that actually got a text can match. If two leads share an
  // email or phone, the one texted first keeps it.
  const texted = leads
    .filter((l) => sentByLead.has(l.contactId))
    .sort((a, b) => sentByLead.get(a.contactId)![0].sentAt!.localeCompare(sentByLead.get(b.contactId)![0].sentAt!));
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const l of texted) {
    const e = normEmail(l.email);
    const p = normPhone(l.phone);
    if (e && !byEmail.has(e)) byEmail.set(e, l.contactId);
    if (p && !byPhone.has(p)) byPhone.set(p, l.contactId);
  }

  return notes.map((row) => {
    if (!row.date) return null;
    const e = normEmail(row.email);
    const p = normPhone(row.phone);
    const contactId = (e && byEmail.get(e)) || (p && byPhone.get(p));
    if (!contactId) return null;

    const sent = sentByLead.get(contactId)!;
    const firstDay = toEasternDateOnly(sent[0].sentAt)!;
    if (row.date < firstDay) return null;
    // When the note was filed on the call day, that time orders it against
    // texts (on the first-text day the call must come after the text).
    // Backfilled notes fall back to the end of the call day.
    const at =
      toEasternDateOnly(row.createdTime) === row.date
        ? row.createdTime
        : row.date === firstDay
          ? null
          : `${addDaysToDateString(row.date, 1)}T04:00:00.000Z`;
    if (!at || at <= sent[0].sentAt!) return null;

    const before = sent.filter((m) => m.sentAt! <= at);
    return { contactId, touch: Math.max(1, ...before.map((m) => m.touch ?? 1)) };
  });
}

/** Every Affiliate PCN row that counts as a reactivation close, any date. */
export function matchCloses(
  leads: ReactivationLead[],
  messages: ReactivationMessage[],
  pcn: AvalAffiliatePcnRow[]
): Close[] {
  const hits = matchToTexts(
    leads,
    messages,
    pcn.map((r) => ({ date: r.date, email: r.leadEmail, phone: r.leadPhone, createdTime: r.createdTime }))
  );
  return pcn.flatMap((row, i) => {
    const hit = hits[i];
    return hit ? [{ ...hit, date: row.date!, cash: row.cpaCash && row.cpaCash > 0 ? row.cpaCash : null }] : [];
  });
}

const HT_CLOSED = /closed|deposit|payment plan/i;

export type ReactivationOverview = {
  leadsTexted: number;
  callsTaken: number;
  affiliateCloses: number;
  highTicketCloses: number;
  cashCollected: number;
};

/**
 * High-level reactivation results for /aval/overview: texted leads followed
 * through every Post Call Note (Affiliate and High Ticket) dated in the range.
 */
export function buildReactivationOverview(
  leads: ReactivationLead[],
  messages: ReactivationMessage[],
  affiliatePcn: AvalAffiliatePcnRow[],
  htPcn: AvalPostCallNoteRow[],
  range: ResolvedRange
): ReactivationOverview {
  const aff = matchCloses(leads, messages, affiliatePcn).filter((c) => isDateInRange(c.date, range));
  const htHits = matchToTexts(
    leads,
    messages,
    htPcn.map((r) => ({ date: r.date, email: r.leadEmail, phone: null, createdTime: r.createdTime }))
  );
  const ht = htPcn.filter((r, i) => htHits[i] && isDateInRange(r.date, range));
  const htClosed = ht.filter((r) => HT_CLOSED.test(r.callOutcome ?? ""));
  const texted = new Set(
    messages
      .filter((m) => m.direction === "out" && m.status === "sent" && isDateInRange(toEasternDateOnly(m.sentAt), range))
      .map((m) => m.contactId)
  );
  return {
    leadsTexted: texted.size,
    callsTaken: aff.length + ht.length,
    affiliateCloses: aff.length,
    highTicketCloses: htClosed.length,
    cashCollected:
      aff.reduce((sum, c) => sum + (c.cash ?? 0), 0) + htClosed.reduce((sum, r) => sum + (r.cashCollected ?? 0), 0),
  };
}

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 400; d = addDaysToDateString(d, 1)) days.push(d);
  return days;
}

export function buildReactivation(
  leads: ReactivationLead[],
  messages: ReactivationMessage[],
  aiCalls: ReactivationAiCall[],
  pcn: AvalAffiliatePcnRow[],
  range: ResolvedRange
): ReactivationResponse {
  const day = (iso: string | null) => toEasternDateOnly(iso);
  const inRange = (iso: string | null) => isDateInRange(day(iso), range);

  const sent = messages.filter((m) => m.direction === "out" && m.status === "sent" && m.sentAt);
  const inbound = messages.filter((m) => m.direction === "in" && !m.optOut);

  const textedIds = new Set(sent.filter((m) => inRange(m.sentAt)).map((m) => m.contactId));
  const repliedIds = new Set(inbound.filter((m) => inRange(m.createdAt)).map((m) => m.contactId));
  const callsBooked = leads.filter((l) => inRange(l.bookedAt)).length;
  const optOuts = leads.filter((l) => inRange(l.optedOutAt)).length;

  const allCloses = matchCloses(leads, messages, pcn);
  const closesInRange = allCloses.filter((c) => isDateInRange(c.date, range));
  const closedIds = new Set(closesInRange.map((c) => c.contactId));
  const pendingIds = new Set(
    [...closedIds].filter((id) => closesInRange.every((c) => c.contactId !== id || c.cash === null))
  );
  const cashCollected = closesInRange.reduce((sum, c) => sum + (c.cash ?? 0), 0);
  const aiCost = aiCalls.filter((c) => inRange(c.createdAt)).reduce((sum, c) => sum + c.costUsd, 0);

  const leadsTexted = textedIds.size;
  const replies = repliedIds.size;
  const closes = closedIds.size;

  // Chart days: the picked range, or from the first activity for All Time.
  const today = easternDateString();
  const firstActivity = [...sent.map((m) => day(m.sentAt)!), ...inbound.map((m) => day(m.createdAt)!)].sort()[0];
  const chartStart = range.start ?? firstActivity ?? today;
  const chartEnd = range.end && range.end < today ? range.end : today;
  const daily = daysBetween(chartStart, chartEnd).map((date) => ({
    date,
    texts: sent.filter((m) => day(m.sentAt) === date).length,
    replies: new Set(inbound.filter((m) => day(m.createdAt) === date).map((m) => m.contactId)).size,
    closes: new Set(closesInRange.filter((c) => c.date === date).map((c) => c.contactId)).size,
  }));

  const byTouch = [1, 2, 3].map((touch) => {
    const rows = closesInRange.filter((c) => Math.min(c.touch, 3) === touch);
    return {
      touch,
      closes: new Set(rows.map((c) => c.contactId)).size,
      cash: rows.reduce((sum, c) => sum + (c.cash ?? 0), 0),
    };
  });

  // Conversations with any message in the range, newest first.
  const everClosed = new Set(allCloses.map((c) => c.contactId));
  const leadById = new Map(leads.map((l) => [l.contactId, l]));
  const threads = new Map<string, ReactivationMessage[]>();
  for (const m of messages) {
    if (m.status === "draft" || m.status === "rejected" || m.status === "approved") continue;
    const list = threads.get(m.contactId) ?? [];
    list.push(m);
    threads.set(m.contactId, list);
  }
  const conversations = [...threads.entries()]
    .filter(([, list]) => list.some((m) => inRange(m.sentAt ?? m.createdAt)))
    .map(([contactId, list]) => {
      const sorted = list.sort((a, b) => (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt));
      const last = sorted[sorted.length - 1];
      const lead = leadById.get(contactId);
      const status: ConversationStatus = lead?.optedOutAt || list.some((m) => m.optOut)
        ? "Opted out"
        : everClosed.has(contactId)
          ? "Closed"
          : lead?.bookedAt
            ? "Booked"
            : lead?.notNow
              ? "Not now"
              : list.some((m) => m.direction === "in")
                ? "Replied"
                : "Texted";
      return {
        contactId,
        name: lead?.name ?? last.leadName ?? "Unknown lead",
        status,
        lastMessage: last.body,
        lastAt: last.sentAt ?? last.createdAt,
        messages: list.length,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, 100);

  return {
    leadsTexted,
    replies,
    replyRate: leadsTexted ? replies / leadsTexted : null,
    callsBooked,
    closes,
    pendingCloses: pendingIds.size,
    conversion: replies ? closes / replies : null,
    cashCollected,
    aiCost,
    roi: aiCost > 0 ? cashCollected / aiCost : null,
    optOuts,
    optOutRate: leadsTexted ? optOuts / leadsTexted : null,
    daily,
    byTouch,
    conversations,
  };
}
