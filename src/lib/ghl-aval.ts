/**
 * Aval's GoHighLevel, read for contact tags. Every masterclass registrant
 * carries the "masterclass" tag ("masterclass (paid)" for ad traffic), which
 * is how a Calendly booking is tied back to the webinar.
 */

const GHL_API = "https://services.leadconnectorhq.com";

async function contactTags(pat: string, locationId: string, email: string): Promise<string[]> {
  const res = await fetch(`${GHL_API}/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, Version: "2021-07-28", "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId,
      pageLimit: 10,
      filters: [{ field: "email", operator: "eq", value: email.trim().toLowerCase() }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GHL contact search failed (${res.status})`);
  const { contacts } = (await res.json()) as { contacts: { tags?: string[] }[] };
  // The same person can be two contacts; any of them carrying the tag counts.
  return contacts.flatMap((c) => c.tags ?? []).map((t) => t.toLowerCase());
}

/** The emails (lowercased) whose Aval GHL contact has a masterclass tag. */
export async function avalMasterclassEmails(emails: string[]): Promise<Set<string>> {
  const pat = process.env.GHL_AVAL_PIT;
  const locationId = process.env.GHL_AVAL_LOCATION_ID;
  if (!pat || !locationId) throw new Error("Missing GHL_AVAL_PIT or GHL_AVAL_LOCATION_ID");
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const tagged = await Promise.all(
    unique.map(async (e) => ((await contactTags(pat, locationId, e)).some((t) => t.startsWith("masterclass")) ? e : null))
  );
  return new Set(tagged.filter((e): e is string => e !== null));
}
