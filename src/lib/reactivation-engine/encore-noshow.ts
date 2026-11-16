import { getReactivationRows } from "@/lib/airtable/reactivation";
import { firstNameOf, generate, MODELS, smsPausedUntil, trySend, type RunReport } from "./engine";
import { deadNumber, flagReview, getContact, ghl, history, recentConversations, replyLine, ROEZAN_SMS, smsBlocked, type GhlContact } from "./ghl";
import { humanTextAfter } from "./guards";
import { s } from "./show-rate";
import { inSendWindow, nextEncore, noShowText } from "./encore-schedule";

/**
 * Encore no-show engine (2026-11-16). Encore = the automated AEvent sessions (Sun, Tue, Wed, Fri, Sat at 8 PM ET,
 * campaign awSPuZl1HKdhVV4). AEvent tags every no-show in GHL ("encore no show", a timeline action on the
 * Non-Attendee audience). This engine texts them once from the Roezan line (the +1 833 line) and, when they say yes,
 * registers them for the next Encore through the existing n8n workflow (HiYBMTsmhwFh0tRb: AEvent, Kit, GHL tag, Discord).
 *
 * State lives in GHL tags, no Airtable rows:
 *   encore no show      AEvent: this person registered and never joined
 *   encore noshow texted  our one text went out
 *   encore seat saved   they said yes and are registered for the next Encore
 *   encore declined / encore opted out / encore needs reply
 *
 * Off unless the Show Rate Settings (Bronson masterclass) row Key "encore_noshow_on" is "1".
 * It only ever sends the one fixed text, a confirmation after a clear yes, and nothing else:
 * anything else a person says goes to the review channel for a human.
 */

const OFFER = "bronsonMasterclass" as const;
export const TAGS = {
  noShow: "encore no show",
  texted: "encore noshow texted",
  seatSaved: "encore seat saved",
  declined: "encore declined",
  optedOut: "encore opted out",
  needsReply: "encore needs reply",
} as const;

const REGISTER_HOOK = "https://kauaoliveira06.app.n8n.cloud/webhook/encore-optin";
const ENCORE_PAGE = "https://www.ad-ventur.com/encore";

// ---------- GHL helpers ----------

type TagContact = { id: string; firstName?: string; phone?: string; tags?: string[] };

async function contactsTagged(tag: string): Promise<TagContact[]> {
  const locationId = (process.env.GHL_BRONSON_LOCATION_ID ?? "").trim();
  const { contacts } = await ghl<{ contacts: TagContact[] }>(OFFER, "/contacts/search", {
    method: "POST",
    body: { locationId, pageLimit: 100, filters: [{ field: "tags", operator: "contains", value: [tag] }] },
  });
  return contacts ?? [];
}

const addTag = (id: string, tag: string) => ghl(OFFER, `/contacts/${id}/tags`, { method: "POST", body: { tags: [tag] } });
async function tagsOf(id: string): Promise<string[]> {
  const { contact } = await ghl<{ contact: { tags?: string[] } }>(OFFER, `/contacts/${id}`);
  return contact.tags ?? [];
}

// ---------- Switch ----------

async function isOn(): Promise<boolean> {
  const rows = await getReactivationRows(OFFER, "settings");
  return s(rows.find((r) => r.fields.Key === "encore_noshow_on")?.fields.Value).trim() === "1";
}

// ---------- Step 1: the one text ----------

export async function runEncoreTexts(deadline: number, report: RunReport): Promise<void> {
  if (!inSendWindow()) {
    report.skipped["encore: outside send window"] = 1;
    return;
  }
  const skip = (why: string) => (report.skipped[`encore: ${why}`] = (report.skipped[`encore: ${why}`] ?? 0) + 1);
  for (const c of await contactsTagged(TAGS.noShow)) {
    if (Date.now() > deadline) return;
    const tags = c.tags ?? [];
    if (tags.includes(TAGS.texted) || tags.includes(TAGS.optedOut)) continue;
    const contact = await getContact(OFFER, c.id);
    if (!contact.phone || smsBlocked(contact)) { skip("no number or SMS blocked"); continue; }
    if (deadNumber(await history(OFFER, c.id))) { skip("dead number"); continue; }
    const first = firstNameOf(contact as GhlContact);
    const ok = await trySend(OFFER, c.id, noShowText(first), "roezan");
    if (!ok) { skip("send failed"); continue; }
    await addTag(c.id, TAGS.texted);
    report.followUps++;
  }
}

// ---------- Step 2: their reply ----------

const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["yes", "no", "stop", "question", "other"] },
  },
  required: ["intent"],
  additionalProperties: false,
};

const INTENT_SYSTEM = `You label one text message from someone who registered for a live online masterclass, missed it, and was offered "we'll grab the spot for you [tomorrow/day] at 8pm est. Just let me know if you want it."
Return JSON {"intent": ...}:
- "yes": a clear yes to being signed up (yes, yeah, yep, sure, please do, I'm in, do it, ok sign me up).
- "no": a clear no to this offer (no, can't make it, not interested in that one) that does not ask us to stop texting.
- "stop": STOP, unsubscribe, remove me, wrong number, don't text me, or any request to stop contact.
- "question": they ask something.
- "other": anything else, including a maybe, a thanks, an emoji, or a different time.
Never choose "yes" for a maybe, "let me see", "what time", or "I'll try".`;

async function intentOf(contactId: string, text: string): Promise<string | null> {
  const out = await generate(OFFER, {
    model: MODELS.firstText,
    system: INTENT_SYSTEM,
    prompt: text.slice(0, 600),
    purpose: "reply",
    contactId,
    touch: null,
    schema: INTENT_SCHEMA,
  });
  try {
    return out ? (JSON.parse(out).intent as string) : null;
  } catch {
    return null;
  }
}

/** Registers them for the next Encore through the n8n workflow; returns their personal join link. */
async function registerForNext(c: GhlContact): Promise<string | null> {
  const next = nextEncore();
  const res = await fetch(REGISTER_HOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.contactName || "",
      email: c.email,
      phone: c.phone,
      masterclassDate: new Date(next.startsAt).toISOString(),
      masterclassLabel: `${next.dayName} · 8:00 PM EST`,
      pageUrl: ENCORE_PAGE,
      source: "encore-noshow",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { joinURL?: string };
  return typeof data.joinURL === "string" && data.joinURL ? data.joinURL : null;
}

export async function runEncoreReplies(deadline: number, report: RunReport): Promise<void> {
  const texted = new Map((await contactsTagged(TAGS.texted)).map((c) => [c.id, c]));
  if (!texted.size) return;
  for (const conv of await recentConversations(OFFER)) {
    if (Date.now() > deadline) return;
    const c = texted.get(conv.contactId);
    if (!c || conv.lastMessageDirection !== "inbound") continue;
    const tags = c.tags ?? [];
    if (tags.includes(TAGS.seatSaved) || tags.includes(TAGS.optedOut) || tags.includes(TAGS.needsReply)) continue;

    const msgs = await history(OFFER, c.id);
    const sms = msgs.filter((m) => m.messageType === "TYPE_SMS" || m.messageType === ROEZAN_SMS);
    const ourText = [...sms].reverse().find((m) => m.direction === "outbound" && /grab the spot for you/i.test(m.body ?? ""));
    const inbound = [...sms].reverse().find((m) => m.direction === "inbound" && m.dateAdded > (ourText?.dateAdded ?? "9999"));
    if (!ourText || !inbound?.body) continue; // not a reply to our text
    // A person on the team already answered: stay out of it.
    if (humanTextAfter(msgs, inbound.dateAdded, ["TYPE_SMS", ROEZAN_SMS])) continue;

    const intent = await intentOf(c.id, inbound.body);
    const contact = await getContact(OFFER, c.id);
    if (intent === "stop") {
      await addTag(c.id, TAGS.optedOut);
    } else if (intent === "no") {
      await addTag(c.id, TAGS.declined);
    } else if (intent === "yes") {
      const next = nextEncore();
      const link = await registerForNext(contact);
      if (!link) {
        // Never promise a seat we could not save.
        await addTag(c.id, TAGS.needsReply);
        await flagReview(OFFER, contact, "Said yes to the Encore invite but registering them in AEvent failed. Register them by hand.", inbound.body);
        report.skipped["encore: register failed"] = (report.skipped["encore: register failed"] ?? 0) + 1;
        continue;
      }
      const line = replyLine(OFFER, sms);
      if (line) {
        await trySend(OFFER, c.id, `Done, you're in for ${next.dayName} at 8pm est. Here's your link: ${link}`, line);
      }
      await addTag(c.id, TAGS.seatSaved);
      report.replies++;
    } else {
      await addTag(c.id, TAGS.needsReply);
      await flagReview(OFFER, contact, "Replied to the Encore invite with something other than a clear yes or no.", inbound.body);
    }
  }
}

// ---------- Cron ----------

export async function runEncoreNoShow(deadline: number): Promise<RunReport & { errors: string[] }> {
  const report: RunReport & { errors: string[] } = { firstTexts: 0, followUps: 0, replies: 0, skipped: {}, errors: [] };
  if (!(await isOn())) {
    report.off = "encore_noshow_on is not 1";
    return report;
  }
  const paused = await smsPausedUntil(OFFER);
  if (paused) {
    report.skipped[`SMS limit, paused until ${new Date(paused).toISOString()}`] = 1;
    return report;
  }
  for (const step of [() => runEncoreReplies(deadline, report), () => runEncoreTexts(deadline, report)]) {
    try {
      await step();
    } catch (e) {
      report.errors.push(String(e));
      console.error("encore no-show step failed", e);
    }
  }
  return report;
}
