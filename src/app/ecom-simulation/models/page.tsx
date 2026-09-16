"use client";

import { useState } from "react";
import { FinancialModelTab } from "./FinancialModelTab";
import { CapacityModelTab } from "./CapacityModelTab";

export default function ModelsPage() {
  const [tab, setTab] = useState<"financial" | "capacity">("financial");

  return (
    // Plain black instead of the purple gradient here — the model tables'
    // own red/orange/green highlighting was hard to read against it. Uses
    // an inline style rather than `bg-black` because that utility class is
    // globally remapped to light purple for this theme (see globals.css).
    <div
      style={{ background: "#000000" }}
      className="ko-neutral-panel -m-4 min-h-screen p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8"
    >
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
