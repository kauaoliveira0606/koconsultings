import { latestBottlenecks, runBottlenecks } from "@/lib/bottlenecks";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Latest AI bottleneck analysis for the Scorecard. POST reruns it now. */
export async function GET() {
  return Response.json({ report: await latestBottlenecks() });
}

export async function POST() {
  try {
    return Response.json({ report: await runBottlenecks() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
