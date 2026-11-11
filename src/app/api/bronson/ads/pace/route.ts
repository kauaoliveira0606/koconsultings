import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { getAdsDaily, getAdsHourly, type AdsHourlyRow } from "@/lib/ads-cortana";
import { safeDivide } from "@/lib/metrics";

export const revalidate = 60;

/** Bronson cost per registration lines (goals.ts costPerLeadMeta): green ≤ $15, red over $18. */
const CPL_GOOD = 15;
const CPL_BAD = 18;

type Window = { leads: number; registrations: number; booked: number; sales: number; revenue: number };
const empty = (): Window => ({ leads: 0, registrations: 0, booked: 0, sales: 0, revenue: 0 });
function add(w: Window, r: AdsHourlyRow) {
  w.leads += r.leads;
  w.registrations += r.registrations;
  w.booked += r.booked;
  w.sales += r.sales;
  w.revenue += r.revenue;
}

/** "YYYY-MM-DDTHH:00" for an Eastern hour, `back` hours before the current one. */
function etHourLabel(back: number): string {
  const d = new Date(Date.now() - back * 3_600_000);
  const day = easternDateString(d);
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(d);
  return `${day}T${h.padStart(2, "0")}:00`;
}

/**
 * 3-hour pace (Manos-style): what the last three finished hours brought in,
 * hour-by-hour opt-ins today vs yesterday, and a budget call per campaign.
 * Spend for today isn't known until Cortana's next-morning sync, so the
 * budget call uses yesterday's and the 3-day cost per opt-in, plus whether
 * the last 3 hours are running ahead of yesterday's hourly average.
 */
export async function GET() {
  const [hourly, daily] = await Promise.all([getAdsHourly(), getAdsDaily()]);
  const today = easternDateString();
  const yesterday = addDaysToDateString(today, -1);

  const last3 = [3, 2, 1].map(etHourLabel);
  const prev3 = [6, 5, 4].map(etHourLabel);
  const latestSynced = hourly.reduce((m, r) => (r.hour > m ? r.hour : m), "");

  const sumHours = (hours: string[], filter?: (r: AdsHourlyRow) => boolean) => {
    const w = empty();
    const set = new Set(hours);
    for (const r of hourly) if (set.has(r.hour) && (!filter || filter(r))) add(w, r);
    return w;
  };

  // Hour-by-hour opt-ins, today vs yesterday (0..23 Eastern).
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, "0");
    const t = sumHours([`${today}T${hh}:00`]);
    const y = sumHours([`${yesterday}T${hh}:00`]);
    return { hour: h, today: t.registrations, yesterday: y.registrations, todayLeads: t.leads, yesterdayLeads: y.leads };
  });

  // Per campaign: last 3h vs yesterday's hourly pace, yesterday + 3-day cost per opt-in.
  const campaignIds = new Set<string>();
  const names = new Map<string, string>();
  for (const r of daily) {
    if (r.level !== "campaign") continue;
    if (r.date >= addDaysToDateString(today, -3)) {
      campaignIds.add(r.entityId);
      names.set(r.entityId, r.name);
    }
  }
  for (const r of hourly) {
    if (last3.includes(r.hour)) {
      campaignIds.add(r.entityId);
      if (!names.has(r.entityId)) names.set(r.entityId, r.campaign);
    }
  }

  const campaigns = [...campaignIds].map((id) => {
    const rows = daily.filter((r) => r.level === "campaign" && r.entityId === id);
    const y = rows.find((r) => r.date === yesterday);
    const three = rows.filter((r) => r.date >= addDaysToDateString(today, -3) && r.date < today);
    const threeSpend = three.reduce((s, r) => s + r.spend, 0);
    const threeRegs = three.reduce((s, r) => s + r.registrations, 0);
    const w3 = sumHours(last3, (r) => r.entityId === id);
    const yRegs = y?.registrations ?? 0;
    const yHourly = yRegs / 24;
    const pace3 = w3.registrations / 3;
    const cplY = y && y.spend ? safeDivide(y.spend, y.registrations) : null;
    const cpl3d = threeSpend ? safeDivide(threeSpend, threeRegs) : null;
    const latest = rows.sort((a, b) => b.date.localeCompare(a.date))[0];
    const status = latest?.status ?? "";
    const activeYesterday = (y?.spend ?? 0) > 0;

    let action: "scale" | "hold" | "watch" | "cut" | "paused";
    let reason: string;
    if (!activeYesterday && w3.registrations === 0) {
      action = "paused";
      reason = "No spend yesterday and no opt-ins in the last 3 hours.";
    } else if (cplY !== null && cpl3d !== null && cplY > CPL_BAD && cpl3d > CPL_BAD) {
      action = "cut";
      reason = `Cost per opt-in over $${CPL_BAD} yesterday and across 3 days.`;
    } else if (cplY !== null && cplY > CPL_BAD) {
      action = "watch";
      reason = `Yesterday's cost per opt-in was over $${CPL_BAD}; 3-day still OK.`;
    } else if (cpl3d !== null && cpl3d > CPL_BAD) {
      action = "watch";
      reason = `3-day cost per opt-in is over $${CPL_BAD}, even though yesterday was inside the line.`;
    } else if (cplY !== null && cplY <= CPL_GOOD && pace3 >= yHourly) {
      action = "scale";
      reason = `Cost per opt-in at or under $${CPL_GOOD} and the last 3 hours are pacing at or above yesterday.`;
    } else {
      action = "hold";
      reason = "Inside the cost per opt-in band; no clear signal to move budget.";
    }

    return {
      entityId: id,
      name: names.get(id) ?? id,
      status,
      dailyBudget: latest?.dailyBudget ?? null,
      last3h: w3,
      pacePerHour: pace3,
      yesterdayPerHour: yHourly,
      spendYesterday: y?.spend ?? 0,
      registrationsYesterday: yRegs,
      cplYesterday: cplY,
      cpl3d,
      revenueYesterday: y?.revenue ?? 0,
      roasYesterday: y && y.spend ? y.revenue / y.spend : null,
      action,
      reason,
    };
  });
  campaigns.sort((a, b) => b.spendYesterday - a.spendYesterday || b.last3h.registrations - a.last3h.registrations);

  const last3Total = sumHours(last3);
  const prev3Total = sumHours(prev3);
  const sameYesterday = sumHours(last3.map((h) => h.replace(today, yesterday)));
  const spendYesterday = daily.filter((r) => r.level === "campaign" && r.date === yesterday).reduce((s, r) => s + r.spend, 0);
  const regsYesterday = daily.filter((r) => r.level === "campaign" && r.date === yesterday).reduce((s, r) => s + r.registrations, 0);

  return Response.json({
    window: { from: last3[0], to: last3[2], latestSynced: latestSynced || null },
    last3h: last3Total,
    prev3h: prev3Total,
    sameHoursYesterday: sameYesterday,
    yesterday: { spend: spendYesterday, registrations: regsYesterday, cpl: safeDivide(spendYesterday, regsYesterday) },
    byHour,
    campaigns,
    rules: { cplGood: CPL_GOOD, cplBad: CPL_BAD },
  });
}
