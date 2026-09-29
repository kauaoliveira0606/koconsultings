import { getLiveCalls } from "@/lib/calendly";

// Short shared cache so every open Live Calls tab polling at once costs one
// round of Calendly requests, not one per viewer.
export const revalidate = 30;

const BRONSON_CALENDLY_ORG =
  "https://api.calendly.com/organizations/b0e34712-1d17-48df-8f67-99f75b40cd01";

// Sales calls only: the Gameplan calls (plus the older strategy/discovery/demo
// types). Onboarding, Follow Up Payment, Mock Calls and internal meetings are
// left out.
const SALES_CALL = /gameplan|strategy session|discovery call|demo call/i;

export async function GET() {
  const pat = process.env.CALENDLY_BRONSON_PAT;
  if (!pat) {
    return Response.json({ error: "Missing CALENDLY_BRONSON_PAT" }, { status: 500 });
  }
  return Response.json(
    await getLiveCalls({
      pat,
      organization: BRONSON_CALENDLY_ORG,
      isSalesCall: (name) => SALES_CALL.test(name),
    })
  );
}
