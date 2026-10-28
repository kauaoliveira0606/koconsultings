import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { WebinarsTab } from "@/components/dashboard/WebinarsTab";

export default function WebinarsPage() {
  return (
    <div>
      <WebinarsTab offer="aval" />
      <DashboardSection title="Webinar Show Rate">
        <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-8 text-center text-sm text-[var(--text-muted)]">
          Not built yet.
        </div>
      </DashboardSection>
    </div>
  );
}
