import type { NextRequest } from "next/server";
import { POST_CALL_NOTE_TABLE_ID, norm, OFFERS } from "@/lib/accountability";
import { airtableListFresh } from "@/lib/airtable/client";
import { getCallsOnDate } from "@/lib/calendly";
import { calendlyFor } from "@/lib/calendly-offers";
import { addDaysToDateString, easternDateString } from "@/lib/date-range";

/**
 * For the Bronson Discord ops bot: every Calendly sales call starting on one
 * Eastern date (canceled/rescheduled ones left out, listed under `skipped`),
 * each with whether a Post Call Note exists for the lead's email (same match
 * as the 9 AM check) and that note's outcome. GET ?date=YYYY-MM-DD, default today.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : easternDateString();
  const since = addDaysToDateString(date, -2);
  const [{ calls, skipped }, notes] = await Promise.all([
    calendlyFor("bronson").then((c) => getCallsOnDate({ ...c, date })),
    airtableListFresh<Record<string, unknown>>(OFFERS.bronson.baseId, POST_CALL_NOTE_TABLE_ID, {
      filterByFormula: `OR(IS_AFTER({Date}, '${since}'), IS_AFTER(CREATED_TIME(), '${since}'))`,
      fields: ["Email (Lead)", "Call Outcome", "First Name", "Cash Collected"],
    }),
  ]);
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const n of notes) {
    const email = n.fields["Email (Lead)"];
    if (typeof email === "string" && email) byEmail.set(norm(email), n.fields);
  }
  const now = Date.now();
  return Response.json({
    date,
    calls: calls
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((c) => {
        const note = c.inviteeEmail ? byEmail.get(norm(c.inviteeEmail)) : undefined;
        return {
          ...c,
          startEt: new Date(c.start).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }),
          happened: Date.parse(c.start) <= now,
          hasPostCallNote: !!note,
          noteOutcome: (note?.["Call Outcome"] as string | undefined) ?? null,
          noteCloser: (note?.["First Name"] as string | undefined) ?? null,
          noteCash: (note?.["Cash Collected"] as number | undefined) ?? null,
        };
      }),
    skipped,
  });
}
