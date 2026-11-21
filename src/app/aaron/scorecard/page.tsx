import { PacingSection } from "@/components/dashboard/PacingSection";
import { RecentChanges } from "@/components/dashboard/RecentChanges";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { WeeklyScorecardGrid } from "@/components/dashboard/WeeklyScorecardGrid";

export default function ScorecardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Scorecard</h1>
      <WeeklyScorecardGrid apiPath="/api/aaron/overview/weekly-scorecard" />
      <DashboardSection title="Pacing">
        <PacingSection apiPath="/api/aaron/overview/pacing" />
      </DashboardSection>
      <DashboardSection title="Recent Changes">
        <RecentChanges apiPath="/api/aaron/overview/recent-changes" />
      </DashboardSection>
    </div>
  );
}
