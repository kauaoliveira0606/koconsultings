import { getAvalAffiliateEod, getAvalMarketingDailyMetrics } from "@/lib/airtable/tables-aval";
import { avalWebinarSourceRows } from "@/lib/aval-webinar-funnel";
import { easternDateString } from "@/lib/date-range";
import { webinarReports } from "@/lib/webinar-report";

export const revalidate = 60;

/** Webinars tab, Aval: one report per webinar, newest first. */
export async function GET() {
  const today = easternDateString();
  const [rows, marketing, eod] = await Promise.all([
    avalWebinarSourceRows(today),
    getAvalMarketingDailyMetrics(),
    getAvalAffiliateEod(),
  ]);
  return Response.json({ webinars: webinarReports(rows, marketing, eod, today) });
}
