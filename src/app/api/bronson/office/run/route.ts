import { runWorker } from "@/lib/ai-worker";
import { getOffice } from "@/lib/office";

// Pro plan with Fluid compute allows up to 800s; the worker stops using tools at 10 minutes.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/** "Work the next task now" button in the Office AI queue (admin only, behind the login). */
export async function POST() {
  const r = await runWorker();
  return Response.json({ ...r, office: await getOffice() });
}
