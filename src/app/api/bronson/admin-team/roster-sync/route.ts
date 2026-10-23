import { syncRoster } from "@/lib/roster-sync";

export const dynamic = "force-dynamic";

/** Adds new EOD / Post Call Note names to the Team Roster. Called by n8n every 10 minutes. */
export async function GET() {
  return Response.json(await syncRoster("bronson"));
}
