/**
 * Aval's GoHighLevel, read to find a booked lead's contact ids, which tie a
 * Calendly booking to that lead's logged calls.
 */

const GHL_API = "https://services.leadconnectorhq.com";

/** Every Aval GHL contact id per email (lowercased); one person can be two contacts. */
export async function avalContactIds(emails: string[]): Promise<Record<string, string[]>> {
  const pat = process.env.GHL_AVAL_PIT;
  const locationId = process.env.GHL_AVAL_LOCATION_ID;
  if (!pat || !locationId) throw new Error("Missing GHL_AVAL_PIT or GHL_AVAL_LOCATION_ID");
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const out: Record<string, string[]> = {};
  // A few at a time: GHL allows about 100 requests per 10 seconds.
  for (let i = 0; i < unique.length; i += 8) {
    await Promise.all(
      unique.slice(i, i + 8).map(async (email) => {
        const res = await fetch(`${GHL_API}/contacts/search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${pat}`, Version: "2021-07-28", "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, pageLimit: 10, filters: [{ field: "email", operator: "eq", value: email }] }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`GHL contact search failed (${res.status})`);
        const { contacts } = (await res.json()) as { contacts: { id: string }[] };
        out[email] = contacts.map((c) => c.id);
      }),
    );
  }
  return out;
}
