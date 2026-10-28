import { isDateInRange, toEasternDateOnly, type ResolvedRange } from "@/lib/date-range";

/**
 * Numbers for /bronson/show-rate (the masterclass show-rate engine). Every
 * registrant is counted in the session they registered for; the range picks
 * sessions by date. Showed / No show come from the GHL Masterclass pipeline
 * after n8n moves people on, so a session reads "pending" until then.
 */

type Row = { id: string; fields: Record<string, unknown>; createdTime?: string };

export type ShowRateStatus = "Registered" | "Replied" | "Committed" | "Can't make it" | "Opted out";
export type ShowRateOutcome = "Pending" | "Showed" | "No show";

export type ShowRateResponse = {
  registrants: number;
  replied: number;
  replyRate: number | null;
  committed: number;
  commitRate: number | null;
  checkIns: number;
  optOuts: number;
  showed: number;
  decided: number;
  showRate: number | null;
  committedShowRate: number | null;
  otherShowRate: number | null;
  aiCost: number;
  bySession: {
    session: string;
    registrants: number;
    replied: number;
    committed: number;
    showed: number;
    noShow: number;
    pending: number;
    showRate: number | null;
  }[];
  feedback: {
    contactId: string;
    name: string;
    session: string;
    status: ShowRateStatus;
    goal: string;
    wantsCovered: string;
    preferredTime: string;
    other: string;
  }[];
  /** Real questions the bot had no approved answer for, to train it on (user, 2026-10-28). */
  questions: { contactId: string; name: string; session: string; note: string }[];
  conversations: {
    contactId: string;
    name: string;
    status: ShowRateStatus;
    outcome: ShowRateOutcome;
    lastMessage: string;
    lastAt: string;
  }[];
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const rate = (n: number, d: number) => (d ? n / d : null);

export function buildShowRate(leads: Row[], messages: Row[], aiCalls: Row[], range: ResolvedRange): ShowRateResponse {
  const inRange = leads.filter((l) => isDateInRange(s(l.fields.Session) || null, range));
  const status = (l: Row) => (s(l.fields.Status) || "Registered") as ShowRateStatus;
  const outcome = (l: Row) => (s(l.fields.Outcome) || "Pending") as ShowRateOutcome;
  const replied = (l: Row) => status(l) !== "Registered";
  const committed = (l: Row) => status(l) === "Committed";

  // Show rates only over people whose session already has an outcome.
  const decided = inRange.filter((l) => outcome(l) !== "Pending");
  const showed = decided.filter((l) => outcome(l) === "Showed");
  const decidedCommitted = decided.filter(committed);
  const decidedOther = decided.filter((l) => !committed(l));

  const sessions = new Map<string, Row[]>();
  for (const l of inRange) {
    const key = s(l.fields.Session);
    sessions.set(key, [...(sessions.get(key) ?? []), l]);
  }
  const bySession = [...sessions.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([session, list]) => {
      const done = list.filter((l) => outcome(l) !== "Pending");
      const shows = done.filter((l) => outcome(l) === "Showed").length;
      return {
        session,
        registrants: list.length,
        replied: list.filter(replied).length,
        committed: list.filter(committed).length,
        showed: shows,
        noShow: done.length - shows,
        pending: list.length - done.length,
        showRate: rate(shows, done.length),
      };
    });

  const feedback = inRange
    .map((l) => ({
      contactId: s(l.fields["GHL Contact ID"]),
      name: s(l.fields.Name) || "Unknown",
      session: s(l.fields.Session),
      status: status(l),
      goal: s(l.fields.Goal),
      wantsCovered: s(l.fields["Wants Covered"]),
      preferredTime: s(l.fields["Preferred Time"]),
      other: s(l.fields["Other Feedback"]),
      at: s(l.fields["Last Message At"]),
    }))
    .filter((f) => f.goal || f.wantsCovered || f.preferredTime || f.other)
    .sort((a, b) => b.at.localeCompare(a.at));

  const questions = inRange
    .flatMap((l) =>
      s(l.fields["Questions To Review"])
        .split("\n")
        .filter(Boolean)
        .map((note) => ({
          contactId: s(l.fields["GHL Contact ID"]),
          name: s(l.fields.Name) || "Unknown",
          session: s(l.fields.Session),
          note,
          at: s(l.fields["Last Message At"]),
        }))
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  // Conversations: registrants in range with any engine-logged message.
  const leadById = new Map(inRange.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const last = new Map<string, { body: string; at: string }>();
  for (const m of messages) {
    const id = s(m.fields["GHL Contact ID"]);
    if (!leadById.has(id)) continue;
    const at = s(m.fields["Sent At"]) || s(m.fields["Created At"]) || m.createdTime || "";
    if (!last.has(id) || at > last.get(id)!.at) last.set(id, { body: typeof m.fields.Body === "string" ? m.fields.Body : "", at });
  }
  const conversations = [...last.entries()]
    .map(([contactId, m]) => {
      const l = leadById.get(contactId)!;
      return { contactId, name: s(l.fields.Name) || "Unknown", status: status(l), outcome: outcome(l), lastMessage: m.body, lastAt: m.at };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, 150);

  const aiCost = aiCalls
    .filter((c) => isDateInRange(toEasternDateOnly(s(c.fields["Created At"]) || c.createdTime || null), range))
    .reduce((sum, c) => sum + (typeof c.fields["Cost USD"] === "number" ? c.fields["Cost USD"] : 0), 0);

  return {
    registrants: inRange.length,
    replied: inRange.filter(replied).length,
    replyRate: rate(inRange.filter(replied).length, inRange.length),
    committed: inRange.filter(committed).length,
    commitRate: rate(inRange.filter(committed).length, inRange.length),
    checkIns: inRange.filter((l) => l.fields["Check-in Sent At"]).length,
    optOuts: inRange.filter((l) => status(l) === "Opted out").length,
    showed: showed.length,
    decided: decided.length,
    showRate: rate(showed.length, decided.length),
    committedShowRate: rate(decidedCommitted.filter((l) => outcome(l) === "Showed").length, decidedCommitted.length),
    otherShowRate: rate(decidedOther.filter((l) => outcome(l) === "Showed").length, decidedOther.length),
    aiCost,
    bySession,
    feedback,
    questions,
    conversations,
  };
}
