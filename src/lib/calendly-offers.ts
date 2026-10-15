import { getTokenOrganization } from "@/lib/calendly";

/**
 * Which Calendly org and event types count as sales calls for each offer.
 * Shared by the Live Calls tab and the 9 AM missing Post Call Note check.
 */

// Bronson's Calendly org. A token made from a Bronson team login (like
// Kaua's) opens this org, never Aval's, so Aval refuses it rather than show
// Bronson's calendar under Aval.
const BRONSON_CALENDLY_ORG =
  "https://api.calendly.com/organizations/b0e34712-1d17-48df-8f67-99f75b40cd01";

const OFFERS = {
  // The Gameplan calls (plus the older strategy/discovery/demo types).
  // Onboarding, Follow Up Payment, Mock Calls and internal meetings are left out.
  bronson: { patEnv: "CALENDLY_BRONSON_PAT", salesCall: /gameplan|strategy session|discovery call|demo call/i },
  aval: { patEnv: "CALENDLY_AVAL_PAT", salesCall: /gameplan|strategy|discovery|demo|sales|consult|call with/i },
} as const;

export type CalendlyOffer = keyof typeof OFFERS;

export class CalendlyConfigError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function calendlyFor(offer: CalendlyOffer) {
  const { patEnv, salesCall } = OFFERS[offer];
  const pat = process.env[patEnv];
  if (!pat) throw new CalendlyConfigError(`Missing ${patEnv}`, 500);
  const organization = offer === "bronson" ? BRONSON_CALENDLY_ORG : await getTokenOrganization(pat);
  if (offer !== "bronson" && organization === BRONSON_CALENDLY_ORG) {
    throw new CalendlyConfigError(`The ${offer} Calendly token opens Bronson's Calendly, not ${offer}'s.`, 409);
  }
  return { pat, organization, isSalesCall: (name: string) => salesCall.test(name) };
}
