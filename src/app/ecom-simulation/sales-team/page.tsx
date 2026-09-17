"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatDateTime, formatStatValue } from "@/lib/format";

type TeamTotalsResponse = {
  outboundDials: number | null;
  pickups: number | null;
  pickupRate: number | null;
  softwarePitched: number | null;
  totalSales: number | null;
  cashCollected: number | null;
  totalTalkTimeMinutes: number | null;
};

type ByRepResponse = {
  reps: {
    rep: string;
    totalCashCollected: number | null;
    lowTicketCashCollected: number | null;
    highTicketCashCollected: number | null;
    lowTicketSales: number | null;
    highTicketSales: number | null;
  }[];
};

type CpaResponse = {
  totalCpaCollected: number | null;
  totalCpaByDay: { date: string; total: number }[];
};

type HighTicketClosersResponse = {
  callsBooked: number | null;
  callsShowed: number | null;
  offersMade: number | null;
  dealsClosed: number | null;
  cashCollected: number | null;
  totalRevenue: number | null;
  pitched: number;
  closed: number;
  closeRate: number | null;
  closers: {
    closer: string;
    callsBooked: number | null;
    callsShowed: number | null;
    dealsClosed: number | null;
    cashCollected: number | null;
    pitched: number;
    closed: number;
    closeRate: number | null;
    collectedPerBookedCall: number | null;
  }[];
  records: {
    id: string;
    date: string | null;
    repName: string | null;
    leadName: string | null;
    source: string | null;
    callOutcome: string | null;
    offerPitched: string | null;
    cashCollected: number | null;
    totalRevenue: number | null;
  }[];
};

function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return `${minutes.toFixed(1)}m`;
}

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/ecom-simulation/sales-team/team-totals",
    range
  );
  const { data: byRep } = useSectionData<ByRepResponse>("/api/ecom-simulation/sales-team/by-rep", range);
  const { data: cpa } = useSectionData<CpaResponse>("/api/ecom-simulation/sales-team/cpa", range);
  const { data: highTicket } = useSectionData<HighTicketClosersResponse>(
    "/api/ecom-simulation/sales-team/high-ticket-closers",
    range
  );

  const leaderboardColumns: Column<ByRepResponse["reps"][number]>[] = [
    { key: "rep", header: "Rep", render: (r) => r.rep },
    {
      key: "totalCashCollected",
      header: "Total Cash Collected",
      render: (r) => formatStatValue(r.totalCashCollected, "currency"),
      align: "right",
    },
    {
      key: "lowTicketCashCollected",
      header: "Low-Ticket Cash Collected",
      render: (r) => formatStatValue(r.lowTicketCashCollected, "currency"),
      align: "right",
    },
    {
      key: "highTicketCashCollected",
      header: "High-Ticket Cash Collected",
      render: (r) => formatStatValue(r.highTicketCashCollected, "currency"),
      align: "right",
    },
    {
      key: "lowTicketSales",
      header: "Low-Ticket Sales",
      render: (r) => formatStatValue(r.lowTicketSales),
      align: "right",
    },
    {
      key: "highTicketSales",
      header: "High-Ticket Sales",
      render: (r) => formatStatValue(r.highTicketSales),
      align: "right",
    },
  ];

  const cpaByDayColumns: Column<CpaResponse["totalCpaByDay"][number]>[] = [
    { key: "date", header: "Date", render: (d) => d.date },
    {
      key: "total",
      header: "Total CPA",
      render: (d) => formatStatValue(d.total, "currency"),
      align: "right",
    },
  ];

  const closerColumns: Column<HighTicketClosersResponse["closers"][number]>[] = [
    { key: "closer", header: "Closer", render: (c) => c.closer },
    {
      key: "callsBooked",
      header: "Calls Booked",
      render: (c) => formatStatValue(c.callsBooked),
      align: "right",
    },
    {
      key: "callsShowed",
      header: "Calls Showed",
      render: (c) => formatStatValue(c.callsShowed),
      align: "right",
    },
    {
      key: "showRate",
      header: "Show Rate",
      render: (c) =>
        formatStatValue(
          c.callsBooked ? (c.callsShowed ?? 0) / c.callsBooked : null,
          "percent"
        ),
      align: "right",
    },
    {
      key: "pitched",
      header: "Pitched",
      render: (c) => formatStatValue(c.pitched),
      align: "right",
    },
    {
      key: "closed",
      header: "Closed",
      render: (c) => formatStatValue(c.closed),
      align: "right",
    },
    {
      key: "closeRate",
      header: "Close Rate",
      render: (c) => formatStatValue(c.closeRate, "percent"),
      align: "right",
    },
    {
      key: "dealsClosed",
      header: "Deals Closed",
      render: (c) => formatStatValue(c.dealsClosed),
      align: "right",
    },
    {
      key: "cashCollected",
      header: "Cash Collected",
      render: (c) => formatStatValue(c.cashCollected, "currency"),
      align: "right",
    },
    {
      key: "collectedPerBookedCall",
      header: "$ / Booked Call",
      render: (c) => formatStatValue(c.collectedPerBookedCall, "currency"),
      align: "right",
    },
  ];

  const postCallNoteColumns: Column<HighTicketClosersResponse["records"][number]>[] = [
    { key: "date", header: "Date", render: (r) => (r.date ? formatDateTime(r.date) : "—") },
    { key: "rep", header: "Setter", render: (r) => r.repName ?? "Unknown" },
    { key: "lead", header: "Lead", render: (r) => r.leadName ?? "—" },
    { key: "source", header: "Source", render: (r) => r.source ?? "—" },
    { key: "outcome", header: "Call Outcome", render: (r) => r.callOutcome ?? "—" },
    { key: "offer", header: "Offer Pitched/Closed", render: (r) => r.offerPitched ?? "—" },
    {
      key: "cash",
      header: "Cash Collected",
      render: (r) => formatStatValue(r.cashCollected, "currency"),
      align: "right",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Sales Team</h1>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <DashboardSection title="Team Totals">
        <StatCardGrid>
          <StatCard label="Outbound Dials" value={teamTotals?.outboundDials} format="number" />
          <StatCard label="Pickups" value={teamTotals?.pickups} format="number" />
          <StatCard label="Pickup Rate" value={teamTotals?.pickupRate} format="percent" />
          <StatCard label="Software Pitched" value={teamTotals?.softwarePitched} format="number" />
          <StatCard label="Total Sales" value={teamTotals?.totalSales} format="number" />
          <StatCard label="Cash Collected" value={teamTotals?.cashCollected} format="currency" />
          <StatCard
            label="Total Talk Time"
            value={teamTotals?.totalTalkTimeMinutes}
            format="number"
            subtext={formatMinutes(teamTotals?.totalTalkTimeMinutes ?? null)}
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Leaderboard">
        <DataTable columns={leaderboardColumns} rows={byRep?.reps ?? []} rowKey={(r) => r.rep} />
      </DashboardSection>

      <DashboardSection title="Affiliate CPA">
        <StatCardGrid>
          <StatCard label="Total CPA Collected" value={cpa?.totalCpaCollected} format="currency" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Total CPA by Day">
        <DataTable columns={cpaByDayColumns} rows={cpa?.totalCpaByDay ?? []} rowKey={(d) => d.date} />
      </DashboardSection>

      <DashboardSection title="High Ticket Closers">
        <StatCardGrid>
          <StatCard label="Calls Booked" value={highTicket?.callsBooked} format="number" />
          <StatCard label="Calls Showed" value={highTicket?.callsShowed} format="number" />
          <StatCard label="Offers Made" value={highTicket?.offersMade} format="number" />
          <StatCard label="Deals Closed" value={highTicket?.dealsClosed} format="number" />
          <StatCard
            label="Close Rate (Closed / Pitched)"
            value={highTicket?.closeRate}
            format="percent"
          />
          <StatCard label="Cash Collected" value={highTicket?.cashCollected} format="currency" />
          <StatCard label="Total Revenue" value={highTicket?.totalRevenue} format="currency" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="By Closer">
        <DataTable columns={closerColumns} rows={highTicket?.closers ?? []} rowKey={(c) => c.closer} />
      </DashboardSection>

      <DashboardSection title="Post Call Note Records">
        <DataTable
          columns={postCallNoteColumns}
          rows={highTicket?.records ?? []}
          rowKey={(r) => r.id}
        />
      </DashboardSection>
    </div>
  );
}
