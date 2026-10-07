import { UpsellPotentialBoard } from "@/components/dashboard/UpsellPotentialBoard";

export default function UpsellPotentialPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Upsell Potential</h1>
      <UpsellPotentialBoard apiPath="/api/bronson/upsell-potential" />
    </div>
  );
}
