/**
 * Apple Wallet pass service (built 2026-11-05). One Pass Type ID serves every
 * client; each event below is white-labelled per pass.
 *
 * webServiceURL is baked into every installed pass, so it must never move:
 * it lives on the agency domain, not a client's.
 */

export const WALLET_TEAM_ID = "6XCQPSRSK6";
export const WALLET_BASE_URL = "https://www.koconsultings.com/wallet";

export function passTypeId(): string {
  const id = process.env.WALLET_PASS_TYPE_ID;
  if (!id) throw new Error("Missing WALLET_PASS_TYPE_ID");
  return id;
}

export type WalletEvent = {
  id: string;
  /** Public key in the claim link, safe to put on a landing page. */
  publicKey: string;
  /** One display name everywhere: banner, organizationName, description. Keep under ~28 chars. */
  name: string;
  brand: string;
  /** Weekly schedule in the event's own timezone, so daylight saving never moves it. */
  timeZone: string;
  weekday: number; // 0 = Sunday
  /**
   * Several sessions a week (Encore: Sun, Tue, Wed, Fri, Sat). When set, `weekday` is ignored and the
   * pass points at the next session that has not started yet (rolls at the start time, like /encore).
   */
  weekdays?: number[];
  hour: number;
  minute: number;
  durationMinutes: number;
  /** Pins the next session to this local date (YYYY-MM-DD) until it has run. */
  pinnedDate?: string;
  /**
   * Reminder ladder 24h / lead / 1h before, "Live now" at the start, last call 15 minutes in (replaces the
   * 15-minutes-before "Starting now"). Not for weekdays events: those roll to the next session at the start.
   */
  liveReminders?: boolean;
  /** Lead time for the middle reminder, in minutes. */
  leadMinutes: number;
  joinUrl: string;
  access: string;
  colors: { background: string; foreground: string; label: string };
  /** Artwork key in WALLET_ASSETS. */
  assets: string;
  /**
   * Front shows the start time with time zone ("7:00 PM EST") where STATUS was; the status moves
   * to the back so its reminder alerts still fire (Bronson, user 2026-11-08: the card showed only the date).
   */
  timeOnFront?: boolean;
  /**
   * Per-event version of PASS_DESIGN_UPDATED: bump it when only this event's pass changes,
   * so other clients' installed passes are left alone.
   */
  designUpdated?: string;
  /** Colours for the /wallet/p landing page. Omitted = the original green (Bronson). */
  page?: { accent: string; glow: string; bgTop: string; bgBottom: string; tagBg: string; tagInk: string };
};

export const WALLET_EVENTS: WalletEvent[] = [
  {
    id: "bronson-masterclass",
    publicKey: "itm-7f3k2q",
    name: "MRR E-Commerce Masterclass",
    brand: "Ecom MBA",
    timeZone: "America/New_York",
    weekday: 1,
    hour: 19,
    minute: 0,
    durationMinutes: 90,
    // Keep in step with ~/repos/bronson masterclass-confirmation/done-shared.js (MASTERCLASS_DATE).
    // Mon Nov 16, 7 PM ET (user, 2026-11-08); weekly on Mondays after that.
    pinnedDate: "2026-11-16",
    leadMinutes: 180,
    liveReminders: true,
    joinUrl: "https://event.webinarjam.com/8wgzn9/go/live/13q192tyipsxs4",
    access: "Live Only",
    colors: { background: "rgb(252,253,252)", foreground: "rgb(15,23,42)", label: "rgb(22,163,74)" },
    assets: "bronson-masterclass",
    timeOnFront: true,
    designUpdated: "2026-11-14T03:30:00Z", // new Ecom MBA logo
  },
  {
    // Encore: automated AEvent sessions on every day except the live days (Mon + Thu), 8 PM ET.
    // Keep weekdays/hour in step with ~/repos/bronson encore/index.html (MASTERCLASS_DAYS / MASTERCLASS_HOUR)
    // and the AEvent recurring entry (campaign awSPuZl1HKdhVV4). Its own pass so the Monday masterclass pass is untouched.
    id: "bronson-encore",
    publicKey: "enc-5r8k3w",
    name: "MRR E-Commerce Masterclass",
    brand: "Ecom MBA",
    timeZone: "America/New_York",
    weekday: 2,
    weekdays: [0, 2, 3, 5, 6],
    hour: 20,
    minute: 0,
    durationMinutes: 90,
    leadMinutes: 60,
    // The AEvent join link is personal and arrives by text and email; the pass points at the Encore page.
    joinUrl: "https://www.ad-ventur.com/encore",
    access: "Live Only",
    colors: { background: "rgb(252,253,252)", foreground: "rgb(15,23,42)", label: "rgb(22,163,74)" },
    assets: "bronson-masterclass",
    timeOnFront: true,
    designUpdated: "2026-11-16T17:00:00Z",
  },
];

export const eventById = (id: string) => WALLET_EVENTS.find((e) => e.id === id);
export const eventByKey = (key: string) => WALLET_EVENTS.find((e) => e.publicKey === key);
