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

async function readShared<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = (await getCache().get(key)) as CacheEntry<T> | null;
    // Entries written in an older shape (another deploy) count as missing.
    if (raw && typeof raw.at === "number" && "value" in raw) return raw;
  } catch {
    // Runtime Cache unavailable: this instance's memory is all there is.
  }
  return null;
}

/** Runs one update of a key at a time per instance; others wait on the same one. */
function update<T>(key: string, next: () => Promise<CacheEntry<T>>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const job = next()
    .then((entry) => {
      memory.set(key, entry);
      return entry.value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** Reads the source and stores the result in memory and the shared cache. */
async function load<T>(key: string, read: () => Promise<T>): Promise<CacheEntry<T>> {
  const entry: CacheEntry<T> = { at: Date.now(), value: await read() };
  try {
    await getCache().set(key, entry, { ttl: 7 * 24 * 60 * 60, name: "" });
  } catch {
    // Too big or cache unavailable: the in-memory copy still serves this instance.
  }
  return entry;
}

/**
 * Brings a stale key up to date: takes the shared copy (keeping its age) if
 * another instance already refreshed it, otherwise re-reads the source.
 */
async function catchUp<T>(key: string, read: () => Promise<T>, freshSeconds: number): Promise<CacheEntry<T>> {
  const shared = await readShared<T>(key);
  if (shared && Date.now() - shared.at < freshSeconds * 1000) return shared;
  return load(key, read);
}

export async function staleWhileRevalidate<T>(
  key: string,
  read: () => Promise<T>,
  freshSeconds: number,
  maxStaleSeconds: number
): Promise<T> {
  // This instance's own copy is answered with without waiting on the shared
  // cache (a download there took ~1.2s for a big table).
  let entry = memory.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    const shared = await readShared<T>(key);
    if (shared) memory.set(key, shared);
    entry = shared ?? undefined;
  }
  const age = entry ? (Date.now() - entry.at) / 1000 : Infinity;
  if (!entry || age > maxStaleSeconds) return update(key, () => load(key, read));
  if (age > freshSeconds) {
    waitUntil(update(key, () => catchUp(key, read, freshSeconds)).catch(() => undefined));
  }
  return entry.value;
}
