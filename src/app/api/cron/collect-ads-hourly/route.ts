import { collectAdsDailyHourly, cronAllowed } from "@/lib/collectors";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hourly (vercel.json): Cortana ads, yesterday + today daily rows and the last 2 hours, into Airtable Ads Daily / Ads Hourly. Add ?dry=1 to fetch and report without writing to Airtable. */
export async function GET(request: Request) {
  if (!cronAllowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    return Response.json(await collectAdsDailyHourly(dry));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
