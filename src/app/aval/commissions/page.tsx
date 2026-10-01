import { CommissionsBoard } from "@/components/dashboard/CommissionsBoard";

export default function CommissionsPage() {
  return <CommissionsBoard apiPath="/api/aval/commissions" payPeriods={{ firstMonth: "2026-09" }} />;
}
