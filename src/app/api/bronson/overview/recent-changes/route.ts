import { getMarketingDailyMetrics } from "@/lib/airtable/tables";
import {
  DASHBOARD_CHANGES_TABLES,
  getRecentChanges,
  saveDayChanges,
} from "@/lib/airtable/dashboard-changes";

// Always needs live Airtable data.
export const dynamic = "force-dynamic";

const TABLE = DASHBOARD_CHANGES_TABLES.bronson;

export async function GET() {
  const days = await getRecentChanges(TABLE, await getMarketingDailyMetrics());
  return Response.json({ days });
}

// Saves the "changes made" note for one day, written on the dashboard itself.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    date?: unknown;
    changes?: unknown;
  } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof body?.changes !== "string") {
    return Response.json({ error: "Expected { date: YYYY-MM-DD, changes: string }" }, { status: 400 });
  }
  await saveDayChanges(TABLE, date, body.changes);
  return Response.json({ ok: true });
}
