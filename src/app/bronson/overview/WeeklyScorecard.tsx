"use client";

import { WeeklyScorecardGrid } from "@/components/dashboard/WeeklyScorecardGrid";

export function WeeklyScorecard() {
  return <WeeklyScorecardGrid apiPath="/api/bronson/overview/weekly-scorecard" />;
}
