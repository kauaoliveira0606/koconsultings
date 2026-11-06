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
  hour: number;
  minute: number;
  durationMinutes: number;
  /** Pins the next session to this local date (YYYY-MM-DD) until it has run. */
  pinnedDate?: string;
  /** Lead time for the middle reminder, in minutes. */
  leadMinutes: number;
  joinUrl: string;
  access: string;
  colors: { background: string; foreground: string; label: string };
  /** Artwork key in WALLET_ASSETS. */
  assets: string;
};

export const WALLET_EVENTS: WalletEvent[] = [
  {
    id: "bronson-masterclass",
    publicKey: "itm-7f3k2q",
    name: "MRR E-Commerce Masterclass",
    brand: "The Inner Table",
    timeZone: "America/New_York",
    weekday: 3,
    hour: 19,
    minute: 0,
    durationMinutes: 90,
    // Keep in step with ~/repos/bronson masterclass-confirmation/done-shared.js (MASTERCLASS_DATE).
    pinnedDate: "2026-11-18",
    leadMinutes: 180,
    joinUrl: "https://event.webinarjam.com/8wgzn9/go/live/13q192tyipsxs4",
    access: "Live Only",
    colors: { background: "rgb(252,253,252)", foreground: "rgb(15,23,42)", label: "rgb(22,163,74)" },
    assets: "bronson-masterclass",
  },
];

export const eventById = (id: string) => WALLET_EVENTS.find((e) => e.id === id);
export const eventByKey = (key: string) => WALLET_EVENTS.find((e) => e.publicKey === key);
