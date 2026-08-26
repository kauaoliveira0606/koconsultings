/**
 * Many Airtable fields that are semantically numeric/currency/percent are
 * stored as `singleLineText` in this base. These parsers strip formatting
 * and return `null` (never `0` or `NaN`) for blank/non-numeric input, so
 * callers can distinguish "no data" from "zero" and render an em-dash.
 */
export function parseNumericText(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return null;

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Percent fields from Airtable's native `percent` type arrive as a 0–1 fraction. */
export function parsePercentFraction(raw: unknown): number | null {
  const value = parseNumericText(raw);
  return value;
}

/**
 * Parses a duration into total minutes. Handles a plain number of minutes,
 * "42.9m" style text, and "1h 23m" style text — the exact format used by
 * EOD Dialer's "Total Talk Time" field varies, so this is deliberately
 * tolerant rather than assuming one shape.
 */
export function parseDurationMinutes(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const hoursMatch = trimmed.match(/([\d.]+)\s*h/i);
  const minutesMatch = trimmed.match(/([\d.]+)\s*m/i);

  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch ? Number.parseFloat(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? Number.parseFloat(minutesMatch[1]) : 0;
    const total = hours * 60 + minutes;
    return Number.isFinite(total) ? total : null;
  }

  return parseNumericText(trimmed);
}

export function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.slice(0, 10);
}
