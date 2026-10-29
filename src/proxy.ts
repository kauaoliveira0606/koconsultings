import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/admin-gate";

/** Keeps the Admin Team and Scorecard tabs, their data and the reactivation controls behind the admin password. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.endsWith("/admin-team/unlock")) return NextResponse.next();

  if (request.cookies.get(ADMIN_COOKIE)?.value === (await adminToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Admin password required" }, { status: 401 });
  }
  const offer = pathname.split("/")[1];
  const url = new URL(`/${offer}/admin-team/unlock`, request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/aval/admin-team/:path*",
    "/bronson/admin-team/:path*",
    "/api/aval/admin-team/:path*",
    "/api/bronson/admin-team/:path*",
    "/api/aval/commissions/:path*",
    "/api/bronson/commissions/:path*",
    "/aval/scorecard/:path*",
    "/bronson/scorecard/:path*",
    "/api/aval/overview/weekly-scorecard/:path*",
    "/api/bronson/overview/weekly-scorecard/:path*",
    "/api/aval/overview/pacing/:path*",
    "/api/bronson/overview/pacing/:path*",
    "/api/aval/overview/recent-changes/:path*",
    "/api/bronson/overview/recent-changes/:path*",
    "/api/aval/overview/reactivation/controls/:path*",
    "/api/bronson/overview/reactivation/controls/:path*",
    "/api/bronson/show-rate/controls/:path*",
    "/api/bronson/no-shows/controls/:path*",
    "/api/aval/show-rate/controls/:path*",
    "/api/aval/no-shows/controls/:path*",
  ],
};
