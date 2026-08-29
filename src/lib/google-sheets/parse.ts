/**
 * Google Sheets' default FORMATTED_VALUE render option returns cell text as
 * displayed in the sheet (e.g. "8/29/2026"), not ISO — these parsers convert
 * that into the "YYYY-MM-DD" strings the rest of the dashboard expects.
 */
export function parseUsDateToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Extracts the first numeric token from a cell, so values like "50/mo",
 * "$3,000", or "192/yr" resolve to a plain number. Returns null (never 0 or
 * NaN) for blank/non-numeric input so callers can distinguish "no data" from
 * "zero".
 */
export function parseNumericText(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return null;
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number.parseFloat(match[0]);
  return Number.isFinite(value) ? value : null;
}
