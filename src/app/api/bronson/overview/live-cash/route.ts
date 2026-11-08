import { getLiveCashToday } from "@/lib/airtable/live-cash";
import { BRONSON_LIVE_CASH_SOURCES } from "@/lib/airtable/live-cash-sources";

// Polled every minute by the Live Cash Today card; the Airtable walk itself
// is still shared through the 60s table cache.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLiveCashToday(BRONSON_LIVE_CASH_SOURCES));
}
