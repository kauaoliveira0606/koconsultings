import {
  getAvalAffiliateEod,
  getAvalEodCloserScorecard,
  getAvalLeads,
  getAvalMarketingDailyMetrics,
} from "@/lib/airtable/tables-aval";
import { AVAL_PACING_ROWS, buildPacing } from "@/lib/weekly-scorecard";
import { getAvalGoals } from "@/lib/goals-aval";

export const revalidate = 60;

export async function GET() {
  const [marketing, leads, eod, closer, allGoals] = await Promise.all([
    getAvalMarketingDailyMetrics(),
    getAvalLeads(),
    getAvalAffiliateEod(),
    getAvalEodCloserScorecard(),
    getAvalGoals(),
  ]);
  // No CPL goal on the Scorecard tab (user, 2026-10-17).
  const goals = { ...allGoals, costPerLeadMeta: null };
  return Response.json(buildPacing(marketing, leads, eod, closer, goals, new Date(), AVAL_PACING_ROWS));
}
