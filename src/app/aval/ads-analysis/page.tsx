"use client";

import { useMemo, useRef, useState } from "react";
import { StatCard, StatCardGrid, DataTable, type Column } from "../_components/dashboard-dark";
import {
  aggregateAdPerformance,
  normalizeMetaAdsRows,
  parseMetaAdsCsv,
  type AdPerformanceRow,
} from "@/lib/ads-analysis/parse-meta-csv";

export default function AdsAnalysisPage() {
  const [rows, setRows] = useState<AdPerformanceRow[]>([]);
  const [campaignFilter, setCampaignFilter] = useState("All Campaigns");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const campaigns = useMemo(
    () => ["All Campaigns", ...Array.from(new Set(rows.map((r) => r.campaign)))],
    [rows]
  );

  const filteredRows = useMemo(
    () => (campaignFilter === "All Campaigns" ? rows : rows.filter((r) => r.campaign === campaignFilter)),
    [rows, campaignFilter]
  );

  const summary = useMemo(() => aggregateAdPerformance(filteredRows), [filteredRows]);

  async function handleFile(file: File) {
    const text = await file.text();
    const raw = parseMetaAdsCsv(text);
    setRows(normalizeMetaAdsRows(raw));
  }

  const columns: Column<AdPerformanceRow>[] = [
    { key: "campaign", header: "Campaign", render: (r) => r.campaign },
    { key: "adSet", header: "Ad Set", render: (r) => r.adSet },
    { key: "ad", header: "Ad", render: (r) => r.ad },
    { key: "spend", header: "Spend", render: (r) => `$${r.spend.toFixed(2)}`, align: "right" },
    { key: "leads", header: "Leads", render: (r) => r.leads.toLocaleString(), align: "right" },
    { key: "sales", header: "Sales", render: (r) => r.sales.toLocaleString(), align: "right" },
    { key: "revenue", header: "Revenue", render: (r) => `$${r.revenue.toFixed(2)}`, align: "right" },
    { key: "cpl", header: "CPL", render: (r) => (r.cpl !== null ? `$${r.cpl.toFixed(2)}` : "—"), align: "right" },
    { key: "roas", header: "ROAS", render: (r) => (r.roas !== null ? `${r.roas.toFixed(2)}x` : "—"), align: "right" },
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Ads Analysis</h1>
      <h2 className="mb-6 text-lg font-semibold text-white/70">Ad Performance Tracker</h2>

      <StatCardGrid>
        <StatCard label="Total Spend" value={summary.totalSpend} format="currency" subtext="across all ads" />
        <StatCard label="Total Leads" value={summary.totalLeads} format="number" subtext="from ads" />
        <StatCard label="Total Sales" value={summary.totalSales} format="number" subtext="conversions" />
        <StatCard label="Total Revenue" value={summary.totalRevenue} format="currency" subtext="from ads" />
        <StatCard label="Avg Cost Per Lead" value={summary.avgCostPerLead} format="currency" subtext="CPL" />
        <StatCard label="Avg Cost Per Sale" value={summary.avgCostPerSale} format="currency" subtext="CPS" />
        <StatCard label="Average ROAS" value={summary.averageRoas} format="ratio" subtext="return on ad spend" />
      </StatCardGrid>

      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-white/70">Campaign:</span>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-[#111826] px-2 py-1 text-white"
          >
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-white/70">Detailed Ad Performance</h3>
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(r, i) => `${r.campaign}-${r.adSet}-${r.ad}-${i}`}
          emptyMessage="No data yet — upload a CSV below."
        />

        <div
          className={`mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center ${
            dragActive ? "border-emerald-400 bg-emerald-500/10" : "border-white/20 bg-[#111826]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <p className="mb-1 font-semibold text-white">Drop your Meta Ads CSV here or click to upload</p>
          <p className="text-sm text-white/50">
            Export from Ads Manager → Customize columns → Export as CSV
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 w-full rounded-md bg-emerald-500 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Run Analysis
        </button>
      </div>
    </div>
  );
}
