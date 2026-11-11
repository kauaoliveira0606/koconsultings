import { runWorker } from "@/lib/ai-worker";

// Pro plan with Fluid compute allows up to 800s; the worker stops using tools at 10 minutes.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/** Hourly in the day: works the next task in the Office AI queue. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runWorker());
}
