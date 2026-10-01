"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import type { RangeState } from "@/components/dashboard/RangeFilterBar";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { useMemo, useState } from "react";
import { buildPayPeriods } from "@/lib/pay-periods";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import type {
  CommissionsResponse,
  CommissionTotalRow,
  HighTicketDeal,
  HighTicketRepRow,
  LowTicketRepRow,
} from "@/lib/airtable/commissions";

const money = (value: number | null | undefined) => formatStatValue(value, "currency");
const pct = (rate: number | undefined) => (rate === undefined ? "" : `${Math.round(rate * 100)}%`);

function formatDay(date: string | null): string {
  if (!date) return "Unknown";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function CommissionsPage() {
  // Commissions are paid per pay period, so this tab has its own period
  // picker instead of the shared day/week range filter.
  const periods = useMemo(() => buildPayPeriods(), []);
  const defaultKey = periods.find((p) => p.kind === "period")?.key ?? periods[0]?.key ?? "";
  const [periodKey, setPeriodKey] = useState(defaultKey);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const range: RangeState = {
    preset: "custom",
    customStart: period?.start,
    customEnd: period?.end,
  };
  const { data, error } = useSectionData<CommissionsResponse>("/api/bronson/commissions", range);

  const rates = data?.rates;
  const totals = data?.totals;

  const totalColumns: Column<CommissionTotalRow>[] = [
    { key: "rep", header: "Rep", render: (r) => r.rep },
    { key: "low", header: "Low Ticket", render: (r) => money(r.lowTicket), align: "right" },
    {
      key: "closer",
      header: "High Ticket (Closer)",
      render: (r) => money(r.highTicketCloser),
      align: "right",
    },
    {
      key: "setter",
      header: "High Ticket (Setter)",
      render: (r) => money(r.highTicketSetter),
      align: "right",
    },
    {
      key: "total",
      header: "Total Commission",
      render: (r) => <span className="font-semibold">{money(r.total)}</span>,
      align: "right",
    },
  ];

  const lowTicketColumns: Column<LowTicketRepRow>[] = [
    { key: "rep", header: "Rep (Shared ID)", render: (r) => r.rep },
    { key: "realSales", header: "Real Sales", render: (r) => formatStatValue(r.realSales), align: "right" },
    { key: "realCash", header: "Real Cash", render: (r) => money(r.realCash), align: "right" },
    {
      key: "submittedSales",
      header: "Submitted Sales",
      render: (r) => formatStatValue(r.submittedSales),
      align: "right",
    },
    {
      key: "submittedCash",
      header: "Submitted Cash",
      render: (r) => money(r.submittedCash),
      align: "right",
    },
    {
      key: "gap",
      header: "Real vs Submitted",
      render: (r) => (
        <span className={r.gap < 0 ? "text-red-600" : r.gap > 0 ? "text-green-700" : undefined}>
          {money(r.gap)}
        </span>
      ),
      align: "right",
    },
    {
      key: "reversed",
      header: "Reversed",
      render: (r) => (r.reversedSales > 0 ? `${r.reversedSales} (${money(r.reversedCash)})` : "0"),
      align: "right",
    },
    {
      key: "attributionRate",
      header: "Attribution Rate",
      render: (r) => (
        <span title={`${r.trackedSales} tracked / ${r.submittedSales} submitted`}>
          {formatStatValue(r.attributionRate, "percent")}{" "}
          <span className="text-xs text-black/50">
            ({r.trackedSales}/{r.submittedSales})
          </span>
        </span>
      ),
      align: "right",
    },
    {
      key: "commission",
      header: `Commission (${pct(rates?.lowTicket)} of Real)`,
      render: (r) => <span className="font-semibold">{money(r.commission)}</span>,
      align: "right",
    },
  ];

  const highTicketColumns: Column<HighTicketRepRow>[] = [
    { key: "rep", header: "Rep", render: (r) => r.rep },
    { key: "closedDeals", header: "Closed", render: (r) => formatStatValue(r.closedDeals), align: "right" },
    { key: "closedCash", header: "Cash Closed", render: (r) => money(r.closedCash), align: "right" },
    {
      key: "closerCommission",
      header: `Closer Commission (${pct(rates?.highTicketCloser)})`,
      render: (r) => money(r.closerCommission),
      align: "right",
    },
    { key: "setDeals", header: "Set", render: (r) => formatStatValue(r.setDeals), align: "right" },
    { key: "setCash", header: "Cash Set", render: (r) => money(r.setCash), align: "right" },
    {
      key: "setterCommission",
      header: `Setter Commission (${pct(rates?.highTicketSetter)})`,
      render: (r) => money(r.setterCommission),
      align: "right",
    },
    {
      key: "commission",
      header: "Total",
      render: (r) => <span className="font-semibold">{money(r.commission)}</span>,
      align: "right",
    },
  ];

  const dealColumns: Column<HighTicketDeal>[] = [
    { key: "date", header: "Date", render: (d) => formatDay(d.date) },
    { key: "lead", header: "Lead", render: (d) => d.lead ?? "Unknown" },
    { key: "offer", header: "Offer", render: (d) => d.offer ?? "Unknown" },
    { key: "outcome", header: "Outcome", render: (d) => d.outcome ?? "Unknown" },
    { key: "cash", header: "Cash Collected", render: (d) => money(d.cashCollected), align: "right" },
    { key: "closer", header: "Closer", render: (d) => d.closer ?? "Not logged" },
    {
      key: "closerCommission",
      header: "Closer Pay",
      render: (d) => money(d.closerCommission),
      align: "right",
    },
    { key: "setter", header: "Setter", render: (d) => d.setter ?? "No setter" },
    {
      key: "setterCommission",
      header: "Setter Pay",
      render: (d) => money(d.setterCommission),
      align: "right",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Commissions</h1>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          Pay period
          <select
            value={period?.key ?? ""}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
          >
            <optgroup label="Pay periods">
              {periods
                .filter((p) => p.kind === "period")
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Full months">
              {periods
                .filter((p) => p.kind === "month")
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load commissions. Retrying.
        </div>
      ) : null}

      <DashboardSection title="Totals">
        <StatCardGrid>
          <StatCard
            label="Total Commissions"
            value={totals?.commission}
            format="currency"
            subtext="Low ticket (real cash only) + high ticket"
          />
          <StatCard
            label="Low Ticket Commissions"
            value={totals?.lowTicketCommission}
            format="currency"
            subtext={`${pct(rates?.lowTicket)} of real cash by Shared ID`}
          />
          <StatCard
            label="High Ticket Commissions"
            value={totals?.highTicketCommission}
            format="currency"
            subtext={`Closer ${pct(rates?.highTicketCloser)} + setter ${pct(rates?.highTicketSetter)} of cash collected`}
          />
          <StatCard
            label="Low Ticket Real Cash"
            value={totals?.lowTicketRealCash}
            format="currency"
            subtext="Portal sales with a rep's Shared ID"
          />
          <StatCard
            label="Low Ticket Submitted Cash"
            value={totals?.lowTicketSubmittedCash}
            format="currency"
            subtext="Affiliate PCN submissions"
          />
          <StatCard
            label="Team Attribution Rate"
            value={totals?.lowTicketAttributionRate}
            format="percent"
            subtext={`${formatStatValue(totals?.lowTicketTrackedSales)} sales tracked under a Shared ID / ${formatStatValue(totals?.lowTicketSubmittedSales)} submitted`}
          />
          <StatCard
            label="No Shared ID"
            value={totals?.unassignedCash}
            format="currency"
            subtext={`${formatStatValue(totals?.unassignedSales)} portal sales with no rep attached, not paid out`}
          />
          <StatCard
            label="High Ticket Cash"
            value={totals?.highTicketCash}
            format="currency"
            subtext="Post Call Notes cash collected"
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Commission By Rep">
        <DataTable
          columns={totalColumns}
          rows={data?.byRep ?? []}
          rowKey={(r) => r.rep}
          emptyMessage="No commissions in this pay period."
        />
      </DashboardSection>

      <DashboardSection title="Low Ticket (Base44 + Wix)">
        <DataTable
          columns={lowTicketColumns}
          rows={data?.lowTicket ?? []}
          rowKey={(r) => r.rep}
          emptyMessage="No low ticket sales in this pay period."
        />
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Real = sales the affiliate portal tracked under the rep&apos;s Shared ID, reversed sales
          taken out. Commission is paid on real cash only. Submitted = what the rep logged in
          Affiliate PCN. Attribution rate = sales the portal tracked under the Shared ID (reversed
          included) divided by sales the rep submitted. The portal only started
          stamping Shared IDs on {formatDay(data?.sharedIdTrackingStart ?? null)}, so real cash is
          blank before that date.
        </p>
      </DashboardSection>

      <DashboardSection title="High Ticket (Post Call Notes)">
        <DataTable
          columns={highTicketColumns}
          rows={data?.highTicket ?? []}
          rowKey={(r) => r.rep}
          emptyMessage="No high ticket cash in this pay period."
        />
      </DashboardSection>

      <DashboardSection title="High Ticket Deals">
        <DataTable
          columns={dealColumns}
          rows={data?.highTicketDeals ?? []}
          rowKey={(d) => d.id}
          emptyMessage="No high ticket cash in this pay period."
        />
      </DashboardSection>
    </div>
  );
}
