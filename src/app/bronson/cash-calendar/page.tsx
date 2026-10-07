import { CashCalendar } from "@/components/dashboard/CashCalendar";

export default function CashCalendarPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Cash Calendar</h1>
      <CashCalendar apiPath="/api/bronson/overview/cash-calendar" />
    </div>
  );
}
