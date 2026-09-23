"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { CashVsSpendChart } from "@/components/dashboard/CashVsSpendChart";
import { AgencyCashCalendar } from "@/components/dashboard/AgencyCashCalendar";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";

type ClientMetrics = {
  cash: number;
  adSpend: number;
  salesTeamPayout: number;
  profit: number;
  agencyProfit: number;
  salesManagerCut: number;
  personalProfit: number;
};

type MetricsResponse = {
  totalCashCollected: number;
  totalAdSpend: number;
  totalProfit: number;
  totalSalesTeamPayout: number;
  totalAgencyProfit: number;
  salesManagerCut: number;
  myProfit: number;
  blendedRoas: number | null;
  clients: {
    bronson: ClientMetrics;
    aval: ClientMetrics;
    ecomSimulation: ClientMetrics;
  };
  byDay: { date: string; cash: number; adSpend: number }[];
};

const CLIENT_ROWS: { key: keyof MetricsResponse["clients"]; label: string; dot: string }[] = [
  { key: "bronson", label: "Bronson", dot: "#f97316" },
  { key: "aval", label: "Aval", dot: "#a855f7" },
  { key: "ecomSimulation", label: "Andy (Ecom Simulation)", dot: "#22d3ee" },
];

export default function AgencyPage() {
  const { range, setRange } = useSharedRange();
  const { data } = useSectionData<MetricsResponse>("/api/agency/overview/metrics", range);

  const totalRow = data
    ? {
        adSpend: data.totalAdSpend,
        cash: data.totalCashCollected,
        profit: data.totalProfit,
        salesTeamPayout: data.totalSalesTeamPayout,
        agencyProfit: data.totalAgencyProfit,
        salesManagerCut: data.salesManagerCut,
        personalProfit: data.myProfit,
      }
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Agency
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Every client combined. Ad spend and sales team payouts come off first, then each
            offer&apos;s profit-share.
          </p>
        </div>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Ad Spend"
          value={data?.totalAdSpend}
          format="currency"
          size="lg"
        />
        <StatCard
          label="Total Cash Collected"
          value={data?.totalCashCollected}
          format="currency"
          size="lg"
        />
        <StatCard
          label="Total Profit"
          value={data?.totalProfit}
          format="currency"
          size="lg"
          subtext="Cash − Ad Spend − Sales Team Payouts, across all clients."
        />
        <StatCard
          label="Total Sales Team Payouts"
          value={data?.totalSalesTeamPayout}
          format="currency"
          size="lg"
          subtext="10%/20% weekday/weekend on Low Ticket, flat 15% on High Ticket."
        />
        <StatCard
          label="Agency Profit"
          value={data?.totalAgencyProfit}
          format="currency"
          size="lg"
          subtext="KOconsultings' take-home — each client's own profit-share formula."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="My Profit"
          value={data?.myProfit}
          format="currency"
          size="lg"
          subtext={
            data
              ? `Agency Profit minus sales manager's 5% cut (${formatStatValue(data.salesManagerCut, "currency")}).`
              : undefined
          }
        />
        <StatCard
          label="Sales Manager Cut"
          value={data?.salesManagerCut}
          format="currency"
          subtext="Bronson: 5% of organic cash + 5% of paid profit. Andy: 5% of organic + paid profit. No cut on Aval. Comes out of your own take-home."
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Cash Collected vs Ad Spend
        </h2>
        <CashVsSpendChart data={data?.byDay ?? []} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          By Client
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--panel-border)] text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Ad Spend</th>
                <th className="px-4 py-3 text-right">Cash Collected</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">Sales Team Payout</th>
                <th className="px-4 py-3 text-right">Agency Profit</th>
                <th className="px-4 py-3 text-right">Sales Manager Payout</th>
                <th className="px-4 py-3 text-right">Personal Profit</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_ROWS.map(({ key, label, dot }) => {
                const c = data?.clients[key];
                return (
                  <tr key={key} className="border-b border-[var(--panel-border)] last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatStatValue(c?.adSpend, "currency")}</td>
                    <td className="px-4 py-3 text-right">{formatStatValue(c?.cash, "currency")}</td>
                    <td className="px-4 py-3 text-right">{formatStatValue(c?.profit, "currency")}</td>
                    <td className="px-4 py-3 text-right">
                      {formatStatValue(c?.salesTeamPayout, "currency")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                      {formatStatValue(c?.agencyProfit, "currency")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400">
                      {formatStatValue(c?.salesManagerCut, "currency")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                      {formatStatValue(c?.personalProfit, "currency")}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{formatStatValue(totalRow?.adSpend, "currency")}</td>
                <td className="px-4 py-3 text-right">{formatStatValue(totalRow?.cash, "currency")}</td>
                <td className="px-4 py-3 text-right">{formatStatValue(totalRow?.profit, "currency")}</td>
                <td className="px-4 py-3 text-right">
                  {formatStatValue(totalRow?.salesTeamPayout, "currency")}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400">
                  {formatStatValue(totalRow?.agencyProfit, "currency")}
                </td>
                <td className="px-4 py-3 text-right text-red-400">
                  {formatStatValue(totalRow?.salesManagerCut, "currency")}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400">
                  {formatStatValue(totalRow?.personalProfit, "currency")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Cash Calendar
        </h2>
        <AgencyCashCalendar />
      </div>
    </div>
  );
}
