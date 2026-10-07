import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";
import { getUpsellPotential } from "@/lib/upsell-potential";

// Reads the Payment Plans tab's hand edits (churned), which must show up right away.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getUpsellPotential(PAYMENT_PLAN_OFFERS.aval));
}
