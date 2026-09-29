import {
  getBronsonAffiliateEod,
  getBronsonEodCloser,
  getLeads,
  getMarketingDailyMetrics,
} from "@/lib/airtable/tables";
import { buildPacing } from "@/lib/weekly-scorecard";
import { getGoals } from "@/lib/goals";

export const revalidate = 60;

export async function GET() {
  const [marketing, leads, eod, closer, goals] = await Promise.all([
    getMarketingDailyMetrics(),
    getLeads(),
    getBronsonAffiliateEod(),
    getBronsonEodCloser(),
    getGoals(),
  ]);
  return Response.json(buildPacing(marketing, leads, eod, closer, goals));
}
