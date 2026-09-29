import { LiveCallsBoard } from "@/components/dashboard/LiveCallsBoard";

export default function LiveCallsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Live Calls</h1>
      <LiveCallsBoard apiPath="/api/bronson/live-calls" />
    </div>
  );
}
