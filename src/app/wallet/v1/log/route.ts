export const dynamic = "force-dynamic";

/** iOS posts pass errors here. Logged to the Vercel function logs. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { logs?: string[] };
  for (const line of body.logs ?? []) console.warn("[wallet log]", line);
  return new Response(null, { status: 200 });
}
