import { collectAdsRange, cronAllowed } from "@/lib/collectors";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hourly (vercel.json): Cortana ad totals for every dashboard date preset, into Airtable Ads Range. Add ?dry=1 to fetch and report without writing to Airtable. */
export async function GET(request: Request) {
  if (!cronAllowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    return Response.json(await collectAdsRange(dry));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
