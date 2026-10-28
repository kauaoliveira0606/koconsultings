import Anthropic from "@anthropic-ai/sdk";
import {
  createReactivationRow,
  getReactivationRows,
  getReactivationSettings,
  setReactivationSetting,
  updateReactivationRow,
  type ReactivationOffer,
} from "@/lib/airtable/reactivation";
import {
  flagBooked,
  getContact,
  history,
  inBlockedStage,
  markFailed,
  smsBlocked,
  markTexted,
  pipelineLeads,
  recentConversations,
  sendSms,
  type GhlContact,
  type GhlMessage,
} from "./ghl";
import { VOICES } from "./voice";

/**
 * The reactivation engine (BUILD.md phase 3 of each offer's kit). Texts cold
 * leads from the offer's GHL pipeline, answers their replies, marks bookings.
 * Every Claude call is logged with its cost, and the offer's Reactivation tab
 * reads the same tables. Aval and Bronson each have their own voice, tables,
 * pipeline and settings.
 */

const DAY = 86_400_000;
const STOP = /^\s*(stop|unsubscribe|remove me|wrong number|cancel|quit|end)\b/i;
/** BUILD.md: sonnet writes first texts, opus handles replies. */
const MODELS = { firstText: "claude-sonnet-5-5", reply: "claude-opus-5-5" } as const;
/** Per million tokens; cache writes cost 1.25x input. */
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
};

// ---------- Claude, with every call costed ----------

// Made on first use: the SDK throws at construction when ANTHROPIC_API_KEY is missing.
let client: Anthropic | null = null;

type Purpose = "first_text" | "follow_up" | "reply";

async function generate(offer: ReactivationOffer, opts: {
  model: string;
  system: string;
  prompt: string;
  purpose: Purpose;
  contactId: string;
  touch: number | null;
  schema?: Record<string, unknown>;
}): Promise<string | null> {
  client ??= new Anthropic();
  const res = await client.beta.messages.create({
    model: opts.model,
    max_tokens: 16000,
    // Same system prompt for every lead, so it is cached after the first call.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.schema ? { output_config: { format: { type: "json_schema", schema: opts.schema } } } : {}),
    betas: ["server-side-fallback-2026-07-01"],
    // On a policy decline the API reruns the request on Anthropic's recommended model.
    fallbacks: "default",
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);

  const u = res.usage;
  const p = PRICES[res.model] ?? PRICES[opts.model];
  const cost =
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.in * 1.25) /
    1_000_000;
  await createReactivationRow(offer, "aiCalls", {
    Name: `${opts.purpose} ${opts.contactId}`,
    "GHL Contact ID": opts.contactId,
    Touch: opts.touch,
    Purpose: opts.purpose,
    Model: res.model,
    "Tokens In": u.input_tokens,
    "Tokens Out": u.output_tokens,
    "Cache Read Tokens": u.cache_read_input_tokens ?? 0,
    "Cache Write Tokens": u.cache_creation_input_tokens ?? 0,
    "Cost USD": cost,
    "Stop Reason": res.stop_reason,
    "Created At": new Date().toISOString(),
  });

  if (res.stop_reason === "refusal") return null;
  const text = res.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  return text ? text.replace(/\s*—\s*/g, ", ") : null;
}

function rules(offer: ReactivationOffer): string {
  const v = VOICES[offer];
  return `${v.names}
Where my-voice.md disagrees with voice.md or the reply playbook, my-voice.md wins.

<voice.md>
${v.voice}
</voice.md>

<my-voice.md>
${v.myVoice}
</my-voice.md>

<offer.md>
${v.offer}
</offer.md>`;
}

const firstTextSystem = (offer: ReactivationOffer) => `You write texts to leads who signed up a while back and went cold. Follow these files exactly.

${rules(offer)}

Reply with only the text message. No quotes, no notes.`;

const replySystem = (offer: ReactivationOffer) => `You answer a lead's texts. The goal is a booked call time. Follow these files exactly.

${rules(offer)}

<reply-playbook.md>
${VOICES[offer].replyPlaybook}
</reply-playbook.md>

A flat no beats every rule above, including "not right now" in my-voice.md (user, 2026-10-28): when they clearly turn it down ("no thank you", "not interested", "I don't want to pay", "I'll pass"), it is a dead lead. Never push the call, never argue, never restate the offer. Send nothing: "reply" is "" and "action" is "not_now". "Not right now" / "busy" / "later" are not a no; keep booking those.

Return JSON:
- "reply": the text to send, or "" when the playbook says to say nothing.
- "action": "booked" when they locked a call time (or said call me now), "not_now" when they want to be left alone for now, "opt_out" for STOP / remove me / wrong number, otherwise "none".
- "booked_for": the time they gave in their words (e.g. "today at 3pm", "in 2 hours", "now"), or "".`;

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["none", "booked", "not_now", "opt_out"] },
    booked_for: { type: "string" },
  },
  required: ["reply", "action", "booked_for"],
  additionalProperties: false,
};

// ---------- Time zones: when a lead may be texted ----------

/** Single time zone countries by calling code, for leads GHL has no time zone for. */
const COUNTRY_TZ: [string, string][] = [
  ["+44", "Europe/London"],
  ["+353", "Europe/Dublin"],
  ["+63", "Asia/Manila"],
  ["+65", "Asia/Singapore"],
  ["+60", "Asia/Kuala_Lumpur"],
  ["+49", "Europe/Berlin"],
  ["+33", "Europe/Paris"],
  ["+34", "Europe/Madrid"],
  ["+39", "Europe/Rome"],
  ["+31", "Europe/Amsterdam"],
  ["+64", "Pacific/Auckland"],
];

/** Africa +20 +21x-26x +27 +290 +291; Middle East +90 +961-968 +970-974 +98. */
const AFRICA_MIDDLE_EAST = "20|2[1-6]\\d|27|29[01]|90|96[1-8]|97[0-4]|98";

const SEND_RULES: Record<
  ReactivationOffer,
  { blockedCountries: RegExp; usEastern: boolean; usHours: [number, number]; hours: [number, number]; autoOff: boolean }
> = {
  // User, 2026-10-28: never text African, Indian, Pakistani/South Asian or Middle Eastern numbers.
  // US (+1) numbers 9am to 10pm Eastern; everyone else 9am to 9pm their own time.
  aval: {
    blockedCountries: new RegExp(`^\\+(${AFRICA_MIDDLE_EAST}|9[1-4]|880|977)`),
    usEastern: true,
    usHours: [9, 22],
    hours: [9, 21],
    // User, 2026-10-28: never shut Aval off by itself either.
    autoOff: false,
  },
  // User, 2026-10-28: never text Middle Eastern or African numbers.
  // BUILD.md default: 9am to 8pm in the lead's own time zone.
  bronson: {
    blockedCountries: new RegExp(`^\\+(${AFRICA_MIDDLE_EAST})`),
    usEastern: false,
    usHours: [9, 20],
    hours: [9, 20],
    // User, 2026-10-28: never shut Bronson off by itself.
    autoOff: false,
  },
};

type SendWindow = { timeZone: string; from: number; to: number };

export function sendWindow(offer: ReactivationOffer, c: Pick<GhlContact, "timezone" | "phone">): SendWindow | null {
  const r = SEND_RULES[offer];
  const phone = c.phone ?? "";
  if (phone.startsWith("+1")) {
    const timeZone = (r.usEastern ? null : c.timezone) || "America/New_York";
    return { timeZone, from: r.usHours[0], to: r.usHours[1] };
  }
  if (r.blockedCountries.test(phone)) return null;
  const timeZone = c.timezone || COUNTRY_TZ.find(([code]) => phone.startsWith(code))?.[1];
  return timeZone ? { timeZone, from: r.hours[0], to: r.hours[1] } : null;
}

export function inWindow(w: SendWindow, now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: w.timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= w.from && hour < w.to;
}

function localTime(timeZone: string): string {
  return new Date().toLocaleString("en-US", { timeZone, weekday: "long", hour: "numeric", minute: "2-digit" });
}

// ---------- Who to text ----------

/** A real-looking number: +1 needs a valid area code and exchange. */
function textable(phone: string | undefined): boolean {
  if (!phone) return false;
  if (phone.startsWith("+1")) return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone);
  return /^\+\d{8,15}$/.test(phone);
}

/**
 * BUILD.md "who to text", plus the user's blocked stages. The daily cap is
 * counted by the caller. Drafts skip the send-hours check: they go out later.
 */
async function skipReason(offer: ReactivationOffer, c: GhlContact, ignoreHours = false): Promise<string | null> {
  if (!textable(c.phone)) return "no valid phone";
  if (SEND_RULES[offer].blockedCountries.test(c.phone!)) return "blocked country";
  if (smsBlocked(c)) return "DND";
  // Cold means the reps have had their week with them.
  if (Date.now() - Date.parse(c.dateAdded) < 7 * DAY) return "signed up under 7 days ago";
  const w = sendWindow(offer, c);
  if (!w) return "unknown time zone";
  if (!ignoreHours && !inWindow(w)) return "outside send hours";
  if (await inBlockedStage(offer, c.id)) return "blocked stage";
  const msgs = await history(offer, c.id);
  if (msgs.some((m) => m.direction === "inbound" && STOP.test(m.body ?? ""))) return "said STOP";
  const recentRep = msgs.some(
    (m) =>
      m.direction === "outbound" &&
      (m.messageType === "TYPE_SMS" || m.messageType === "TYPE_CALL") &&
      Date.now() - Date.parse(m.dateAdded) < 7 * DAY
  );
  return recentRep ? "rep text or call in the last 7 days" : null;
}

const PERMANENT_SKIPS = new Set(["no valid phone", "blocked country", "blocked stage", "said STOP"]);

// ---------- Airtable rows ----------

type Row = { id: string; fields: Record<string, unknown> };
const s = (v: unknown) => (typeof v === "string" ? v : "");
const easternDay = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** The single-contact endpoint has no contactName, so build it from first + last. */
const fullName = (c: GhlContact) =>
  c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.phone || c.id;
const firstNameOf = (c: GhlContact) => {
  const n = c.firstName?.trim().split(/\s+/)[0] ?? "";
  return /^[a-z][a-z'-]+$/i.test(n) && !/^(ok|affiliate|test)$/i.test(n) ? n : null;
};

async function logSent(offer: ReactivationOffer, lead: Row | null, c: GhlContact, body: string, touch: number | null) {
  const now = new Date().toISOString();
  const name = s(lead?.fields.Name) || fullName(c);
  await createReactivationRow(offer, "messages", {
    Name: `${name} ${touch ? `#${touch}` : "reply"}`,
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

/** Sends, and returns false (instead of throwing) so failures can trip the safety switch. */
async function trySend(offer: ReactivationOffer, contactId: string, body: string): Promise<boolean> {
  try {
    await sendSms(offer, contactId, body);
    return true;
  } catch (e) {
    console.error("reactivation send failed", contactId, e);
    return false;
  }
}

// ---------- The runs ----------

export type RunReport = { firstTexts: number; followUps: number; replies: number; skipped: Record<string, number>; off?: string };

/**
 * Texts: approved drafts, then due follow-ups, then new first texts up to the
 * daily cap (first texts only). Stops at `deadline` so the run
 * ends inside Vercel's time limit; the next run picks up where it left off.
 */
export async function runSends(
  offer: ReactivationOffer,
  scanNew: boolean,
  deadline: number,
  report: RunReport
): Promise<void> {
  const settings = await getReactivationSettings(offer);
  if (!settings.engineOn) return;
  const leads = await getReactivationRows(offer, "leads");
  const messages = await getReactivationRows(offer, "messages");
  const leadById = new Map(leads.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const today = easternDay(new Date());
  const sentOut = messages.filter((m) => m.fields.Direction === "out" && m.fields.Status === "sent");
  let firstToday = sentOut.filter((m) => m.fields.Touch === 1 && easternDay(s(m.fields["Sent At"])) === today).length;
  let failsInARow = 0;

  async function send(c: GhlContact, body: string, touch: number, draftId?: string): Promise<boolean> {
    const ok = await trySend(offer, c.id, body);
    const lead = leadById.get(c.id) ?? null;
    const now = new Date().toISOString();
    if (draftId) await updateReactivationRow(offer, "messages", draftId, ok ? { Status: "sent", "Sent At": now } : { Status: "failed" });
    else if (ok) await logSent(offer, lead, c, body, touch);
    if (!ok) {
      if (await markFailed(offer, c.id).catch((e) => (console.error("reactivation move to failed stage failed", c.id, e), false))) {
        if (lead) await updateReactivationRow(offer, "leads", lead.id, { Status: "Skipped" });
        else await createReactivationRow(offer, "leads", { Name: c.contactName || c.phone || c.id, "GHL Contact ID": c.id, Phone: c.phone ?? null, Status: "Skipped" });
      }
      if (++failsInARow >= 3 && SEND_RULES[offer].autoOff) {
        report.off = "3 texts in a row failed to send";
        await turnOff(offer, report.off);
      }
      return false;
    }
    failsInARow = 0;
    const fields: Record<string, unknown> = { "Last Message At": now };
    if (touch === 1) {
      Object.assign(fields, { Status: "Texted", "First Texted At": now });
      await markTexted(offer, c.id).catch((e) => console.error("reactivation GHL tag/stage failed", c.id, e));
    }
    if (lead) await updateReactivationRow(offer, "leads", lead.id, fields);
    else
      await createReactivationRow(offer, "leads", {
        Name: fullName(c),
        "GHL Contact ID": c.id,
        Email: c.email ?? null,
        Phone: c.phone ?? null,
        Timezone: sendWindow(offer, c)?.timeZone ?? null,
        DND: false,
        Buyer: false,
        ...fields,
      });
    return true;
  }

  // 1. Drafts approved in chat or on the dashboard.
  for (const d of messages.filter((m) => m.fields.Status === "approved" && m.fields.Direction === "out")) {
    if (report.off || firstToday >= settings.dailyCap || Date.now() > deadline) break;
    const c = await getContact(offer, s(d.fields["GHL Contact ID"]));
    const why = await skipReason(offer, c);
    if (why) {
      report.skipped[`draft: ${why}`] = (report.skipped[`draft: ${why}`] ?? 0) + 1;
      continue;
    }
    if (await send(c, s(d.fields.Body), Number(d.fields.Touch) || 1, d.id)) {
      firstToday++;
      report.firstTexts++;
    }
  }

  // 2. Follow-ups: max 2 more, 3 days apart, only if they never replied.
  for (const lead of leads.filter((l) => l.fields.Status === "Texted")) {
    if (report.off || Date.now() > deadline) return;
    const id = s(lead.fields["GHL Contact ID"]);
    const mine = sentOut.filter((m) => m.fields["GHL Contact ID"] === id).sort((a, b) => s(a.fields["Sent At"]).localeCompare(s(b.fields["Sent At"])));
    const last = mine[mine.length - 1];
    const touch = Math.max(...mine.map((m) => Number(m.fields.Touch) || 1)) + 1;
    if (!last || touch > 3 || Date.now() - Date.parse(s(last.fields["Sent At"])) < 3 * DAY) continue;
    const c = await getContact(offer, id);
    const w = sendWindow(offer, c);
    if (smsBlocked(c) || !w || !inWindow(w)) continue;
    const body = await generate(offer, {
      model: MODELS.firstText,
      system: firstTextSystem(offer),
      prompt: `Write follow-up #${touch} of 3${touch === 3 ? " (the last one)" : ""} to a lead who never replied. Use a different angle from the earlier texts.
Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
Earlier texts we sent:
${mine.map((m) => `- ${s(m.fields.Body)}`).join("\n")}`,
      purpose: "follow_up",
      contactId: id,
      touch,
    });
    if (body && (await send(c, body, touch))) report.followUps++;
  }

  // 3. New first texts, newest cold leads first.
  if (!scanNew || firstToday >= settings.dailyCap) return;
  for await (const c of coldLeads(offer, new Set(leadById.keys()), report, () => !report.off && firstToday < settings.dailyCap && Date.now() <= deadline)) {
    const body = await writeFirstText(offer, c);
    if (body && (await send(c, body, 1))) {
      firstToday++;
      report.firstTexts++;
    }
  }
}

/**
 * Cold pipeline leads the engine may text, newest first, while `more()` holds.
 * Permanent skips are saved so later scans don't pay for them again.
 */
async function* coldLeads(
  offer: ReactivationOffer,
  seen: Set<string>,
  report: RunReport,
  more: () => boolean,
  ignoreHours = false
): AsyncGenerator<GhlContact> {
  for await (const { contactId, createdAt } of pipelineLeads(offer)) {
    if (!more()) return;
    if (seen.has(contactId)) continue;
    seen.add(contactId);
    if (Date.now() - Date.parse(createdAt) < 7 * DAY) continue;
    const c = await getContact(offer, contactId);
    const why = await skipReason(offer, c, ignoreHours);
    if (why) {
      report.skipped[why] = (report.skipped[why] ?? 0) + 1;
      if (PERMANENT_SKIPS.has(why)) {
        await createReactivationRow(offer, "leads", { Name: fullName(c), "GHL Contact ID": c.id, Phone: c.phone ?? null, Status: "Skipped" });
      }
      continue;
    }
    yield c;
  }
}

function writeFirstText(offer: ReactivationOffer, c: GhlContact): Promise<string | null> {
  const daysAgo = Math.floor((Date.now() - Date.parse(c.dateAdded)) / DAY);
  return generate(offer, {
    model: MODELS.firstText,
    system: firstTextSystem(offer),
    prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}\nSigned up: ${daysAgo} days ago\n\nWrite the first text.`,
    purpose: "first_text",
    contactId: c.id,
    touch: 1,
  });
}

/**
 * BUILD.md "show 20 real drafts": writes first texts for the newest cold
 * leads as drafts. Sends nothing; approved drafts go out on the next run
 * while the engine is ON.
 */
export async function makeDrafts(offer: ReactivationOffer, want: number): Promise<{ drafts: { name: string; body: string }[]; skipped: Record<string, number> }> {
  const leads = await getReactivationRows(offer, "leads");
  const report: RunReport = { firstTexts: 0, followUps: 0, replies: 0, skipped: {} };
  const drafts: { name: string; body: string }[] = [];
  const seen = new Set(leads.map((l) => s(l.fields["GHL Contact ID"])));
  for await (const c of coldLeads(offer, seen, report, () => drafts.length < want, true)) {
    const body = await writeFirstText(offer, c);
    if (!body) continue;
    const name = c.contactName || firstNameOf(c) || c.phone || c.id;
    await createReactivationRow(offer, "leads", {
      Name: name,
      "GHL Contact ID": c.id,
      Email: c.email ?? null,
      Phone: c.phone ?? null,
      Timezone: sendWindow(offer, c)?.timeZone ?? null,
      Status: "Queued",
      DND: false,
      Buyer: false,
    });
    await createReactivationRow(offer, "messages", {
      Name: `${name} #1`,
      "GHL Contact ID": c.id,
      "Lead Name": name,
      Direction: "out",
      Body: body,
      Touch: 1,
      Status: "draft",
      "Created At": new Date().toISOString(),
    });
    drafts.push({ name, body });
  }
  return { drafts, skipped: report.skipped };
}

/** Every 5 minutes: log new inbound texts from texted leads and answer them. */
export async function runReplies(offer: ReactivationOffer, report: RunReport): Promise<void> {
  const settings = await getReactivationSettings(offer);
  const leads = await getReactivationRows(offer, "leads", "{First Texted At}");
  const leadById = new Map(leads.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const cutoff = Date.now() - DAY;

  for (const conv of await recentConversations(offer)) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = leadById.get(conv.contactId);
    if (!lead || lead.fields.Status === "Opted out" || conv.lastMessageDirection !== "inbound") continue;
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
      // Stop forever, never reply again.
      await updateReactivationRow(offer, "leads", lead.id, { ...fields, Status: "Opted out", "Opted Out At": new Date().toISOString() });
      continue;
    }
    if (lead.fields.Status === "Texted") fields.Status = "Replied";

    if (settings.engineOn) {
      const c = await getContact(offer, conv.contactId);
      const timeZone = sendWindow(offer, c)?.timeZone ?? c.timezone ?? "America/New_York";
      const out = await generate(offer, {
        model: MODELS.reply,
        system: replySystem(offer),
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
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
        if (parsed.reply && (await trySend(offer, c.id, parsed.reply))) {
          await logSent(offer, lead, c, parsed.reply, null);
          fields["Last Message At"] = new Date().toISOString();
          report.replies++;
        }
        if (parsed.action === "booked") {
          Object.assign(fields, { Status: "Booked", "Booked At": new Date().toISOString(), "Booked For": parsed.booked_for });
          await flagBooked(offer, c, parsed.booked_for);
        } else if (parsed.action === "not_now") fields.Status = "Not now";
      }
    }
    await updateReactivationRow(offer, "leads", lead.id, fields);
  }
}

function thread(msgs: GhlMessage[]): string {
  return msgs
    .filter((m) => m.messageType === "TYPE_SMS" && m.body)
    .map((m) => `${m.direction === "inbound" ? "Lead" : "Us"} (${m.dateAdded.slice(0, 16)}Z): ${m.body}`)
    .join("\n");
}

function parseReply(text: string | null): { reply: string; action: string; booked_for: string } | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function turnOff(offer: ReactivationOffer, reason: string) {
  await setReactivationSetting(offer, "engine_on", "0");
  await setReactivationSetting(offer, "off_reason", reason);
}

/**
 * BUILD.md safety switch: opt-outs over 3% of today's texts turn the engine OFF,
 * judged once the day has 100+ texts (user, 2026-10-28: one STOP in the first
 * 28 texts shut Aval down).
 */
export async function checkOptOuts(offer: ReactivationOffer, report: RunReport): Promise<void> {
  if (!SEND_RULES[offer].autoOff) return;
  if (!(await getReactivationSettings(offer)).engineOn) return;
  const today = easternDay(new Date());
  const messages = await getReactivationRows(offer, "messages");
  const texts = messages.filter((m) => m.fields.Direction === "out" && m.fields.Status === "sent" && easternDay(s(m.fields["Sent At"])) === today).length;
  const optOuts = messages.filter((m) => m.fields["Opt Out"] === true && easternDay(s(m.fields["Created At"])) === today).length;
  if (texts >= 100 && optOuts / texts > 0.03) {
    report.off = `Opt-outs hit ${optOuts} of ${texts} texts today (over 3%)`;
    await turnOff(offer, report.off);
  }
}
