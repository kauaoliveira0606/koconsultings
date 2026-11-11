import { airtableListFresh } from "@/lib/airtable/client";
import { easternDateString } from "@/lib/date-range";

/**
 * Real connection checks for the Integrations tab (user, 2026-11-10: the old
 * Connect button only flipped a label). Each check calls the service with the
 * dashboard's own key, or looks at how fresh the data it feeds is. A source the
 * dashboard has no key or data for is reported as "unverified", never as connected.
 */
export type CheckState = "connected" | "problem" | "unverified";
export type CheckResult = { name: string; state: CheckState; detail: string; checkedAt: string };

const BASE = "appiMw8gpaLv2WITA";
const SITE = "https://www.ad-ventur.com";

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

async function timed<T>(fn: () => Promise<T>, ms = 10_000): Promise<T> {
  return await Promise.race([fn(), new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
}

/** Newest value of a field across a table's records. */
async function newest(table: string, field: string): Promise<string | null> {
  const recs = await airtableListFresh(BASE, table);
  let max = "";
  for (const r of recs) {
    const v = String((r.fields as Record<string, unknown>)[field] ?? "");
    if (v > max) max = v;
  }
  return max || null;
}

type Check = (name: string) => Promise<Omit<CheckResult, "name" | "checkedAt">>;

const CHECKS: Record<string, Check> = {
  async Cortana() {
    const [daily, range] = await Promise.all([newest("tblL8SDCb0PKcxdL7", "Synced At"), newest("tblj3zPyKzSTxwSnV", "Run")]);
    const last = [daily, range].filter(Boolean).sort().pop() ?? null;
    if (!last) return { state: "problem", detail: "No Cortana data has been synced yet." };
    const fresh = Date.now() - new Date(last).getTime() < 2.5 * 3600_000;
    return fresh
      ? { state: "connected", detail: `Ad numbers synced ${ago(last)} (hourly).` }
      : { state: "problem", detail: `Last Cortana sync was ${ago(last)}; it should run every hour.` };
  },

  async Meta() {
    // User, 2026-11-11: no Meta token, he switches ad accounts often. Ad data comes through Cortana.
    return { state: "unverified", detail: "Not connected on purpose: you switch ad accounts, so all ad numbers come through Cortana instead." };
  },

  async GoHighLevel() {
    const pit = process.env.GHL_BRONSON_PIT;
    const loc = process.env.GHL_BRONSON_LOCATION_ID;
    if (!pit || !loc) return { state: "problem", detail: "No GoHighLevel key on the dashboard." };
    const res = await fetch(`https://services.leadconnectorhq.com/locations/${loc}`, {
      headers: { Authorization: `Bearer ${pit}`, Version: "2021-07-28", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { state: "problem", detail: `GoHighLevel refused the key (HTTP ${res.status}).` };
    const body = (await res.json().catch(() => ({}))) as { location?: { name?: string } };
    return { state: "connected", detail: `Key works for location "${body.location?.name ?? loc}".` };
  },

  async Calendly() {
    const pat = process.env.CALENDLY_BRONSON_PAT;
    if (!pat) return { state: "problem", detail: "No Calendly key on the dashboard." };
    const res = await fetch("https://api.calendly.com/users/me", { headers: { Authorization: `Bearer ${pat}` }, cache: "no-store" });
    if (!res.ok) return { state: "problem", detail: `Calendly refused the key (HTTP ${res.status}).` };
    const body = (await res.json().catch(() => ({}))) as { resource?: { name?: string } };
    return { state: "connected", detail: `Key works for ${body.resource?.name ?? "the Calendly account"}.` };
  },

  async WebinarJam() {
    const key = process.env.WEBINARJAM_API_KEY;
    if (!key) return { state: "problem", detail: "No WebinarJam key on the dashboard." };
    const res = await fetch("https://api.webinarjam.com/webinarjam/webinars", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: key }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; webinars?: unknown[]; message?: string };
    if (!res.ok || body.status !== "success") return { state: "problem", detail: `WebinarJam refused the key${body.message ? `: ${body.message}` : ` (HTTP ${res.status})`}.` };
    return { state: "connected", detail: `Key works; ${Array.isArray(body.webinars) ? body.webinars.length : "some"} webinars on the account.` };
  },

  async Airtable() {
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/tblL8SDCb0PKcxdL7?pageSize=1`, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT ?? ""}` },
      cache: "no-store",
    });
    return res.ok
      ? { state: "connected", detail: "Reads from the Bronson base work." }
      : { state: "problem", detail: `Airtable refused the key (HTTP ${res.status}).` };
  },

  async n8n() {
    const last = await newest("tblL8SDCb0PKcxdL7", "Synced At");
    if (!last) return { state: "problem", detail: "No sign of the n8n jobs writing data." };
    const fresh = Date.now() - new Date(last).getTime() < 2.5 * 3600_000;
    return fresh
      ? { state: "connected", detail: `Hourly jobs are running: last write ${ago(last)}.` }
      : { state: "problem", detail: `The hourly n8n jobs last wrote ${ago(last)}.` };
  },

  async VTurb() {
    const last = await newest("tblXkoLdiizJoUjjD", "Date");
    if (!last) return { state: "problem", detail: "No VSL stats have ever been synced." };
    const days = Math.round((Date.parse(easternDateString()) - Date.parse(last)) / 86400_000);
    return days <= 2
      ? { state: "connected", detail: `VSL stats synced through ${last}.` }
      : { state: "problem", detail: `Last VSL stats are from ${last} (${days} days ago). Nothing is syncing.` };
  },

  async Vercel() {
    const started = Date.now();
    const res = await fetch(`${SITE}/`, { cache: "no-store" });
    return res.ok
      ? { state: "connected", detail: `ad-ventur.com is live (${Date.now() - started} ms).` }
      : { state: "problem", detail: `ad-ventur.com answered HTTP ${res.status}.` };
  },

  async "Microsoft Clarity"() {
    const pages = ["/", "/masterclass", "/application"];
    const found = await Promise.all(
      pages.map(async (p) => {
        const html = await fetch(`${SITE}${p}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
        return [p, /clarity\.ms/.test(html)] as const;
      }),
    );
    const on = found.filter(([, ok]) => ok).map(([p]) => p);
    const off = found.filter(([, ok]) => !ok).map(([p]) => p);
    if (!on.length) return { state: "problem", detail: "The Clarity tag isn't on the site." };
    return off.length
      ? { state: "problem", detail: `Tag found on ${on.join(", ")} but missing on ${off.join(", ")}.` }
      : { state: "connected", detail: `Tag found on ${on.join(", ")}.` };
  },

  async Whop() {
    return { state: "unverified", detail: "The dashboard has no Whop key, so it can't check this. Payments reach Discord through n8n." };
  },
  async Supabase() {
    return { state: "unverified", detail: "The dashboard has no Supabase key and doesn't read from it." };
  },
  async Roezan() {
    return { state: "unverified", detail: "The dashboard has no Roezan key, so it can't check this." };
  },
};

export const CHECKED_NAMES = Object.keys(CHECKS);

export async function runChecks(names: string[]): Promise<CheckResult[]> {
  return Promise.all(
    names.map(async (name) => {
      const checkedAt = new Date().toISOString();
      const check = CHECKS[name];
      if (!check) return { name, state: "unverified" as const, detail: "No check exists for this source yet.", checkedAt };
      try {
        return { name, checkedAt, ...(await timed(() => check(name))) };
      } catch (err) {
        return { name, state: "problem" as const, detail: `Check failed: ${err instanceof Error ? err.message : "error"}.`, checkedAt };
      }
    }),
  );
}
