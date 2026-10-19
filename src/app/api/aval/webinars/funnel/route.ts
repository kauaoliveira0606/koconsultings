import type { NextRequest } from "next/server";
import { avalWebinarSourceRows } from "@/lib/aval-webinar-funnel";
import { parseRangeFromRequest } from "@/lib/api-range";
import { easternDateString, isDateInRange } from "@/lib/date-range";
import { sumSourceRows } from "@/lib/webinar-source-funnel";

export const revalidate = 60;

/** Webinars tab, Aval: the paid vs organic funnel per webinar and for the range. */
export async function GET(request: NextRequest) {
  const range = parseRangeFromRequest(request);
  const webinars = await avalWebinarSourceRows(easternDateString());
  // Range totals use webinars already held, so an upcoming session's sign-ups don't drag its show rate.
  const inRange = webinars.filter((w) => w.status === "done" && isDateInRange(w.date, range));
  return Response.json({ range: sumSourceRows(inRange), webinars });
}
