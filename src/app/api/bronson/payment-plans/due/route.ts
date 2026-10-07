import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";
import { paymentPlansDueGet } from "@/lib/payment-plans-routes";

export const dynamic = "force-dynamic";

export const GET = paymentPlansDueGet(
  PAYMENT_PLAN_OFFERS.bronson,
  "https://www.koconsultings.com/bronson/payment-plans"
);
