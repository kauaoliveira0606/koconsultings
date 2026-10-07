import { PAYMENT_PLAN_OFFERS } from "@/lib/payment-plans";
import { paymentWeeklySummaryGet } from "@/lib/payment-reminders";

export const dynamic = "force-dynamic";

export const GET = paymentWeeklySummaryGet(
  PAYMENT_PLAN_OFFERS.aval,
  "https://www.koconsultings.com/aval/payment-plans"
);
