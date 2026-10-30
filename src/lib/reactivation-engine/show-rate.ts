import {
  createReactivationRow,
  getReactivationRows,
  updateReactivationRow,
} from "@/lib/airtable/reactivation";
import { firstNameOf, generate, localTime, MODELS, thread, trySend, type RunReport } from "./engine";
import {
  AVAL_MASTERCLASS_NO_SHOW_STAGE,
  AVAL_MASTERCLASS_REGISTRANTS_STAGE,
  AVAL_MASTERCLASS_SHOWED_STAGES,
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
import { AVAL_VOICE_SOP, BRONSON_VOICE_SOP, VOICES } from "./voice";
import { schedules } from "./webinarjam";

/**
 * The show-rate engine, one per offer (kits: ~/Desktop/reactivation-bronson-masterclass,
 * ~/Desktop/reactivation-aval-masterclass). Texts as the host to masterclass registrants: answers every reply to the
 * WebinarJam sequence and sends one check-in at 4pm ET on event day that
 * teases one nugget and quotes their stated goal back (commitment stacking). Saves their feedback (goal, what they want covered,
 * preferred time) for each offer's Show Rate tab. Never touches GHL stages.
 */

export type MasterclassOffer = "bronsonMasterclass" | "avalMasterclass";

type Masterclass = {
  /** Who the texts come from, first person. */
  host: string;
  signupPage: string;
  /** User, 2026-10-28: never send a link outside the approved set. */
  approvedLinks: string[];
  /** Stages that mean "registered for the upcoming session". */
  registered: Set<string>;
  noShowStage: string;
  /** Stages that mean they showed; null = any stage that isn't registered or no-show. */
  showedStages: Set<string> | null;
  /** GHL tags for the registrant's source. */
  paidTag: string;
  organicTag: string;
  /** The usual slot, for when WebinarJam and the signup page both fail: weekday (0 = Sunday), 7pm ET. */
  usualWeekday: number;
  /** Days between sessions, for the next date when WebinarJam doesn't have it yet. */
  cadenceDays: number;
  sopName: string;
  sop: string;
};

export const MASTERCLASS: Record<MasterclassOffer, Masterclass> = {
  bronsonMasterclass: {
    host: "Bronson",
    signupPage: "https://www.ad-ventur.com/masterclass",
    approvedLinks: [
      "https://event.webinarjam.com/8wgzn9/go/live/13q192tyipsxs4",
      "https://www.ad-ventur.com/masterclass",
      "https://www.youtube.com/@Bronny.builds",
      "https://www.instagram.com/bronnybuilds/",
    ],
    registered: new Set([MASTERCLASS_OPT_IN_STAGE, MASTERCLASS_VIP_STAGE]),
    noShowStage: MASTERCLASS_NO_SHOW_STAGE,
    showedStages: null,
    paidTag: "masterclass paid",
    organicTag: "masterclass organic",
    usualWeekday: 3,
    cadenceDays: 7,
    sopName: "bronson-voice-sop.md",
    sop: BRONSON_VOICE_SOP,
  },
  // User, 2026-10-29: same engines as Bronson, texting as Benicio himself.
  avalMasterclass: {
    host: "Benicio (Aval Trades)",
    signupPage: "https://www.mindovermarket.com/masterclass",
    approvedLinks: [
      "https://event.webinarjam.com/qwk59l/go/live/k50k29izins2s1",
      "https://www.mindovermarket.com/masterclass",
      "https://www.youtube.com/@AvalTrading",
      "https://www.instagram.com/avaltrades/",
    ],
    // The $27 stage is left out: buyers stay there after the session, so it can't mean "upcoming".
    registered: new Set([AVAL_MASTERCLASS_REGISTRANTS_STAGE]),
    noShowStage: AVAL_MASTERCLASS_NO_SHOW_STAGE,
    showedStages: new Set(AVAL_MASTERCLASS_SHOWED_STAGES),
    paidTag: "paid",
    organicTag: "organic",
    // Every other Sunday at 7pm ET; WebinarJam has the real dates.
    usualWeekday: 0,
    cadenceDays: 14,
    sopName: "benicio-voice-sop.md",
    sop: AVAL_VOICE_SOP,
  },
};
const DAY = 86_400_000;
/** User, 2026-10-28: "wrong number" is not an opt-out here, we remind them what they signed up for. */
export const STOP = /^\s*(stop|unsubscribe|remove me|cancel|quit|end)\b/i;
const CHECK_IN_HOUR = 16;

/** Protocol, "www.", trailing slash and trailing punctuation don't matter. */
const normLink = (l: string) => l.toLowerCase().replace(/[.,!?)]+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

/** False when a text carries any link that isn't approved; such a text is never sent. */
export function linksOk(offer: MasterclassOffer, text: string): boolean {
  // Bare domains count too ("evil.com/x"), not just https:// links.
  const links = text.match(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi) ?? [];
  return links.every((l) => MASTERCLASS[offer].approvedLinks.some((ok) => normLink(l) === normLink(ok)));
}

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
export async function liveSince(offer: MasterclassOffer, switchKey: "engine_on" | "noshow_on" = "engine_on"): Promise<number | null> {
  const rows = await getReactivationRows(offer, "settings");
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
 * time), else the usual weekday at 7pm ET. A session stays "next" until 3 hours
 * after it starts.
 */
export async function nextSession(offer: MasterclassOffer): Promise<Session> {
  const live = Date.now() - 3 * 3_600_000;
  try {
    const upcoming = (await schedules(offer)).find((sc) => sc.startsAt > live);
    if (upcoming) return toSession(upcoming.startsAt);
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
  }
  try {
    const html = await (await fetch(MASTERCLASS[offer].signupPage, { cache: "no-store" })).text();
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
  // Fallback: the usual weekday at 7pm ET.
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    const day = easternDay(now + i * DAY);
    const [y, mo, d] = day.split("-").map(Number);
    const start = easternToUtc(y, mo - 1, d, 19, 0);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === MASTERCLASS[offer].usualWeekday && start > now - 2 * 3_600_000) return toSession(start);
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

function rules(offer: MasterclassOffer): string {
  const v = VOICES[offer];
  const m = MASTERCLASS[offer];
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

<${m.sopName}>
${m.sop}
</${m.sopName}>`;
}

/** The session after this one, for "can't make it": the next one set up in WebinarJam, else the usual weekly slot. */
async function nextDate(offer: MasterclassOffer, session: Session): Promise<string> {
  try {
    const after = (await schedules(offer)).find((sc) => sc.startsAt > session.startsAt + 3_600_000);
    if (after) return toSession(after.startsAt).label;
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
  }
  return toSession(session.startsAt + MASTERCLASS[offer].cadenceDays * DAY).label;
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

export const replySystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, answering a masterclass registrant's texts. Follow these files exactly.

${rules(offer)}

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

export const checkInSystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, texting a masterclass registrant a few hours before it starts. Follow these files exactly.

${rules(offer)}

Write the 4pm check-in. It teases exactly ONE nugget from the nugget bank ("Tonight I'm breaking down the exact math on X"), never teaches it, and asks if they're still good for tonight. If they told you their goal or what they want covered, quote it back and pick the nugget that fits it best (commitment stacking). If they already committed, hold them to it. Never pitch, never mention the offer or price. Under two lines (about 160 characters), like a text from a friend. Reply with only the text message. No quotes, no notes.`;

// ---------- Registrants ----------

const registrantName = (o: { contact?: { name?: string } }, fallback: string) => o.contact?.name?.trim() || fallback;

/**
 * The pipeline's opportunities the sync needs. With named showed stages only
 * those stages are read (Aval's Webinar Pipeline holds thousands of old deals,
 * and reading all of it every 5 minutes hits GHL's rate limit).
 */
async function* syncedOpportunities(offer: MasterclassOffer) {
  const m = MASTERCLASS[offer];
  if (!m.showedStages) {
    yield* pipelineOpportunities(offer);
    return;
  }
  for (const stage of [...m.registered, m.noShowStage, ...m.showedStages]) yield* pipelineOpportunities(offer, stage);
}

/**
 * Keeps one Show Rate Leads row per registrant per session in step with the
 * GHL Masterclass pipeline: new registrants get a row, and once n8n moves
 * them after the event the row's Outcome becomes Showed or No show.
 */
export async function syncRegistrants(offer: MasterclassOffer, session: Session): Promise<{ added: number; outcomes: number }> {
  const rows = await getReactivationRows(offer, "leads");
  const latest = new Map<string, Row>();
  for (const r of rows.sort((a, b) => s(a.fields.Session).localeCompare(s(b.fields.Session)))) {
    latest.set(s(r.fields["GHL Contact ID"]), r);
  }
  let added = 0;
  let outcomes = 0;
  const cutoff = Date.now() - 14 * DAY;
  const m = MASTERCLASS[offer];
  for await (const o of syncedOpportunities(offer)) {
    const row = latest.get(o.contactId);
    const pending = row?.fields.Outcome === "Pending";
    if (m.registered.has(o.pipelineStageId)) {
      const registeredAt = o.lastStageChangeAt ?? o.createdAt;
      if (row && pending) {
        // Still registered: they roll over to the upcoming session.
        if (s(row.fields.Session) < session.date) await updateReactivationRow(offer, "leads", row.id, { Session: session.date });
        continue;
      }
      if (Date.parse(registeredAt) < cutoff) continue;
      if (row && s(row.fields.Session) >= session.date) continue;
      const tags = o.contact?.tags ?? [];
      await createReactivationRow(offer, "leads", {
        Name: registrantName(o, o.contact?.phone ?? o.contactId),
        "GHL Contact ID": o.contactId,
        Email: o.contact?.email ?? null,
        Phone: o.contact?.phone ?? null,
        Session: session.date,
        "Registered At": registeredAt,
        Source: tags.includes(m.paidTag) ? "paid" : tags.includes(m.organicTag) ? "organic" : "unknown",
        Status: "Registered",
        Outcome: "Pending",
        // Only replies after they registered get answered.
        "Last Message At": registeredAt,
      });
      added++;
    } else if (row && pending && (o.pipelineStageId === m.noShowStage || !m.showedStages || m.showedStages.has(o.pipelineStageId))) {
      await updateReactivationRow(offer, "leads", row.id, {
        Outcome: o.pipelineStageId === m.noShowStage ? "No show" : "Showed",
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

/** Every 5 minutes: log new texts from registrants and answer them as the host. */
export async function runShowRateReplies(offer: MasterclassOffer, session: Session, report: RunReport): Promise<void> {
  const since = await liveSince(offer);
  const rows = await getReactivationRows(offer, "leads");
  // Registrants of the upcoming session, plus last session's for a day after it.
  const fromSession = easternDay(Date.now() - 2 * DAY);
  const byContact = new Map<string, Row>();
  for (const r of rows.filter((r) => s(r.fields.Session) >= fromSession).sort((a, b) => s(a.fields.Session).localeCompare(s(b.fields.Session)))) {
    byContact.set(s(r.fields["GHL Contact ID"]), r);
  }
  // Two days, so replies that came in during a 24-hour SMS limit pause still get answered.
  const cutoff = Date.now() - 2 * DAY;

  for (const conv of await recentConversations(offer)) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = byContact.get(conv.contactId);
    if (!lead || lead.fields.Status === "Opted out" || conv.lastMessageDirection !== "inbound") continue;
    // No-shows belong to the no-show engine (no-show.ts) from the night of the class.
    if (lead.fields.Outcome === "No show") continue;
    // Compared to the second: Airtable may drop milliseconds.
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
      await updateReactivationRow(offer, "leads", lead.id, { ...fields, Status: "Opted out", "Opted Out At": new Date().toISOString() });
      continue;
    }
    if (lead.fields.Status === "Registered") fields.Status = "Replied";

    if (since !== null && Date.parse(fresh[fresh.length - 1].dateAdded) >= since) {
      const c = await getContact(offer, conv.contactId);
      const timeZone = c.timezone || "America/New_York";
      const out = await generate(offer, {
        model: MODELS.reply,
        system: replySystem(offer),
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(lead)}Masterclass: ${session.label}${Date.now() > session.startsAt ? " (it has already started)" : ""}
Next date after that: ${await nextDate(offer, session)}
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
        const linkBlocked = Boolean(parsed.reply) && !linksOk(offer, parsed.reply);
        if (linkBlocked) report.skipped["reply held: unapproved link"] = (report.skipped["reply held: unapproved link"] ?? 0) + 1;
        const question = parsed.question_to_review.trim() || (linkBlocked ? fresh[fresh.length - 1].body ?? "" : "");
        if (question) {
          const note = `Q: ${question} → ${linkBlocked ? "NOT SENT (unapproved link)" : `Sent: ${parsed.reply || "(no reply)"}`}`;
          const next = appendTo(lead.fields["Questions To Review"], note);
          if (next) fields["Questions To Review"] = next;
        }
        if (parsed.reply && !linkBlocked && (await trySend(offer, c.id, parsed.reply))) {
          await logOut(offer, c, name, parsed.reply, null);
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
    await updateReactivationRow(offer, "leads", lead.id, fields);
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

export async function logOut(offer: MasterclassOffer, c: GhlContact, name: string, body: string, touch: number | null, label?: string) {
  const now = new Date().toISOString();
  await createReactivationRow(offer, "messages", {
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
export async function runCheckIns(offer: MasterclassOffer, session: Session, deadline: number, report: RunReport): Promise<void> {
  const now = Date.now();
  if (easternDay(now) !== session.date || easternHour(now) !== CHECK_IN_HOUR || now > session.startsAt) return;
  if ((await liveSince(offer)) === null) return;
  const rows = await getReactivationRows(offer, "leads");
  const out = new Set(["Opted out", "Can't make it"]);
  const due = rows.filter((r) => s(r.fields.Session) === session.date && !out.has(s(r.fields.Status)) && !r.fields["Check-in Sent At"]);
  for (const r of due) {
    if (Date.now() > deadline) return;
    const c = await getContact(offer, s(r.fields["GHL Contact ID"]));
    if (!c.phone || smsBlocked(c)) {
      report.skipped["no textable phone"] = (report.skipped["no textable phone"] ?? 0) + 1;
      continue;
    }
    const msgs = await history(offer, c.id);
    const body = await generate(offer, {
      model: MODELS.firstText,
      system: checkInSystem(offer),
      prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(r)}Masterclass: tonight, ${session.label}

Text thread so far, oldest first:
${thread(msgs) || "(none)"}

Write the check-in.`,
      purpose: "check_in",
      contactId: c.id,
      touch: 1,
    });
    if (!body || !linksOk(offer, body) || !(await trySend(offer, c.id, body))) continue;
    const name = s(r.fields.Name);
    await logOut(offer, c, name, body, 1);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(offer, "leads", r.id, { "Check-in Sent At": sentAt, "Last Message At": sentAt });
    report.firstTexts++;
  }
}

// ---------- The 24-hour callback ----------

/** WebinarJam's 1-day-before text, word for word, for people who never told us their goal. */
const WJ_24H = (first: string | null) =>
  `Hey${first ? ` ${first}` : ""}, what is the one thing you want covered in tomorrow's masterclass? We'd love to hear your thoughts so we can best help you.`;

export const callbackSystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, texting a masterclass registrant the day before it starts. Follow these files exactly.

${rules(offer)}

They told you their goal. Write the 24-hour text: call their goal back in a few words ("You mentioned [their reason], that's a big part of what we're covering.") then ask the one thing they want covered tomorrow. People show up when they feel heard, not when they feel reminded. Under two lines. Never pitch. Reply with only the text message. No quotes, no notes.`;

/**
 * The 1-day-before text, sent by the engine so it can call back their goal
 * (user, 2026-10-28: "that callback is the whole game"). Off until the
 * send_24h setting is "1", which waits on the user removing WebinarJam's own
 * 1-day-before reminder so nobody gets both.
 */
export async function runCallbacks(offer: MasterclassOffer, session: Session, deadline: number, report: RunReport): Promise<void> {
  const now = Date.now();
  if (now < session.startsAt - DAY || now >= session.startsAt - DAY + 3_600_000) return;
  const settings = await getReactivationRows(offer, "settings");
  if (s(settings.find((r) => r.fields.Key === "send_24h")?.fields.Value).trim() !== "1") return;
  if ((await liveSince(offer)) === null) return;
  const rows = await getReactivationRows(offer, "leads");
  const out = new Set(["Opted out", "Can't make it"]);
  const due = rows.filter((r) => s(r.fields.Session) === session.date && !out.has(s(r.fields.Status)) && !r.fields["24h Sent At"]);
  for (const r of due) {
    if (Date.now() > deadline) return;
    const c = await getContact(offer, s(r.fields["GHL Contact ID"]));
    if (!c.phone || smsBlocked(c)) continue;
    const goal = s(r.fields.Goal);
    const body = goal
      ? await generate(offer, {
          model: MODELS.firstText,
          system: callbackSystem(offer),
          prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}\nTheir stated goal: ${goal}\nMasterclass: tomorrow, ${session.label}\n\nWrite the 24-hour text.`,
          purpose: "check_in",
          contactId: c.id,
          touch: 2,
        })
      : WJ_24H(firstNameOf(c));
    if (!body || !linksOk(offer, body) || !(await trySend(offer, c.id, body))) continue;
    await logOut(offer, c, s(r.fields.Name), body, 2);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(offer, "leads", r.id, { "24h Sent At": sentAt, "Last Message At": sentAt });
    report.followUps++;
  }
}
