import type { MasterclassOffer } from "./show-rate";

/**
 * Each offer's WebinarJam masterclass (API key in an env var): the scheduled
 * sessions, and registering someone so the no-show engine can save their seat
 * for the next one. Bronson: n8n bVSWLTEH1cHOsNDH picks new registrants up
 * into GHL within 5 minutes, same as a page signup.
 */

const API = "https://api.webinarjam.com/webinarjam";

const WEBINARS: Record<MasterclassOffer, { keyEnv: string; webinarId: string }> = {
  // "Learn How to Build a Subscription Based E-commerce Brand 2", the webinar n8n polls too.
  bronsonMasterclass: { keyEnv: "WEBINARJAM_API_KEY", webinarId: "2" },
  // "The 3-Step System Traders Are Using To Get Consistent Payouts", on Aval's own WebinarJam account.
  avalMasterclass: { keyEnv: "WEBINARJAM_AVAL_API_KEY", webinarId: "2" },
};

function env(offer: MasterclassOffer) {
  const { keyEnv, webinarId } = WEBINARS[offer];
  const apiKey = process.env[keyEnv];
  if (!apiKey) throw new Error(`Missing ${keyEnv}`);
  return { apiKey, webinarId };
}

async function post<T>(offer: MasterclassOffer, path: string, params: Record<string, string>): Promise<T> {
  const { apiKey, webinarId } = env(offer);
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ api_key: apiKey, webinar_id: webinarId, ...params }),
    cache: "no-store",
  });
  const json = (await res.json()) as T & { status?: string; message?: string; errors?: unknown };
  if (!res.ok || json.status !== "success") {
    throw new Error(`WebinarJam ${path} failed: ${json.message ?? res.status} ${JSON.stringify(json.errors ?? "")}`);
  }
  return json;
}

/** Eastern wall time ("2026-10-28 19:00") to a UTC timestamp, DST included. */
function easternToUtc(wall: string): number {
  const [d, t] = wall.split(" ");
  const [y, mo, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, day, h, mi);
  const at = (timeZone: string) => new Date(new Date(guess).toLocaleString("en-US", { timeZone })).getTime();
  return guess + (at("UTC") - at("America/New_York"));
}

export type WjSchedule = { id: string; startsAt: number };

/** Every session set up in WebinarJam, oldest first. The webinar's time zone is New York. */
export async function schedules(offer: MasterclassOffer): Promise<WjSchedule[]> {
  const { webinar } = await post<{ webinar: { schedules: { date: string; schedule: number }[] } }>(offer, "webinar", {});
  return webinar.schedules
    .map((sc) => ({ id: String(sc.schedule), startsAt: easternToUtc(sc.date) }))
    .sort((a, b) => a.startsAt - b.startsAt);
}

/** "+44 7700 900123" style E.164 to WebinarJam's country code + number. */
const CODES = ["1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98"];
function splitPhone(e164: string): { code: string; number: string } {
  const digits = e164.replace(/\D/g, "");
  const code = CODES.filter((c) => digits.startsWith(c)).sort((a, b) => b.length - a.length)[0] ?? digits.slice(0, 3);
  return { code: `+${code}`, number: digits.slice(code.length) };
}

/** Registers them for one session. WebinarJam needs a phone and an email. */
export async function register(
  offer: MasterclassOffer,
  person: { firstName: string; lastName?: string; email: string; phone: string },
  scheduleId: string
): Promise<void> {
  const { code, number } = splitPhone(person.phone);
  await post(offer, "register", {
    first_name: person.firstName,
    last_name: person.lastName ?? "",
    email: person.email,
    schedule: scheduleId,
    phone_country_code: code,
    phone: number,
  });
}
