import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SALES_COOKIE, adminToken, isAdminPassword, salesToken } from "@/lib/admin-gate";

const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

/** Logs in as Admin (password required) or Sales Team (no password). */
export async function POST(request: Request) {
  const { role, password } = (await request.json().catch(() => ({}))) as { role?: string; password?: string };
  const res = NextResponse.json({ ok: true, role });

  if (role === "admin") {
    if (!password || !isAdminPassword(password)) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
    res.cookies.set(ADMIN_COOKIE, await adminToken(), COOKIE);
    res.cookies.delete(SALES_COOKIE);
    return res;
  }
  if (role === "sales") {
    res.cookies.set(SALES_COOKIE, await salesToken(), COOKIE);
    res.cookies.delete(ADMIN_COOKIE);
    return res;
  }
  return NextResponse.json({ error: "Pick Admin or Sales Team" }, { status: 400 });
}

/** Log out: clears both role cookies. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete(SALES_COOKIE);
  return res;
}
