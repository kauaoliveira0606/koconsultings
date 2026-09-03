import { BUSINESS_TIME_ZONE } from "./date-range";

export type StatFormat = "currency" | "percent" | "number" | "ratio";

const EM_DASH = "—";

export { BUSINESS_TIME_ZONE };

export function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return EM_DASH;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return (
    date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: BUSINESS_TIME_ZONE,
    }) + " ET"
  );
}

export function formatStatValue(
  value: number | null | undefined,
  format: StatFormat = "number"
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }

  switch (format) {
    case "currency":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      return `${value.toFixed(2)}x`;
    case "number":
    default:
      return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
}
