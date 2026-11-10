import { BerlinHeader, EmptyState } from "@/components/berlin/Berlin";

/** Berlin / Sales — the ledger of closes. Empty-state scaffold until the CRM/Cortana feed is wired. */
export default function SalesPage() {
  return (
    <div>
      <BerlinHeader title="Sales" subtitle="The ledger: every close with its cash, source and rep, newest first." />
      <EmptyState
        title="No sales numbers yet"
        body="Once the CRM and Cortana are feeding, each close lands here with the cash collected, the traffic source it came from, and who closed it."
        hint="Ask your Claude: &ldquo;Sync Bronson's calls and sales for the last 14 days.&rdquo;"
        action={{ href: "/bronson/integrations", label: "Set up the CRM in Integrations" }}
      />
    </div>
  );
}
