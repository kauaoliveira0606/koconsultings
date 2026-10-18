import { formatStatValue } from "@/lib/format";

type Cash = number | null | undefined;

export type RevenueBreakdownProps = {
  lowTicketOrganic: Cash;
  lowTicketPaid: Cash;
  highTicketOrganic: Cash;
  highTicketPaid: Cash;
  /** Webinar VIP purchases. */
  vipOrganic: Cash;
  vipPaid: Cash;
  /** Bronson AI subscriptions. Bronson only; the column hides when left out. */
  aiOrganic?: Cash;
  aiPaid?: Cash;
  /** Booked high ticket revenue, payment plans included. Reference only. */
  revenueHighTicket: Cash;
  adSpend: Cash;
  /** False hides the Affiliate column (Bronson, off affiliate since Oct 2026). Old affiliate cash still counts in Combined. */
  showAffiliate?: boolean;
};

/** Adds what is there; stays empty while nothing has loaded. */
export function addCash(...values: Cash[]): number | null {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length > 0 ? known.reduce((t, v) => t + v, 0) : null;
}

const money = (value: Cash) => formatStatValue(value, "currency");

function Cell({ label, value, tone }: { label: string; value: Cash; tone?: "paid" | "organic" }) {
  return (
    <div className="min-w-0 flex-1 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {tone ? (
          <span
            className={`h-2 w-2 rounded-full ${tone === "paid" ? "bg-sky-400" : "bg-emerald-400"}`}
          />
        ) : null}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-[var(--text-strong)]">{money(value)}</div>
    </div>
  );
}

function Footer({ rows }: { rows: [string, Cash][] }) {
  return (
    <div className="space-y-1 border-t border-[var(--panel-border)] px-4 py-3 text-xs text-[var(--text-muted)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <span>{label}</span>
          <span className="font-semibold text-[var(--text-strong)]">{money(value)}</span>
        </div>
      ))}
    </div>
  );
}

const PANEL =
  "flex flex-col rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-sm";
const GRID: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-2 xl:grid-cols-4" };
const SPAN: Record<number, string> = { 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-2 xl:col-span-4" };

const PANEL_TITLE =
  "border-b border-[var(--panel-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-strong)]";

/**
 * Cash collected, laid out as columns: Affiliate (Organic | Paid), High
 * Ticket (Organic | Paid), VIP (Organic | Paid), then Combined underneath. Every figure is the Marketing Daily
 * Metrics form's own Paid / Organic split.
 */
export function RevenueBreakdown({
  lowTicketOrganic,
  lowTicketPaid,
  highTicketOrganic,
  highTicketPaid,
  vipOrganic,
  vipPaid,
  aiOrganic,
  aiPaid,
  revenueHighTicket,
  adSpend,
  showAffiliate = true,
}: RevenueBreakdownProps) {
  const showAi = aiOrganic !== undefined || aiPaid !== undefined;
  const parts = [showAffiliate ? "Affiliate" : null, "HT", "VIP", showAi ? "AI" : null].filter(Boolean).join(" + ");
  const panels = 2 + (showAffiliate ? 1 : 0) + (showAi ? 1 : 0);
  const organic = addCash(lowTicketOrganic, highTicketOrganic, vipOrganic, aiOrganic);
  const paid = addCash(lowTicketPaid, highTicketPaid, vipPaid, aiPaid);
  return (
    <div>
      <div className={`grid grid-cols-1 gap-4 ${GRID[panels]}`}>
        {showAffiliate ? (
        <div className={PANEL}>
          <div className={PANEL_TITLE}>Affiliate</div>
          <div className="flex flex-1 divide-x divide-[var(--panel-border)]">
            <Cell label="Organic" value={lowTicketOrganic} tone="organic" />
            <Cell label="Paid" value={lowTicketPaid} tone="paid" />
          </div>
          <Footer rows={[["Affiliate total", addCash(lowTicketOrganic, lowTicketPaid)]]} />
        </div>
        ) : null}

        <div className={PANEL}>
          <div className={PANEL_TITLE}>High Ticket</div>
          <div className="flex flex-1 divide-x divide-[var(--panel-border)]">
            <Cell label="Organic" value={highTicketOrganic} tone="organic" />
            <Cell label="Paid" value={highTicketPaid} tone="paid" />
          </div>
          <Footer
            rows={[
              ["High ticket total", addCash(highTicketOrganic, highTicketPaid)],
              ["Booked revenue (incl. unpaid plans)", revenueHighTicket],
            ]}
          />
        </div>

        <div className={PANEL}>
          <div className={PANEL_TITLE}>VIP</div>
          <div className="flex flex-1 divide-x divide-[var(--panel-border)]">
            <Cell label="Organic" value={vipOrganic} tone="organic" />
            <Cell label="Paid" value={vipPaid} tone="paid" />
          </div>
          <Footer rows={[["VIP total", addCash(vipOrganic, vipPaid)]]} />
        </div>

        {showAi ? (
          <div className={PANEL}>
            <div className={PANEL_TITLE}>Bronson AI</div>
            <div className="flex flex-1 divide-x divide-[var(--panel-border)]">
              <Cell label="Organic" value={aiOrganic} tone="organic" />
              <Cell label="Paid" value={aiPaid} tone="paid" />
            </div>
            <Footer rows={[["Bronson AI total", addCash(aiOrganic, aiPaid)]]} />
          </div>
        ) : null}

        <div className={`${PANEL} ${SPAN[panels]}`}>
          <div className={PANEL_TITLE}>Combined</div>
          <div className="flex-1">
            <Cell label="Total Cash" value={addCash(organic, paid)} />
          </div>
          <Footer
            rows={[
              [`Organic (${parts})`, organic],
              [`Paid (${parts})`, paid],
              ["Ad spend", adSpend],
            ]}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Cash collected, from the Marketing Daily Metrics form. Paid ROAS = Paid ({parts}) ÷ Ad spend.
      </p>
    </div>
  );
}
