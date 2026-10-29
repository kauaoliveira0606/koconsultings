import { isDateInRange, type ResolvedRange } from "@/lib/date-range";

/**
 * Numbers for each offer's No-Shows tab (the masterclass no-show engine). A no-show is
 * a Show Rate Leads row with Outcome "No show", counted in its session; the
 * range picks sessions by date. Came back = a later row for the same person.
 */

type Row = { id: string; fields: Record<string, unknown>; createdTime?: string };

export type NoShowStatus = "Not texted" | "Texted" | "Replied" | "Seat Saved" | "Seat Pending" | "Not interested" | "Opted out";

export type NoShowsResponse = {
  noShows: number;
  texted: number;
  replied: number;
  replyRate: number | null;
  seatsSaved: number;
  seatsPending: number;
  reRegistered: number;
  reRegisterRate: number | null;
  showedNext: number;
  notInterested: number;
  optOuts: number;
  bySession: { session: string; noShows: number; texted: number; replied: number; seatsSaved: number; reRegistered: number; showedNext: number }[];
  feedback: { contactId: string; name: string; session: string; status: NoShowStatus; reason: string; preferredTime: string; goal: string }[];
  questions: { contactId: string; name: string; session: string; note: string }[];
  conversations: { contactId: string; name: string; status: NoShowStatus; lastMessage: string; lastAt: string }[];
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const rate = (n: number, d: number) => (d ? n / d : null);

export function buildNoShows(leads: Row[], messages: Row[], range: ResolvedRange): NoShowsResponse {
  const byContact = new Map<string, Row[]>();
  for (const l of leads) {
    const id = s(l.fields["GHL Contact ID"]);
    byContact.set(id, [...(byContact.get(id) ?? []), l]);
  }
  const later = (l: Row) =>
    (byContact.get(s(l.fields["GHL Contact ID"])) ?? []).filter((o) => s(o.fields.Session) > s(l.fields.Session));

  const rows = leads.filter((l) => l.fields.Outcome === "No show" && isDateInRange(s(l.fields.Session) || null, range));
  const status = (l: Row) => (s(l.fields["No-show Status"]) || "Not texted") as NoShowStatus;
  const texted = (l: Row) => Boolean(l.fields["Night-of Sent At"]);
  const replied = (l: Row) => !["Not texted", "Texted"].includes(status(l));
  const saved = (l: Row) => status(l) === "Seat Saved" || status(l) === "Seat Pending";
  const reRegistered = (l: Row) => later(l).length > 0;
  const showedNext = (l: Row) => later(l).some((o) => o.fields.Outcome === "Showed");

  const sessions = new Map<string, Row[]>();
  for (const l of rows) sessions.set(s(l.fields.Session), [...(sessions.get(s(l.fields.Session)) ?? []), l]);
  const bySession = [...sessions.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([session, list]) => ({
      session,
      noShows: list.length,
      texted: list.filter(texted).length,
      replied: list.filter(replied).length,
      seatsSaved: list.filter(saved).length,
      reRegistered: list.filter(reRegistered).length,
      showedNext: list.filter(showedNext).length,
    }));

  const feedback = rows
    .map((l) => ({
      contactId: s(l.fields["GHL Contact ID"]),
      name: s(l.fields.Name) || "Unknown",
      session: s(l.fields.Session),
      status: status(l),
      reason: s(l.fields["No-show Reason"]),
      preferredTime: s(l.fields["Preferred Time"]),
      goal: s(l.fields.Goal),
      at: s(l.fields["Last Message At"]),
    }))
    .filter((f) => f.reason || f.preferredTime)
    .sort((a, b) => b.at.localeCompare(a.at));

  const questions = rows
    .flatMap((l) =>
      s(l.fields["Questions To Review"])
        .split("\n")
        .filter((n) => n.startsWith("Q (no-show)"))
        .map((note) => ({ contactId: s(l.fields["GHL Contact ID"]), name: s(l.fields.Name) || "Unknown", session: s(l.fields.Session), note, at: s(l.fields["Last Message At"]) }))
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  // Conversations: messages after the class for no-shows in range.
  const rowById = new Map(rows.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const last = new Map<string, { body: string; at: string }>();
  for (const m of messages) {
    const id = s(m.fields["GHL Contact ID"]);
    const l = rowById.get(id);
    if (!l) continue;
    const at = s(m.fields["Sent At"]) || s(m.fields["Created At"]) || m.createdTime || "";
    if (at.slice(0, 10) < s(l.fields.Session)) continue;
    if (!last.has(id) || at > last.get(id)!.at) last.set(id, { body: typeof m.fields.Body === "string" ? m.fields.Body : "", at });
  }
  const conversations = [...last.entries()]
    .map(([contactId, m]) => ({ contactId, name: s(rowById.get(contactId)!.fields.Name) || "Unknown", status: status(rowById.get(contactId)!), lastMessage: m.body, lastAt: m.at }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, 150);

  return {
    noShows: rows.length,
    texted: rows.filter(texted).length,
    replied: rows.filter(replied).length,
    replyRate: rate(rows.filter(replied).length, rows.filter(texted).length),
    seatsSaved: rows.filter(saved).length,
    seatsPending: rows.filter((l) => status(l) === "Seat Pending").length,
    reRegistered: rows.filter(reRegistered).length,
    reRegisterRate: rate(rows.filter(reRegistered).length, rows.length),
    showedNext: rows.filter(showedNext).length,
    notInterested: rows.filter((l) => status(l) === "Not interested").length,
    optOuts: rows.filter((l) => status(l) === "Opted out").length,
    bySession,
    feedback,
    questions,
    conversations,
  };
}
