import { PaymentPlansBoard } from "@/components/dashboard/PaymentPlansBoard";

export default function PaymentPlansPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Payment Plans</h1>
      <PaymentPlansBoard apiPath="/api/bronson/payment-plans" />
    </div>
  );
}
