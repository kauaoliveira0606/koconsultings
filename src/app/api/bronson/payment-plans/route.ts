import { PAYMENT_PLAN_OFFERS, getPaymentPlans } from "@/lib/payment-plans";

export const revalidate = 60;

export async function GET() {
  return Response.json(await getPaymentPlans(PAYMENT_PLAN_OFFERS.bronson));
}
