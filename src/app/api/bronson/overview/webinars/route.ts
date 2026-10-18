import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import { easternDateString } from "@/lib/date-range";
import { webinarBreakdown } from "@/lib/webinar-breakdown";

export const revalidate = 60;

export async function GET() {
  return Response.json({ webinars: webinarBreakdown(await getMarketingDailyMetrics(), easternDateString()) });
}
