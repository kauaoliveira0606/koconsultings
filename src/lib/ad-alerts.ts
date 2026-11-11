import { airtableListFresh } from "@/lib/airtable/client";
import { aggregateEntities, getAdsRange, type AdsDailyRow, type AdsEntity } from "@/lib/ads-cortana";
import { addTask, AI_ASSIGNEE } from "@/lib/office";
import { postToDiscord } from "@/lib/discord";

/**
 * "Hear about problems first" (user, 2026-11-10). Hourly check of the ad
 * numbers against the KPI lines; each problem is saved in Airtable "Ad Alerts",
 * shown as a banner on Overview / Ads, queued for the AI in the Office, and
 * posted to Discord when DISCORD_BRONSON_ALERTS_WEBHOOK is set. The same alert
 * is not re-sent within 6 hours.
 */
const BASE = "appiMw8gpaLv2WITA";
const TABLE = "tblIUYyt7DVZIXDRv";
const RESEND_MS = 6 * 3600_000;

export type Alert = { key: string; level: "red" | "yellow"; title: string; detail: string };
export type StoredAlert = Alert & { id: string; firstAt: string; lastSeen: string; active: boolean };

const money = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function campaigns(rows: AdsDailyRow[] | null): AdsEntity[] {
  return rows ? aggregateEntities(rows.filter((r) => r.level === "campaign")) : [];
}
function total(list: AdsEntity[]) {
  const s = (k: keyof AdsEntity) => list.reduce((a, r) => a + ((r[k] as number) || 0), 0);
  const spend = s("spend");
  const reg = s("registrations");
  const lpv = s("lpViews");
  return { spend, reg, lpv, revenue: s("revenue"), cpr: reg ? spend / reg : null, optIn: lpv && lpv >= reg ? reg / lpv : null };
}

/** Works out the current problems. Pure read: nothing is sent here. */
export async function findAlerts(now = new Date()): Promise<Alert[]> {
  const [today, yesterday, last3, last7] = await Promise.all([
    getAdsRange("today"),
    getAdsRange("yesterday"),
    getAdsRange("last_3_days"),
    getAdsRange("last_7_days"),
  ]);
  const out: Alert[] = [];
  const hourET = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(now));

  const t = total(campaigns(today));
  const y = total(campaigns(yesterday));
  const w = total(campaigns(last7));

  // Ads look off: real spend yesterday, nothing today by 1 PM.
  if (hourET >= 13 && y.spend > 50 && t.spend === 0)
    out.push({ key: "spend-zero-today", level: "red", title: "No ad spend today", detail: `Yesterday spent ${money(y.spend)}, today shows $0 at ${hourET}:00 ET. Check the ad account, billing or campaign status.` });

  // Cost per complete registration, today (once enough has been spent) and yesterday.
  if (t.spend >= 75 && t.cpr !== null && t.cpr > 15)
    out.push({ key: "cpr-today", level: "red", title: "Cost per registration is over $15 today", detail: `${money(t.cpr)} per complete registration (${money(t.spend)} spent, ${t.reg} registrations). Goal: under $15 (red over $18).` });
  else if (t.spend >= 75 && t.cpr === null)
    out.push({ key: "cpr-today", level: "red", title: "Spend but no registrations today", detail: `${money(t.spend)} spent and 0 complete registrations so far.` });
  if (y.spend >= 75 && y.cpr !== null && y.cpr > 15)
    out.push({ key: "cpr-yesterday", level: "yellow", title: "Cost per registration was over $15 yesterday", detail: `${money(y.cpr)} per complete registration (${money(y.spend)} spent, ${y.reg} registrations).` });

  // Opt-in rate on the page.
  if (t.lpv >= 40 && t.optIn !== null && t.optIn < 0.2)
    out.push({ key: "optin-today", level: "red", title: "Opt-in rate under 20% today", detail: `${pct(t.optIn)} of landing page views registered (${t.reg} of ${t.lpv}). Line: 30% good, under 20% bad. Check the page and the form.` });

  // ROAS over the last 7 days (cash lags, so a week is the fair window).
  if (w.spend >= 300 && w.revenue / w.spend < 2.4)
    out.push({ key: "roas-7d", level: "yellow", title: "7-day ROAS under 2.4x", detail: `${(w.revenue / w.spend).toFixed(2)}x on ${money(w.spend)} spent in the last 7 days (${money(w.revenue)} attributed). Goal 3x.` });

  // Per campaign, last 3 days: cost per registration, CPM, link CTR, frequency.
  for (const c of campaigns(last3)) {
    if (c.spend < 100) continue;
    if (c.costPerOptIn !== null && c.costPerOptIn > 15)
      out.push({ key: `camp-cpr-${c.entityId}`, level: "yellow", title: `"${c.name}" over $15 per registration (3 days)`, detail: `${money(c.costPerOptIn)} per registration on ${money(c.spend)} spent.` });
    if (c.cpm !== null && c.cpm > 80)
      out.push({ key: `camp-cpm-${c.entityId}`, level: "yellow", title: `"${c.name}" CPM over $80 (3 days)`, detail: `CPM ${money(c.cpm)}. Line: under $20 good, over $80 bad.` });
    if (c.linkCtr !== null && c.linkCtr < 0.005)
      out.push({ key: `camp-ctr-${c.entityId}`, level: "yellow", title: `"${c.name}" link CTR under 0.5% (3 days)`, detail: `LCTR ${pct(c.linkCtr)}. The creative isn't getting clicks.` });
    if (c.frequency !== null && c.frequency > 3.5)
      out.push({ key: `camp-freq-${c.entityId}`, level: "yellow", title: `"${c.name}" frequency over 3.5 (3 days)`, detail: `Frequency ${c.frequency.toFixed(2)}. The audience is seeing the same ads too often.` });
  }

  // Data itself stopped coming in.
  const recs = await airtableListFresh(BASE, "tblL8SDCb0PKcxdL7");
  const last = recs.reduce((m, r) => {
    const v = String((r.fields as Record<string, unknown>)["Synced At"] ?? "");
    return v > m ? v : m;
  }, "");
  if (!last || now.getTime() - new Date(last).getTime() > 3 * 3600_000)
    out.push({ key: "sync-stale", level: "red", title: "Ad numbers stopped syncing", detail: last ? `Last Cortana sync was ${new Date(last).toLocaleString("en-US", { timeZone: "America/New_York" })} ET.` : "No Cortana sync found." });

  return out;
}

export async function getStoredAlerts(): Promise<StoredAlert[]> {
  const recs = await airtableListFresh(BASE, TABLE);
  return recs
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      return {
        id: r.id,
        key: String(f.Key ?? ""),
        level: (f.Level === "red" ? "red" : "yellow") as "red" | "yellow",
        title: String(f.Title ?? ""),
        detail: String(f.Detail ?? ""),
        firstAt: String(f["First At"] ?? ""),
        lastSeen: String(f["Last Seen"] ?? ""),
        active: f.Active === true,
        lastSent: String(f["Last Sent"] ?? ""),
      };
    })
    .filter((a) => a.key);
}

async function write(method: "POST" | "PATCH", records: unknown[]) {
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${method} alerts failed (${res.status}): ${await res.text()}`);
  }
}

async function postDiscord(alerts: Alert[]) {
  const url = process.env.DISCORD_BRONSON_ALERTS_WEBHOOK;
  if (!url || !alerts.length) return false;
  const lines = alerts.map((a) => `${a.level === "red" ? "🔴" : "🟡"} **${a.title}**\n${a.detail}`);
  return postToDiscord(url, "Berlin", `**Ad alerts**\n\n${lines.join("\n\n")}\n\nhttps://www.koconsultings.com/bronson/ads`);
}

/** Runs the check: saves alerts, resolves cleared ones, queues new ones for the AI, posts to Discord. */
export async function runAlertCheck(now = new Date()) {
  const [found, stored] = await Promise.all([findAlerts(now), getStoredAlerts()]);
  const nowIso = now.toISOString();
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const toSend: Alert[] = [];
  const creates: unknown[] = [];
  const patches: unknown[] = [];

  for (const a of found) {
    const s = byKey.get(a.key) as (StoredAlert & { lastSent?: string }) | undefined;
    const due = !s || !s.active || !s.lastSent || now.getTime() - new Date(s.lastSent).getTime() > RESEND_MS;
    if (due) toSend.push(a);
    const fields: Record<string, unknown> = { Key: a.key, Level: a.level, Title: a.title, Detail: a.detail, "Last Seen": nowIso, Active: true };
    if (due) fields["Last Sent"] = nowIso;
    if (!s) {
      fields["First At"] = nowIso;
      // New problem: queue it for the AI to investigate.
      try {
        const taskId = await addTask({
          task: `Investigate: ${a.title}`,
          description: `${a.detail}\n\nFound by the hourly ad alert check. Look at the Ads tab (campaigns, ad sets, ads), find the cause, and put a recommendation in Review.`,
          department: "Marketing",
          role: "AI",
          assignee: AI_ASSIGNEE,
          status: "Up Next",
          priority: a.level === "red" ? "High" : "Normal",
        });
        if (taskId) fields["Office Task"] = taskId;
      } catch {
        // Office write failing must not stop the alert itself.
      }
      creates.push({ fields });
    } else {
      if (!s.active) fields["First At"] = nowIso;
      patches.push({ id: s.id, fields });
    }
  }
  // Cleared problems.
  const foundKeys = new Set(found.map((a) => a.key));
  for (const s of stored) if (s.active && !foundKeys.has(s.key)) patches.push({ id: s.id, fields: { Active: false, "Last Seen": nowIso } });

  if (creates.length) await write("POST", creates);
  if (patches.length) await write("PATCH", patches);
  const discord = await postDiscord(toSend);
  return { found: found.length, sent: toSend.length, discord, discordConfigured: Boolean(process.env.DISCORD_BRONSON_ALERTS_WEBHOOK) };
}
