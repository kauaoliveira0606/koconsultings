import { runAllAreas } from "@/lib/jeremy-areas";

// Pro plan allows up to 800s; runAllAreas stops starting new areas at 11 minutes.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/** Every morning: Jeremy AI feedback on each business area (once a day per area). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runAllAreas());
}
