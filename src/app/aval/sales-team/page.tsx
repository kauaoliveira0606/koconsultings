"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { cellStatus } from "@/lib/weekly-scorecard";
import type { GoalsConfig } from "@/lib/goals";
import { StatCardGrid, DashboardSection } from "@/components/dashboard/StatCardGrid";
import { CloserLeaderboard } from "@/components/dashboard/CloserLeaderboard";
import { SetterLeaderboard } from "@/components/dashboard/SetterLeaderboard";
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
  touchPoints: {
    avgTouchPoints: number | null;
    atFivePlus: number;
    atFivePlusRate: number | null;
    total: number;
  };
  leads: {
    id: string;
    name: string | null;
    createdAt: string | null;
    firstCallAt: string | null;
    minutesToCall: number | null;
    status: string | null;
    touchPoints: number | null;
  }[];
};

type SpeedBucket = { label: string; className: string };

function speedBucket(lead: {
  minutesToCall: number | null;
  firstCallAt: string | null;
}): SpeedBucket {
  const { minutesToCall, firstCallAt } = lead;
  if (!firstCallAt || minutesToCall === null || !Number.isFinite(minutesToCall)) {
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

/** 4.2 min, 1h 12m, 2d 3h: readable at any size. */
function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return `${minutes.toFixed(1)}m`;
}

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: goals } = useSectionData<GoalsConfig>("/api/aval/goals", range);
  const { data: speedToLead } = useSectionData<SpeedToLeadResponse>(
    "/api/aval/sales-team/speed-to-lead",
    range
  );
  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/aval/sales-team/team-totals",
    range
  );

  const leadColumns: Column<SpeedToLeadResponse["leads"][number]>[] = [
    { key: "lead", header: "Lead", render: (l) => l.name ?? "Unknown" },
    { key: "created", header: "Opted In", render: (l) => formatDateTime(l.createdAt) },
    { key: "firstCalled", header: "First Called", render: (l) => formatDateTime(l.firstCallAt) },
    {
      key: "timeToCall",
      header: "Time to Call",
      render: (l) => formatMinutes(l.minutesToCall),
    },
    {
      key: "touchPoints",
      header: "Touch Points",
      render: (l) => formatStatValue(l.touchPoints ?? 0),
      align: "right",
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

      <DashboardSection title="Closer Leaderboard">
        <CloserLeaderboard
          apiPath="/api/aval/sales-team/closer-leaderboard"
          range={range}
          goals={goals}
        />
      </DashboardSection>

      <DashboardSection title="Setter Leaderboard">
        <SetterLeaderboard
          apiPath="/api/aval/sales-team/setter-leaderboard"
          range={range}
          goals={goals}
        />
      </DashboardSection>

      <div className="ko-light-panel">
        <DashboardSection title="Speed to Lead">
          <StatCardGrid>
            <StatCard
              label="Avg. Speed to Lead"
              value={speedToLead?.avgSpeedToLead}
              override={speedToLead ? formatDuration(speedToLead.avgSpeedToLead) : undefined}
              subtext="Average working-hours time (9am–11pm ET) from opt-in to a rep's first call, called leads only"
              status={cellStatus(
                speedToLead?.avgSpeedToLead ?? null,
                goals?.speedToLeadMinutes?.max ?? null,
                "lower"
              )}
              goal={goals?.speedToLeadMinutes ? `≤ ${goals.speedToLeadMinutes.max} min` : null}
            />
            <StatCard
              label="% Called Under 5 Min"
              value={speedToLead?.leadsCalled.under5Rate}
              format="percent"
              subtext={
                speedToLead
                  ? `${speedToLead.leadsCalled.calledUnder5} of ${speedToLead.leadsCalled.total} opt-ins called within 5 working min (9am–11pm ET) · ${speedToLead.leadsCalled.notYetCalled} not called yet`
                  : undefined
              }
            />
          </StatCardGrid>
        </DashboardSection>

        <DashboardSection title="Touch Point Density">
          <StatCardGrid>
            <StatCard
              label="Avg. Touch Points per Lead"
              value={speedToLead?.touchPoints.avgTouchPoints}
              format="ratio"
              override={
                speedToLead?.touchPoints.avgTouchPoints != null
                  ? speedToLead.touchPoints.avgTouchPoints.toFixed(1)
                  : undefined
              }
              subtext="Rep calls in each lead's first 14 days; a double-dial (calls within 5 min) counts as 1 touch point. Every opt-in counts, uncalled leads as 0."
              status={cellStatus(
                speedToLead?.touchPoints.avgTouchPoints ?? null,
                goals?.touchPointsPerLead?.min ?? null,
                "higher"
              )}
              goal={goals?.touchPointsPerLead ? `≥ ${goals.touchPointsPerLead.min} per lead` : null}
            />
            <StatCard
              label="% Leads With 5+ Touch Points"
              value={speedToLead?.touchPoints.atFivePlusRate}
              format="percent"
              subtext={
                speedToLead
                  ? `${speedToLead.touchPoints.atFivePlus} of ${speedToLead.touchPoints.total} opt-ins reached 5 touch points`
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
    </div>
  );
}
