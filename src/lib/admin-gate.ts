/**
 * Password gate for the Admin Team tab (commissions, payouts, data check).
 * The proxy checks this cookie on the Admin Team pages and their APIs.
 */

export const ADMIN_COOKIE = "koc_admin";

const PASSWORD = "0606";

/** Cookie value for an unlocked browser: a hash, so the password isn't stored as-is. */
export async function adminToken(): Promise<string> {
  const bytes = new TextEncoder().encode(`koconsultings-admin:${PASSWORD}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isAdminPassword(input: string): boolean {
  return input.trim() === PASSWORD;
}
