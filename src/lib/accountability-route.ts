import type { NextRequest } from "next/server";
import { accountabilityMessage, getAccountabilityReport } from "@/lib/accountability";
import type { CalendlyOffer } from "@/lib/calendly-offers";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";

export const ACCOUNTABILITY_LABELS: Record<CalendlyOffer, string> = { bronson: "Bronson", aval: "Aval" };

/** GET ?date=YYYY-MM-DD (default: yesterday, Eastern). Called by n8n at 9 AM ET. */
export function accountabilityGet(offer: CalendlyOffer) {
  return async (request: NextRequest) => {
    const param = request.nextUrl.searchParams.get("date");
    const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : addDaysToDateString(easternDateString(), -1);
    const report = await getAccountabilityReport(offer, date);
    return Response.json({ ...report, message: accountabilityMessage(ACCOUNTABILITY_LABELS[offer], report) });
  };
}
