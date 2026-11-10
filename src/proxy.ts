import { NextResponse, type NextRequest } from "next/server";
import { SALES_HOME, SERVICE_TOKEN, ADMIN_COOKIE, roleFromCookies, salesCanSee } from "@/lib/admin-gate";

/**
 * Login gate for the whole dashboard (Bronson, Aval, Agency).
 * Admin sees everything; Sales Team only the Sales tabs + Cash Calendar.
 */

/** Called by n8n without a cookie (payment plan Discord posts); kept open as before. */
const OPEN_APIS = ["/api/bronson/payment-plans/weekly-summary", "/api/bronson/payment-plans/reminders"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (OPEN_APIS.includes(pathname)) return NextResponse.next();
  if (isApi && request.cookies.get(ADMIN_COOKIE)?.value === SERVICE_TOKEN) return NextResponse.next();

  const role = await roleFromCookies((name) => request.cookies.get(name)?.value);
  if (role === "admin") return NextResponse.next();

  if (role === "sales") {
    if (salesCanSee(pathname)) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Not available for the Sales Team" }, { status: 403 });
    return NextResponse.redirect(new URL(SALES_HOME, request.url));
  }

  if (isApi) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/bronson/:path*",
    "/aval/:path*",
    "/agency/:path*",
    "/api/bronson/:path*",
    "/api/aval/:path*",
    "/api/agency/:path*",
  ],
};
