"use client";

import { WeeklyScorecardGrid } from "@/components/dashboard/WeeklyScorecardGrid";

export function WeeklyScorecard() {
  return <WeeklyScorecardGrid apiPath="/api/ecom-simulation/overview/weekly-scorecard" />;
}
