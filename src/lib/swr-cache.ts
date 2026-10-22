import { getCache, waitUntil } from "@vercel/functions";

/**
 * Stale-while-revalidate, done by hand, in Vercel's Runtime Cache (shared by
 * every route and kept across deploys) plus this instance's memory.
 *
 * Next's `unstable_cache` did NOT serve stale data in our route handlers:
 * whoever opened the dashboard after the window waited 3-6s per section
 * while Airtable was re-read (measured 2026-10-22). Here a copy older than
 * `freshSeconds` is still answered with right away and re-read after the
 * response (`waitUntil`); the dashboard re-fetches every section a few
 * seconds after it loads (refetchOnceSoon in lib/range-context.tsx) to pick
 * up the new copy. Only a key never seen before, or one older than
 * `maxStaleSeconds`, makes the request wait.
 */
type CacheEntry<T> = { at: number; value: T };

const memory = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

async function readEntry<T>(key: string, freshSeconds: number): Promise<CacheEntry<T> | null> {
  const local = memory.get(key) as CacheEntry<T> | undefined;
  // A fresh copy in this instance's memory skips the download from the shared cache.
  if (local && Date.now() - local.at < freshSeconds * 1000) return local;
  let shared: CacheEntry<T> | null = null;
  try {
    const raw = (await getCache().get(key)) as CacheEntry<T> | null;
    // Entries written in an older shape (another deploy) count as missing.
    if (raw && typeof raw.at === "number" && "value" in raw) shared = raw;
  } catch {
    // Runtime Cache unavailable: fall back to this instance's memory.
  }
  if (shared && (!local || shared.at > local.at)) {
    memory.set(key, shared);
    return shared;
  }
  return local ?? null;
}

function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const job = (async () => {
    const value = await load();
    const entry: CacheEntry<T> = { at: Date.now(), value };
    memory.set(key, entry);
    try {
      await getCache().set(key, entry, { ttl: 7 * 24 * 60 * 60, name: "" });
    } catch {
      // Too big or cache unavailable: the in-memory copy still serves this instance.
    }
    return value;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

export async function staleWhileRevalidate<T>(
  key: string,
  load: () => Promise<T>,
  freshSeconds: number,
  maxStaleSeconds: number
): Promise<T> {
  const t0 = Date.now();
  const hadLocal = memory.has(key);
  const entry = await readEntry<T>(key, freshSeconds);
  console.log(`[swr-timing] ${key.slice(0, 60)} read=${Date.now() - t0}ms local=${hadLocal} hit=${!!entry}`);
  const age = entry ? (Date.now() - entry.at) / 1000 : Infinity;
  if (!entry || age > maxStaleSeconds) return refresh(key, load);
  if (age > freshSeconds) {
    waitUntil(refresh(key, load).catch(() => undefined));
  }
  return entry.value;
}
