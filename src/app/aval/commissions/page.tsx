import { redirect } from "next/navigation";

// Commissions moved into the Admin Team tab.
export default function CommissionsPage() {
  redirect("/aval/admin-team");
}
