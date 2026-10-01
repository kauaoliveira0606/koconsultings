import { CommissionsBoard } from "@/components/dashboard/CommissionsBoard";

export default function CommissionsPage() {
  return (
    <CommissionsBoard
      apiPath="/api/bronson/commissions"
      payPeriods={{ firstMonth: "2026-08", firstMonthSplitDay: 21 }}
    />
  );
}
