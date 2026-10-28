import Anthropic from "@anthropic-ai/sdk";
import {
  createReactivationRow,
  getReactivationRows,
  getReactivationSettings,
  setReactivationSetting,
  updateReactivationRow,
} from "@/lib/airtable/reactivation";
import {
  base44Leads,
  BLOCKED_STAGES,
  contactStages,
  flagBooked,
  getContact,
  history,
  recentConversations,
  sendSms,
  type GhlContact,
  type GhlMessage,
} from "./ghl";
import { MY_VOICE, OFFER, REPLY_PLAYBOOK, VOICE } from "./voice";

/**
 * The Aval reactivation engine (kit: ~/Downloads/reactivation-engine-kit,
 * BUILD.md phase 3). Texts cold Base44 leads from GHL, answers their replies,
 * marks bookings. Every Claude call is logged with its cost, and the
 * Reactivation section on /aval/overview reads the same tables.
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

async function generate(opts: {
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
  await createReactivationRow("aiCalls", {
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

const RULES = `{TEAM} = Aval Trade's team. {OWNER} = Aval. {OFFER} = the free trading course and AI tools.
Where my-voice.md disagrees with voice.md or the reply playbook, my-voice.md wins.

<voice.md>
${VOICE}
</voice.md>

<my-voice.md>
${MY_VOICE}
</my-voice.md>

<offer.md>
${OFFER}
</offer.md>`;

const FIRST_TEXT_SYSTEM = `You write texts to leads who signed up a while back and went cold. Follow these files exactly.

${RULES}

Reply with only the text message. No quotes, no notes.`;

const REPLY_SYSTEM = `You answer a lead's texts. The goal is a booked call time. Follow these files exactly.

${RULES}

<reply-playbook.md>
${REPLY_PLAYBOOK}
</reply-playbook.md>

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

// ---------- Time zones: texts only go out 9am to 9pm in the lead's time ----------

/** Single time zone countries by calling code, for leads GHL has no time zone for. */
const COUNTRY_TZ: [string, string][] = [
  ["+44", "Europe/London"],
  ["+353", "Europe/Dublin"],
  ["+91", "Asia/Kolkata"],
  ["+92", "Asia/Karachi"],
  ["+63", "Asia/Manila"],
  ["+65", "Asia/Singapore"],
  ["+60", "Asia/Kuala_Lumpur"],
  ["+971", "Asia/Dubai"],
  ["+966", "Asia/Riyadh"],
  ["+27", "Africa/Johannesburg"],
  ["+234", "Africa/Lagos"],
  ["+233", "Africa/Accra"],
  ["+254", "Africa/Nairobi"],
  ["+49", "Europe/Berlin"],
  ["+33", "Europe/Paris"],
  ["+34", "Europe/Madrid"],
  ["+39", "Europe/Rome"],
  ["+31", "Europe/Amsterdam"],
  ["+64", "Pacific/Auckland"],
];

/** The zones to check: the lead's own, or for a +1 number with none, both US coasts (so noon to 9pm Eastern). */
export function leadZones(c: Pick<GhlContact, "timezone" | "phone">): string[] | null {
  if (c.timezone) return [c.timezone];
  const phone = c.phone ?? "";
  if (phone.startsWith("+1")) return ["America/New_York", "America/Los_Angeles"];
  const hit = COUNTRY_TZ.find(([code]) => phone.startsWith(code));
  return hit ? [hit[1]] : null;
}

export function inWindow(zones: string[], now = new Date()): boolean {
  return zones.every((timeZone) => {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
    return hour >= 9 && hour < 21;
  });
}

function localTime(zones: string[]): string {
  return new Date().toLocaleString("en-US", { timeZone: zones[0], weekday: "long", hour: "numeric", minute: "2-digit" });
}

// ---------- Who to text ----------

/** A real-looking number: +1 needs a valid area code and exchange. */
function textable(phone: string | undefined): boolean {
  if (!phone) return false;
  if (phone.startsWith("+1")) return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone);
  return /^\+\d{8,15}$/.test(phone);
}

/** BUILD.md "who to text", plus the user's blocked Base44 stages. The daily cap is counted by the caller. */
async function skipReason(c: GhlContact): Promise<string | null> {
  if (!textable(c.phone)) return "no valid phone";
  if (c.dnd) return "DND";
  // Cold means the reps have had their week with them.
  if (Date.now() - Date.parse(c.dateAdded) < 7 * DAY) return "signed up under 7 days ago";
  const zones = leadZones(c);
  if (!zones) return "unknown time zone";
  if (!inWindow(zones)) return "outside 9am to 9pm their time";
  if ((await contactStages(c.id)).some((s) => BLOCKED_STAGES.has(s))) return "blocked stage";
  const msgs = await history(c.id);
  if (msgs.some((m) => m.direction === "inbound" && STOP.test(m.body ?? ""))) return "said STOP";
  const recentRep = msgs.some(
    (m) =>
      m.direction === "outbound" &&
      (m.messageType === "TYPE_SMS" || m.messageType === "TYPE_CALL") &&
      Date.now() - Date.parse(m.dateAdded) < 7 * DAY
  );
  return recentRep ? "rep text or call in the last 7 days" : null;
}

const PERMANENT_SKIPS = new Set(["no valid phone", "blocked stage", "said STOP"]);

// ---------- Airtable rows ----------

type Row = { id: string; fields: Record<string, unknown> };
const s = (v: unknown) => (typeof v === "string" ? v : "");
const easternDay = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const firstNameOf = (c: GhlContact) => {
  const n = c.firstName?.trim().split(/\s+/)[0] ?? "";
  return /^[a-z][a-z'-]+$/i.test(n) && !/^(ok|affiliate|test)$/i.test(n) ? n : null;
};

async function logSent(lead: Row | null, c: GhlContact, body: string, touch: number | null) {
  const now = new Date().toISOString();
  const name = s(lead?.fields.Name) || c.contactName || c.phone || c.id;
  await createReactivationRow("messages", {
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
async function trySend(contactId: string, body: string): Promise<boolean> {
  try {
    await sendSms(contactId, body);
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
 * daily cap (first texts only). `scanNew` is false on the 5-minute runs so GHL
 * is only searched for new leads once an hour.
 */
export async function runSends(scanNew: boolean, report: RunReport): Promise<void> {
  const settings = await getReactivationSettings();
  if (!settings.engineOn) return;
  const leads = await getReactivationRows("leads");
  const messages = await getReactivationRows("messages");
  const leadById = new Map(leads.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const today = easternDay(new Date());
  const sentOut = messages.filter((m) => m.fields.Direction === "out" && m.fields.Status === "sent");
  let firstToday = sentOut.filter((m) => m.fields.Touch === 1 && easternDay(s(m.fields["Sent At"])) === today).length;
  let failsInARow = 0;

  async function send(c: GhlContact, body: string, touch: number, draftId?: string): Promise<boolean> {
    const ok = await trySend(c.id, body);
    const lead = leadById.get(c.id) ?? null;
    const now = new Date().toISOString();
    if (draftId) await updateReactivationRow("messages", draftId, ok ? { Status: "sent", "Sent At": now } : { Status: "failed" });
    else if (ok) await logSent(lead, c, body, touch);
    if (!ok) {
      if (++failsInARow >= 3) {
        report.off = "3 texts in a row failed to send";
        await turnOff(report.off);
      }
      return false;
    }
    failsInARow = 0;
    const fields: Record<string, unknown> = { "Last Message At": now };
    if (touch === 1) Object.assign(fields, { Status: "Texted", "First Texted At": now });
    if (lead) await updateReactivationRow("leads", lead.id, fields);
    else
      await createReactivationRow("leads", {
        Name: c.contactName || c.phone || c.id,
        "GHL Contact ID": c.id,
        Email: c.email ?? null,
        Phone: c.phone ?? null,
        Timezone: leadZones(c)?.join(" / ") ?? null,
        DND: false,
        Buyer: false,
        ...fields,
      });
    return true;
  }

  // 1. Drafts approved in chat or on the dashboard.
  for (const d of messages.filter((m) => m.fields.Status === "approved" && m.fields.Direction === "out")) {
    if (report.off || firstToday >= settings.dailyCap) break;
    const c = await getContact(s(d.fields["GHL Contact ID"]));
    const why = await skipReason(c);
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
    if (report.off) return;
    const id = s(lead.fields["GHL Contact ID"]);
    const mine = sentOut.filter((m) => m.fields["GHL Contact ID"] === id).sort((a, b) => s(a.fields["Sent At"]).localeCompare(s(b.fields["Sent At"])));
    const last = mine[mine.length - 1];
    const touch = Math.max(...mine.map((m) => Number(m.fields.Touch) || 1)) + 1;
    if (!last || touch > 3 || Date.now() - Date.parse(s(last.fields["Sent At"])) < 3 * DAY) continue;
    const c = await getContact(id);
    const zones = leadZones(c);
    if (c.dnd || !zones || !inWindow(zones)) continue;
    const body = await generate({
      model: MODELS.firstText,
      system: FIRST_TEXT_SYSTEM,
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

  // 3. New first texts, newest cold Base44 leads first.
  if (!scanNew || firstToday >= settings.dailyCap) return;
  const seen = new Set(leadById.keys());
  let checked = 0;
  for await (const { contactId, createdAt } of base44Leads()) {
    if (report.off || firstToday >= settings.dailyCap || checked >= 300) return;
    if (seen.has(contactId)) continue;
    seen.add(contactId);
    if (Date.now() - Date.parse(createdAt) < 7 * DAY) continue;
    checked++;
    const c = await getContact(contactId);
    const why = await skipReason(c);
    if (why) {
      report.skipped[why] = (report.skipped[why] ?? 0) + 1;
      // Saved so the hourly scan doesn't pay for them again.
      if (PERMANENT_SKIPS.has(why)) {
        await createReactivationRow("leads", { Name: c.contactName || c.phone || c.id, "GHL Contact ID": c.id, Phone: c.phone ?? null, Status: "Skipped" });
      }
      continue;
    }
    const daysAgo = Math.floor((Date.now() - Date.parse(c.dateAdded)) / DAY);
    const body = await generate({
      model: MODELS.firstText,
      system: FIRST_TEXT_SYSTEM,
      prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}\nSigned up: ${daysAgo} days ago\n\nWrite the first text.`,
      purpose: "first_text",
      contactId,
      touch: 1,
    });
    if (body && (await send(c, body, 1))) {
      firstToday++;
      report.firstTexts++;
    }
  }
}

/** Every 5 minutes: log new inbound texts from texted leads and answer them. */
export async function runReplies(report: RunReport): Promise<void> {
  const settings = await getReactivationSettings();
  const leads = await getReactivationRows("leads", "{First Texted At}");
  const leadById = new Map(leads.map((l) => [s(l.fields["GHL Contact ID"]), l]));
  const cutoff = Date.now() - DAY;

  for (const conv of await recentConversations()) {
    if (conv.lastMessageDate < cutoff) break;
    const lead = leadById.get(conv.contactId);
    if (!lead || lead.fields.Status === "Opted out" || conv.lastMessageDirection !== "inbound") continue;
    // Compared to the second: Airtable may drop milliseconds.
    const handledUpTo = s(lead.fields["Last Message At"]).slice(0, 19);
    if (new Date(conv.lastMessageDate).toISOString().slice(0, 19) <= handledUpTo) continue;

    const msgs = await history(conv.contactId);
    const fresh = msgs.filter((m) => m.direction === "inbound" && m.messageType === "TYPE_SMS" && m.dateAdded.slice(0, 19) > handledUpTo);
    if (!fresh.length) continue;
    const name = s(lead.fields.Name);
    const fields: Record<string, unknown> = { "Last Message At": fresh[fresh.length - 1].dateAdded };
    let optOut = false;
    for (const m of fresh) {
      const isStop = STOP.test(m.body ?? "");
      optOut ||= isStop;
      await createReactivationRow("messages", {
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
      await updateReactivationRow("leads", lead.id, { ...fields, Status: "Opted out", "Opted Out At": new Date().toISOString() });
      continue;
    }
    if (lead.fields.Status === "Texted") fields.Status = "Replied";

    if (settings.engineOn) {
      const c = await getContact(conv.contactId);
      const zones = leadZones(c) ?? ["America/New_York"];
      const out = await generate({
        model: MODELS.reply,
        system: REPLY_SYSTEM,
        prompt: `Lead first name: ${firstNameOf(c) ?? "(unknown, don't use a name)"}
Their local time now: ${localTime(zones)}

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
        if (parsed.reply && (await trySend(c.id, parsed.reply))) {
          await logSent(lead, c, parsed.reply, null);
          fields["Last Message At"] = new Date().toISOString();
          report.replies++;
        }
        if (parsed.action === "booked") {
          Object.assign(fields, { Status: "Booked", "Booked At": new Date().toISOString(), "Booked For": parsed.booked_for });
          await flagBooked(c.id, parsed.booked_for);
        } else if (parsed.action === "not_now") fields.Status = "Not now";
      }
    }
    await updateReactivationRow("leads", lead.id, fields);
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

async function turnOff(reason: string) {
  await setReactivationSetting("engine_on", "0");
  await setReactivationSetting("off_reason", reason);
}

/** BUILD.md safety switch: opt-outs over 3% of today's texts turn the engine OFF. */
export async function checkOptOuts(report: RunReport): Promise<void> {
  if (!(await getReactivationSettings()).engineOn) return;
  const today = easternDay(new Date());
  const messages = await getReactivationRows("messages");
  const texts = messages.filter((m) => m.fields.Direction === "out" && m.fields.Status === "sent" && easternDay(s(m.fields["Sent At"])) === today).length;
  const optOuts = messages.filter((m) => m.fields["Opt Out"] === true && easternDay(s(m.fields["Created At"])) === today).length;
  if (texts > 0 && optOuts / texts > 0.03) {
    report.off = `Opt-outs hit ${optOuts} of ${texts} texts today (over 3%)`;
    await turnOff(report.off);
  }
}
