import {
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
  getAvalLeads,
  getAvalMarketingDailyMetrics,
} from "@/lib/airtable/tables-aval";
import { buildPacing } from "@/lib/weekly-scorecard";
import { getAvalGoals } from "@/lib/goals-aval";

export const revalidate = 60;

export async function GET() {
  const [marketing, leads, eod, closer, goals] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
  ]);
  return Response.json(buildPacing(marketing, leads, eod, closer, goals));
}
