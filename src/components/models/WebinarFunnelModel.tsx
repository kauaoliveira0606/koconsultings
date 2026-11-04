"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { computeWebinarFunnel, type WebinarFunnelInputs } from "@/lib/models/webinar-funnel-model";
import { usePersistedState } from "@/lib/use-persisted-state";

const DEFAULT_INPUTS: WebinarFunnelInputs = {
  adSpend: 7000,
  cpm: 70,
  ctr: 0.02,
  optInRate: 0.25,
  cplOverride: null,
  showRate: 0.25,
  retentionRate: 0.8,
  bookingRate: 0.25,
  callShowRate: 0.8,
  closeRate: 0.25,
  aov: 5000,
  vipEnabled: false,
  vipPrice: 97,
  vipTakeRate: 0.08,
};

/** Same deep gradient the Bronson hero numbers use; readable on any light card. */
const NUMBER_GRADIENT = "linear-gradient(100deg, #0d9488 0%, #0284c7 45%, #4f46e5 100%)";

const usd0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = (n: number) => (Number.isInteger(Math.round(n * 10) / 10) ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("en-US");
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export function WebinarFunnelModel() {
  const [stored, setInputs] = usePersistedState<WebinarFunnelInputs>(
    `webinar-funnel-model-v2:${usePathname()}:inputs`,
    DEFAULT_INPUTS
  );
  // Older or partial stored values fall back to the defaults field by field.
  const inputs = { ...DEFAULT_INPUTS, ...stored };
  const r = computeWebinarFunnel(inputs);
  const set = (patch: Partial<WebinarFunnelInputs>) => setInputs((prev) => ({ ...DEFAULT_INPUTS, ...prev, ...patch }));

  const funnel: { stage: string; count: number; rate: string }[] = [
    { stage: "Registrants", count: r.registrants, rate: `${usd2(r.cpl)} CPL` },
    ...(inputs.vipEnabled ? [{ stage: "VIP Buyers", count: r.vipBuyers, rate: pct(inputs.vipTakeRate) }] : []),
    { stage: "Attendees", count: r.attendees, rate: pct(inputs.showRate) },
    { stage: "Stayed to Pitch", count: r.stayedToPitch, rate: pct(inputs.retentionRate) },
    { stage: "Calls Booked", count: r.callsBooked, rate: pct(inputs.bookingRate) },
    { stage: "Calls Showed", count: r.callsShowed, rate: pct(inputs.callShowRate) },
    { stage: "Buyers", count: r.buyers, rate: pct(inputs.closeRate) },
  ];

  return (
    <div className="text-[var(--text)]" style={{ ["--wf-accent" as string]: "#0369a1" }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-strong)]">Webinar Funnel</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Ad Spend → Ads → Registration → Live Webinar → Pitch → Booked Call → Close. Change any number and everything on the right updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInputs(DEFAULT_INPUTS)}
          className="rounded-md border border-[var(--panel-border)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Inputs */}
        <div className="flex flex-col gap-5">
          <Card title="Ad Spend" tag="Budget">
            <Field label="Monthly Ad Spend ($)" value={inputs.adSpend} onChange={(v) => set({ adSpend: v })} />
          </Card>

          <Card title="Cold Traffic Ads" tag="Paid Acquisition">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="CPM ($)" value={inputs.cpm} onChange={(v) => set({ cpm: v })} />
              <Field label="CTR (%)" value={round(inputs.ctr * 100, 2)} onChange={(v) => set({ ctr: v / 100 })} />
              <Field label="Opt-In Rate (%)" value={round(inputs.optInRate * 100, 2)} onChange={(v) => set({ optInRate: v / 100 })} />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--wf-accent)]/30 bg-[var(--wf-accent)]/[0.06] p-4">
              <Field
                label="Cost Per Lead ($)"
                value={round(r.cpl, 2)}
                onChange={(v) => set({ cplOverride: v })}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span>
                  {inputs.cplOverride === null
                    ? "Auto-calculated from CPM, CTR and Opt-In Rate. Edit to override."
                    : `Manual override. Auto-calculated would be ${usd2(r.calculatedCpl)}.`}
                </span>
                {inputs.cplOverride !== null ? (
                  <button
                    type="button"
                    onClick={() => set({ cplOverride: null })}
                    className="font-semibold text-[var(--wf-accent)] hover:underline"
                  >
                    Use auto CPL
                  </button>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title="Registrants">
            <Field
              label="Estimated Registrants"
              value={Math.round(r.registrants)}
              onChange={(v) => set({ adSpend: round(v * r.cpl, 2) })}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Ad Spend ÷ CPL. Edit to set registrants directly and the ad spend updates to match.
            </p>
          </Card>

          <Card title="Attendance & Engagement">
            <Slider label="Show Rate %" hint="Registrants who show up to the live webinar." value={inputs.showRate} onChange={(v) => set({ showRate: v })} />
            <Slider label="Webinar Retention %" hint="Attendees who stay until the pitch." value={inputs.retentionRate} onChange={(v) => set({ retentionRate: v })} />
          </Card>

          <Card title="Calls & Close">
            <Slider label="Booking Rate %" hint="People who stayed to the pitch and booked a call." value={inputs.bookingRate} onChange={(v) => set({ bookingRate: v })} />
            <Slider label="Call Show Rate %" hint="Booked calls that show up." value={inputs.callShowRate} onChange={(v) => set({ callShowRate: v })} />
            <Slider label="Call Close Rate %" hint="Showed calls that buy." value={inputs.closeRate} onChange={(v) => set({ closeRate: v })} />
          </Card>

          <Card title="Offer">
            <Field label="AOV ($)" value={inputs.aov} onChange={(v) => set({ aov: v })} />
          </Card>

          <Card
            title="VIP Package"
            action={<Toggle on={inputs.vipEnabled} onChange={(on) => set({ vipEnabled: on })} />}
          >
            {inputs.vipEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="VIP Offer Price ($)" value={inputs.vipPrice} onChange={(v) => set({ vipPrice: v })} />
                <Field
                  label="VIP Take Rate (%)"
                  value={round(inputs.vipTakeRate * 100, 2)}
                  onChange={(v) => set({ vipTakeRate: Math.min(v, 100) / 100 })}
                />
                <p className="text-xs text-[var(--text-muted)] sm:col-span-2">
                  Take rate = registrants who buy the VIP package. VIP revenue is added to Expected Revenue and ROAS.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Off. Turn on to add a VIP package to the model.</p>
            )}
          </Card>
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Expected Revenue"
              value={usd0(r.revenue)}
              sub={inputs.vipEnabled ? `${usd0(r.htRevenue)} high ticket + ${usd0(r.vipRevenue)} VIP` : undefined}
              big
            />
            <Stat
              label="Expected Buyers"
              value={count(r.buyers)}
              sub={inputs.vipEnabled ? `+ ${count(r.vipBuyers)} VIP buyers` : undefined}
              big
            />
            <Stat label="Revenue / Attendee" value={usd0(r.revenuePerAttendee)} />
            <Stat label="Revenue / Registrant" value={usd0(r.revenuePerRegistrant)} />
          </div>

          <Card title="Ad Spend Snapshot">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Mini label="CPL" value={usd2(r.cpl)} />
              <Mini label="Ad Spend" value={usd0(r.adSpend)} />
              <Mini label="CPA" value={usd0(r.cpa)} />
              <Mini label="ROAS" value={`${r.roas.toFixed(2)}x`} accent />
              <Mini label="Cost Per Booked Call" value={usd0(r.costPerCall)} />
              <Mini label="Revenue After Ad Spend" value={usd0(r.profit)} />
              {inputs.vipEnabled ? (
                <>
                  <Mini label="VIP Revenue" value={usd0(r.vipRevenue)} />
                  <Mini label="VIP Revenue / Ad Spend" value={`${r.vipRevenueToAdSpend.toFixed(2)}x`} />
                </>
              ) : null}
            </div>
          </Card>

          <Card title="Funnel Snapshot">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-[var(--text-muted)]">
                  <th className="py-2.5 text-left font-medium">Stage</th>
                  <th className="py-2.5 text-right font-medium">Count</th>
                  <th className="py-2.5 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.stage} className="border-b border-[var(--panel-border)] last:border-0">
                    <td className="py-3 font-medium text-[var(--text-strong)]">{f.stage}</td>
                    <td className="py-3 text-right tabular-nums">{count(f.count)}</td>
                    <td className="py-3 text-right tabular-nums">{f.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, tag, action, children }: { title: string; tag?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-[var(--text-strong)]">{title}</h3>
        {tag ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wf-accent)]">{tag}</span>
        ) : null}
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, big = false }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
      <div
        className={`mt-2 font-extrabold leading-tight tracking-tight tabular-nums ${big ? "text-3xl sm:text-4xl" : "text-2xl text-[var(--text-strong)]"}`}
        style={big ? { backgroundImage: NUMBER_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-[var(--text-muted)]">{sub}</div> : null}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
      style={{ color: on ? "var(--wf-accent)" : "var(--text-muted)" }}
    >
      {on ? "On" : "Off"}
      <span
        className="relative inline-block h-6 w-11 rounded-full transition-colors"
        style={{ background: on ? "var(--wf-accent)" : "var(--panel-border)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? "1.375rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

function Mini({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
      <div
        className="mt-1 text-xl font-bold tabular-nums text-[var(--text-strong)]"
        style={accent ? { backgroundImage: NUMBER_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** Number box that keeps what's typed (so "0." or an empty box don't snap back) and reports parsed numbers. */
function NumberBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Draft text only while the box is being edited; otherwise show the live value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      min={0}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n) && n >= 0) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel-subtle)] px-3 py-2.5 tabular-nums text-[var(--text-strong)] outline-none focus:border-[var(--wf-accent)]"
    />
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--text-muted)]">{label}</span>
      <NumberBox value={value} onChange={onChange} />
    </label>
  );
}

/** Slider + number box for a rate stored as a fraction 0-1, shown as a percent. */
function Slider({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  const percent = round(value * 100, 2);
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--text-strong)]" title={hint}>
          {label} <span className="cursor-help text-[var(--text-muted)]">ⓘ</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-[var(--wf-accent)]">{percent.toFixed(1)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={Math.min(percent, 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mb-2 w-full"
        style={{ accentColor: "var(--wf-accent)" }}
      />
      <NumberBox value={percent} onChange={(v) => onChange(Math.min(v, 100) / 100)} />
    </div>
  );
}
