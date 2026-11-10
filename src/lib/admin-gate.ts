/**
 * Login roles for the dashboard (user, 2026-11-10).
 *
 * - Admin: password 0000, sees everything.
 * - Sales Team: no password, sees only the Sales tabs + Cash Calendar.
 *
 * src/proxy.ts checks these cookies on every dashboard page and API.
 */

export type Role = "admin" | "sales";

export const ADMIN_COOKIE = "koc_admin";
export const SALES_COOKIE = "koc_sales";

const ADMIN_PASSWORD = "0000";

/**
 * Server-to-server key: the old 0606 admin cookie value, still sent by n8n
 * (Daily EOD Totals, Missed EOD check, Team Roster sync). Accepted on /api/* only,
 * never on pages, so it can't be used to browse the dashboard.
 */
export const SERVICE_TOKEN = "c0e95bc99a72fea17c7c90ffa9c3b8f392d5d9ffb27f9f0fd2b7b669727c1c7a";

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie value for a logged-in admin: a hash, so the password isn't stored as-is. */
export function adminToken(): Promise<string> {
  return sha256(`koconsultings-admin:${ADMIN_PASSWORD}`);
}

export function salesToken(): Promise<string> {
  return sha256("koconsultings-sales:v1");
}

export function isAdminPassword(input: string): boolean {
  return input.trim() === ADMIN_PASSWORD;
}

/** Which role a request's cookies carry (admin wins if both are set). */
export async function roleFromCookies(get: (name: string) => string | undefined): Promise<Role | null> {
  if (get(ADMIN_COOKIE) === (await adminToken())) return "admin";
  if (get(SALES_COOKIE) === (await salesToken())) return "sales";
  return null;
}

/** Bronson pages the Sales Team can open. Everything else is admin only. */
export const SALES_PAGES = [
  "/bronson/sales-team",
  "/bronson/live-calls",
  "/bronson/payment-plans",
  "/bronson/upsell-potential",
  "/bronson/models",
  "/bronson/knowledge-base",
  "/bronson/cash-calendar",
];

/** APIs behind those pages. */
const SALES_APIS = [
  "/api/bronson/sales-team",
  "/api/bronson/live-calls",
  "/api/bronson/payment-plans",
  "/api/bronson/upsell-potential",
  "/api/bronson/overview/cash-calendar",
  "/api/bronson/goals",
];

export const SALES_HOME = "/bronson/sales-team";

function under(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function salesCanSee(pathname: string): boolean {
  return under(pathname, SALES_PAGES) || under(pathname, SALES_APIS);
}
