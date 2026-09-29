import { getLiveCalls, getTokenOrganization } from "@/lib/calendly";

// Short shared cache so every open Live Calls tab polling at once costs one
// round of Calendly requests, not one per viewer.
export const revalidate = 30;

// Bronson's Calendly org. A token made from a Bronson team login (like
// Kaua's) opens this org, never Aval's, so refuse it rather than show
// Bronson's calendar under Aval.
const BRONSON_CALENDLY_ORG =
  "https://api.calendly.com/organizations/b0e34712-1d17-48df-8f67-99f75b40cd01";

// Sales calls only; anything else on the calendar is listed as hidden.
const SALES_CALL = /gameplan|strategy|discovery|demo|sales|consult|call with/i;

export async function GET() {
  const pat = process.env.CALENDLY_AVAL_PAT;
  if (!pat) {
    return Response.json({ error: "Missing CALENDLY_AVAL_PAT" }, { status: 500 });
  }
  const organization = await getTokenOrganization(pat);
  if (organization === BRONSON_CALENDLY_ORG) {
    return Response.json(
      { error: "The Aval Calendly token opens Bronson's Calendly, not Aval's." },
      { status: 409 }
    );
  }
  return Response.json(
    await getLiveCalls({
      pat,
      organization,
      isSalesCall: (name) => SALES_CALL.test(name),
    })
  );
}
