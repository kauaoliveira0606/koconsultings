import type { NextRequest } from "next/server";
import { parseRangeFromRequest } from "@/lib/api-range";
import { easternDateString, isDateInRange } from "@/lib/date-range";
import { getBookings, getConnectedCalls, getMarketingDailyMetrics, getPostCallNotes } from "@/lib/airtable/tables";
import { bronsonRegistrants } from "@/lib/bronson-webinar-funnel";
import { webinarSourceRows, type SourceFunnel } from "@/lib/webinar-source-funnel";
import { PITCH_AT_SECONDS, WEBINAR_SCHEDULE } from "@/lib/webinar-schedule";
import { getAdsDaily } from "@/lib/ads-cortana";

export const revalidate = 120;

type Step = {
  key: string;
  label: string;
  value: number | null;
  /** Conversion from the step before, as a fraction. */
  rate: number | null;
  rateLabel: string | null;
  kpi: string | null;
  note: string;
};

const div = (a: number | null, b: number | null) => (a === null || b === null || !b ? null : a / b);

function addFunnel(acc: SourceFunnel | null, f: SourceFunnel): SourceFunnel {
  if (!acc) return { ...f };
  const out = { ...acc } as Record<string, unknown>;
  for (const k of ["registered", "attended", "stayed", "booked", "canceled", "connected", "connectable", "due", "showed", "closed", "cashCollected"] as const) {
    out[k] = (Number(acc[k]) || 0) + (Number(f[k]) || 0);
  }
  return out as SourceFunnel;
}

/**
 * Funnel analytics map (Manos "Analytics" view) for the Bronson webinar funnel:
 * Meta ad -> click -> landing page -> opt-in -> live attendee -> stayed to
 * pitch -> booked call -> showed -> closed -> cash. Ad steps from Cortana
 * (paid only); webinar and call steps from WebinarJam + Calendly + Post
 * Call Notes for the webinars held in the range.
 */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const source = (request.nextUrl.searchParams.get("source") ?? "paid") as "paid" | "organic" | "total";
  const today = easternDateString();

  const [ads, marketing, registrants, bookings, calls, notes] = await Promise.all([
    getAdsDaily(),
    getMarketingDailyMetrics(),
    bronsonRegistrants(today),
    getBookings(),
    getConnectedCalls(),
    getPostCallNotes(),
  ]);

  const camp = ads.filter((r) => r.level === "campaign" && isDateInRange(r.date, range));
  const s = (k: "spend" | "impressions" | "linkClicks" | "lpViews" | "registrations") => camp.reduce((a, r) => a + r[k], 0);
  const spend = s("spend");
  const impressions = s("impressions");
  const linkClicks = s("linkClicks");
  const lpViews = s("lpViews");
  const adOptIns = s("registrations");

  const webinars = webinarSourceRows(WEBINAR_SCHEDULE.bronson, marketing, registrants, bookings, calls, notes, today, PITCH_AT_SECONDS.bronson)
    .filter((w) => isDateInRange(w.date, range));
  let f: SourceFunnel | null = null;
  for (const w of webinars) f = addFunnel(f, w[source]);

  const registered = f?.registered ?? null;
  const steps: Step[] = [];
  const push = (key: string, label: string, value: number | null, prev: number | null, rateLabel: string | null, kpi: string | null, note: string) =>
    steps.push({ key, label, value, rate: div(value, prev), rateLabel, kpi, note });

  const showAds = source !== "organic";
  if (showAds) {
    push("impressions", "Ad impressions", impressions || null, null, null, null, "Meta, all Bronson campaigns (Cortana)");
    push("clicks", "Link clicks", linkClicks || null, impressions || null, "Link CTR", "linkCtr", "Clicked through to the page");
    push("lp", "Landing page", lpViews || null, linkClicks || null, "LP connect", "lpConnectRate", "Landing page views");
    push("optin", "Opted in", adOptIns || null, lpViews || null, "Opt-in rate", "optInRate", "Webinar registrations from ads (Cortana)");
  } else {
    push("optin", "Opted in", registered, null, null, null, "WebinarJam registrants, organic");
  }
  const optInBase = showAds ? (registered ?? adOptIns) : registered;
  push("attended", "Attended live", f?.attended ?? null, optInBase, "Show rate", null, "Joined the webinar live (WebinarJam)");
  push("stayed", "Stayed to pitch", f?.stayed ?? null, f?.attended ?? null, "Retention", null, "Still in the room at the pitch");
  push("booked", "Booked a call", f?.booked ?? null, f?.attended ?? null, "Booking rate", null, "Calendly bookings counted to these webinars, ÷ attendees");
  push("showed", "Showed to call", f?.showed ?? null, f?.due ?? f?.booked ?? null, "Call show rate", null, "Post Call Note logged (not a no show)");
  push("closed", "Closed", f?.closed ?? null, f?.showed ?? null, "Close rate", null, "Closed outcomes on Post Call Notes");

  const cash = f?.cashCollected ?? null;

  return Response.json({
    source,
    steps,
    money: {
      spend: showAds ? spend : null,
      cash,
      roas: showAds ? div(cash, spend) : null,
      cpm: showAds && impressions ? (spend / impressions) * 1000 : null,
      costPerOptIn: showAds ? div(spend, adOptIns) : null,
      costPerAttendee: showAds ? div(spend, f?.attended ?? null) : null,
      costPerBooked: showAds ? div(spend, f?.booked ?? null) : null,
      costPerClose: showAds ? div(spend, f?.closed ?? null) : null,
    },
    webinars: webinars.map((w) => ({ number: w.number, date: w.date, status: w.status, registered: w[source].registered, attended: w[source].attended, booked: w[source].booked, closed: w[source].closed, cash: w[source].cashCollected })),
    notes: {
      registrantsVsAds:
        showAds && registered !== null && adOptIns
          ? `Ads show ${adOptIns} opt-ins; WebinarJam has ${registered} ${source} registrants for the webinars in this range. Webinar steps use WebinarJam.`
          : null,
    },
  });
}
