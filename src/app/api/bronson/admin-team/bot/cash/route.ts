import type { NextRequest } from "next/server";
import { sumSourceForRange } from "@/lib/airtable/live-cash";
import { BRONSON_LIVE_CASH_SOURCES } from "@/lib/airtable/live-cash-sources";
import { easternDateString } from "@/lib/date-range";

/**
 * For the Bronson Discord ops bot: cash logged in Post Call Notes, Affiliate
 * PCN and Follow Up Payment between two Eastern dates (same rules as the Live
 * Cash Today card). GET ?from=YYYY-MM-DD&to=YYYY-MM-DD, both default to today.
 * Behind the admin cookie (proxy matcher covers /api/bronson/admin-team/*).
 */
export const dynamic = "force-dynamic";

const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(request: NextRequest) {
  const today = easternDateString();
  const from = ymd(request.nextUrl.searchParams.get("from")) ?? today;
  const to = ymd(request.nextUrl.searchParams.get("to")) ?? from;
  const s = BRONSON_LIVE_CASH_SOURCES;
  const [postCallNotes, affiliatePcn, followUpPayments] = await Promise.all([
    sumSourceForRange(s.postCallNotes, from, to),
    sumSourceForRange(s.affiliatePcn, from, to),
    sumSourceForRange(s.followUpPayments, from, to),
  ]);
  return Response.json({
    from,
    to,
    today,
    total: postCallNotes.cash + affiliatePcn.cash + followUpPayments.cash,
    postCallNotes,
    affiliatePcn,
    followUpPayments,
  });
}
