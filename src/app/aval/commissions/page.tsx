import { CommissionsBoard } from "@/components/dashboard/CommissionsBoard";

export default function CommissionsPage() {
  // Aval pays weekly: Monday to Sunday, wired the Monday after.
  return (
    <CommissionsBoard
      apiPath="/api/aval/commissions"
      payPeriods={{ cadence: "weekly", firstMonth: "2026-09" }}
    />
  );
}
