"use client";

import { HeroStat, HERO_GRADIENT } from "@/components/dashboard/HeroStat";
import { DashboardSection } from "@/components/dashboard/StatCardGrid";
import { RangeFilterBar } from "@/components/dashboard/RangeFilterBar";
import { CashVsSpendChart } from "@/components/dashboard/CashVsSpendChart";
import { AgencyCashCalendar } from "@/components/dashboard/AgencyCashCalendar";
import { AgencyExpenses } from "@/components/dashboard/AgencyExpenses";
import { useSharedRange } from "@/lib/range-context";
import { useSectionData } from "@/lib/use-section-data";
import { formatStatValue } from "@/lib/format";
import { rangePeriodLabel } from "@/lib/range-label";

type ClientMetrics = {
  cash: number;
  adSpend: number;
  salesTeamPayout: number;
  expenses: number;
  fees: number;
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
  totalExpenses: number;
  totalFees: number;
  totalAgencyProfit: number;
  salesManagerCut: number;
  myProfit: number;
  bronsonReimbursement: number;
  bronsonTotalOwed: number;
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

// Same card surface as the HeroStat cards, so the table sits in the same family.
const PANEL_GRADIENT =
  "linear-gradient(160deg, rgba(30,41,59,0.75) 0%, rgba(13,18,30,0.92) 60%, rgba(10,14,24,0.95) 100%)";
const GRADIENT_TEXT = {
  backgroundImage: HERO_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;

export default function AgencyPage() {
  const { range, setRange } = useSharedRange();
  const period = rangePeriodLabel(range);
  const { data } = useSectionData<MetricsResponse>("/api/agency/overview/metrics", range);

  const totalRow = data
    ? {
        adSpend: data.totalAdSpend,
        cash: data.totalCashCollected,
        profit: data.totalProfit,
        salesTeamPayout: data.totalSalesTeamPayout,
        expenses: data.totalExpenses,
        fees: data.totalFees,
        agencyProfit: data.totalAgencyProfit,
        salesManagerCut: data.salesManagerCut,
        personalProfit: data.myProfit,
      }
    : null;

  // The sales manager left after September 2026: no card or column once the range has no cut.
  const hasSalesManagerCut = !!data && data.salesManagerCut !== 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-[var(--text-strong)]">
            Agency
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/[0.08] px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
            </span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Every client combined. Bronson&apos;s affiliate cash is real: what the affiliate portal
            actually tracked, not what was logged. Ad spend, sales team payouts, expenses and
            fees (2.5% processing on high ticket, VIP and Bronson AI, plus 15% on financed deals, from October 2026) come off first, then each
            offer&apos;s profit-share.
          </p>
        </div>
        <RangeFilterBar value={range} onChange={setRange} />
      </div>

      <DashboardSection title="Keystone Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HeroStat
            label="Total Cash Collected"
            value={data?.totalCashCollected}
            format="currency"
            period={period}
            sub="Every client combined"
          />
          <HeroStat
            label="Total Profit"
            value={data?.totalProfit}
            format="currency"
            period={period}
            sub="Cash − Ad Spend − Sales Team Payouts − Expenses − Fees, across all clients."
          />
          <HeroStat
            label="Agency Profit"
            value={data?.totalAgencyProfit}
            format="currency"
            period={period}
            sub="KOconsultings' take-home — each client's own profit-share formula."
          />
          <HeroStat
            label="My Profit"
            value={data?.myProfit}
            format="currency"
            period={period}
            sub={
              !data
                ? undefined
                : hasSalesManagerCut
                  ? `Agency Profit minus sales manager's 5% cut (${formatStatValue(data.salesManagerCut, "currency")}).`
                  : "Your take-home. Same as Agency Profit: no sales manager cut."
            }
          />
          <HeroStat
            size="md"
            label="Total Ad Spend"
            value={data?.totalAdSpend}
            format="currency"
            sub="Every client combined"
          />
          <HeroStat
            size="md"
            label="Total Sales Team Payouts"
            value={data?.totalSalesTeamPayout}
            format="currency"
            sub="Bronson: actual paid-traffic commissions from his Commissions tab (organic not deducted). Aval (from Oct 2026) and Andy: 10%/20% weekday/weekend on Affiliate, 15% on High Ticket (5% setter + 10% closer)."
          />
          <HeroStat
            size="md"
            label="Bronson Owes You"
            value={data?.bronsonTotalOwed}
            format="currency"
            sub={
              data
                ? `Your Bronson profit share (${formatStatValue(data.clients.bronson.agencyProfit, "currency")}) + bills you paid yourself (${formatStatValue(data.bronsonReimbursement, "currency")}).`
                : undefined
            }
          />
          <HeroStat
            size="md"
            label="Reimbursement From Bronson"
            value={data?.bronsonReimbursement}
            format="currency"
            sub="Expenses marked I paid, sent back in full. They still come off paid profit before the split, so you each carry half the cost."
          />
          {hasSalesManagerCut && (
            <HeroStat
              size="md"
              label="Sales Manager Cut"
              value={data?.salesManagerCut}
              format="currency"
              sub="Through September 2026 only. Bronson: 5% of organic cash + 5% of paid profit. Andy: 5% of organic + paid profit. No cut on Aval. Comes out of your own take-home."
            />
          )}
        </div>
      </DashboardSection>

      <DashboardSection title="By Client">
        <div
          className="overflow-x-auto rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]"
          style={{ background: PANEL_GRADIENT }}
        >
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                <th className="px-5 py-4">Client</th>
                <th className="px-5 py-4 text-right">Ad Spend</th>
                <th className="px-5 py-4 text-right">Cash Collected</th>
                <th className="px-5 py-4 text-right">Profit</th>
                <th className="px-5 py-4 text-right">Sales Team Payout</th>
                <th className="px-5 py-4 text-right">Expenses</th>
                <th className="px-5 py-4 text-right">Fees</th>
                <th className="px-5 py-4 text-right">Agency Profit</th>
                {hasSalesManagerCut && (
                  <th className="px-5 py-4 text-right">Sales Manager Payout</th>
                )}
                <th className="px-5 py-4 text-right">Personal Profit</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_ROWS.map(({ key, label, dot }) => {
                const c = data?.clients[key];
                // Andy left after September 2026: no row once the range has nothing of his.
                if (key === "ecomSimulation" && c && c.cash === 0 && c.adSpend === 0 && c.expenses === 0) {
                  return null;
                }
                return (
                  <tr key={key} className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2.5 font-semibold text-[var(--text-strong)]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot, boxShadow: `0 0 10px ${dot}` }} />
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">{formatStatValue(c?.adSpend, "currency")}</td>
                    <td className="px-5 py-4 text-right font-semibold text-sky-300">{formatStatValue(c?.cash, "currency")}</td>
                    <td className="px-5 py-4 text-right">{formatStatValue(c?.profit, "currency")}</td>
                    <td className="px-5 py-4 text-right">
                      {formatStatValue(c?.salesTeamPayout, "currency")}
                    </td>
                    <td className="px-5 py-4 text-right text-rose-400">
                      {formatStatValue(c?.expenses, "currency")}
                    </td>
                    <td className="px-5 py-4 text-right text-rose-400">
                      {formatStatValue(c?.fees, "currency")}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-emerald-400">
                      {formatStatValue(c?.agencyProfit, "currency")}
                    </td>
                    {hasSalesManagerCut && (
                      <td className="px-5 py-4 text-right font-semibold text-rose-400">
                        {formatStatValue(c?.salesManagerCut, "currency")}
                      </td>
                    )}
                    <td className="px-5 py-4 text-right font-semibold text-emerald-400">
                      {formatStatValue(c?.personalProfit, "currency")}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-sky-400/[0.05] font-bold">
                <td className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-300">Total</td>
                <td className="px-5 py-4 text-right">{formatStatValue(totalRow?.adSpend, "currency")}</td>
                <td className="px-5 py-4 text-right">
                  <span style={GRADIENT_TEXT}>{formatStatValue(totalRow?.cash, "currency")}</span>
                </td>
                <td className="px-5 py-4 text-right">{formatStatValue(totalRow?.profit, "currency")}</td>
                <td className="px-5 py-4 text-right">
                  {formatStatValue(totalRow?.salesTeamPayout, "currency")}
                </td>
                <td className="px-5 py-4 text-right text-rose-400">
                  {formatStatValue(totalRow?.expenses, "currency")}
                </td>
                <td className="px-5 py-4 text-right text-rose-400">
                  {formatStatValue(totalRow?.fees, "currency")}
                </td>
                <td className="px-5 py-4 text-right text-emerald-400">
                  {formatStatValue(totalRow?.agencyProfit, "currency")}
                </td>
                {hasSalesManagerCut && (
                  <td className="px-5 py-4 text-right text-rose-400">
                    {formatStatValue(totalRow?.salesManagerCut, "currency")}
                  </td>
                )}
                <td className="px-5 py-4 text-right">
                  <span style={GRADIENT_TEXT}>{formatStatValue(totalRow?.personalProfit, "currency")}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title="Cash Collected vs Ad Spend">
        <CashVsSpendChart data={data?.byDay ?? []} />
      </DashboardSection>

      <div className="mt-12">
        <AgencyExpenses />
      </div>

      <DashboardSection title="Cash Calendar">
        <AgencyCashCalendar />
      </DashboardSection>
    </div>
  );
}
