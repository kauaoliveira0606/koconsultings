import { airtableListAll } from "@/lib/airtable/client";
import { BRONSON_BASE_ID, getPostCallNotes } from "@/lib/airtable/tables";
import { isDateInRange, type ResolvedRange } from "@/lib/date-range";

/**
 * "Know which ad made which sale" (user, 2026-11-10). Cortana has no per-sale
 * list, so n8n pulls purchases per ad per hour (Ads Hourly, Level = ad); each
 * sale is then matched to the Post Call Note logged that day for the same
 * amount, which gives the customer and closer. Purchases with no note (VIP,
 * AI subscription, deposits paid online) stay unmatched and say so.
 */
const HOURLY = "tblDzlpmtwjR3v9kL";

export type AdSale = {
  hour: string; // Eastern "YYYY-MM-DDTHH:00", first hour Cortana shows the sale
  lastHour: string; // Cortana repeats one sale across consecutive hours; this is the last one
  ad: string;
  adId: string;
  amount: number;
  highTicket: boolean;
  customer: string | null;
  closer: string | null;
  offer: string | null;
  matched: boolean;
};

const CLOSED = /clos|deposit|payment plan|paid|pif/i;

export async function getSalesByAd(range: ResolvedRange): Promise<AdSale[]> {
  const [recs, notes] = await Promise.all([airtableListAll<Record<string, unknown>>(BRONSON_BASE_ID, HOURLY), getPostCallNotes()]);
  // Cortana repeats one purchase in every hourly window across a stretch of hours
  // (seen 2026-11-10: one $1,000 sale in 24 straight hours). Collapse each run of
  // consecutive hours for the same ad and amount into a single sale.
  type Row = { hour: string; ad: string; adId: string; n: number; amount: number; ht: boolean };
  const rows: Row[] = [];
  for (const { fields: f } of recs) {
    if (f.Level !== "ad") continue;
    const hour = String(f.Hour ?? "");
    if (!isDateInRange(hour.slice(0, 10), range)) continue;
    const n = Number(f.Sales ?? 0) || Number(f["HT Sales"] ?? 0);
    if (!n) continue;
    const total0 = Number(f["HT Revenue"] ?? 0) || Number(f.Revenue ?? 0);
    if (total0 <= 0) continue; // $0 "payments" aren't sales
    const total = Number(f["HT Revenue"] ?? 0) || Number(f.Revenue ?? 0);
    rows.push({ hour, ad: String(f.Campaign ?? ""), adId: String(f["Entity ID"] ?? ""), n, amount: Math.round((total / n) * 100) / 100, ht: Number(f["HT Sales"] ?? 0) > 0 });
  }
  rows.sort((a, b) => a.adId.localeCompare(b.adId) || a.amount - b.amount || a.hour.localeCompare(b.hour));
  const hourMs = (h: string) => Date.parse(`${h}:00Z`);
  const sales: AdSale[] = [];
  let prev: Row | null = null;
  let run: AdSale[] = [];
  for (const r of rows) {
    const continues = prev && prev.adId === r.adId && prev.amount === r.amount && prev.n === r.n && hourMs(r.hour) - hourMs(prev.hour) <= 3600_000;
    if (continues) {
      for (const s of run) s.lastHour = r.hour;
    } else {
      run = Array.from({ length: r.n }, () => ({ hour: r.hour, lastHour: r.hour, ad: r.ad, adId: r.adId, amount: r.amount, highTicket: r.ht, customer: null, closer: null, offer: null, matched: false }));
      sales.push(...run);
    }
    prev = r;
  }
  // Match each sale to a closed Post Call Note on the same day for the same cash (each note used once).
  const pool = notes.filter((p) => p.date && (p.cashCollected ?? 0) > 0 && CLOSED.test(p.callOutcome ?? ""));
  const used = new Set<string>();
  for (const s of sales.sort((a, b) => a.hour.localeCompare(b.hour))) {
    const from = s.hour.slice(0, 10);
    const to = s.lastHour.slice(0, 10);
    const hit = pool.find((p) => !used.has(p.id) && p.date! >= from && p.date! <= to && Math.abs((p.cashCollected ?? 0) - s.amount) < 1);
    if (hit) {
      used.add(hit.id);
      Object.assign(s, { customer: hit.leadName, closer: hit.repName, offer: hit.offerPitched, matched: true });
    }
  }
  return sales.sort((a, b) => b.hour.localeCompare(a.hour));
}
