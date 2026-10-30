import { createReactivationRow, getReactivationRows, updateReactivationRow } from "@/lib/airtable/reactivation";
import { firstNameOf, generate, localTime, MODELS, thread, trySend, type RunReport } from "./engine";
import { getContact, history, recentConversations, smsBlocked, type GhlContact } from "./ghl";
import {
  appendTo,
  easternDay,
  easternHour,
  easternToUtc,
  linksOk,
  liveSince,
  logOut,
  MASTERCLASS,
  s,
  statedSoFar,
  STOP,
  toSession,
  type MasterclassOffer,
  type Row,
} from "./show-rate";
import { NOSHOW_VOICES, VOICES } from "./voice";
import { register, schedules, type WjSchedule } from "./webinarjam";

/**
 * The no-show engine, one per offer (kits: ~/Desktop/reactivation-bronson-noshow,
 * ~/Desktop/reactivation-aval-noshow). Texts masterclass no-shows as the host, no guilt: the night of the class
 * (about 9:30 to 10:30pm ET), the next afternoon, and two days after, then
 * stops. When they say yes it saves their seat by registering them in
 * WebinarJam itself; if the next date isn't set up yet the request waits and
 * goes through once it is. Shares the Show Rate tables (Outcome "No show").
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const STOPPED = new Set(["Replied", "Seat Saved", "Seat Pending", "Not interested", "Opted out"]);

// ---------- Prompts ----------

function rules(offer: MasterclassOffer): string {
  const m = MASTERCLASS[offer];
  return `You ARE ${m.host}, texting in first person. Where my-voice.md disagrees with voice.md, my-voice.md wins. Ignore anything in voice.md about booking a call: there is no call here.

<voice.md>
${VOICES[offer].voice}
</voice.md>

<my-voice.md>
${NOSHOW_VOICES[offer].myVoice}
</my-voice.md>

<offer.md>
${NOSHOW_VOICES[offer].offer}
</offer.md>

<${m.sopName}>
${m.sop}
</${m.sopName}>`;
}

const DATES = `Dates: the approved examples name a day ("next Wednesday at 7pm ET", "next Sunday at 7pm ET") only as a placeholder. Always use the exact next date given below. Say "next <day>" only if it really is 7 days away or less; otherwise name it ("Sunday, November 15 at 7pm ET" style).`;

type Touch = "night" | "late" | "push1" | "push2";
const TOUCH_BRIEF: Record<Touch, string> = {
  night: "the night-of text, about an hour after the class ended: warm and casual, saw you couldn't make it, no worries at all, want me to save you a seat for the next one",
  late: "the night-of text, going out late because it couldn't send last night: warm and casual, saw you couldn't make it, no worries at all, want me to save you a seat for the next one. Don't say tonight or last night",
  push1: "push #1, the next afternoon, they never replied: like the approved push #1 example",
  push2: "push #2, the last one, two days after: like the approved push #2 example. After this I never text first again",
};

export const touchSystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, texting someone who registered for your masterclass and didn't show up. Follow these files exactly.

${rules(offer)}

No guilt, no "you missed out". ${DATES} Reply with only the text message. No quotes, no notes.`;

export const noShowReplySystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, answering a masterclass no-show's texts. Follow these files exactly.

${rules(offer)}

Goal: get them back on the next live masterclass. You save their seat for them.
Rulebook: no guilt, never pitch, never mention price, never push a call, never send a link outside the approved set, under two lines unless it's a personal callback.
${DATES}

Return JSON:
- "reply": the one text to send, or "" (plain ok / thanks / 👍, or STOP).
- "action": "save_seat" only on a clear yes to saving their seat (never on a maybe), "not_interested", "opt_out" (STOP / remove me / unsubscribe), or "none".
- "preferred_time": the day/time they say would work, in their words, or "".
- "reason": why they missed it or why they're not interested, in their words, or "".
- "question_to_review": if their newest text asks a real question the approved examples don't answer, that question in their words, else "".`;

export const NO_SHOW_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["none", "save_seat", "not_interested", "opt_out"] },
    preferred_time: { type: "string" },
    reason: { type: "string" },
    question_to_review: { type: "string" },
  },
  required: ["reply", "action", "preferred_time", "reason", "question_to_review"],
  additionalProperties: false,
};

type Parsed = { reply: string; action: string; preferred_time: string; reason: string; question_to_review: string };

// ---------- Who's a no-show ----------

/** The latest row per contact, when it's a no-show from the last two weeks. A newer registration hands them to the show-rate engine. */
function noShows(rows: Row[]): Map<string, Row> {
  const latest = new Map<string, Row>();
  for (const r of [...rows].sort((a, b) => s(a.fields.Session).localeCompare(s(b.fields.Session)))) {
    latest.set(s(r.fields["GHL Contact ID"]), r);
  }
  const since = easternDay(Date.now() - 14 * DAY);
  return new Map([...latest].filter(([, r]) => r.fields.Outcome === "No show" && s(r.fields.Session) >= since && r.fields.Status !== "Opted out"));
}

/** When a row's session started: its WebinarJam session that day, else 7pm ET. */
function sessionStart(r: Row, all: WjSchedule[]): number {
  const day = s(r.fields.Session);
  const wj = all.find((sc) => easternDay(sc.startsAt) === day);
  if (wj) return wj.startsAt;
  const [y, mo, d] = day.split("-").map(Number);
  return easternToUtc(y, mo - 1, d, 19, 0);
}

/** The session to save seats in: the next one set up in WebinarJam, at least 30 minutes out. */
const nextSchedule = (all: WjSchedule[]) => all.find((sc) => sc.startsAt > Date.now() + 30 * 60_000) ?? null;

/** What the texts call the next one: the WebinarJam date, else the usual weekday at 7pm ET. */
function nextLabel(offer: MasterclassOffer, all: WjSchedule[]): string {
  const sc = nextSchedule(all);
  if (sc) return toSession(sc.startsAt).label;
  for (let i = 1; i <= 8; i++) {
    const day = easternDay(Date.now() + i * DAY);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === MASTERCLASS[offer].usualWeekday) {
      const [y, mo, d] = day.split("-").map(Number);
      return toSession(easternToUtc(y, mo - 1, d, 19, 0)).label;
    }
  }
  return "the next one at 7pm ET";
}

// ---------- Seats ----------

/** Registers them for the next session, or marks the request pending when there isn't one yet. */
async function saveSeat(offer: MasterclassOffer, c: GhlContact, all: WjSchedule[]): Promise<Record<string, unknown>> {
  const sc = nextSchedule(all);
  if (!sc || !c.email || !c.phone) return { "No-show Status": "Seat Pending" };
  await register(offer, { firstName: c.firstName?.trim() || c.contactName?.trim() || "Friend", lastName: c.lastName, email: c.email, phone: c.phone }, sc.id);
  return { "No-show Status": "Seat Saved", "Seat Session": easternDay(sc.startsAt) };
}

/** Every run: pending seat requests go through as soon as the next date exists in WebinarJam. */
export async function runPendingSeats(offer: MasterclassOffer, report: RunReport): Promise<void> {
  const rows = await getReactivationRows(offer, "leads", "{No-show Status}='Seat Pending'");
  if (!rows.length) return;
  const all = await schedules(offer);
  if (!nextSchedule(all)) return;
  for (const r of rows) {
    const c = await getContact(offer, s(r.fields["GHL Contact ID"]));
    try {
      const fields = await saveSeat(offer, c, all);
      if (fields["No-show Status"] === "Seat Saved") {
        await updateReactivationRow(offer, "leads", r.id, fields);
        report.skipped["seats saved from pending"] = (report.skipped["seats saved from pending"] ?? 0) + 1;
      }
    } catch (e) {
      console.error("no-show: pending seat failed", c.id, e);
    }
  }
}

// ---------- The three texts ----------

/**
 * Night of (2.5 to 3.5 hours after the start), next afternoon, two days after. Each needs the one before it.
 * When the night-of text couldn't go out (SMS limit pause), it goes in the next window instead of the push, so nobody's first text is a bare "still a priority?".
 */
function dueTouch(r: Row, start: number, now = Date.now()): Touch | null {
  const status = s(r.fields["No-show Status"]);
  if (STOPPED.has(status)) return null;
  const today = easternDay(now);
  const hour = easternHour(now);
  const push1Window = today === easternDay(start + DAY) && hour >= 13 && hour < 17;
  const push2Window = today === easternDay(start + 2 * DAY) && hour >= 11 && hour < 15;
  if (!r.fields["Night-of Sent At"]) {
    if (now >= start + 2.5 * HOUR && now < start + 3.5 * HOUR) return "night";
    return push1Window || push2Window ? "late" : null;
  }
  // A late night-of text never gets a push on its heels.
  if (now - Date.parse(s(r.fields["Last Message At"])) < 12 * HOUR) return null;
  if (!r.fields["Push 1 Sent At"]) return push1Window ? "push1" : null;
  if (!r.fields["Push 2 Sent At"]) return push2Window ? "push2" : null;
  return null;
}

/**
 * One-off resend to a marked list (user, 2026-10-30: the Oct 28 night-of text hit GHL's SMS limit, so these
 * leads never saw the real message). Goes out on the "Recovery Due" date, 1 to 5pm ET.
 */
function recoveryDue(r: Row, now = Date.now()): boolean {
  if (s(r.fields["Recovery Due"]) !== easternDay(now) || r.fields["Recovery Sent At"] || STOPPED.has(s(r.fields["No-show Status"]))) return false;
  const hour = easternHour(now);
  return hour >= 13 && hour < 17;
}

const TOUCH_FIELD: Record<Touch, string> = { night: "Night-of Sent At", late: "Night-of Sent At", push1: "Push 1 Sent At", push2: "Push 2 Sent At" };

export async function runNoShowTouches(offer: MasterclassOffer, deadline: number, report: RunReport): Promise<void> {
  if ((await liveSince(offer, "noshow_on")) === null) return;
  const rows = await getReactivationRows(offer, "leads");
  const all = await schedules(offer);
  for (const r of noShows(rows).values()) {
    if (Date.now() > deadline) return;
    const recovery = recoveryDue(r);
    const touch = recovery ? "late" : dueTouch(r, sessionStart(r, all));
    if (!touch) continue;
    const c = await getContact(offer, s(r.fields["GHL Contact ID"]));
    if (!c.phone || smsBlocked(c)) {
      report.skipped["no-show: no textable phone"] = (report.skipped["no-show: no textable phone"] ?? 0) + 1;
      continue;
    }
    // Anyone who has texted since the class is a conversation now, not a recovery.
    if (recovery && (await history(offer, c.id)).some((m) => m.direction === "inbound" && m.messageType === "TYPE_SMS" && Date.parse(m.dateAdded) >= sessionStart(r, all))) continue;
    const body = await generate(offer, {
      model: MODELS.firstText,
      system: touchSystem(offer),
      prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(r)}Next masterclass: ${nextLabel(offer, all)}

Write ${TOUCH_BRIEF[touch]}.`,
      purpose: "no_show",
      contactId: c.id,
      touch: touch === "night" || touch === "late" ? 1 : touch === "push1" ? 2 : 3,
    });
    if (!body || !linksOk(offer, body) || !(await trySend(offer, c.id, body))) continue;
    await logOut(offer, c, s(r.fields.Name), body, null, `no-show ${touch}`);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(offer, "leads", r.id, { [recovery ? "Recovery Sent At" : TOUCH_FIELD[touch]]: sentAt, "Last Message At": sentAt, "No-show Status": "Texted" });
    report.followUps++;
  }
}

// ---------- Replies ----------

/** Every 5 minutes: answer no-shows' texts as the host and save seats on a yes. */
export async function runNoShowReplies(offer: MasterclassOffer, report: RunReport): Promise<void> {
  const since = await liveSince(offer, "noshow_on");
  const rows = await getReactivationRows(offer, "leads");
  const byContact = noShows(rows);
  if (!byContact.size) return;
  let all: WjSchedule[] | null = null;
  // Two days, so replies that came in during a 24-hour SMS limit pause still get answered.
  const cutoff = Date.now() - 2 * DAY;

  for (const conv of await recentConversations(offer)) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = byContact.get(conv.contactId);
    if (!lead || conv.lastMessageDirection !== "inbound") continue;
    const handledUpTo = s(lead.fields["Last Message At"]).slice(0, 19);
    if (new Date(conv.lastMessageDate).toISOString().slice(0, 19) <= handledUpTo) continue;

    const msgs = await history(offer, conv.contactId);
    const fresh = msgs.filter((m) => m.direction === "inbound" && m.messageType === "TYPE_SMS" && m.dateAdded.slice(0, 19) > handledUpTo);
    if (!fresh.length) continue;
    const name = s(lead.fields.Name);
    const fields: Record<string, unknown> = { "Last Message At": fresh[fresh.length - 1].dateAdded };
    let optOut = false;
    for (const m of fresh) {
      const isStop = STOP.test(m.body ?? "");
      optOut ||= isStop;
      await createReactivationRow(offer, "messages", {
        Name: `${name} in`,
        "GHL Contact ID": conv.contactId,
        "Lead Name": name,
        Direction: "in",
        Body: m.body ?? "",
        Status: "received",
        "Opt Out": isStop,
        "Created At": m.dateAdded,
      });
    }
    if (optOut) {
      await updateReactivationRow(offer, "leads", lead.id, { ...fields, Status: "Opted out", "No-show Status": "Opted out", "Opted Out At": new Date().toISOString() });
      continue;
    }
    if (!STOPPED.has(s(lead.fields["No-show Status"]))) fields["No-show Status"] = "Replied";

    if (since !== null && Date.parse(fresh[fresh.length - 1].dateAdded) >= since) {
      const c = await getContact(offer, conv.contactId);
      all ??= await schedules(offer);
      const out = await generate(offer, {
        model: MODELS.reply,
        system: noShowReplySystem(offer),
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(lead)}Next masterclass: ${nextLabel(offer, all)}${nextSchedule(all) ? "" : " (not set up yet: if they say yes, their seat is saved and confirmed once it is)"}
Now in Eastern time: ${localTime("America/New_York")}

Full text thread, oldest first:
${thread(msgs)}

Answer their latest text.`,
        purpose: "no_show",
        contactId: conv.contactId,
        touch: null,
        schema: NO_SHOW_SCHEMA,
      });
      const parsed = parse(out);
      if (parsed?.action === "opt_out") {
        Object.assign(fields, { Status: "Opted out", "No-show Status": "Opted out", "Opted Out At": new Date().toISOString() });
      } else if (parsed) {
        if (parsed.action === "save_seat") {
          try {
            Object.assign(fields, await saveSeat(offer, c, all));
          } catch (e) {
            console.error("no-show: saving seat failed", c.id, e);
            fields["No-show Status"] = "Seat Pending";
          }
        } else if (parsed.action === "not_interested") fields["No-show Status"] = "Not interested";
        const linkBlocked = Boolean(parsed.reply) && !linksOk(offer, parsed.reply);
        const question = parsed.question_to_review.trim() || (linkBlocked ? fresh[fresh.length - 1].body ?? "" : "");
        if (question) {
          const note = `Q (no-show): ${question} → ${linkBlocked ? "NOT SENT (unapproved link)" : `Sent: ${parsed.reply || "(no reply)"}`}`;
          const next = appendTo(lead.fields["Questions To Review"], note);
          if (next) fields["Questions To Review"] = next;
        }
        for (const [field, value] of [
          ["Preferred Time", parsed.preferred_time],
          ["No-show Reason", parsed.reason],
        ] as const) {
          const next = appendTo(lead.fields[field], value);
          if (next) fields[field] = next;
        }
        if (parsed.reply && !linkBlocked && (await trySend(offer, c.id, parsed.reply))) {
          await logOut(offer, c, name, parsed.reply, null, "no-show reply");
          fields["Last Message At"] = new Date().toISOString();
          report.replies++;
        }
      }
    }
    await updateReactivationRow(offer, "leads", lead.id, fields);
  }
}

function parse(text: string | null): Parsed | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Parsed;
  } catch {
    return null;
  }
}
