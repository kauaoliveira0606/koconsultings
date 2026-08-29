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
  callsBooked: number | null;
  callsShowed: number | null;
  dealsClosed: number | null;
  cashCollected: number | null;
  totalRevenue: number | null;
  totalTalkTimeMinutes: number | null;
  followUpPaymentsCollected: number | null;
};

type BySetterResponse = {
  setters: {
    setter: string;
    outboundDials: number | null;
    pickups: number | null;
    pickupRate: number | null;
    callsBookedSet: number | null;
  }[];
};

type ByCloserResponse = {
  closers: {
    closer: string;
    callsBooked: number | null;
    callsShowed: number | null;
    dealsClosed: number | null;
    cashCollected: number | null;
    totalTalkTimeMinutes: number | null;
  }[];
};

type PostCallNotesResponse = {
  notes: {
    id: string;
    date: string | null;
    repName: string | null;
    leadName: string | null;
    source: string | null;
    callOutcome: string | null;
    offerPitched: string | null;
    cashCollected: number | null;
  }[];
};

type FollowUpPaymentsResponse = {
  totalCollected: number | null;
  payments: {
    id: string;
    date: string | null;
    setterName: string | null;
    closerName: string | null;
    leadFirstName: string | null;
    leadLastName: string | null;
    cashCollected: number | null;
  }[];
};

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  return `${minutes.toFixed(1)}m`;
}

export default function SalesTeamPage() {
  const { range, setRange } = useSharedRange();

  const { data: teamTotals } = useSectionData<TeamTotalsResponse>(
    "/api/aval/sales-team/team-totals",
    range
  );
  const { data: bySetter } = useSectionData<BySetterResponse>("/api/aval/sales-team/by-setter", range);
  const { data: byCloser } = useSectionData<ByCloserResponse>("/api/aval/sales-team/by-closer", range);
  const { data: postCallNotes } = useSectionData<PostCallNotesResponse>(
    "/api/aval/sales-team/post-call-notes",
    range
  );
  const { data: followUpPayments } = useSectionData<FollowUpPaymentsResponse>(
    "/api/aval/sales-team/follow-up-payments",
    range
  );

  const setterColumns: Column<BySetterResponse["setters"][number]>[] = [
    { key: "setter", header: "Setter", render: (r) => r.setter },
    { key: "dials", header: "Outbound Dials", render: (r) => formatStatValue(r.outboundDials), align: "right" },
    { key: "pickups", header: "Pickups", render: (r) => formatStatValue(r.pickups), align: "right" },
    {
      key: "pickupRate",
      header: "Pickup Rate",
      render: (r) => formatStatValue(r.pickupRate, "percent"),
      align: "right",
    },
    {
      key: "callsBookedSet",
      header: "Calls Booked/Set",
      render: (r) => formatStatValue(r.callsBookedSet),
      align: "right",
    },
  ];

  const closerColumns: Column<ByCloserResponse["closers"][number]>[] = [
    { key: "closer", header: "Closer", render: (r) => r.closer },
    { key: "callsBooked", header: "Calls Booked", render: (r) => formatStatValue(r.callsBooked), align: "right" },
    { key: "callsShowed", header: "Calls Showed", render: (r) => formatStatValue(r.callsShowed), align: "right" },
    { key: "dealsClosed", header: "Deals Closed", render: (r) => formatStatValue(r.dealsClosed), align: "right" },
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

  const noteColumns: Column<PostCallNotesResponse["notes"][number]>[] = [
    { key: "date", header: "Date", render: (n) => (n.date ? formatDateTime(n.date) : "—") },
    { key: "rep", header: "Rep", render: (n) => n.repName ?? "Unknown" },
    { key: "lead", header: "Lead", render: (n) => n.leadName ?? "—" },
    { key: "source", header: "Source", render: (n) => n.source ?? "—" },
    { key: "outcome", header: "Call Outcome", render: (n) => n.callOutcome ?? "—" },
    { key: "offer", header: "Offer Pitched/Closed", render: (n) => n.offerPitched ?? "—" },
    {
      key: "cash",
      header: "Cash Collected",
      render: (n) => formatStatValue(n.cashCollected, "currency"),
      align: "right",
    },
  ];

  const paymentColumns: Column<FollowUpPaymentsResponse["payments"][number]>[] = [
    { key: "date", header: "Date", render: (p) => (p.date ? formatDateTime(p.date) : "—") },
    {
      key: "lead",
      header: "Lead",
      render: (p) => [p.leadFirstName, p.leadLastName].filter(Boolean).join(" ") || "—",
    },
    { key: "setter", header: "Setter", render: (p) => p.setterName ?? "—" },
    { key: "closer", header: "Closer", render: (p) => p.closerName ?? "—" },
    {
      key: "cash",
      header: "Cash Collected",
      render: (p) => formatStatValue(p.cashCollected, "currency"),
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
          <StatCard label="Calls Booked" value={teamTotals?.callsBooked} format="number" />
          <StatCard label="Calls Showed" value={teamTotals?.callsShowed} format="number" />
          <StatCard label="Deals Closed" value={teamTotals?.dealsClosed} format="number" />
          <StatCard label="Cash Collected" value={teamTotals?.cashCollected} format="currency" />
          <StatCard label="Total Revenue" value={teamTotals?.totalRevenue} format="currency" />
          <StatCard
            label="Follow Up Payments Collected"
            value={teamTotals?.followUpPaymentsCollected}
            format="currency"
          />
          <StatCard
            label="Total Talk Time"
            value={teamTotals?.totalTalkTimeMinutes}
            format="number"
            subtext={formatMinutes(teamTotals?.totalTalkTimeMinutes)}
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="By Setter">
        <DataTable columns={setterColumns} rows={bySetter?.setters ?? []} rowKey={(r) => r.setter} />
      </DashboardSection>

      <DashboardSection title="By Closer">
        <DataTable columns={closerColumns} rows={byCloser?.closers ?? []} rowKey={(r) => r.closer} />
      </DashboardSection>

      <DashboardSection title="Post Call Notes">
        <DataTable columns={noteColumns} rows={postCallNotes?.notes ?? []} rowKey={(n) => n.id} />
      </DashboardSection>

      <DashboardSection
        title="Follow Up Payments"
        action={
          <span className="text-sm font-semibold">
            Total: {formatStatValue(followUpPayments?.totalCollected ?? null, "currency")}
          </span>
        }
      >
        <DataTable columns={paymentColumns} rows={followUpPayments?.payments ?? []} rowKey={(p) => p.id} />
      </DashboardSection>
    </div>
  );
}
