import type { ReactivationOffer } from "@/lib/airtable/reactivation";

/**
 * Each offer's GoHighLevel for the reactivation engine: the pipeline its
 * leads come from, their message history, and sending texts from the
 * location's number.
 */

const GHL_API = "https://services.leadconnectorhq.com";

type GhlOffer = {
  envPrefix: string;
  /** Where cold leads come from. */
  pipeline: string;
  /** A contact in any of these stages, in any pipeline, is never texted. */
  blockedStages: Set<string>;
  /** A contact with any opportunity in these pipelines is never texted. */
  blockedPipelines: Set<string>;
  /** Another engine answers contacts in these stages, so this one stays quiet on their replies. */
  deferStages: Set<string>;
  /** Stages texted / booked leads move to in `pipeline`; null leaves the stage alone. */
  textedStage: string | null;
  readyStage: string | null;
  /** Where a lead goes in `pipeline` when a text to them fails; null leaves the stage alone. */
  failedStage: string | null;
  /** Discord webhook env var for booked leads. */
  bookedWebhookEnv: string;
  /** Extra line on the Discord alert so the team knows what the lead is for. */
  bookedContext: string | null;
};

export const MASTERCLASS_PIPELINE = "uxzG8oq8bMtG6hCWVFyl";
/** Registered for the upcoming session; n8n moves them on after it (bVSWLTEH1cHOsNDH). */
export const MASTERCLASS_OPT_IN_STAGE = "79e030e6-c91f-473e-8add-4cabbe852109";
/** Bought the $27 upgrade at signup: still a registrant for the upcoming session. */
export const MASTERCLASS_VIP_STAGE = "e7de3f9c-93bd-4be7-a194-4e091450173a";
export const MASTERCLASS_NO_SHOW_STAGE = "d6087cb2-e9c3-479f-8151-8f6ed8cbd274";

export const GHL_OFFERS: Record<ReactivationOffer, GhlOffer> = {
  aval: {
    envPrefix: "GHL_AVAL",
    pipeline: "1YUUtFeSnGtc3u94exjP", // Base44
    // User, 2026-10-28: the only Base44 stages the engine may not text.
    blockedStages: new Set([
      "1831ed07-0869-4316-9ede-050df354194c", // Base44 Purchase
      "eb1b63a2-90ad-4de3-a85b-b97132c57b05", // Base44 -> Booked
      "202b456f-fc28-4101-9374-45d0a511919b", // High Ticket Applicant
      "54616683-f220-4ed6-9eef-1380230c8868", // Closed High Ticket
      "a007b9d8-c3b9-485d-a48d-29db6559a937", // Booked call
    ]),
    blockedPipelines: new Set(),
    deferStages: new Set(),
    // Added 2026-10-28 right after "Base44 Opt in", named "Reactivation Attempt".
    textedStage: "f6897d1a-12aa-4d78-a350-6e7b8299afab",
    // Added 2026-10-28 right after "Reactivation Attempt": the lead gave us a call time.
    readyStage: "75477154-b0bc-4166-83d2-1a1df8738288",
    failedStage: null,
    bookedWebhookEnv: "DISCORD_AVAL_REACTIVATION_WEBHOOK",
    bookedContext: null,
  },
  bronson: {
    envPrefix: "GHL_BRONSON",
    pipeline: "fV02CzJidh5FBHJ4HFoM", // Affiliate (the old Base44 free course opt-ins)
    // User, 2026-10-28: Affiliate stages that don't need reactivating.
    blockedStages: new Set([
      "0ad0cb36-eb34-4a14-b119-bf95d15b6016", // Affiliate Closed
      "deb3ae52-df38-459d-9f50-970e8d69d772", // Applied for HT
      "2ffa8859-78b2-4db2-a2a3-6fc7fcf91797", // Booked High Ticket
      "12328bd9-d806-4e7f-b363-09fff85047e7", // No show High Ticket
      "8ac6e9c1-ed97-4621-9f6f-c70e04ab47c7", // Cancelled
      "10ecabaa-b220-4f21-bd23-f87db83ef25e", // No Close High Ticket
      "0e518f40-87ad-4d71-8e2a-31105082bccb", // Closed High Ticket
      "c755a89e-03b2-4ebb-83cc-2b712545314f", // Trash
      "8de41b99-da24-4b0f-9f78-f6e512569a34", // Dead Lead
      // BUILD.md "not a buyer": high ticket closes from the masterclass too.
      "cf87fbab-3d9e-41a7-8609-94d377439a70", // Masterclass: HIGH TICKET CLOSED
      // Registered for the upcoming masterclass: the show-rate engine has them.
      MASTERCLASS_OPT_IN_STAGE,
      MASTERCLASS_VIP_STAGE,
    ]),
    // Paying clients being onboarded and checked in on.
    blockedPipelines: new Set(["uzqhkJTeAUvgDg4Rh5Br"]), // Fulfillment
    deferStages: new Set([MASTERCLASS_OPT_IN_STAGE, MASTERCLASS_VIP_STAGE]),
    textedStage: null,
    readyStage: null,
    // User, 2026-10-28: a number we can't text goes to the dead pile. Trash is blocked above.
    failedStage: "c755a89e-03b2-4ebb-83cc-2b712545314f", // Trash
    bookedWebhookEnv: "DISCORD_BRONSON_REACTIVATION_WEBHOOK",
    // User, 2026-10-28: the team stopped selling Base44 a while back, so say it on every alert.
    bookedContext: "⚠️ **Base44 lead.** Old Base44 free course opt-in: give them free course access and get them started on the AI tools.",
  },
  // Show-rate engine: answers masterclass registrants, never books or moves stages.
  bronsonMasterclass: {
    envPrefix: "GHL_BRONSON",
    pipeline: MASTERCLASS_PIPELINE,
    blockedStages: new Set(),
    blockedPipelines: new Set(),
    deferStages: new Set(),
    textedStage: null,
    readyStage: null,
    failedStage: null,
    bookedWebhookEnv: "",
    bookedContext: null,
  },
};

function env(offer: ReactivationOffer) {
  const prefix = GHL_OFFERS[offer].envPrefix;
  const pat = process.env[`${prefix}_PIT`];
  const locationId = process.env[`${prefix}_LOCATION_ID`];
  if (!pat || !locationId) throw new Error(`Missing ${prefix}_PIT or ${prefix}_LOCATION_ID`);
  return { pat, locationId };
}

async function ghl<T>(offer: ReactivationOffer, path: string, init?: { method: string; body: unknown }): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${GHL_API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${env(offer).pat}`,
        Version: "2021-07-28",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: init ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    // GHL allows about 100 requests per 10 seconds.
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok) throw new Error(`GHL ${path.split("?")[0]} failed (${res.status}): ${await res.text()}`);
    return (await res.json()) as T;
  }
}

export type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  dnd?: boolean;
  /** Per-channel DND. GHL turns SMS on by itself after carrier errors (dead number, landline). */
  dndSettings?: { SMS?: { status?: string } };
  dateAdded: string;
};

/** Full DND or SMS-only DND: GHL refuses to text either. */
export const smsBlocked = (c: GhlContact) => Boolean(c.dnd) || c.dndSettings?.SMS?.status === "active";

export type GhlMessage = {
  id: string;
  dateAdded: string;
  messageType: string;
  direction: "inbound" | "outbound";
  body?: string;
};

/** The offer's pipeline leads, newest opportunity first. */
export async function* pipelineLeads(offer: ReactivationOffer): AsyncGenerator<{ contactId: string; createdAt: string }> {
  const { locationId } = env(offer);
  let path: string | undefined = `/opportunities/search?location_id=${locationId}&pipeline_id=${GHL_OFFERS[offer].pipeline}&limit=100`;
  while (path) {
    const page: { opportunities: { contactId: string; createdAt: string }[]; meta: { nextPageUrl?: string } } =
      await ghl(offer, path);
    yield* page.opportunities;
    path = page.meta.nextPageUrl?.replace(GHL_API, "");
  }
}

export async function getContact(offer: ReactivationOffer, contactId: string): Promise<GhlContact> {
  return (await ghl<{ contact: GhlContact }>(offer, `/contacts/${contactId}`)).contact;
}

export type GhlOpportunity = {
  id: string;
  contactId: string;
  pipelineStageId: string;
  createdAt: string;
  lastStageChangeAt?: string;
  contact?: { name?: string; email?: string; phone?: string; tags?: string[] };
};

/** Every opportunity in the offer's pipeline, newest first. */
export async function* pipelineOpportunities(offer: ReactivationOffer): AsyncGenerator<GhlOpportunity> {
  const { locationId } = env(offer);
  let path: string | undefined = `/opportunities/search?location_id=${locationId}&pipeline_id=${GHL_OFFERS[offer].pipeline}&limit=100`;
  while (path) {
    const page: { opportunities: GhlOpportunity[]; meta: { nextPageUrl?: string } } = await ghl(offer, path);
    yield* page.opportunities;
    path = page.opportunities.length ? page.meta.nextPageUrl?.replace(GHL_API, "") : undefined;
  }
}

/** True when another engine owns this contact's replies (see deferStages). */
export async function deferReply(offer: ReactivationOffer, contactId: string): Promise<boolean> {
  const stages = GHL_OFFERS[offer].deferStages;
  if (!stages.size) return false;
  const { opportunities } = await ghl<{ opportunities: { pipelineStageId: string }[] }>(
    offer,
    `/opportunities/search?location_id=${env(offer).locationId}&contact_id=${contactId}`
  );
  return opportunities.some((o) => stages.has(o.pipelineStageId));
}

/** True when any of this contact's opportunities sits in a blocked stage or pipeline. */
export async function inBlockedStage(offer: ReactivationOffer, contactId: string): Promise<boolean> {
  const { opportunities } = await ghl<{ opportunities: { pipelineId: string; pipelineStageId: string }[] }>(
    offer,
    `/opportunities/search?location_id=${env(offer).locationId}&contact_id=${contactId}`
  );
  const o = GHL_OFFERS[offer];
  return opportunities.some((x) => o.blockedStages.has(x.pipelineStageId) || o.blockedPipelines.has(x.pipelineId));
}

/** Every message in every conversation this contact has, oldest first. */
export async function history(offer: ReactivationOffer, contactId: string): Promise<GhlMessage[]> {
  const { conversations } = await ghl<{ conversations: { id: string }[] }>(
    offer,
    `/conversations/search?locationId=${env(offer).locationId}&contactId=${contactId}`
  );
  const all: GhlMessage[] = [];
  for (const c of conversations) {
    const { messages } = await ghl<{ messages: { messages: GhlMessage[] } }>(offer, `/conversations/${c.id}/messages?limit=100`);
    all.push(...messages.messages);
  }
  return all.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
}

/** Conversations with the newest activity first, to spot replies. */
export async function recentConversations(offer: ReactivationOffer): Promise<{ contactId: string; lastMessageDate: number; lastMessageDirection?: string }[]> {
  const { conversations } = await ghl<{
    conversations: { contactId: string; lastMessageDate: number; lastMessageDirection?: string }[];
  }>(offer, `/conversations/search?locationId=${env(offer).locationId}&sortBy=last_message_date&sort=desc&limit=100`);
  return conversations;
}

export async function sendSms(offer: ReactivationOffer, contactId: string, message: string): Promise<void> {
  await ghl(offer, "/conversations/messages", { method: "POST", body: { type: "SMS", contactId, message } });
}

/**
 * Every texted lead gets the "reactivation" tag (and, where the offer has
 * one, its opportunity moves to the texted stage) so the team can follow
 * them in GHL.
 */
export async function markTexted(offer: ReactivationOffer, contactId: string): Promise<void> {
  await ghl(offer, `/contacts/${contactId}/tags`, { method: "POST", body: { tags: ["reactivation"] } });
  const stage = GHL_OFFERS[offer].textedStage;
  if (stage) await moveInPipeline(offer, contactId, stage);
}

/** A text to this lead failed: move them to the offer's failed stage, if it has one. */
export async function markFailed(offer: ReactivationOffer, contactId: string): Promise<boolean> {
  const stage = GHL_OFFERS[offer].failedStage;
  if (!stage) return false;
  await moveInPipeline(offer, contactId, stage);
  return true;
}

async function moveInPipeline(offer: ReactivationOffer, contactId: string, stageId: string): Promise<void> {
  const pipeline = GHL_OFFERS[offer].pipeline;
  const { opportunities } = await ghl<{ opportunities: { id: string; pipelineId: string }[] }>(
    offer,
    `/opportunities/search?location_id=${env(offer).locationId}&contact_id=${contactId}&pipeline_id=${pipeline}`
  );
  for (const o of opportunities.filter((o) => o.pipelineId === pipeline)) {
    await ghl(offer, `/opportunities/${o.id}`, { method: "PUT", body: { pipelineId: pipeline, pipelineStageId: stageId } });
  }
}

/** How a booked lead reaches the team: ready stage (if any), tag, a note and a Discord post. */
export async function flagBooked(offer: ReactivationOffer, c: GhlContact, bookedFor: string): Promise<void> {
  const stage = GHL_OFFERS[offer].readyStage;
  if (stage) await moveInPipeline(offer, c.id, stage);
  await ghl(offer, `/contacts/${c.id}/tags`, { method: "POST", body: { tags: ["reactivation booked"] } });
  await ghl(offer, `/contacts/${c.id}/notes`, {
    method: "POST",
    body: { body: `Reactivation engine booked a call by text: ${bookedFor}. Call them at that time.` },
  });
  const { bookedWebhookEnv, bookedContext } = GHL_OFFERS[offer];
  const webhook = process.env[bookedWebhookEnv];
  if (!webhook) return;
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `📞 **Reactivation booked a call**\n${bookedContext ? `${bookedContext}\n` : ""}**${c.contactName || c.firstName || "Lead"}** ${c.phone ?? ""}\nCall them: **${bookedFor}**\nhttps://app.gohighlevel.com/v2/location/${env(offer).locationId}/contacts/detail/${c.id}`,
    }),
  });
  if (!res.ok) console.error("reactivation Discord alert failed", res.status, await res.text());
}
