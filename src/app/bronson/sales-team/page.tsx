"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatDateTime, formatStatValue } from "@/lib/format";

type SpeedToLeadResponse = {
  avgSpeedToLead: number | null;
  medianSpeedToLead: number | null;
  leadsCalled: { called: number; total: number; notYetCalled: number };
  leads: {
    id: string;
    name: string | null;
    createdAt: string | null;
    firstCallAt: string | null;
    minutesToCall: number | null;
    status: string | null;
  }[];
};

type TeamTotalsResponse = {
  outboundDials: number | null;
  pickups: number | null;
  pickupRate: number | null;
  softwarePitched: number | null;
  totalSales: number | null;
  cashCollected: number | null;
  highTicketCallsPitched: number | null;
  newHighTicketCallsBooked: number | null;
  totalTalkTimeMinutes: number | null;
};

type ByRepResponse = {
  reps: {
    rep: string;
    outboundDials: number | null;
    pickups: number | null;
    pickupRate: number | null;
    totalSales: number | null;
    cashCollected: number | null;
    totalTalkTimeMinutes: number | null;
  }[];
};

type CpaResponse = {
  totalCpaCollected: number | null;
  totalCpaByDay: { date: string; total: number }[];
  records: {
    id: string;
    date: string | null;
    repName: string | null;
    leadName: string | null;
    software: string | null;
    plan: string | null;
    cpaCash: number | null;
  }[];
};

function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return `${minutes.toFixed(1)}m`;
}

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: speedToLead } = useSectionData<SpeedToLeadResponse>(
    "/api/bronson/sales-team/speed-to-lead",
    range
  );
  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/bronson/sales-team/team-totals",
    range
  );
  const { data: byRep } = useSectionData<ByRepResponse>("/api/bronson/sales-team/by-rep", range);
  const { data: cpa } = useSectionData<CpaResponse>("/api/bronson/sales-team/cpa", range);

  const repColumns: Column<ByRepResponse["reps"][number]>[] = [
    { key: "rep", header: "Rep", render: (r) => r.rep },
    { key: "dials", header: "Outbound Dials", render: (r) => formatStatValue(r.outboundDials), align: "right" },
    { key: "pickups", header: "Pickups", render: (r) => formatStatValue(r.pickups), align: "right" },
    {
      key: "pickupRate",
      header: "Pickup Rate",
      render: (r) => formatStatValue(r.pickupRate, "percent"),
      align: "right",
    },
    { key: "sales", header: "Sales", render: (r) => formatStatValue(r.totalSales), align: "right" },
    {
      key: "cashCollected",
      header: "Cash Collected",
      render: (r) => formatStatValue(r.cashCollected, "currency"),
      align: "right",
    },
    {
      key: "talkTime",
      header: "Total Talk Time",
      render: (r) => formatMinutes(r.totalTalkTimeMinutes),
      align: "right",
    },
  ];

  const leadColumns: Column<SpeedToLeadResponse["leads"][number]>[] = [
    { key: "lead", header: "Lead", render: (l) => l.name ?? "Unknown" },
    { key: "created", header: "Created", render: (l) => formatDateTime(l.createdAt) },
    { key: "firstCalled", header: "First Called", render: (l) => formatDateTime(l.firstCallAt) },
    {
      key: "timeToCall",
      header: "Time to Call",
      render: (l) => formatMinutes(l.minutesToCall),
    },
    {
      key: "status",
      header: "Status",
      render: (l) =>
        l.firstCallAt ? (
          l.status ?? "—"
        ) : (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50">
            Not called yet
          </span>
        ),
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

  const cpaRecordColumns: Column<CpaResponse["records"][number]>[] = [
    { key: "date", header: "Date", render: (r) => (r.date ? formatDateTime(r.date) : "—") },
    { key: "rep", header: "Rep", render: (r) => r.repName ?? "Unknown" },
    { key: "lead", header: "Lead", render: (r) => r.leadName ?? "—" },
    { key: "software", header: "Software", render: (r) => r.software ?? "—" },
    { key: "plan", header: "Plan", render: (r) => r.plan ?? "—" },
    {
      key: "cpa",
      header: "CPA / Cash",
      render: (r) => formatStatValue(r.cpaCash, "currency"),
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
            label="High Ticket Pitched"
            value={teamTotals?.highTicketCallsPitched}
            format="number"
          />
          <StatCard
            label="New High Ticket Booked"
            value={teamTotals?.newHighTicketCallsBooked}
            format="number"
          />
          <StatCard
            label="Total Talk Time"
            value={teamTotals?.totalTalkTimeMinutes}
            format="number"
            subtext={formatMinutes(teamTotals?.totalTalkTimeMinutes ?? null)}
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="By Rep">
        <DataTable columns={repColumns} rows={byRep?.reps ?? []} rowKey={(r) => r.rep} />
      </DashboardSection>

      <DashboardSection title="Affiliate CPA">
        <StatCardGrid>
          <StatCard label="Total CPA Collected" value={cpa?.totalCpaCollected} format="currency" />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Total CPA by Day">
        <DataTable columns={cpaByDayColumns} rows={cpa?.totalCpaByDay ?? []} rowKey={(d) => d.date} />
      </DashboardSection>

      <DashboardSection title="Affiliate PCN Records">
        <DataTable columns={cpaRecordColumns} rows={cpa?.records ?? []} rowKey={(r) => r.id} />
      </DashboardSection>

      <DashboardSection title="Speed to Lead">
        <StatCardGrid>
          <StatCard label="Avg. Speed to Lead" value={speedToLead?.avgSpeedToLead} format="number" />
          <StatCard label="Median Speed to Lead" value={speedToLead?.medianSpeedToLead} format="number" />
          <StatCard
            label="Leads Called"
            value={speedToLead?.leadsCalled.called}
            format="number"
            subtext={
              speedToLead
                ? `${speedToLead.leadsCalled.called}/${speedToLead.leadsCalled.total} — ${speedToLead.leadsCalled.notYetCalled} not yet called`
                : undefined
            }
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Leads — Speed to Lead Detail">
        <DataTable
          columns={leadColumns}
          rows={speedToLead?.leads ?? []}
          rowKey={(l) => l.id}
        />
      </DashboardSection>
    </div>
  );
}
