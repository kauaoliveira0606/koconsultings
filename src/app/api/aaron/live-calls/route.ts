import { getLiveCalls } from "@/lib/calendly";
import { CalendlyConfigError, calendlyFor } from "@/lib/calendly-offers";

// Short shared cache so every open Live Calls tab polling at once costs one
// round of Calendly requests, not one per viewer.
export const revalidate = 30;

// Aaron books every sales call on Calendly ("Next Level - SalesHQ" and "SalesHQ Game Plan").
export async function GET() {
  try {
    return Response.json(await getLiveCalls(await calendlyFor("aaron")));
  } catch (err) {
    if (err instanceof CalendlyConfigError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
