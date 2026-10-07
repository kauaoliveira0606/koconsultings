import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";
import { upsellStatusPatch } from "@/lib/upsell-status";

export const dynamic = "force-dynamic";

export const PATCH = upsellStatusPatch(PAYMENT_PLAN_OFFERS.aval);
