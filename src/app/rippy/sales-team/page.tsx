"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";

type TeamTotalsResponse = {
  outboundDials: number | null;
  pickups: number | null;
  pickupRate: number | null;
  base44Pitched: number | null;
  base44Closes: number | null;
  base44CashCollected: number | null;
  highTicketShowed: number | null;
  highTicketBooked: number | null;
  highTicketCloses: number | null;
  highTicketCashCollected: number | null;
  totalCashCollected: number | null;
};

type Setter = {
  name: string;
  outboundDials: number | null;
  pickups: number | null;
  pickupRate: number | null;
  base44Pitched: number | null;
  highTicketBooked: number | null;
  highTicketShowed: number | null;
};

type Closer = {
  name: string;
  base44Closes: number;
  base44CashCollected: number | null;
  highTicketCloses: number;
  highTicketCashCollected: number | null;
  totalCashCollected: number | null;
};

type ByRepResponse = { setters: Setter[]; closers: Closer[] };

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/rippy/sales-team/team-totals",
    range
  );
  const { data: byRep } = useSectionData<ByRepResponse>("/api/rippy/sales-team/by-rep", range);

  const setterColumns: Column<Setter>[] = [
    { key: "name", header: "Setter", render: (r) => r.name },
    {
      key: "dials",
      header: "Outbound Dials",
      render: (r) => formatStatValue(r.outboundDials),
      align: "right",
    },
    { key: "pickups", header: "Pickups", render: (r) => formatStatValue(r.pickups), align: "right" },
    {
      key: "pickupRate",
      header: "Pickup Rate",
      render: (r) => formatStatValue(r.pickupRate, "percent"),
      align: "right",
    },
    {
      key: "base44Pitched",
      header: "Base44 Pitched",
      render: (r) => formatStatValue(r.base44Pitched),
      align: "right",
    },
    {
      key: "htBooked",
      header: "HT Booked",
      render: (r) => formatStatValue(r.highTicketBooked),
      align: "right",
    },
    {
      key: "htShowed",
      header: "HT Showed",
      render: (r) => formatStatValue(r.highTicketShowed),
      align: "right",
    },
  ];

  const closerColumns: Column<Closer>[] = [
    { key: "name", header: "Closer", render: (r) => r.name },
    {
      key: "base44Closes",
      header: "Base44 Closes",
      render: (r) => formatStatValue(r.base44Closes),
      align: "right",
    },
    {
      key: "base44Cash",
      header: "Base44 Cash Collected",
      render: (r) => formatStatValue(r.base44CashCollected, "currency"),
      align: "right",
    },
    {
      key: "htCloses",
      header: "HT Closes",
      render: (r) => formatStatValue(r.highTicketCloses),
      align: "right",
    },
    {
      key: "htCash",
      header: "HT Cash Collected",
      render: (r) => formatStatValue(r.highTicketCashCollected, "currency"),
      align: "right",
    },
    {
      key: "totalCash",
      header: "Total Cash Collected",
      render: (r) => formatStatValue(r.totalCashCollected, "currency"),
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
          <StatCard label="Base44 Pitched" value={teamTotals?.base44Pitched} format="number" />
          <StatCard label="Base44 Closes" value={teamTotals?.base44Closes} format="number" />
          <StatCard
            label="Base44 Cash Collected"
            value={teamTotals?.base44CashCollected}
            format="currency"
          />
          <StatCard label="High Ticket Showed" value={teamTotals?.highTicketShowed} format="number" />
          <StatCard label="High Ticket Booked" value={teamTotals?.highTicketBooked} format="number" />
          <StatCard label="High Ticket Closes" value={teamTotals?.highTicketCloses} format="number" />
          <StatCard
            label="High Ticket Cash Collected"
            value={teamTotals?.highTicketCashCollected}
            format="currency"
          />
          <StatCard
            label="Total Cash Collected"
            value={teamTotals?.totalCashCollected}
            format="currency"
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="By Setter">
        <DataTable columns={setterColumns} rows={byRep?.setters ?? []} rowKey={(r) => r.name} />
      </DashboardSection>

      <DashboardSection title="By Closer">
        <DataTable columns={closerColumns} rows={byRep?.closers ?? []} rowKey={(r) => r.name} />
      </DashboardSection>
    </div>
  );
}
