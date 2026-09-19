"use client";

import { usePathname } from "next/navigation";
import { usePersistedState } from "@/lib/use-persisted-state";
import { AscensionModel } from "./AscensionModel";
import { VslFunnelModel } from "./VslFunnelModel";
import { WebinarFunnelModel } from "./WebinarFunnelModel";
import { ToggleButtons } from "./model-table";

const SUB_TABS = [
  { id: "ascension", label: "Low-Ticket → High-Ticket Ascension" },
  { id: "vsl", label: "High-Ticket VSL Call Funnel" },
  { id: "webinar", label: "Webinar Funnel + VIP Ticket" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["id"];

export function FinancialModelTab() {
  const [stored, setSubTab] = usePersistedState<SubTab>(
    `financial-model-subtab:${usePathname()}`,
    "ascension"
  );
  // A stale or unknown stored value falls back to the first sub-tab.
  const subTab = SUB_TABS.some((t) => t.id === stored) ? stored : "ascension";

  return (
    <div>
      <ToggleButtons value={subTab} options={[...SUB_TABS]} onChange={setSubTab} />
      {subTab === "ascension" ? <AscensionModel /> : null}
      {subTab === "vsl" ? <VslFunnelModel /> : null}
      {subTab === "webinar" ? <WebinarFunnelModel /> : null}
    </div>
  );
}
