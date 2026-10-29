import {
  createReactivationRow,
  getReactivationRows,
  updateReactivationRow,
} from "@/lib/airtable/reactivation";
import { firstNameOf, generate, localTime, MODELS, thread, trySend, type RunReport } from "./engine";
import {
  getContact,
  history,
  MASTERCLASS_NO_SHOW_STAGE,
  MASTERCLASS_OPT_IN_STAGE,
  MASTERCLASS_VIP_STAGE,
  pipelineOpportunities,
  recentConversations,
  smsBlocked,
  type GhlContact,
} from "./ghl";
import { BRONSON_VOICE_SOP, VOICES } from "./voice";
import { schedules } from "./webinarjam";

/**
 * Bronson's show-rate engine (kit: ~/Desktop/reactivation-bronson-masterclass).
 * Texts as Bronson to masterclass registrants: answers every reply to the
 * WebinarJam sequence and sends one check-in at 4pm ET on event day that
 * teases one nugget and quotes their stated goal back (commitment stacking). Saves their feedback (goal, what they want covered,
 * preferred time) for the /bronson/show-rate tab. Never touches GHL stages.
 */

export const OFFER = "bronsonMasterclass" as const;
const DAY = 86_400_000;
/** User, 2026-10-28: "wrong number" is not an opt-out here, we remind them what they signed up for. */
export const STOP = /^\s*(stop|unsubscribe|remove me|cancel|quit|end)\b/i;
const SIGNUP_PAGE = "https://www.ad-ventur.com/masterclass";
const CHECK_IN_HOUR = 16;
/** User, 2026-10-28: never send a link outside the approved set. */
const APPROVED_LINKS = [
  "https://event.webinarjam.com/8wgzn9/go/live/13q192tyipsxs4",
  "https://www.ad-ventur.com/masterclass",
  "https://www.youtube.com/@Bronny.builds",
  "https://www.instagram.com/bronnybuilds/",
];

/** Protocol, "www.", trailing slash and trailing punctuation don't matter. */
const normLink = (l: string) => l.toLowerCase().replace(/[.,!?)]+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

/** False when a text carries any link that isn't approved; such a text is never sent. */
export function linksOk(text: string): boolean {
  // Bare domains count too ("evil.com/x"), not just https:// links.
  const links = text.match(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi) ?? [];
  return links.every((l) => APPROVED_LINKS.some((ok) => normLink(l) === normLink(ok)));
}

const REGISTERED = new Set([MASTERCLASS_OPT_IN_STAGE, MASTERCLASS_VIP_STAGE]);

export type Row = { id: string; fields: Record<string, unknown> };
export const s = (v: unknown) => (typeof v === "string" ? v : "");
export const easternDay = (t: number | string | Date) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
export const easternHour = (t: number) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(t));

// ---------- On / off ----------

/**
 * ON means the switch (engine_on, or noshow_on for the no-show engine) is "1"
 * and today (Eastern) is on or after the optional on_from date in Show Rate
 * Settings (user, 2026-10-28: "turn this on starting tomorrow"). Returns the
 * start of that day so earlier texts are never answered.
 */
export async function liveSince(switchKey: "engine_on" | "noshow_on" = "engine_on"): Promise<number | null> {
  const rows = await getReactivationRows(OFFER, "settings");
  const value = (key: string) => s(rows.find((r) => r.fields.Key === key)?.fields.Value).trim();
  if (value(switchKey) !== "1") return null;
  // on_from belongs to the show-rate switch; the no-show engine has noshow_on_from.
  const from = value(switchKey === "engine_on" ? "on_from" : "noshow_on_from");
  if (!from) return 0;
  if (easternDay(Date.now()) < from) return null;
  const [y, mo, d] = from.split("-").map(Number);
  return easternToUtc(y, mo - 1, d, 0, 0);
}

// ---------- The session ----------

export type Session = { date: string; label: string; startsAt: number };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Eastern wall time to a UTC timestamp, DST included. */
export function easternToUtc(y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo, d, h, mi);
  const at = (timeZone: string) => new Date(new Date(guess).toLocaleString("en-US", { timeZone })).getTime();
  return guess + (at("UTC") - at("America/New_York"));
}

/**
 * The next masterclass: the next session set up in WebinarJam (where seats are
 * actually saved), else the signup page (user: it shows the current date and
 * time), else the usual Wednesday 7pm ET. A session stays "next" until 3 hours
 * after it starts.
 */
export async function nextSession(): Promise<Session> {
  const live = Date.now() - 3 * 3_600_000;
  try {
    const upcoming = (await schedules()).find((sc) => sc.startsAt > live);
    if (upcoming) return toSession(upcoming.startsAt);
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
  }
  try {
    const html = await (await fetch(SIGNUP_PAGE, { cache: "no-store" })).text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ");
    const m = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2})\s*·?\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*E[SD]?T/i
    );
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (m && month >= 0) {
      const hour = (Number(m[3]) % 12) + (m[5].toUpperCase() === "PM" ? 12 : 0);
      let year = Number(easternDay(Date.now()).slice(0, 4));
      // A January date read in December is next year.
      if (easternToUtc(year, month, Number(m[2]), hour, Number(m[4] ?? 0)) < Date.now() - 60 * DAY) year++;
      const fromPage = easternToUtc(year, month, Number(m[2]), hour, Number(m[4] ?? 0));
      if (fromPage > live) return toSession(fromPage);
    }
  } catch (e) {
    console.error("show-rate: couldn't read the masterclass date", e);
  }
  // Fallback: the usual Wednesday 7pm ET.
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    const day = easternDay(now + i * DAY);
    const [y, mo, d] = day.split("-").map(Number);
    const start = easternToUtc(y, mo - 1, d, 19, 0);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 3 && start > now - 2 * 3_600_000) return toSession(start);
  }
  return toSession(now);
}

export function toSession(startsAt: number): Session {
  const label = new Date(startsAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return { date: easternDay(startsAt), label: `${label} ET`, startsAt };
}

// ---------- Prompts ----------

function rules(): string {
  const v = VOICES[OFFER];
  return `${v.names}
Where my-voice.md disagrees with voice.md, my-voice.md wins. Ignore anything in voice.md about booking a call: there is no call here.

<voice.md>
${v.voice}
</voice.md>

<my-voice.md>
${v.myVoice}
</my-voice.md>

<offer.md>
${v.offer}
</offer.md>

<bronson-voice-sop.md>
${BRONSON_VOICE_SOP}
</bronson-voice-sop.md>`;
}

/** The session after this one, for "can't make it": the next one set up in WebinarJam, else the usual weekly slot. */
async function nextDate(session: Session): Promise<string> {
  try {
    const after = (await schedules()).find((sc) => sc.startsAt > session.startsAt + 3_600_000);
    if (after) return toSession(after.startsAt).label;
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
  }
  return toSession(session.startsAt + 7 * DAY).label;
}

const PLAYBOOK = `<show-up-playbook>
Goal: they show up to the live masterclass. A clear "yes, I'll be there" is the win.
Rulebook, non-negotiable: never pitch, never mention price, never push a call, never send a link outside the approved set in offer.md, every text under two lines (about 160 characters), sounds like a text from a friend.
Decision tree:
- Can't make it: offer the next date (given below, use it exactly, don't assume it's next week). Only if that doesn't work either, ask what day and time would be perfect for them.
- "What's this about?": one line of value and the date.
- Replied yes: confirm and hype.
- They answered "what's your main goal / what made you sign up": acknowledge it like a human, short ("Love that, that's exactly who this is built for").
- They said the one thing they want covered: confirm you'll cover it. That's an open loop you owe them.
- Answer what they actually said, short, like the approved examples. Once they're engaged, no extra push.
- They confirm they'll be there: action "committed".
- They flatly can't make it: ask what day and time would be perfect for them, action "cant_make_it".
- Plain "ok", "thanks", a thumbs up: reply "".
- STOP / remove me / unsubscribe: reply "", action "opt_out". "Wrong number" is NOT an opt-out.
- Time words must match the session: say "tonight" only on the event day before it starts.
- The thread includes our automated reminder texts. Don't repeat them.
- Never pitch, never mention the offer, never push a call. Build anticipation and accountability.
- If they shared a goal, you can tie one short tease from the nugget bank to it. People protect commitments they've stated out loud.
</show-up-playbook>`;

export const replySystem = () => `You are Bronson, answering a masterclass registrant's texts. Follow these files exactly.

${rules()}

${PLAYBOOK}

Return JSON:
- "reply": the one text to send, or "".
- "action": "committed", "cant_make_it", "opt_out" or "none".
- "preferred_time": the day/time they say would work for them, in their words, or "".
- "goal": what they want out of this (e.g. answering "what's your main goal"), in their words, or "".
- "wants_covered": what they want covered in the masterclass, in their words, or "".
- "question_to_review": if their newest text asks a real question that the approved examples in my-voice.md don't already answer, that question in their words, else "".
- "other_feedback": a real detail about their situation or an objection (work schedule, kids, money worries, past attempts), short, or "". Not a summary of what they said.
Only fill the feedback fields from their newest texts, never from earlier ones.`;

export const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["none", "committed", "cant_make_it", "opt_out"] },
    preferred_time: { type: "string" },
    goal: { type: "string" },
    wants_covered: { type: "string" },
    other_feedback: { type: "string" },
    question_to_review: { type: "string" },
  },
  required: ["reply", "action", "preferred_time", "goal", "wants_covered", "other_feedback", "question_to_review"],
  additionalProperties: false,
};

type Parsed = {
  reply: string;
  action: string;
  preferred_time: string;
  goal: string;
  wants_covered: string;
  other_feedback: string;
  question_to_review: string;
};

export const checkInSystem = () => `You are Bronson, texting a masterclass registrant a few hours before it starts. Follow these files exactly.

${rules()}

Write the 4pm check-in. It teases exactly ONE nugget from the nugget bank ("Tonight I'm breaking down the exact math on X"), never teaches it, and asks if they're still good for tonight. If they told you their goal or what they want covered, quote it back and pick the nugget that fits it best (commitment stacking). If they already committed, hold them to it. Never pitch, never mention the offer or price. Under two lines (about 160 characters), like a text from a friend. Reply with only the text message. No quotes, no notes.`;

// ---------- Registrants ----------

const registrantName = (o: { contact?: { name?: string } }, fallback: string) => o.contact?.name?.trim() || fallback;

/**
 * Keeps one Show Rate Leads row per registrant per session in step with the
 * GHL Masterclass pipeline: new registrants get a row, and once n8n moves
 * them after the event the row's Outcome becomes Showed or No show.
 */
export async function syncRegistrants(session: Session): Promise<{ added: number; outcomes: number }> {
  const rows = await getReactivationRows(OFFER, "leads");
  const latest = new Map<string, Row>();
  for (const r of rows.sort((a, b) => s(a.fields.Session).localeCompare(s(b.fields.Session)))) {
    latest.set(s(r.fields["GHL Contact ID"]), r);
  }
  let added = 0;
  let outcomes = 0;
  const cutoff = Date.now() - 14 * DAY;
  for await (const o of pipelineOpportunities(OFFER)) {
    const row = latest.get(o.contactId);
    const pending = row?.fields.Outcome === "Pending";
    if (REGISTERED.has(o.pipelineStageId)) {
      const registeredAt = o.lastStageChangeAt ?? o.createdAt;
      if (row && pending) {
        // Still registered: they roll over to the upcoming session.
        if (s(row.fields.Session) < session.date) await updateReactivationRow(OFFER, "leads", row.id, { Session: session.date });
        continue;
      }
      if (Date.parse(registeredAt) < cutoff) continue;
      if (row && s(row.fields.Session) >= session.date) continue;
      const tags = o.contact?.tags ?? [];
      await createReactivationRow(OFFER, "leads", {
        Name: registrantName(o, o.contact?.phone ?? o.contactId),
        "GHL Contact ID": o.contactId,
        Email: o.contact?.email ?? null,
        Phone: o.contact?.phone ?? null,
        Session: session.date,
        "Registered At": registeredAt,
        Source: tags.includes("masterclass paid") ? "paid" : tags.includes("masterclass organic") ? "organic" : "unknown",
        Status: "Registered",
        Outcome: "Pending",
        // Only replies after they registered get answered.
        "Last Message At": registeredAt,
      });
      added++;
    } else if (row && pending) {
      await updateReactivationRow(OFFER, "leads", row.id, {
        Outcome: o.pipelineStageId === MASTERCLASS_NO_SHOW_STAGE ? "No show" : "Showed",
      });
      outcomes++;
    }
  }
  return { added, outcomes };
}

// ---------- Replies ----------

export const appendTo = (old: unknown, add: string) => {
  const prev = s(old).trim();
  const next = add.trim();
  if (!next || prev.includes(next)) return undefined;
  return prev ? `${prev}\n${next}` : next;
};

/** Every 5 minutes: log new texts from registrants and answer them as Bronson. */
export async function runShowRateReplies(session: Session, report: RunReport): Promise<void> {
  const since = await liveSince();
  const rows = await getReactivationRows(OFFER, "leads");
  // Registrants of the upcoming session, plus last session's for a day after it.
  const fromSession = easternDay(Date.now() - 2 * DAY);
  const byContact = new Map<string, Row>();
  for (const r of rows.filter((r) => s(r.fields.Session) >= fromSession).sort((a, b) => s(a.fields.Session).localeCompare(s(b.fields.Session)))) {
    byContact.set(s(r.fields["GHL Contact ID"]), r);
  }
  const cutoff = Date.now() - DAY;

  for (const conv of await recentConversations(OFFER)) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = byContact.get(conv.contactId);
    if (!lead || lead.fields.Status === "Opted out" || conv.lastMessageDirection !== "inbound") continue;
    // No-shows belong to the no-show engine (no-show.ts) from the night of the class.
    if (lead.fields.Outcome === "No show") continue;
    // Compared to the second: Airtable may drop milliseconds.
    const handledUpTo = s(lead.fields["Last Message At"]).slice(0, 19);
    if (new Date(conv.lastMessageDate).toISOString().slice(0, 19) <= handledUpTo) continue;

    const msgs = await history(OFFER, conv.contactId);
    const fresh = msgs.filter((m) => m.direction === "inbound" && m.messageType === "TYPE_SMS" && m.dateAdded.slice(0, 19) > handledUpTo);
    if (!fresh.length) continue;
    const name = s(lead.fields.Name);
    const fields: Record<string, unknown> = { "Last Message At": fresh[fresh.length - 1].dateAdded };
    let optOut = false;
    for (const m of fresh) {
      const isStop = STOP.test(m.body ?? "");
      optOut ||= isStop;
      await createReactivationRow(OFFER, "messages", {
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
      await updateReactivationRow(OFFER, "leads", lead.id, { ...fields, Status: "Opted out", "Opted Out At": new Date().toISOString() });
      continue;
    }
    if (lead.fields.Status === "Registered") fields.Status = "Replied";

    if (since !== null && Date.parse(fresh[fresh.length - 1].dateAdded) >= since) {
      const c = await getContact(OFFER, conv.contactId);
      const timeZone = c.timezone || "America/New_York";
      const out = await generate(OFFER, {
        model: MODELS.reply,
        system: replySystem(),
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(lead)}Masterclass: ${session.label}${Date.now() > session.startsAt ? " (it has already started)" : ""}
Next date after that: ${await nextDate(session)}
Now in Eastern time: ${localTime("America/New_York")}
Their local time now: ${localTime(timeZone)}

Full text thread, oldest first:
${thread(msgs)}

Answer their latest text.`,
        purpose: "reply",
        contactId: conv.contactId,
        touch: null,
        schema: REPLY_SCHEMA,
      });
      const parsed = parseReply(out);
      if (parsed?.action === "opt_out") {
        Object.assign(fields, { Status: "Opted out", "Opted Out At": new Date().toISOString() });
      } else if (parsed) {
        const linkBlocked = Boolean(parsed.reply) && !linksOk(parsed.reply);
        if (linkBlocked) report.skipped["reply held: unapproved link"] = (report.skipped["reply held: unapproved link"] ?? 0) + 1;
        const question = parsed.question_to_review.trim() || (linkBlocked ? fresh[fresh.length - 1].body ?? "" : "");
        if (question) {
          const note = `Q: ${question} → ${linkBlocked ? "NOT SENT (unapproved link)" : `Sent: ${parsed.reply || "(no reply)"}`}`;
          const next = appendTo(lead.fields["Questions To Review"], note);
          if (next) fields["Questions To Review"] = next;
        }
        if (parsed.reply && !linkBlocked && (await trySend(OFFER, c.id, parsed.reply))) {
          await logOut(c, name, parsed.reply, null);
          fields["Last Message At"] = new Date().toISOString();
          report.replies++;
        }
        if (parsed.action === "committed") Object.assign(fields, { Status: "Committed", "Committed At": new Date().toISOString() });
        else if (parsed.action === "cant_make_it") fields.Status = "Can't make it";
        const feedback: [string, string][] = [
          ["Preferred Time", parsed.preferred_time],
          ["Goal", parsed.goal],
          ["Wants Covered", parsed.wants_covered],
          ["Other Feedback", parsed.other_feedback],
        ];
        for (const [field, value] of feedback) {
          const next = appendTo(lead.fields[field], value);
          if (next) fields[field] = next;
        }
      }
    }
    await updateReactivationRow(OFFER, "leads", lead.id, fields);
  }
}

/** What they've told us so far, for commitment stacking. */
export function statedSoFar(r: Row): string {
  const lines = [
    ["Their stated goal", s(r.fields.Goal)],
    ["What they want covered", s(r.fields["Wants Covered"])],
    ["Committed to showing up live", r.fields.Status === "Committed" ? "yes" : ""],
  ].filter(([, v]) => v);
  return lines.length ? lines.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" : "";
}

function parseReply(text: string | null): Parsed | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Parsed;
  } catch {
    return null;
  }
}

export async function logOut(c: GhlContact, name: string, body: string, touch: number | null, label?: string) {
  const now = new Date().toISOString();
  await createReactivationRow(OFFER, "messages", {
    Name: `${name} ${label ?? (touch === 1 ? "check-in" : touch === 2 ? "24h callback" : "reply")}`,
    "GHL Contact ID": c.id,
    "Lead Name": name,
    Direction: "out",
    Body: body,
    Touch: touch,
    Status: "sent",
    "Created At": now,
    "Sent At": now,
  });
}

// ---------- The 4pm check-in ----------

/**
 * Event day, 4pm ET hour: one check-in to every registrant still in (not
 * opted out, not "can't make it"), with a nugget and their goal quoted back.
 */
export async function runCheckIns(session: Session, deadline: number, report: RunReport): Promise<void> {
  const now = Date.now();
  if (easternDay(now) !== session.date || easternHour(now) !== CHECK_IN_HOUR || now > session.startsAt) return;
  if ((await liveSince()) === null) return;
  const rows = await getReactivationRows(OFFER, "leads");
  const out = new Set(["Opted out", "Can't make it"]);
  const due = rows.filter((r) => s(r.fields.Session) === session.date && !out.has(s(r.fields.Status)) && !r.fields["Check-in Sent At"]);
  for (const r of due) {
    if (Date.now() > deadline) return;
    const c = await getContact(OFFER, s(r.fields["GHL Contact ID"]));
    if (!c.phone || smsBlocked(c)) {
      report.skipped["no textable phone"] = (report.skipped["no textable phone"] ?? 0) + 1;
      continue;
    }
    const msgs = await history(OFFER, c.id);
    const body = await generate(OFFER, {
      model: MODELS.firstText,
      system: checkInSystem(),
      prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(r)}Masterclass: tonight, ${session.label}

Text thread so far, oldest first:
${thread(msgs) || "(none)"}

Write the check-in.`,
      purpose: "check_in",
      contactId: c.id,
      touch: 1,
    });
    if (!body || !linksOk(body) || !(await trySend(OFFER, c.id, body))) continue;
    const name = s(r.fields.Name);
    await logOut(c, name, body, 1);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(OFFER, "leads", r.id, { "Check-in Sent At": sentAt, "Last Message At": sentAt });
    report.firstTexts++;
  }
}

// ---------- The 24-hour callback ----------

/** WebinarJam's 1-day-before text, word for word, for people who never told us their goal. */
const WJ_24H = (first: string | null) =>
  `Hey${first ? ` ${first}` : ""}, what is the one thing you want covered in tomorrow's masterclass? We'd love to hear your thoughts so we can best help you.`;

export const callbackSystem = () => `You are Bronson, texting a masterclass registrant the day before it starts. Follow these files exactly.

${rules()}

They told you their goal. Write the 24-hour text: call their goal back in a few words ("You mentioned [their reason], that's a big part of what we're covering.") then ask the one thing they want covered tomorrow. People show up when they feel heard, not when they feel reminded. Under two lines. Never pitch. Reply with only the text message. No quotes, no notes.`;

/**
 * The 1-day-before text, sent by the engine so it can call back their goal
 * (user, 2026-10-28: "that callback is the whole game"). Off until the
 * send_24h setting is "1", which waits on the user removing WebinarJam's own
 * 1-day-before reminder so nobody gets both.
 */
export async function runCallbacks(session: Session, deadline: number, report: RunReport): Promise<void> {
  const now = Date.now();
  if (now < session.startsAt - DAY || now >= session.startsAt - DAY + 3_600_000) return;
  const settings = await getReactivationRows(OFFER, "settings");
  if (s(settings.find((r) => r.fields.Key === "send_24h")?.fields.Value).trim() !== "1") return;
  if ((await liveSince()) === null) return;
  const rows = await getReactivationRows(OFFER, "leads");
  const out = new Set(["Opted out", "Can't make it"]);
  const due = rows.filter((r) => s(r.fields.Session) === session.date && !out.has(s(r.fields.Status)) && !r.fields["24h Sent At"]);
  for (const r of due) {
    if (Date.now() > deadline) return;
    const c = await getContact(OFFER, s(r.fields["GHL Contact ID"]));
    if (!c.phone || smsBlocked(c)) continue;
    const goal = s(r.fields.Goal);
    const body = goal
      ? await generate(OFFER, {
          model: MODELS.firstText,
          system: callbackSystem(),
          prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}\nTheir stated goal: ${goal}\nMasterclass: tomorrow, ${session.label}\n\nWrite the 24-hour text.`,
          purpose: "check_in",
          contactId: c.id,
          touch: 2,
        })
      : WJ_24H(firstNameOf(c));
    if (!body || !linksOk(body) || !(await trySend(OFFER, c.id, body))) continue;
    await logOut(c, s(r.fields.Name), body, 2);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(OFFER, "leads", r.id, { "24h Sent At": sentAt, "Last Message At": sentAt });
    report.followUps++;
  }
}
