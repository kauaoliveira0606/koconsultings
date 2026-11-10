import { BerlinHeader, EmptyState } from "@/components/berlin/Berlin";

/** Berlin / Ads / Campaigns — per-campaign breakdown. Empty-state scaffold. */
export default function CampaignsPage() {
  return (
    <div>
      <BerlinHeader title="Campaigns" subtitle="Every Meta campaign: spend, leads, cost per lead and ROAS, newest first." />
      <EmptyState
        title="No campaigns yet"
        body="Once Meta is connected, each campaign shows here with its spend, leads and the revenue attribution pulls back to it."
        hint="Ask your Claude: &ldquo;Break down Bronson's Meta campaigns for the last 14 days.&rdquo;"
        action={{ href: "/bronson/integrations", label: "Set up Meta in Integrations" }}
      />
    </div>
  );
}
