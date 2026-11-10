import { redirect } from "next/navigation";

/** Old password page: the proxy now handles login, so just go where the link pointed. */
export default async function AdminUnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/bronson/admin-team");
}
