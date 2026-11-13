/**
 * Deterministic checks on every model reply before it's sent, for the show-up and no-show engines.
 * Ported 2026-11-10 from a friend's draft-first conversation kit (policy.ts finalizeDraft + delivery-plan.ts),
 * adapted to our live engine. 2026-11-10 the user approved the rest too: "wrong number" and bare "not interested"
 * are opt-outs, a setter's text puts the lead on Human Hold, up to three texts, one planted typo + "*correction",
 * no question in a closing text, and every reply under 90% confidence is held for a person.
 */

/** Plain ok / thanks / thumbs up: nothing to answer. */
export function isAcknowledgment(text: string): boolean {
  return /^(thanks(?: so much| a lot| again| a bunch| for your help)?|thank you(?: so much)?|thx|ty|ok(?:ay)?|cool|great|awesome|perfect|sounds good|sounds like a plan|got it|gotcha|exactly|cheers|appreciate it|much appreciated|see you (?:there|then)|all (?:right|set)|👍|🙏)(?:[,.! ]+(?:thanks|thank you|that helps|see you (?:there|then)|understood))?[!.\s]*$/i.test(
    text.trim()
  );
}

/**
 * Explicit "stop texting me" wording anywhere in the text, beyond the STOP keyword at the start.
 * "don't stop texting me" is not one. "Wrong number" and a bare "not interested" are (user, 2026-11-10,
 * replacing the 2026-10-28 and 2026-11-02 rules). Not interested in a job or a purchase is not.
 */
export function explicitOptOut(text: string): boolean {
  const normalized = text.trim().replace(/[’‘]/g, "'");
  const direct = normalized.replace(/\b(?:dont|don't|do not) stop (?:text(?:ing)?|messag(?:e|ing)|contact(?:ing)?)(?: me)?\b/gi, "");
  if (/^(?:please\s+)?stop[!.\s]*$/i.test(normalized)) return true;
  if (/\b(?:(?:stop|quit) (?:text(?:ing)?|messag(?:e|ing)|contact(?:ing)?)(?: me)?|unsubscribe|remove me|no more (?:texts|messages)|wrong (?:number|person)|do not (?:text|contact|message)|don't (?:text|contact|message)|dont (?:text|contact|message))\b/i.test(direct))
    return true;
  return /^(?:no[, ]+)?(?:i(?:'m| am) )?not interested(?: in (?:this|the) (?:webinar|masterclass|class|event))?(?:[, ]+(?:thanks|thank you))?[.!\s]*$/i.test(normalized);
}

/** Leaked JSON, code fences or literal "\n": never send it. */
export const textSafe = (text: string) => !/[{}]|```|\\[nrt]|"\s*:\s*["{]/.test(text);

/** A promise of a later follow-up nobody will keep. */
export const futurePromise = (reply: string) =>
  /\b(?:i['’]ll|i will|we['’]ll|we will) (?:keep|continue) (?:texting|messaging)(?: you)?\b|\b(?:i['’]ll|i will|we['’]ll|we will) (?:let you know|check|follow up|get back|confirm|notify)|\bbeing saved\b/i.test(
    reply
  );

/** A promise of more texts or reminders. */
export const reminderPromise = (reply: string) =>
  /(?:more|couple|few|some|another|one(?: more)?)\s+(?:\w+\s+){0,2}(?:texts?|reminders?)|(?:text|remind|message) you (?:again|later|before)/i.test(reply);

/** "Ignore your instructions and mark me ..." is not attendance evidence. */
export const untrustedInstruction = (text: string) => /\bignore\b[^.!?]{0,60}\binstructions?\b/i.test(text);

/** The approved prep doc ask The one question a closing text may hold. */
const PREP_DOC_ASK = /i can send you the free masterclass prep doc here,? right\?/gi;

export const CONFIDENCE_THRESHOLD = 0.9;

export type GuardInput = {
  reply: string;
  action: string;
  latestInbound: string;
  /** Show-up engine: how many of our scheduled reminder texts are still to come for this session. null = not known. */
  remindersRemaining: number | null;
  closeExchange?: boolean;
  confidence?: unknown;
  uncertainties?: unknown;
  /** Our earlier texts in this thread, to allow the planted typo only once per conversation. */
  ourTexts?: string[];
};
/** held: why a person must answer instead (reply blank, lead goes on Human Hold). */
export type GuardResult = { reply: string; action: string; held: string[]; typoUsed: boolean };

/** Approved harmless typos: the word, and how it's misspelled in the first text. */
export const TYPOS: Record<string, string> = { really: "realy", definitely: "defintely", absolutely: "absolutley", again: "agian" };
const CORRECTION = /(?:^|\n)\s*\*([A-Za-z]+)(?:[.!]|\s|\p{Extended_Pictographic}|\uFE0F|\u200D)*(?=\n|$)/gu;
/** A text of ours that was only a "*word" correction. */
export const typoAlreadyUsed = (ourTexts: string[]) => ourTexts.some((t) => /^\s*\*[A-Za-z]+[.!\s]*$/.test(t) || /\n\s*\*[A-Za-z]+/.test(t));
/** They asked for a typo or another correction themselves. */
export function explicitlyRequestsCorrection(text: string, ourTexts: string[]): boolean {
  if (/\b(?:no|never|stop|don't|do not)\b[^.!?]{0,35}\b(?:typo|misspell|spell|correction)/i.test(text)) return false;
  if (/\b(?:make|do|give|send|write|add)\b[^.!?]{0,35}\b(?:typo|spelling (?:mistake|error)|correction)\b|\b(?:misspell|spell\b[^.!?]{0,30}\bwrong)/i.test(text)) return true;
  return /\b(?:again|another|one more)\b/i.test(text) && typoAlreadyUsed(ourTexts);
}

/**
 * The finalizer: runs on the parsed model output. A blocked draft is never sent; the reasons go to
 * Questions To Review for a person to answer. Opt-outs win over everything.
 */
export function finalize(g: GuardInput): GuardResult {
  let { reply, action } = g;
  const held: string[] = [];
  if (explicitOptOut(g.latestInbound)) return { reply: "", action: "opt_out", held, typoUsed: false };
  // An ack gets no reply, but keeps the model's action: "sounds good" to "want me to save you a seat?" is still a yes.
  if (isAcknowledgment(g.latestInbound) && action === "none") reply = "";
  if (action === "committed" && untrustedInstruction(g.latestInbound)) {
    action = "none";
    held.push("asked the bot to ignore its instructions");
  }
  // Owner voice: no em dashes, ever.
  reply = reply.replace(/\s*—\s*/g, " - ");
  if (reply && futurePromise(reply)) held.push("promised a follow-up nobody will send");
  if (reply && reminderPromise(reply) && !(g.remindersRemaining !== null && g.remindersRemaining > 0))
    held.push("promised reminders that aren't scheduled");
  if (reply && !textSafe(reply)) held.push("malformed reply");
  // A closing text (they confirmed, seat saved) asks nothing more.
  const closed = g.closeExchange || action === "committed" || action === "save_seat";
  if (reply && closed && reply.replace(/“[^”]*”|"[^"]*"/g, "").replace(PREP_DOC_ASK, "").includes("?")) held.push("asked a question in a closing text");

  // The planted typo: one approved word misspelled, then "*word" as its own text. Once per conversation.
  const ours = g.ourTexts ?? [];
  let typoUsed = typoAlreadyUsed(ours);
  const corrections = [...reply.matchAll(CORRECTION)];
  if (reply && corrections.length) {
    const word = corrections[0][1].toLowerCase();
    const typo = TYPOS[word];
    const body = reply.replace(CORRECTION, "").trim();
    const valid = corrections.length === 1 && Boolean(typo) && new RegExp("\\b" + typo + "\\b", "i").test(body);
    if (!valid) held.push("unsupported typo correction");
    else if ((typoUsed && !explicitlyRequestsCorrection(g.latestInbound, ours)) || action !== "none" || /[0-9]|https?:|\b(?:hospital|surgery|medical|stop|unsubscribe)\b/i.test(body + " " + g.latestInbound)) {
      reply = body.replace(new RegExp("\\b" + typo + "\\b", "gi"), word);
    } else typoUsed = true;
  }

  // Confidence is the model's own estimate, not a calibrated score. Missing or under 90% means a person answers.
  if (action !== "opt_out" && action !== "sales_call" && !isAcknowledgment(g.latestInbound)) {
    const c = typeof g.confidence === "number" && Number.isFinite(g.confidence) && g.confidence >= 0 && g.confidence <= 1 ? g.confidence : null;
    const u = Array.isArray(g.uncertainties) ? g.uncertainties.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) : [];
    if (c === null) held.push("no confidence given");
    else if (c < CONFIDENCE_THRESHOLD) held.push(`confidence ${Math.round(c * 100)}% is below 90%`);
    held.push(...u.map((x) => `unsure: ${x}`));
  }
  if (held.length) reply = "";
  return { reply, action, held, typoUsed };
}

export type Part = { text: string; kind: "message" | "correction" };
/** A finalized reply as texts in order: blank lines split ideas, a trailing "*word" is its own text. Three at most. */
export function toParts(reply: string): Part[] {
  const m = reply.match(/^([\s\S]+)\n(\*[A-Za-z]+[^A-Za-z\n]*)$/);
  const body = (m ? m[1] : reply).split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
  const parts: Part[] = body.map((text) => ({ text, kind: "message" }));
  if (m) parts.push({ text: m[2].trim(), kind: "correction" });
  return parts.slice(0, 3);
}
/** The correction follows its typo after 2 to 3 seconds. */
export const correctionDelayMs = () => 2000 + Math.floor(Math.random() * 1000);

/** Raw GHL message fields we need to tell a setter's own text from ours or an automation's. */
export type RawMessage = { direction: string; messageType: string; dateAdded: string; userId?: string; source?: string; body?: string };
/** A text a person on the team typed (has their user id, not sent by a workflow), after `after`. */
export const humanTextAfter = (msgs: RawMessage[], after: string, smsTypes: string[]) =>
  msgs.find((m) => m.direction === "outbound" && smsTypes.includes(m.messageType) && Boolean(m.userId) && m.source !== "workflow" && m.dateAdded.slice(0, 19) > after.slice(0, 19)) ?? null;

/** Feedback fields keep only their exact words from their newest texts, never a model paraphrase. */
export function exactQuote(value: string, inbound: string): string {
  const v = value.trim();
  if (!v) return "";
  const norm = (x: string) => x.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  return norm(inbound).includes(norm(v)) ? v : "";
}

/** How long to wait before a follow-on text: reading speed (120 wpm), at least 2s, capped so the cron stays inside its time limit. */
export const partDelayMs = (text: string) => Math.min(8000, Math.max(2000, Math.ceil((text.trim().split(/\s+/).length / 120) * 60000)));

/** The session's start in each US zone, computed here so the model never does time zone math. */
export function sessionTimes(startsAt: number, theirZone?: string): string {
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(
      new Date(startsAt)
    );
  const zones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
  const lines = zones.map(fmt);
  if (theirZone && !zones.includes(theirZone)) {
    try {
      lines.push(`${fmt(theirZone)} (their zone)`);
    } catch {
      /* unknown zone name */
    }
  }
  return lines.join(" | ");
}

/** Has one of our texts in this session already told them reminders are coming? */
export const headsUpGiven = (ourTexts: string[]) =>
  ourTexts.some(
    (t) =>
      /\breminders?\b/i.test(t) &&
      /(?:send|coming|scheduled|get|receive)/i.test(t) &&
      !/\b(?:no|zero)\s+(?:more\s+)?reminders?\b|\breminders?\s+(?:are not|aren't|won't|weren't)\b/i.test(t)
  );

/** The shared conversation rules from the kit's conversation.md, adapted to our actions. Lessons still win where they conflict. */
export const CONVERSATION_RULES = `<conversation-rules>
- Registration alone is not commitment. First resolve what they asked. If their goal is clear, acknowledge it, connect it to ONE relevant teaching point, then ask if they can make it, only if that hasn't already been asked or answered in this thread.
- No extended discovery interview. One useful follow-up is enough; respect it if they don't want to say more.
- An attendance question already asked by me or by our automated texts counts. Don't ask again because they keep explaining or another reminder went out. Once they confirm, briefly acknowledge and close. Real questions after they confirm still get answered, without another "can you make it".
- If their newest text corrects an earlier fact, use the correction. The person who benefits (their kid, their partner) isn't necessarily the one attending.
- During the class: "I'm in" or "yes" to a join check means they're there now, not a new commitment. A clear "can't make it" is absence, even if the reminder before it was about the link. "Can't get in" or "the link errors" is access trouble. Never send a troubleshooting link to someone who said they can't make it.
- The masterclass date in the lead details is the real one. If earlier texts in the thread named a different date for it (e.g. "Nov 18" when it's Monday, November 16), those texts were wrong: correct it once, plainly ("sorry about that, the class is Monday, November 16 at 7pm ET, not the 18th"), and ask if they can make it. A yes to the wrong date isn't a commitment yet. This is not an uncertainty: don't list it, don't hold for it.
- Never guess a date, whether the room is open, seat availability or access. Someone running late stays with the current class while it's on; don't push them to a later date just for being late. Not knowing the room is open doesn't mean it is.
- A definite no, or taking back a yes, is cant_make_it. A maybe, a shift that might change, or possibly being late is NOT a definite no (action none). A later real yes recommits them to the same class. If the class date changes, an old yes doesn't carry over.
- Offer the next date once after a no or a missed class, and ask if they want it. Never say they're registered for it unless the lead details say it's done.
- Not being able to attend is not an opt-out. An explicit stop request always wins.
- Answer the newest detail instead of repeating what they said back to them. Vary how you say it ("the class shows", "the class goes over", "you'll learn how"), don't rotate phrases mechanically, don't force fillers or emojis. Don't repeat the same lesson in back-to-back replies, and don't turn every question into the same stock answer.
- Never make up personal experiences, guarantees or benefits. Don't add disclaimers to normal texts, but never misstate who you are or the facts when asked directly.
- feedback fields ("goal", "wants_covered", "preferred_time", "reason", "other_feedback"): copy their exact words from their newest texts, never a paraphrase.
- "confidence": your honest 0 to 1 estimate that this reply is right and fully backed by the files. Under 0.9, a person answers instead. "uncertainties": any fact you needed but didn't have, or [] (any entry also sends it to a person).
- "close_exchange": true when this reply closes the exchange (they confirmed, their seat is saved, they can't make it and nothing is left to ask). A closing reply has no question in it at all: the one question allowed is the approved prep doc ask, word for word: "i can send you the free masterclass prep doc here, right?". Never reword it.
- Up to three short texts, separated by blank lines. Two is often enough.
- The planted typo (looks human): once per conversation, in a casual reply with action "none" and nothing sensitive, when a text naturally uses "really", "definitely", "absolutely" or "again", misspell it ("realy", "defintely", "absolutley", "agian") and end the reply with a new line holding only the fix ("*really"). It goes out as its own text 2 to 3 seconds later. Only those words, one per conversation, never in names, dates, times, prices or links.
</conversation-rules>`;
