import {
  createReactivationRow,
  getReactivationRows,
  updateReactivationRow,
} from "@/lib/airtable/reactivation";
import { firstNameOf, generate, localTime, MODELS, thread, trySend, type RunReport } from "./engine";
import {
  flagReview,
  flagSalesCall,
  ghlTeam,
  GHL_OFFERS,
  replyLine,
  ROEZAN_SMS,
  type Line,
  AVAL_MASTERCLASS_NO_SHOW_STAGE,
  AVAL_MASTERCLASS_REGISTRANTS_STAGE,
  AVAL_MASTERCLASS_SHOWED_STAGES,
  BRONSON_MASTERCLASS_NO_SHOW_STAGE,
  BRONSON_MASTERCLASS_OPT_IN_STAGE,
  BRONSON_MASTERCLASS_SHOWED_STAGES,
  getContact,
  history,
  pipelineOpportunities,
  type GhlOpportunity,
  recentConversations,
  smsBlocked,
  type GhlContact,
} from "./ghl";
import { AVAL_VOICE_SOP, BRONSON_VOICE_SOP, VOICES } from "./voice";
import { schedules } from "./webinarjam";
import { airtableListFresh } from "@/lib/airtable/client";
import { getBookingsMade } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { staleWhileRevalidate } from "@/lib/swr-cache";
import { AVAL_LESSONS, BRONSON_LESSONS } from "./lessons";
import { CONVERSATION_RULES, correctionDelayMs, exactQuote, explicitOptOut, finalize, headsUpGiven, humanTextAfter, partDelayMs, sessionTimes, toParts } from "./guards";
import { BRONSON_DECK } from "./bronson-deck";

/**
 * The show-rate engine, one per offer (kits: ~/Desktop/reactivation-bronson-masterclass,
 * ~/Desktop/reactivation-aval-masterclass). Texts as the host to masterclass registrants: answers every reply to the
 * WebinarJam sequence (the 4pm event-day check-in was removed by the user on 2026-11-06). Saves their feedback (goal, what they want covered,
 * preferred time) for each offer's Show Rate tab. Never touches GHL stages.
 */

export type MasterclassOffer = "bronsonMasterclass" | "avalMasterclass";

type Masterclass = {
  /** Who the texts come from, first person. */
  host: string;
  signupPage: string;
  /** User, 2026-10-28: never send a link outside the approved set. */
  approvedLinks: string[];
  /** Where registrants sit: named stages of the offer's pipeline. */
  stages: { registered: Set<string>; noShowStage: string; showedStages: Set<string> };
  /** GHL tags for the registrant's source. */
  paidTag: string;
  organicTag: string;
  /** The usual slot, for when WebinarJam and the signup page both fail: weekday (0 = Sunday), 7pm ET. */
  usualWeekday: number;
  /** Days between sessions, for the next date when WebinarJam doesn't have it yet. */
  cadenceDays: number;
  /** Sent when someone asks for the questionnaire or application; must also be in approvedLinks. */
  questionnaire?: string;
  /** What the team calls it ("questionnaire", "intake form"). */
  questionnaireName?: string;
  /** Setters who text the same leads, so a reply to them goes to a setter, not the bot. */
  setterNames: string[];
  /** How the host reacts to a stated goal, in their own words (true details only). */
  goalExamples: string;
  /** User, 2026-11-05: the free prep doc, offered with "i can send it here, right?" and sent only on a yes. */
  prepDoc?: string;
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
      // The questionnaire (user, 2026-11-04).
      "https://form.typeform.com/to/h5RJJ0d7",
      "https://www.ad-ventur.com/masterclass-prep",
    ],
    // User, 2026-11-09: registrants are back in the main Masterclass pipeline (date pipelines removed).
    // The $27 stage is left out: buyers stay there after the session, so it can't mean "upcoming".
    stages: {
      registered: new Set([BRONSON_MASTERCLASS_OPT_IN_STAGE]),
      noShowStage: BRONSON_MASTERCLASS_NO_SHOW_STAGE,
      showedStages: new Set(BRONSON_MASTERCLASS_SHOWED_STAGES),
    },
    paidTag: "masterclass paid",
    organicTag: "masterclass organic",
    usualWeekday: 1,
    cadenceDays: 7,
    prepDoc: "https://www.ad-ventur.com/masterclass-prep",
    questionnaire: "https://form.typeform.com/to/h5RJJ0d7",
    questionnaireName: "questionnaire",
    setterNames: ["Ewan", "Kendyl"],
    goalExamples: `Bronson's own examples:
  "Get rich" -> "So am I haha. Is that the only goal you have, or what are you envisioning for yourself with this?"
  "Time and financial freedom leading to generational wealth" -> "I respect that a lot. That was a big thing for me too, since I was working with construction when I first started. For your first goals since they are time and financial freedom, out of curiosity what does that look like for you specifically?"
  "I'm trying to get out of car sales and be more present with my family" -> "I respect that a lot. Family is one of my personal core values, and I'm very glad I've been able to be more present myself because of e-com. Planning on showing you the same in the masterclass"
  "My main goal is to be able to gain enough flexibility to attend to my future family and kids" + "Also my goal is to continue to grow as a business women and give back to the community I choose to reside" -> "I respect that a lot. Family is one of my core values too, and e-com is what let me be more present myself. In what way would you want to give back?" (the follow-up asks about the thing they said, in plain words; never a question that twists it)`,
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
      // User, 2026-11-06: the intake form registrants fill out before the masterclass.
      "https://mind-over-market.typeform.com/to/vDBXuzzK",
      "https://www.mindovermarket.com/masterclass-prep",
    ],
    // The $27 stage is left out: buyers stay there after the session, so it can't mean "upcoming".
    stages: {
      registered: new Set([AVAL_MASTERCLASS_REGISTRANTS_STAGE]),
      noShowStage: AVAL_MASTERCLASS_NO_SHOW_STAGE,
      showedStages: new Set(AVAL_MASTERCLASS_SHOWED_STAGES),
    },
    paidTag: "paid",
    organicTag: "organic",
    // Every other Sunday at 7pm ET; WebinarJam has the real dates.
    usualWeekday: 0,
    cadenceDays: 14,
    questionnaire: "https://mind-over-market.typeform.com/to/vDBXuzzK",
    questionnaireName: "intake form",
    // User, 2026-11-06: the page goes up at this URL; send it either way.
    prepDoc: "https://www.mindovermarket.com/masterclass-prep",
    // Read live from GHL instead (teamLine): the location's users and the lead's assigned setter.
    setterNames: [],
    // No examples in Benicio's own words yet: react plainly, no borrowed stories.
    goalExamples: "",
    sopName: "benicio-voice-sop.md",
    sop: AVAL_VOICE_SOP,
  },
};
const DAY = 86_400_000;
/** STOP keywords at the start. "Wrong number" and other stop phrases anywhere: guards.ts explicitOptOut (user, 2026-11-10). */
export const STOP = /^\s*(stop|unsubscribe|remove me|cancel|quit|end)\b/i;

/** User, 2026-11-05: how every text is shaped, for the show-up and no-show engines. */
export const TEXT_SHAPE = `<text-shape>
- One idea per text. Texts don't have sections. If a reply needs a second idea (e.g. confirm their seat, then ask about the prep doc), put a blank line between them: each part goes out as its own text, in order. Never more than three (user, 2026-11-10); two is often enough.
- Questions end in an easy yes: "right?", "yeah?", "want me to send it?". No open-ended questions early in the flow. The approved open questions stay (the goal follow-up, "what day and time would be perfect for you?").
- Their name: only in the first text you ever send them and in a recovery ping (texting first after they've gone quiet: a no-show night-of or push #1). Never in replies. A name in every text reads as mail-merge.
</text-shape>`;

/** User, 2026-11-05: one idea per text. A blank line in a reply means two texts, sent in order. */
export const splitTexts = (reply: string) => reply.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).slice(0, 2);

/** The goal-reply examples, or plain guidance when the host has none yet. */
function goalExamples(offer: MasterclassOffer): string {
  return MASTERCLASS[offer].goalExamples || "  (No examples in the host's own words yet. React plainly to what they said and ask one plain follow-up about it. Don't add a personal story unless it's in the voice or offer files.)";
}

/** Who "my team" is when a lead replies to a setter. */
export function setterPhrase(offer: MasterclassOffer): string {
  const names = MASTERCLASS[offer].setterNames;
  return names.length ? `a setter like ${names.join(" or ")}` : "a setter or anyone else on my team, named in the lead details";
}

/** Sending the questionnaire, or handing the ask to a setter when there is none. */
export function questionnaireRule(offer: MasterclassOffer): string {
  const { questionnaire: q, questionnaireName: n = "questionnaire" } = MASTERCLASS[offer];
  return q
    ? `- Asking for the ${n} (or a questionnaire, application or form to fill out before the class): send it, ${q} (e.g. "here you go, here's the ${n}: ${q}"). This link is approved even if offer.md doesn't list it.`
    : `- Asking for the questionnaire or application: reply "", action "sales_call", call_request "wants the application". A setter sends it.`;
}

/**
 * For offers with no fixed setter list (Aval): the team names from GHL and the lead's assigned setter,
 * so a reply meant for one of them goes to a setter instead of the bot. Cached for an hour.
 */
export async function teamLine(offer: MasterclassOffer, c: GhlContact): Promise<string> {
  if (MASTERCLASS[offer].setterNames.length) return "";
  try {
    const team = await staleWhileRevalidate(`ghl-team:${offer}:v1`, () => ghlTeam(offer), 3600, 7 * 24 * 3600);
    const assigned = c.assignedTo ? team[c.assignedTo] : undefined;
    return `My team (setters who may text this lead): ${Object.values(team).join(", ") || "(none listed)"}${assigned ? `. Their assigned setter: ${assigned}` : ""}\n`;
  } catch (e) {
    console.error("show-rate: couldn't read the GHL team", e);
    return "";
  }
}

/** The prep doc rule, for offers that have one. */
export function prepDocRule(offer: MasterclassOffer, when: string): string {
  const doc = MASTERCLASS[offer].prepDoc;
  if (!doc) return "";
  return `- The free masterclass prep doc (user, 2026-11-05): ${when}, and nobody in the thread has offered it yet, ask if this is a good place to send it, always framed as "i can do this here, right?" (e.g. "i can send you the free masterclass prep doc here, right?"; in a closing reply, no question mark: "i can send you the free masterclass prep doc here too, just say the word"). Only when they say yes (or ask for it), send it: ${doc} (e.g. "here you go ${doc}"). Never send the link before they say yes. A yes to the prep doc is not a yes to showing up.`;
}

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
/**
 * The upcoming (or just-started) session, from WebinarJam only. User, 2026-11-10: "if WebinarJam says one thing,
 * that's what it is, no matter what". No signup page date, no guessed weekday (a page date told 73 leads Nov 18
 * when WebinarJam had Monday Nov 16). null when WebinarJam has none or can't be read: the show-up engine waits.
 */
export async function nextSession(offer: MasterclassOffer): Promise<Session | null> {
  const live = Date.now() - 3 * 3_600_000;
  try {
    const upcoming = (await schedules(offer)).find((sc) => sc.startsAt > live);
    return upcoming ? toSession(upcoming.startsAt) : null;
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
    return null;
  }
}

/** The date on the masterclass signup page (user: it shows the current date and time), or null. */
export async function signupPageDate(offer: MasterclassOffer): Promise<number | null> {
  try {
    const html = await (await fetch(MASTERCLASS[offer].signupPage, { cache: "no-store" })).text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ");
    const m = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2})\s*·?\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*E[SD]?T/i
    );
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (!m || month < 0) return null;
    const hour = (Number(m[3]) % 12) + (m[5].toUpperCase() === "PM" ? 12 : 0);
    let year = Number(easternDay(Date.now()).slice(0, 4));
    // A January date read in December is next year.
    if (easternToUtc(year, month, Number(m[2]), hour, Number(m[4] ?? 0)) < Date.now() - 60 * DAY) year++;
    return easternToUtc(year, month, Number(m[2]), hour, Number(m[4] ?? 0));
  } catch (e) {
    console.error("show-rate: couldn't read the masterclass date", e);
    return null;
  }
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

/** User, 2026-11-04: answer Roezan replies through Roezan. Off until the setting roezan_replies is "1" (tested first). */
export async function roezanRepliesOn(offer: MasterclassOffer): Promise<boolean> {
  const settings = await getReactivationRows(offer, "settings");
  return s(settings.find((r) => r.fields.Key === "roezan_replies")?.fields.Value).trim() === "1";
}

/** Texts the engine starts go out on Roezan where the offer has it: registrants have only ever heard from that number. */
const startLine = (offer: MasterclassOffer): Line => (GHL_OFFERS[offer].roezanProvider ? "roezan" : "ghl");

// ---------- Booked sales calls ----------

const BRONSON_BASE = "appiMw8gpaLv2WITA";
const BRONSON_BOOKINGS = "tblLZwboT5tfhq3H5"; // Calendly gameplan bookings (n8n 27mSFVcr9fHHm5uC)

/**
 * User, 2026-11-03: anyone who booked a sales call in the last 30 days belongs to the
 * setters and closers, so the masterclass engines never text them ("just let them be").
 * Canceled bookings count too: rebooking them is the setters' job. Contact IDs and emails,
 * since a booking can land on a duplicate contact. Aval (2026-11-06): its Calendly sales-call bookings, by email.
 */
export async function bookedCall(offer: MasterclassOffer): Promise<(r: Row) => boolean> {
  if (offer === "avalMasterclass") {
    const emails = new Set(await avalBookedEmails());
    return (r) => emails.has(s(r.fields.Email).trim().toLowerCase());
  }
  const since = Date.now() - 30 * DAY;
  const rows = (await airtableListFresh(BRONSON_BASE, BRONSON_BOOKINGS)).filter((b) => Date.parse(s(b.fields["Booked At"])) >= since);
  const ids = new Set(rows.map((b) => s(b.fields["Contact ID"])).filter(Boolean));
  const emails = new Set(rows.map((b) => s(b.fields.Email).trim().toLowerCase()).filter(Boolean));
  return (r) => ids.has(s(r.fields["GHL Contact ID"])) || emails.has(s(r.fields.Email).trim().toLowerCase());
}

/** Emails with an Aval Calendly sales call booked in the last 30 days (canceled too), re-read every 10 minutes. */
function avalBookedEmails(): Promise<string[]> {
  return staleWhileRevalidate(
    "aval-booked-call-emails:v1",
    async () => {
      const made = await getBookingsMade({ ...(await calendlyFor("aval")), from: easternDay(Date.now() - 30 * DAY), to: easternDay(Date.now()) });
      return [...new Set(made.flatMap((b) => (b.inviteeEmail ? [b.inviteeEmail.trim().toLowerCase()] : [])))];
    },
    600,
    24 * 60 * 60
  );
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

/**
 * The session after this one, for "can't make it": the next one set up in WebinarJam, else the signup page's date.
 * Never a guess (2026-11-05: a "+7 days" guess told six people Nov 11 when the next one was Nov 18).
 */
export const NO_DATE_YET = "not set yet. Don't name a day or date: say you'll text them the date as soon as it's set, and ask if you can save them a seat";
async function nextDate(offer: MasterclassOffer, session: Session): Promise<string> {
  try {
    const after = (await schedules(offer)).find((sc) => sc.startsAt > session.startsAt + 3_600_000);
    if (after) return toSession(after.startsAt).label;
  } catch (e) {
    console.error("show-rate: couldn't read WebinarJam sessions", e);
  }
  // WebinarJam only (user, 2026-11-10): no signup page date.
  return NO_DATE_YET;
}

const playbook = (offer: MasterclassOffer) => `<show-up-playbook>
Goal: they show up to the live masterclass. A clear "yes, I'll be there" is the win.
Rulebook, non-negotiable: never pitch, never mention price, never push a call, never send a link outside the approved set in offer.md, every text under two lines (about 160 characters), sounds like a text from a friend.
Decision tree:
- Can't make it: offer the next date (given below, use it exactly, don't assume it's next week). Only if that doesn't work either, ask what day and time would be perfect for them.
- "What's this about?": one line of value and the date.
- Replied yes: confirm and hype.
- They answered "what's your main goal / what made you sign up": text like a real 20-something, not a copywriter. React to what they actually said, then (above all when it's short or vague) ask one curious follow-up so they open up more. Never a tagline or a polished line: no "Love that, that's exactly who this is built for", nothing like "monthly income that stacks is what changed it for me".
${goalExamples(offer)}
  Only use personal details that are true for you (these examples, or the voice and offer files); if nothing true connects, skip the personal part. These may run to three lines.
- Their goal is confusing or doesn't fit what we teach (e.g. "Selling the products I already use and encourage clients to purchase for better health"): don't continue it. Reply "" and put their text in "question_to_review".
- They answered your follow-up about their goal: short, real reaction, and tie it to the masterclass. No new question.
- They said the one thing they want covered: confirm you'll cover it. That's an open loop you owe them.
- Answer what they actually said, short, like the approved examples. Once they're engaged, no extra push.
- They confirm they'll be there: action "committed".
- They flatly can't make it: ask what day and time would be perfect for them, action "cant_make_it".
- Plain "ok", "thanks", a thumbs up: reply "".
- STOP / remove me / unsubscribe / wrong number / a flat "not interested": reply "", action "opt_out".
- Never promise to check on something or get back to them ("let me check", "I'll get back to you"): nobody follows up on those. If you can't answer it yourself, reply "" and put their question in "question_to_review".
${questionnaireRule(offer)}
- Anything about a 1-on-1 or sales call (booking, rescheduling or cancelling a call or meeting, wanting to talk to someone, "call me"), or a reply to someone from my team (${setterPhrase(offer)}) about a call: reply "", action "sales_call", and say what they want in "call_request". A setter picks it up.
- Time words must match the session: say "tonight" only on the event day before it starts.
- The thread includes our automated reminder texts. Don't repeat them.
- Never pitch, never mention the offer, never push a call. Build anticipation and accountability.
- If they shared a goal, you can tie one short tease from the nugget bank to it. People protect commitments they've stated out loud.
${prepDocRule(offer, "Before the masterclass starts, once you've answered their text (most often their first \"yes\" to the seat text)")}
</show-up-playbook>

${TEXT_SHAPE}`;

/** Bronson's masterclass deck facts plus the simulated-lead test loop's lessons (lessons.ts), for the reply prompts. */
export function lessonsBlock(offer: MasterclassOffer): string {
  const l = offer === "avalMasterclass" ? AVAL_LESSONS : BRONSON_LESSONS;
  // Bronson's deck facts (bronson-deck.ts) go first, so the lessons still win where they conflict.
  const deck = offer === "bronsonMasterclass" ? `${BRONSON_DECK}\n\n` : "";
  return `${deck}<lessons-from-testing>\nThese override anything above where they conflict.\n${l}\n</lessons-from-testing>\n\n`;
}

export const replySystem = (offer: MasterclassOffer) => `You are ${MASTERCLASS[offer].host}, answering a masterclass registrant's texts. Follow these files exactly.

${rules(offer)}

${playbook(offer)}

${CONVERSATION_RULES}

<reminder-heads-up>
After their first clear yes, if the lead details say reminders are still coming and no text of ours already told them, you may use the second text for "btw, you'll get a couple reminders before the class too" (match the count: one reminder vs a couple). Once per class, never on every goodbye, and only when the prep doc ask isn't in this reply. Reminders still coming 0 or not given: never mention more texts or reminders. If they can't make it but reminders are still coming and the class is still ahead, you may say they could still get reminders in case their schedule opens up.
</reminder-heads-up>

${lessonsBlock(offer)}Return JSON:
- "reply": the text to send (up to three texts split by blank lines, one idea each; a planted-typo fix on its own last line), or "".
- "close_exchange": true or false.
- "action": "committed", "cant_make_it", "opt_out", "sales_call" or "none".
- "committed_to": with "committed", "this_session" (the masterclass above) or "next_session" (the next date after it), else "".
- "call_request": with "sales_call", what they want about the call, short (e.g. "wants to reschedule tomorrow's call earlier"), else "".
- "preferred_time": the day/time they say would work for them, in their words, or "".
- "goal": what they want out of this (e.g. answering "what's your main goal"), in their words, or "".
- "wants_covered": what they want covered in the masterclass, in their words, or "".
- "question_to_review": if their newest text asks a real question that the approved examples in my-voice.md don't already answer, that question in their words, else "".
- "other_feedback": a real detail about their situation or an objection (work schedule, kids, money worries, past attempts), short, or "". Not a summary of what they said.
- "confidence": a number from 0 to 1.
- "uncertainties": an array of strings, or [].
Only fill the feedback fields from their newest texts, never from earlier ones.`;

export const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["none", "committed", "cant_make_it", "opt_out", "sales_call"] },
    committed_to: { type: "string", enum: ["", "this_session", "next_session"] },
    close_exchange: { type: "boolean" },
    call_request: { type: "string" },
    preferred_time: { type: "string" },
    goal: { type: "string" },
    wants_covered: { type: "string" },
    other_feedback: { type: "string" },
    question_to_review: { type: "string" },
    confidence: { type: "number" },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "action", "committed_to", "close_exchange", "call_request", "preferred_time", "goal", "wants_covered", "other_feedback", "question_to_review", "confidence", "uncertainties"],
  additionalProperties: false,
};

type Parsed = {
  reply: string;
  action: string;
  committed_to?: string;
  close_exchange?: boolean;
  confidence?: number;
  uncertainties?: string[];
  call_request: string;
  preferred_time: string;
  goal: string;
  wants_covered: string;
  other_feedback: string;
  question_to_review: string;
};

// ---------- Registrants ----------

const registrantName = (o: { contact?: { name?: string } }, fallback: string) => o.contact?.name?.trim() || fallback;

type Synced = { o: GhlOpportunity; kind: "registered" | "noShow" | "showed" };

/**
 * The opportunities the sync needs, stage by stage (Aval's Webinar Pipeline holds
 * thousands of old deals, and reading all of it every 5 minutes hits GHL's rate limit).
 */
async function* syncedOpportunities(offer: MasterclassOffer): AsyncGenerator<Synced> {
  const st = MASTERCLASS[offer].stages;
  for (const stage of st.registered) for await (const o of pipelineOpportunities(offer, stage)) yield { o, kind: "registered" };
  for await (const o of pipelineOpportunities(offer, st.noShowStage)) yield { o, kind: "noShow" };
  for (const stage of st.showedStages) for await (const o of pipelineOpportunities(offer, stage)) yield { o, kind: "showed" };
}

/**
 * Keeps one Show Rate Leads row per registrant per session in step with GHL:
 * new registrants get a row, and once n8n moves them after the event the row's
 * Outcome becomes Showed or No show.
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
  for await (const { o, kind } of syncedOpportunities(offer)) {
    const row = latest.get(o.contactId);
    const pending = row?.fields.Outcome === "Pending";
    if (kind === "registered") {
      const forSession = session.date;
      const registeredAt = o.lastStageChangeAt ?? o.createdAt;
      if (row && pending) {
        // Still registered: they roll over to the upcoming session.
        // A new date means an old yes or no doesn't carry over (kit rule): back to Replied for the new class.
        if (s(row.fields.Session) < forSession) {
          const carried = row.fields.Status === "Committed" || row.fields.Status === "Can't make it";
          await updateReactivationRow(offer, "leads", row.id, { Session: forSession, ...(carried ? { Status: "Replied", "Committed At": null } : {}) });
        }
        continue;
      }
      if (Date.parse(registeredAt) < cutoff) continue;
      if (row && s(row.fields.Session) >= forSession) continue;
      const tags = o.contact?.tags ?? [];
      await createReactivationRow(offer, "leads", {
        Name: registrantName(o, o.contact?.phone ?? o.contactId),
        "GHL Contact ID": o.contactId,
        Email: o.contact?.email ?? null,
        Phone: o.contact?.phone ?? null,
        Session: forSession,
        "Registered At": registeredAt,
        Source: tags.includes(m.paidTag) ? "paid" : tags.includes(m.organicTag) ? "organic" : "unknown",
        Status: "Registered",
        Outcome: "Pending",
        // Only replies after they registered get answered.
        "Last Message At": registeredAt,
      });
      added++;
    } else if (row && pending) {
      await updateReactivationRow(offer, "leads", row.id, { Outcome: kind === "noShow" ? "No show" : "Showed" });
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
export async function runShowRateReplies(offer: MasterclassOffer, session: Session, report: RunReport, catchUp = false): Promise<void> {
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

  const booked = await bookedCall(offer);
  const roezanOn = await roezanRepliesOn(offer);

  // Catch-up (run by hand): every lead, not just the 100 newest threads, whatever came last in the thread.
  const convs = catchUp
    ? [...byContact.keys()].map((contactId) => ({ contactId, lastMessageDate: Date.now(), lastMessageDirection: "inbound" }))
    : await recentConversations(offer);
  for (const conv of convs) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = byContact.get(conv.contactId);
    if (!lead || lead.fields.Status === "Opted out" || conv.lastMessageDirection !== "inbound" || booked(lead)) continue;
    // No-shows belong to the no-show engine (no-show.ts) from the night of the class.
    if (lead.fields.Outcome === "No show") continue;
    // Compared to the second: Airtable may drop milliseconds.
    const handledUpTo = s(lead.fields["Last Message At"]).slice(0, 19);
    if (new Date(conv.lastMessageDate).toISOString().slice(0, 19) <= handledUpTo) continue;

    // A catch-up walks every lead, deleted GHL contacts included: skip those.
    const msgs = await history(offer, conv.contactId).catch((e) => {
      if (catchUp) return null;
      throw e;
    });
    if (!msgs) continue;
    const fresh = msgs.filter((m) => m.direction === "inbound" && (m.messageType === "TYPE_SMS" || m.messageType === ROEZAN_SMS) && m.dateAdded.slice(0, 19) > handledUpTo);
    if (!fresh.length) continue;
    if (catchUp && Date.parse(fresh[fresh.length - 1].dateAdded) < Date.now() - 3 * DAY) continue;
    const line = replyLine(offer, fresh);
    if (!line || (line === "roezan" && !roezanOn)) continue;
    const name = s(lead.fields.Name);
    const fields: Record<string, unknown> = { "Last Message At": fresh[fresh.length - 1].dateAdded };
    let optOut = false;
    for (const m of fresh) {
      const isStop = STOP.test(m.body ?? "") || explicitOptOut(m.body ?? "");
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
    // Kit rule: a setter's own text or an earlier held reply means a person owns this lead. Opt-outs above still count.
    const setterText = humanTextAfter(msgs, handledUpTo, ["TYPE_SMS", ROEZAN_SMS]);
    if (setterText) {
      const next = appendTo(lead.fields["Human Hold"], `Setter texted them ${setterText.dateAdded.slice(0, 16)}Z: "${(setterText.body ?? "").slice(0, 120)}"`);
      if (next) fields["Human Hold"] = next;
    }
    if (setterText || s(lead.fields["Human Hold"]).trim()) {
      report.skipped["human hold: team owns it"] = (report.skipped["human hold: team owns it"] ?? 0) + 1;
      await updateReactivationRow(offer, "leads", lead.id, fields);
      continue;
    }

    if (since !== null && Date.parse(fresh[fresh.length - 1].dateAdded) >= since) {
      const c = await getContact(offer, conv.contactId);
      const timeZone = c.timezone || "America/New_York";
      const remindersLeft = remindersRemaining(session.startsAt);
      const sinceSession = session.startsAt - 14 * DAY;
      const headsUp = headsUpGiven(msgs.filter((m) => m.direction !== "inbound" && Date.parse(m.dateAdded) > sinceSession).map((m) => m.body ?? ""));
      const out = await generate(offer, {
        model: MODELS.reply,
        system: replySystem(offer),
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
${statedSoFar(lead)}${await teamLine(offer, c)}Masterclass: ${session.label}${Date.now() > session.startsAt ? " (it has already started)" : ""}
Masterclass start by time zone (use these, never convert yourself): ${sessionTimes(session.startsAt, c.timezone)}
Reminder texts still coming before it: ${remindersLeft}${headsUp ? " (we already told them reminders are coming, don't say it again)" : ""}
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
      const latestText = fresh[fresh.length - 1].body ?? "";
      const inboundText = fresh.map((m) => m.body ?? "").join("\n");
      let held: string[] = [];
      if (parsed) {
        const g = finalize({
          reply: parsed.reply,
          action: parsed.action,
          latestInbound: latestText,
          remindersRemaining: remindersLeft,
          closeExchange: parsed.close_exchange,
          confidence: parsed.confidence,
          uncertainties: parsed.uncertainties,
          ourTexts: msgs.filter((m) => m.direction === "outbound").map((m) => m.body ?? ""),
        });
        parsed.reply = g.reply;
        parsed.action = g.action;
        held = g.held;
        for (const k of ["preferred_time", "goal", "wants_covered", "other_feedback"] as const) parsed[k] = exactQuote(parsed[k] ?? "", inboundText);
      }
      if (parsed?.action === "opt_out") {
        Object.assign(fields, { Status: "Opted out", "Opted Out At": new Date().toISOString() });
      } else if (parsed?.action === "sales_call") {
        await flagSalesCall(offer, c, parsed.call_request, fresh.map((m) => m.body ?? "").join(" / "));
        report.skipped["sales call: sent to setter"] = (report.skipped["sales call: sent to setter"] ?? 0) + 1;
      } else if (parsed) {
        const linkBlocked = Boolean(parsed.reply) && !linksOk(offer, parsed.reply);
        if (linkBlocked) report.skipped["reply held: unapproved link"] = (report.skipped["reply held: unapproved link"] ?? 0) + 1;
        const question = parsed.question_to_review.trim() || (linkBlocked || held.length ? latestText : "");
        const notes: string[] = [];
        if (question) notes.push(`Q: ${question} → ${linkBlocked ? "NOT SENT (unapproved link)" : held.length ? `NOT SENT (${held.join("; ")})` : `Sent: ${parsed.reply || "(no reply)"}`}`);
        for (const note of notes) {
          const next = appendTo(fields["Questions To Review"] ?? lead.fields["Questions To Review"], note);
          if (next) fields["Questions To Review"] = next;
        }
        if (held.length || linkBlocked) {
          // Kit rule: a held reply goes to a person, and the lead stays theirs until Human Hold is cleared.
          const reason = linkBlocked ? "unapproved link" : held.join("; ");
          fields["Human Hold"] = appendTo(lead.fields["Human Hold"], `Reply held ${new Date().toISOString().slice(0, 16)}Z: ${reason}`) ?? s(lead.fields["Human Hold"]);
          await flagReview(offer, c, reason, latestText).catch((e) => console.error("show-rate: review alert failed", e));
          report.skipped["reply held: sent to a person"] = (report.skipped["reply held: sent to a person"] ?? 0) + 1;
          parsed.action = "none";
        }
        if (parsed.reply && !linkBlocked) {
          const sent = await sendParts(offer, c, name, parsed.reply, line, fresh[fresh.length - 1].dateAdded);
          if (sent) {
            fields["Last Message At"] = new Date().toISOString();
            report.replies++;
          }
        }
        // Said they can't make this one, then yes to the next date (2026-11-05: Tia, Selina): save that seat and keep
        // them off the no-show texts, instead of marking them committed to the class they already said they'd miss.
        // committed_to tells a yes to the next date apart from a change of heart about this one (kit: a later yes recommits the same class).
        if (parsed.action === "committed" && (parsed.committed_to === "next_session" || (s(lead.fields.Status) === "Can't make it" && parsed.committed_to !== "this_session"))) fields["No-show Status"] = "Seat Pending";
        else if (parsed.action === "committed") Object.assign(fields, { Status: "Committed", "Committed At": new Date().toISOString() });
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

/** Our automated reminder texts before a class (user, 2026-11-06: 2 days, 1 day, 7 hours, 1 hour and 1 minute before). */
const REMINDER_OFFSETS = [2 * DAY, DAY, 7 * 3_600_000, 3_600_000, 60_000];
export const remindersRemaining = (startsAt: number, now = Date.now()) => REMINDER_OFFSETS.filter((o) => startsAt - o > now).length;

/**
 * Sends a finalized reply as up to three texts in order (logged as ours). A planted-typo fix follows its text
 * after 2 to 3 seconds; other follow-on texts wait a reading pause and stop if they texted again meanwhile.
 */
export async function sendParts(offer: MasterclassOffer, c: GhlContact, name: string, reply: string, line: Line, lastInboundAt: string, label?: string): Promise<number> {
  let sent = 0;
  for (const part of toParts(reply)) {
    if (sent && part.kind === "correction") await new Promise((r) => setTimeout(r, correctionDelayMs()));
    else if (sent && !(await stillCurrent(offer, c.id, lastInboundAt, part.text))) break;
    if (!(await trySend(offer, c.id, part.text, line))) break;
    await logOut(offer, c, name, part.text, null, label);
    sent++;
  }
  return sent;
}

/**
 * Before a follow-on text: wait a reading-speed pause, then make sure no new text came in meanwhile
 * (the kit's stale-context check). A new inbound cancels the rest; the next run answers it fresh.
 */
export async function stillCurrent(offer: MasterclassOffer, contactId: string, lastInboundAt: string, nextPart: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, partDelayMs(nextPart)));
  try {
    const msgs = await history(offer, contactId);
    return !msgs.some((m) => m.direction === "inbound" && m.dateAdded.slice(0, 19) > lastInboundAt.slice(0, 19));
  } catch {
    return true;
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
  const booked = await bookedCall(offer);
  const due = rows.filter((r) => s(r.fields.Session) === session.date && !out.has(s(r.fields.Status)) && !booked(r) && !r.fields["24h Sent At"]);
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
    if (!body || !linksOk(offer, body) || !(await trySend(offer, c.id, body, startLine(offer)))) continue;
    await logOut(offer, c, s(r.fields.Name), body, 2);
    const sentAt = new Date().toISOString();
    await updateReactivationRow(offer, "leads", r.id, { "24h Sent At": sentAt, "Last Message At": sentAt });
    report.followUps++;
  }
}
