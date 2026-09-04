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
  leadsCalled: {
    called: number;
    total: number;
    notYetCalled: number;
    calledUnder5: number;
    under5Rate: number | null;
  };
  leads: {
    id: string;
    name: string | null;
    createdAt: string | null;
    firstCallAt: string | null;
    minutesToCall: number | null;
    status: string | null;
    everSpokeTo?: boolean;
  }[];
};

type SpeedBucket = { label: string; className: string };

function speedBucket(lead: {
  minutesToCall: number | null;
  firstCallAt: string | null;
  everSpokeTo?: boolean;
}): SpeedBucket {
  const { minutesToCall, firstCallAt, everSpokeTo } = lead;
  if (!firstCallAt || minutesToCall === null || !Number.isFinite(minutesToCall)) {
    // No first-call timestamp on the Speed to Lead table — but if the lead
    // turns up in a call log we still know they were reached.
    if (everSpokeTo) {
      return { label: "Called (no timestamp)", className: "bg-blue-100 text-blue-800" };
    }
    return { label: "Not called yet", className: "bg-black/5 text-black/50" };
  }
  if (minutesToCall < 5) return { label: "Under 5 min", className: "bg-green-100 text-green-800" };
  if (minutesToCall <= 10) return { label: "5–10 min", className: "bg-amber-100 text-amber-800" };
  return { label: "Over 10 min", className: "bg-red-100 text-red-800" };
}

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

function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return `${minutes.toFixed(1)}m`;
}

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: speedToLead } = useSectionData<SpeedToLeadResponse>(
    "/api/aval/sales-team/speed-to-lead",
    range
  );
  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/aval/sales-team/team-totals",
    range
  );
  const { data: byRep } = useSectionData<ByRepResponse>("/api/aval/sales-team/by-rep", range);

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
      render: (l) => {
        const bucket = speedBucket(l);
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bucket.className}`}>
            {bucket.label}
          </span>
        );
      },
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

      <div className="ko-light-panel">
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
            <StatCard
              label="Called Under 5 Min"
              value={speedToLead?.leadsCalled.calledUnder5}
              format="number"
              subtext={
                speedToLead
                  ? `of ${speedToLead.leadsCalled.total} total opt-ins`
                  : undefined
              }
            />
            <StatCard
              label="% Called Under 5 Min"
              value={speedToLead?.leadsCalled.under5Rate}
              format="percent"
              subtext="Under-5-min calls ÷ total opt-ins"
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
    </div>
  );
}
