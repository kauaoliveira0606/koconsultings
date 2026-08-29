"use client";

import { useState } from "react";
import { FinancialModelTab } from "./FinancialModelTab";
import { CapacityModelTab } from "./CapacityModelTab";

export default function ModelsPage() {
  const [tab, setTab] = useState<"financial" | "capacity">("financial");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Models</h1>
      <div className="mb-6 flex gap-6 border-b border-white/10 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab("financial")}
          className={`-mb-px border-b-2 px-1 pb-3 ${
            tab === "financial" ? "border-emerald-400 text-emerald-400" : "border-transparent text-white"
          }`}
        >
          Financial Model
        </button>
        <button
          type="button"
          onClick={() => setTab("capacity")}
          className={`-mb-px border-b-2 px-1 pb-3 ${
            tab === "capacity" ? "border-emerald-400 text-emerald-400" : "border-transparent text-white"
          }`}
        >
          Capacity Model
        </button>
      </div>

      {tab === "financial" ? <FinancialModelTab /> : <CapacityModelTab />}
    </div>
  );
}
