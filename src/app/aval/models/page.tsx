"use client";

import { usePathname } from "next/navigation";
import { useHydrated, usePersistedState } from "@/lib/use-persisted-state";
import { FinancialModelTab } from "./FinancialModelTab";
import { CapacityModelTab } from "./CapacityModelTab";

// Renders only after hydration so the remembered tab (and the numbers inside it)
// can be read from storage without mismatching the server-rendered HTML.
export default function ModelsPage() {
  const hydrated = useHydrated();
  return hydrated ? <ModelsPageContent /> : null;
}

function ModelsPageContent() {
  const [tab, setTab] = usePersistedState<"financial" | "capacity">(
    `models-tab:${usePathname()}`,
    "financial"
  );

  return (
    <div className="ko-light-panel">
      <h1 className="mb-4 text-2xl font-bold">Models</h1>
      <div className="mb-6 flex gap-6 border-b border-black/10 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab("financial")}
          className={`-mb-px border-b-2 px-1 pb-3 ${
            tab === "financial" ? "border-black text-black" : "border-transparent text-black/50"
          }`}
        >
          Financial Model
        </button>
        <button
          type="button"
          onClick={() => setTab("capacity")}
          className={`-mb-px border-b-2 px-1 pb-3 ${
            tab === "capacity" ? "border-black text-black" : "border-transparent text-black/50"
          }`}
        >
          Capacity Model
        </button>
      </div>

      {tab === "financial" ? <FinancialModelTab /> : <CapacityModelTab />}
    </div>
  );
}
