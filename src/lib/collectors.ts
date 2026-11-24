/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Hourly data collectors that used to be n8n workflows (each run cost an n8n
 * execution, ~720 a month apiece). They now run as Vercel crons:
 *   - Ads Daily + Hourly   (Cortana -> Airtable Ads Daily / Ads Hourly)
 *   - Ads Range Totals     (Cortana -> Airtable Ads Range)
 *   - Connected Calls      (GHL -> Airtable, Bronson and Aaron)
 * Same logic, same tables, same keys (upserts merge on Key), so they can run
 * next to the old workflows without duplicating rows.
 */

const TZ = "America/New_York";
const BRONSON_BASE = "appiMw8gpaLv2WITA";
const AARON_BASE = "appuxfqSlDCFgNzn0";
const CORTANA_BUSINESS = "d71db67b-c468-4d33-a5d0-22677e8ed1bc";
const ADS_DAILY_TABLE = "tblL8SDCb0PKcxdL7";
const ADS_HOURLY_TABLE = "tblDzlpmtwjR3v9kL";
const ADS_RANGE_TABLE = "tblj3zPyKzSTxwSnV";
const BRONSON_CALLS_TABLE = "tblvKz06oPjczAk0p";
const AARON_CALLS_TABLE = "tbl9glaXKhORUZKe9";
const BROWSER_UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function cronAllowed(request: Request) {
  const secret = process.env.CRON_SECRET;
  return secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
}

// ---------- shared time helpers (Eastern calendar) ----------
function offMin(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(d).find((x) => x.type === "timeZoneName");
  const m = (p?.value || "GMT-5").match(/GMT([+-]\d+)/);
  return (m ? parseInt(m[1]) : -5) * 60;
}
const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const etMidnight = (ds: string) => new Date(Date.parse(ds + "T00:00:00Z") - offMin(new Date(ds + "T12:00:00Z")) * 60000);
const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z");
const addDays = (ds: string, n: number) => {
  const d = new Date(ds + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthEnd = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
};

// ---------- Airtable ----------
async function airtableUpsert(base: string, table: string, records: Record<string, unknown>[], typecast: boolean) {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) throw new Error("Missing AIRTABLE_PAT");
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(`https://api.airtable.com/v0/${base}/${table}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Key"] }, ...(typecast ? { typecast: true } : {}), records: records.slice(i, i + 10).map((fields) => ({ fields })) }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Airtable upsert ${table} failed (${res.status}) ${(await res.text()).slice(0, 200)}`);
    await sleep(250);
  }
}
const clean = (f: Record<string, unknown>) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined));

// ---------- Cortana ----------
async function cortana(startDate: string, endDate: string, groupBy: string, gapMs: number): Promise<any[]> {
  const key = process.env.CORTANA_API_KEY;
  if (!key) throw new Error("Missing CORTANA_API_KEY");
  const url = `https://app.usecortana.ai/api/v1/businesses/${CORTANA_BUSINESS}/attribution?` + new URLSearchParams({ startDate, endDate, groupBy });
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, "User-Agent": BROWSER_UA, Accept: "application/json" }, cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as any;
      await sleep(gapMs);
      return body?.data && Array.isArray(body.data.data) ? body.data.data : [];
    }
    last = `${res.status} ${(await res.text()).slice(0, 120)}`;
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`Cortana attribution failed: ${last}`);
}

const META_KEYS = ["spent", "impressions", "reach", "clicks", "inlineLinkClicks", "uniqueInlineLinkClicks", "landingPageViews", "frequency", "hookRate", "holdRate", "video3sViews", "video3sImpressions", "thruPlays", "dailyBudget", "status", "effectiveStatus"];
const CONV_KEYS = ["conversions", "leads", "totalRevenue", "pageViews", "uniqueVisitors"];
const cnt = (r: any, k: string) => {
  const x = (r.conversions || {})[k] || {};
  return x.uniqueCount || x.count || 0;
};
const eid = (r: any) => String(r.platformEntityId || String(r.dimensionKey || "").split("|||").pop() || r.dimension);

/** Each entity's Meta delivery (UTC-day query) merged with its pixel events (Eastern-day query). */
function mergeParts(meta: any[], conv: any[]) {
  const by = new Map<string, any>();
  const get = (r: any) => {
    const id = String(r.platformEntityId);
    if (!by.has(id)) by.set(id, { platformEntityId: r.platformEntityId, dimension: r.dimension, dimensionKey: r.dimensionKey, conversions: {} });
    return by.get(id);
  };
  for (const r of meta) {
    if (!r.platformEntityId) continue;
    const m = get(r);
    for (const k of META_KEYS) m[k] = r[k];
    m.dimension = r.dimension;
  }
  for (const r of conv) {
    if (!r.platformEntityId) continue;
    const m = get(r);
    for (const k of CONV_KEYS) m[k] = r[k];
    if (!m.dimension) m.dimension = r.dimension;
  }
  return [...by.values()];
}

// ---------- Ads Daily + Hourly ----------
export async function collectAdsDailyHourly(dry = false) {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = day(now);
  const yday = day(new Date(etMidnight(today).getTime() - 3600000));
  const daily: Record<string, unknown>[] = [];
  const hourly: Record<string, unknown>[] = [];

  for (const ds of [yday, today]) {
    const s = etMidnight(ds);
    const e = etMidnight(day(new Date(s.getTime() + 36 * 3600000)));
    const ms = new Date(ds + "T00:00:00Z");
    const me = new Date(ds + "T23:59:59Z");
    for (const level of ["campaign", "ad", "medium"]) {
      const conv = await cortana(iso(s), iso(e), level, 3000);
      const meta = await cortana(iso(ms), iso(me), level, 3000);
      const groupBy = level === "medium" ? "adset" : level;
      for (const r of mergeParts(meta, conv)) {
        if (!r.platformEntityId) continue;
        if (!(r.spent || r.impressions || r.leads || r.totalRevenue)) continue;
        daily.push(clean({
          Key: `${ds}|${groupBy}|${eid(r)}`, Date: ds, Level: groupBy, Name: r.dimension, "Entity ID": eid(r),
          Status: r.effectiveStatus || r.status || "", "Daily Budget": r.dailyBudget, Spend: r.spent || 0, Impressions: r.impressions || 0, Reach: r.reach || 0,
          Clicks: r.clicks || 0, "Link Clicks": r.inlineLinkClicks || 0, "LP Views": r.landingPageViews || 0, "Page Views": r.pageViews || 0,
          "Unique Visitors": r.uniqueVisitors || 0, Leads: r.leads || 0, Registrations: cnt(r, "complete_registration"), "Booked Calls": cnt(r, "appointment_booked"),
          "Calls Held": cnt(r, "post_call_note"), "HT Sales": cnt(r, "high_ticket"), Sales: cnt(r, "all_payments"), Revenue: r.totalRevenue || 0,
          "Hook Rate": r.hookRate, "Hold Rate": r.holdRate, Thruplays: r.thruPlays || 0, Frequency: r.frequency, "Video 3s Views": r.video3sViews || 0,
          "Video 3s Impressions": r.video3sImpressions || 0, "Unique Link Clicks": r.uniqueInlineLinkClicks || 0,
          "HT Revenue": (((r.conversions || {}).high_ticket || {}).revenue) || 0, "Synced At": nowIso,
        }));
      }
    }
  }

  const top = Math.floor(now.getTime() / 3600000) * 3600000;
  for (const back of [2, 1]) {
    const s = new Date(top - back * 3600000);
    const e = new Date(s.getTime() + 3600000);
    const h = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(s);
    const hour = `${day(s)}T${h.padStart(2, "0")}:00`;
    for (const groupBy of ["campaign", "ad"]) {
      const rows = await cortana(iso(s), iso(e), groupBy, 3000);
      for (const r of rows) {
        if (!r.platformEntityId) continue;
        const f: Record<string, number> = {
          Leads: r.leads || 0, Registrations: cnt(r, "complete_registration"), "Booked Calls": cnt(r, "appointment_booked"), Sales: cnt(r, "all_payments"),
          Revenue: r.totalRevenue || 0, "HT Sales": cnt(r, "high_ticket"), "HT Revenue": (((r.conversions || {}).high_ticket || {}).revenue) || 0,
        };
        if (!Object.values(f).some(Boolean)) continue;
        if (groupBy === "ad") {
          if (!f.Sales && !f["HT Sales"]) continue;
          hourly.push(clean({ Key: `${hour}|ad|${eid(r)}`, Hour: hour, Level: "ad", Campaign: r.dimension, "Entity ID": eid(r), ...f, "Synced At": nowIso }));
        } else {
          hourly.push(clean({ Key: `${hour}|${eid(r)}`, Hour: hour, Level: "campaign", Campaign: r.dimension, "Entity ID": eid(r), ...f, "Synced At": nowIso }));
        }
      }
    }
  }

  if (!dry) {
    await airtableUpsert(BRONSON_BASE, ADS_DAILY_TABLE, daily, true);
    await airtableUpsert(BRONSON_BASE, ADS_HOURLY_TABLE, hourly, true);
  }
  return { dry, daily: daily.length, hourly: hourly.length, sampleDaily: dry ? daily.slice(0, 2) : undefined, sampleHourly: dry ? hourly.slice(0, 2) : undefined };
}

// ---------- Ads Range Totals ----------
export async function collectAdsRange(dry = false) {
  const today = day(new Date());
  const ym = today.slice(0, 7);
  const lastM = addDays(ym + "-01", -1).slice(0, 7);
  const presets: Record<string, [string, string]> = {
    today: [today, today], yesterday: [addDays(today, -1), addDays(today, -1)], last_3_days: [addDays(today, -2), today], last_7_days: [addDays(today, -6), today],
    last_30_days: [addDays(today, -29), today], this_month: [ym + "-01", monthEnd(ym)], last_month: [lastM + "-01", monthEnd(lastM)], all_time: ["2025-01-01", today],
  };
  const run = new Date().toISOString();
  const recs: Record<string, unknown>[] = [];
  for (const [preset, [s, e]] of Object.entries(presets)) {
    for (const groupBy of ["campaign", "medium", "ad"]) {
      const conv = await cortana(iso(etMidnight(s)), iso(etMidnight(addDays(e, 1))), groupBy, 1500);
      const meta = await cortana(s + "T00:00:00Z", e + "T23:59:59Z", groupBy, 1500);
      const level = groupBy === "medium" ? "adset" : groupBy;
      for (const r of mergeParts(meta, conv)) {
        if (!r.platformEntityId) continue;
        if (!(r.spent || r.impressions || r.leads || r.totalRevenue)) continue;
        recs.push(clean({
          Key: `${preset}|${level}|${eid(r)}`, Preset: preset, Run: run, Level: level, Name: r.dimension, "Entity ID": eid(r),
          Status: r.effectiveStatus || r.status || "", "Daily Budget": r.dailyBudget, Spend: r.spent || 0, Reach: r.reach || 0, Impressions: r.impressions || 0,
          "Link Clicks": r.inlineLinkClicks || 0, "Unique Link Clicks": r.uniqueInlineLinkClicks || 0, "LP Views": r.landingPageViews || 0, "Page Views": r.pageViews || 0,
          "Unique Visitors": r.uniqueVisitors || 0, Leads: r.leads || 0, Registrations: cnt(r, "complete_registration"), "Booked Calls": cnt(r, "appointment_booked"),
          "Calls Held": cnt(r, "post_call_note"), "HT Sales": cnt(r, "high_ticket"), "HT Revenue": (((r.conversions || {}).high_ticket || {}).revenue) || 0,
          Sales: cnt(r, "all_payments"), Revenue: r.totalRevenue || 0, "Hook Rate": r.hookRate, "Hold Rate": r.holdRate, Frequency: r.frequency,
          "Video 3s Views": r.video3sViews || 0, "Video 3s Impressions": r.video3sImpressions || 0, Thruplays: r.thruPlays || 0,
        }));
      }
    }
  }
  if (!dry) await airtableUpsert(BRONSON_BASE, ADS_RANGE_TABLE, recs, true);
  return { dry, rows: recs.length, sample: dry ? recs.slice(0, 2) : undefined };
}

// ---------- Connected Calls (GHL -> Airtable) ----------
type CallsCfg = { name: string; base: string; table: string; pit: string; locationId: string; source: (tags: string[]) => string | null };

async function ghlFetch(pit: string, version: string, path: string, query?: Record<string, string>) {
  const url = `https://services.leadconnectorhq.com${path}` + (query ? "?" + new URLSearchParams(query) : "");
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pit}`, Version: version, "User-Agent": BROWSER_UA, Accept: "application/json" }, cache: "no-store" });
    if (res.ok) return (await res.json()) as any;
    if (res.status === 404) return null;
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`GHL ${path} failed`);
}

async function collectCalls(cfg: CallsCfg, dry: boolean) {
  const now = new Date();
  const start = new Date(now.getTime() - 72 * 3600 * 1000);
  const et = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const groups = new Map<string, { contactId: string; date: string; calls: number; longest: number; ids: Set<string> }>();
  let cursor = "";
  for (let page = 0; page < 80; page++) {
    const q: Record<string, string> = { locationId: cfg.locationId, channel: "Call", startDate: start.toISOString(), endDate: now.toISOString(), limit: "100" };
    if (cursor) q.cursor = cursor;
    const body = await ghlFetch(cfg.pit, "2021-04-15", "/conversations/messages/export", q);
    const msgs: any[] = body?.messages || [];
    for (const m of msgs) {
      if (m.messageType !== "TYPE_CALL") continue;
      const dur = Number(m.meta?.call?.duration) || 0;
      if (dur < 60 || !m.contactId || !m.dateAdded) continue;
      const date = et.format(new Date(m.dateAdded));
      const key = m.contactId + "::" + date;
      const g = groups.get(key) || { contactId: m.contactId, date, calls: 0, longest: 0, ids: new Set<string>() };
      if (g.ids.has(m.id)) continue;
      g.ids.add(m.id);
      g.calls += 1;
      g.longest = Math.max(g.longest, dur);
      groups.set(key, g);
    }
    cursor = body?.nextCursor || "";
    if (!cursor || msgs.length < 100) break;
  }

  const contactIds = [...new Set([...groups.values()].map((g) => g.contactId))];
  const info = new Map<string, { source: string; name: string | null }>();
  for (let i = 0; i < contactIds.length; i += 8) {
    await Promise.all(contactIds.slice(i, i + 8).map(async (id) => {
      const body = await ghlFetch(cfg.pit, "2021-07-28", `/contacts/${id}`);
      const c = body?.contact || body;
      if (!c?.id) return;
      const tags = (c.tags || []).map((t: unknown) => String(t).toLowerCase().trim());
      const source = cfg.source(tags);
      if (!source) return;
      info.set(c.id, { source, name: c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ") || null });
    }));
    await sleep(900);
  }

  const updatedAt = new Date().toISOString();
  const records: Record<string, unknown>[] = [];
  for (const g of groups.values()) {
    const who = info.get(g.contactId);
    if (!who) continue;
    const fields: Record<string, unknown> = {
      Key: g.date + "::" + g.contactId, Date: g.date, "Contact ID": g.contactId, Source: who.source,
      "Calls Over 1 Min": g.calls, "Longest Call (sec)": g.longest, "Updated At": updatedAt,
    };
    if (who.name) fields.Name = who.name;
    records.push(fields);
  }
  if (!dry) await airtableUpsert(cfg.base, cfg.table, records, false);
  return { name: cfg.name, dry, callGroups: groups.size, contacts: contactIds.length, rows: records.length, sample: dry ? records.slice(0, 2) : undefined };
}

export async function collectConnectedCalls(dry = false) {
  const results: unknown[] = [];
  const bronsonPit = process.env.GHL_BRONSON_PIT, bronsonLoc = process.env.GHL_BRONSON_LOCATION_ID;
  if (bronsonPit && bronsonLoc) {
    results.push(await collectCalls({
      name: "bronson", base: BRONSON_BASE, table: BRONSON_CALLS_TABLE, pit: bronsonPit, locationId: bronsonLoc,
      // Masterclass registrants only: Bronson no longer runs the Base44 affiliate funnel.
      source: (tags) => (tags.includes("masterclass paid") ? "Paid" : tags.includes("masterclass organic") ? "Organic" : null),
    }, dry));
  } else results.push({ name: "bronson", error: "missing GHL_BRONSON_PIT / GHL_BRONSON_LOCATION_ID" });
  const aaronPit = process.env.GHL_AARON_PIT, aaronLoc = process.env.GHL_AARON_LOCATION_ID;
  if (aaronPit && aaronLoc) {
    results.push(await collectCalls({
      name: "aaron", base: AARON_BASE, table: AARON_CALLS_TABLE, pit: aaronPit, locationId: aaronLoc,
      // Masterclass registrants are kept too, labelled "Masterclass" so the Paid / Organic connection-rate cards ignore them.
      source: (tags) => (tags.includes("base44 paid") ? "Paid" : tags.includes("base44 organic") ? "Organic" : tags.some((t) => t.startsWith("masterclass")) ? "Masterclass" : null),
    }, dry));
  } else results.push({ name: "aaron", error: "missing GHL_AARON_PIT / GHL_AARON_LOCATION_ID" });
  return results;
}
