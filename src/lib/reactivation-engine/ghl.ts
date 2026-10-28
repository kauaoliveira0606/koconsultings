/**
 * Aval's GoHighLevel for the reactivation engine: Base44 pipeline leads,
 * their message history, and sending texts from the location's number.
 */

const GHL_API = "https://services.leadconnectorhq.com";

export const BASE44_PIPELINE = "1YUUtFeSnGtc3u94exjP";
/** Added 2026-10-28 right after "Base44 Opt in": where texted leads sit. */
export const REACTIVATION_STAGE = "f6897d1a-12aa-4d78-a350-6e7b8299afab";
/** User, 2026-10-28: the only Base44 stages the engine may not text. */
export const BLOCKED_STAGES = new Set([
  "1831ed07-0869-4316-9ede-050df354194c", // Base44 Purchase
  "eb1b63a2-90ad-4de3-a85b-b97132c57b05", // Base44 -> Booked
  "202b456f-fc28-4101-9374-45d0a511919b", // High Ticket Applicant
  "54616683-f220-4ed6-9eef-1380230c8868", // Closed High Ticket
  "a007b9d8-c3b9-485d-a48d-29db6559a937", // Booked call
]);

function env() {
  const pat = process.env.GHL_AVAL_PIT;
  const locationId = process.env.GHL_AVAL_LOCATION_ID;
  if (!pat || !locationId) throw new Error("Missing GHL_AVAL_PIT or GHL_AVAL_LOCATION_ID");
  return { pat, locationId };
}

async function ghl<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${GHL_API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${env().pat}`,
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
  contactName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  dnd?: boolean;
  dateAdded: string;
};

export type GhlMessage = {
  id: string;
  dateAdded: string;
  messageType: string;
  direction: "inbound" | "outbound";
  body?: string;
};

/** Base44 pipeline leads, newest opportunity first. */
export async function* base44Leads(): AsyncGenerator<{ contactId: string; createdAt: string }> {
  const { locationId } = env();
  let path: string | undefined = `/opportunities/search?location_id=${locationId}&pipeline_id=${BASE44_PIPELINE}&limit=100`;
  while (path) {
    const page: { opportunities: { contactId: string; createdAt: string }[]; meta: { nextPageUrl?: string } } =
      await ghl(path);
    yield* page.opportunities;
    path = page.meta.nextPageUrl?.replace(GHL_API, "");
  }
}

export async function getContact(contactId: string): Promise<GhlContact> {
  return (await ghl<{ contact: GhlContact }>(`/contacts/${contactId}`)).contact;
}

/** Every pipeline stage this contact sits in. */
export async function contactStages(contactId: string): Promise<string[]> {
  const { opportunities } = await ghl<{ opportunities: { pipelineStageId: string }[] }>(
    `/opportunities/search?location_id=${env().locationId}&contact_id=${contactId}`
  );
  return opportunities.map((o) => o.pipelineStageId);
}

/** Every message in every conversation this contact has, oldest first. */
export async function history(contactId: string): Promise<GhlMessage[]> {
  const { conversations } = await ghl<{ conversations: { id: string }[] }>(
    `/conversations/search?locationId=${env().locationId}&contactId=${contactId}`
  );
  const all: GhlMessage[] = [];
  for (const c of conversations) {
    const { messages } = await ghl<{ messages: { messages: GhlMessage[] } }>(`/conversations/${c.id}/messages?limit=100`);
    all.push(...messages.messages);
  }
  return all.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
}

/** Conversations with the newest activity first, to spot replies. */
export async function recentConversations(): Promise<{ contactId: string; lastMessageDate: number; lastMessageDirection?: string }[]> {
  const { conversations } = await ghl<{
    conversations: { contactId: string; lastMessageDate: number; lastMessageDirection?: string }[];
  }>(`/conversations/search?locationId=${env().locationId}&sortBy=last_message_date&sort=desc&limit=100`);
  return conversations;
}

export async function sendSms(contactId: string, message: string): Promise<void> {
  await ghl("/conversations/messages", { method: "POST", body: { type: "SMS", contactId, message } });
}

/**
 * Every texted lead gets the "reactivation" tag and its Base44 opportunity
 * moves to the Reactivation stage, so the team can follow them in GHL.
 */
export async function markTexted(contactId: string): Promise<void> {
  await ghl(`/contacts/${contactId}/tags`, { method: "POST", body: { tags: ["reactivation"] } });
  const { opportunities } = await ghl<{ opportunities: { id: string; pipelineId: string }[] }>(
    `/opportunities/search?location_id=${env().locationId}&contact_id=${contactId}&pipeline_id=${BASE44_PIPELINE}`
  );
  for (const o of opportunities.filter((o) => o.pipelineId === BASE44_PIPELINE)) {
    await ghl(`/opportunities/${o.id}`, { method: "PUT", body: { pipelineId: BASE44_PIPELINE, pipelineStageId: REACTIVATION_STAGE } });
  }
}

/** How a booked lead reaches the team inside GHL. */
export async function flagBooked(contactId: string, bookedFor: string): Promise<void> {
  await ghl(`/contacts/${contactId}/tags`, { method: "POST", body: { tags: ["reactivation booked"] } });
  await ghl(`/contacts/${contactId}/notes`, {
    method: "POST",
    body: { body: `Reactivation engine booked a call by text: ${bookedFor}. Call them at that time.` },
  });
}
