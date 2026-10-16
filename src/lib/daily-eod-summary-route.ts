import type { NextRequest } from "next/server";
import type { CalendlyOffer } from "@/lib/calendly-offers";
import { dailyEodSummaryMessage, getDailyEodSummary } from "@/lib/daily-eod-summary";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";
import { ACCOUNTABILITY_LABELS } from "@/lib/accountability-route";

/** GET ?date=YYYY-MM-DD (default: yesterday, Eastern). Called by n8n at 6 AM ET. */
export function dailyEodSummaryGet(offer: CalendlyOffer) {
  return async (request: NextRequest) => {
    const param = request.nextUrl.searchParams.get("date");
    const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : addDaysToDateString(easternDateString(), -1);
    const summary = await getDailyEodSummary(offer, date);
    return Response.json({ ...summary, message: dailyEodSummaryMessage(ACCOUNTABILITY_LABELS[offer], offer, summary) });
  };
}
