import { redirect } from "next/navigation";

/** Office (task board + AI queue) shut down by the user 2026-11-11. Board code kept in OfficeBoard.tsx. */
export default function OfficePage() {
  redirect("/bronson/overview");
}
