import {
  getAaronAffiliateEod,
  getAaronEodCloserScorecard,
  getAaronLeads,
  getAaronMarketingDailyMetrics,
} from "@/lib/airtable/tables-aaron";
import { AARON_PACING_ROWS, buildPacing } from "@/lib/weekly-scorecard";
import { getAaronGoals } from "@/lib/goals-aaron";

export const revalidate = 60;

export async function GET() {
  const [marketing, leads, eod, closer, goals] = await Promise.all([
    getAaronMarketingDailyMetrics(),
    getAaronLeads(),
    getAaronAffiliateEod(),
    getAaronEodCloserScorecard(),
    getAaronGoals(),
  ]);
  return Response.json(buildPacing(marketing, leads, eod, closer, goals, new Date(), AARON_PACING_ROWS));
}
