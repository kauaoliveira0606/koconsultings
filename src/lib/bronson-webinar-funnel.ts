import { BRONSON_BASE_ID, getMasterclassRegistrants, type MasterclassRegistrantRow } from "@/lib/airtable/tables";
import { airtableListAll } from "@/lib/airtable/client";
import { getWebinarJamRegistrants } from "@/lib/webinarjam";
import { PITCH_AT_SECONDS } from "@/lib/webinar-schedule";
import { staleWhileRevalidate } from "@/lib/swr-cache";

/** "Learn How to Build a Subscription Based E-commerce Brand", the webinar n8n polls too. */
const BRONSON_WEBINAR_ID = "2";
/** Masterclass Registrants: n8n writes each person's paid / organic Source here (GHL `masterclass paid` tag or campaign UTM). */
const REGISTRANTS_TABLE = "tblekAN7Ba1YCeEa9";
/** Masterclass Form UTMs: the site's own form, whose UTMs the WebinarJam API drops. */
const FORM_UTMS_TABLE = "tblGjdl2NAwDtmfoY";

/**
 * Bronson's webinar registrants, read live from WebinarJam (user, 2026-11-04):
 * session = the registrant's schedule, stages and the live room straight from
 * WebinarJam. Paid / organic keeps the rule the n8n workflow tags by: paid if
 * any of the person's sign-ups carried a campaign UTM (WebinarJam or our own
 * form) or their GHL contact is tagged `masterclass paid`; paid wins.
 * Falls back to the Airtable rows if WebinarJam can't be reached.
 */
async function load(today: string): Promise<MasterclassRegistrantRow[]> {
  const apiKey = process.env.WEBINARJAM_API_KEY;
  if (!apiKey) throw new Error("Missing WEBINARJAM_API_KEY");
  const [people, saved, form] = await Promise.all([
    getWebinarJamRegistrants(apiKey, BRONSON_WEBINAR_ID, today, PITCH_AT_SECONDS.bronson),
    airtableListAll<{ Email?: string; Source?: string }>(BRONSON_BASE_ID, REGISTRANTS_TABLE, { fields: ["Email", "Source"] }),
    airtableListAll<{ Email?: string; utm_campaign?: string }>(BRONSON_BASE_ID, FORM_UTMS_TABLE, { fields: ["Email", "utm_campaign"] }),
  ]);
  const norm = (e?: string) => (e ?? "").trim().toLowerCase();
  const paid = new Set(people.filter((p) => p.paidSignup).map((p) => p.email));
  for (const r of saved) if (r.fields.Source === "Paid" && r.fields.Email) paid.add(norm(r.fields.Email));
  for (const r of form) if ((r.fields.utm_campaign ?? "").trim() && r.fields.Email) paid.add(norm(r.fields.Email));
  return people.map((p) => ({
    id: p.key,
    sessionDate: p.sessionDate,
    source: paid.has(p.email) ? "Paid" : "Organic",
    stage: p.stage,
    enteredAt: p.enteredAt,
    leftAt: p.leftAt,
  }));
}

/** Re-read in the background once 5 minutes old, so no visitor waits on WebinarJam. */
export async function bronsonRegistrants(today: string): Promise<MasterclassRegistrantRow[]> {
  try {
    return await staleWhileRevalidate("bronson-webinarjam-registrants:v1", () => load(today), 300, 24 * 60 * 60);
  } catch (err) {
    console.error("WebinarJam (Bronson) unavailable, using Airtable registrants", err);
    return getMasterclassRegistrants();
  }
}
