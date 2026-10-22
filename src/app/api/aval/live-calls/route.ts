import { getLiveCalls, type LiveCallsResponse } from "@/lib/calendly";
import { CalendlyConfigError, calendlyFor } from "@/lib/calendly-offers";
import { getAvalGhlLiveCalls } from "@/lib/ghl-live-calls";

// Short shared cache so every open Live Calls tab polling at once costs one
// round of Calendly and GHL requests, not one per viewer.
export const revalidate = 30;

// Aval books sales calls on both Calendly and the GHL calendar; the board
// shows both. One source failing still shows the other.
export async function GET() {
  const [calendly, ghl] = await Promise.allSettled([
    calendlyFor("aval").then(getLiveCalls),
    getAvalGhlLiveCalls(),
  ]);
  if (calendly.status === "rejected" && ghl.status === "rejected") {
    const err = calendly.reason;
    if (err instanceof CalendlyConfigError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
  if (calendly.status === "rejected") console.error("Aval live calls: Calendly failed", calendly.reason);
  if (ghl.status === "rejected") console.error("Aval live calls: GHL failed", ghl.reason);

  const base: LiveCallsResponse =
    calendly.status === "fulfilled"
      ? calendly.value
      : { calls: [], hiddenEventNames: [], fetchedAt: new Date().toISOString() };
  const calls = [...base.calls, ...(ghl.status === "fulfilled" ? ghl.value : [])].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  return Response.json({ ...base, calls });
}
