import { getCache, waitUntil } from "@vercel/functions";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export class AirtableError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AirtableError";
    this.status = status;
  }
}

/**
 * Andy was offboarded and the token lost access to his base (403 since
 * 2026-10-12). Pages that add his numbers to the other offers load them
 * through this so they keep working with his rows left out.
 */
export async function emptyIfNoAccess<T>(rows: Promise<T[]>): Promise<T[]> {
  try {
    return await rows;
  } catch (error) {
    if (error instanceof AirtableError && error.status === 403) return [];
    throw error;
  }
}

export type AirtableRecord<TFields = Record<string, unknown>> = {
  id: string;
  createdTime: string;
  fields: TFields;
};

type ListParams = {
  filterByFormula?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  fields?: string[];
  view?: string;
  pageSize?: number;
};

function getPat() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    throw new AirtableError("Missing AIRTABLE_PAT environment variable", 500);
  }
  return pat;
}

function buildQueryString(params: ListParams, offset?: string): string {
  const query = new URLSearchParams();
  if (params.filterByFormula) query.set("filterByFormula", params.filterByFormula);
  if (params.view) query.set("view", params.view);
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.fields) {
    for (const field of params.fields) query.append("fields[]", field);
  }
  if (params.sort) {
    params.sort.forEach((s, i) => {
      query.set(`sort[${i}][field]`, s.field);
      query.set(`sort[${i}][direction]`, s.direction ?? "asc");
    });
  }
  if (offset) query.set("offset", offset);
  return query.toString();
}

/**
 * Airtable's `offset` pagination tokens are short-lived server-side
 * iterators (they expire after a few minutes). Next's fetch cache would
 * happily replay a `?offset=...` page from a previous request, so a cached
 * first page could hand us a token that Airtable has already discarded by
 * the time we ask for the next page — Airtable then answers 422
 * (LIST_RECORDS_ITERATOR_NOT_AVAILABLE) and the whole route 500s, leaving
 * that dashboard section blank. To avoid it, only the first page (no
 * offset in the URL) is cached; every follow-up page is fetched
 * `no-store` so a single coherent iterator walk always runs fresh.
 */
const RETRYABLE_STATUSES = new Set([422, 429, 500, 502, 503, 504]);

async function walkAllPages<TFields>(
  baseId: string,
  tableId: string,
  params: ListParams,
  revalidateSeconds: number
): Promise<AirtableRecord<TFields>[]> {
  const pat = getPat();
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    const qs = buildQueryString(params, offset);
    const url = `${AIRTABLE_API_BASE}/${baseId}/${tableId}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      ...(offset
        ? { cache: "no-store" as const }
        : { next: { revalidate: revalidateSeconds } }),
    });

    if (!res.ok) {
      throw new AirtableError(
        `Airtable request failed for table ${tableId} (${res.status})`,
        res.status
      );
    }

    const body = (await res.json()) as {
      records: AirtableRecord<TFields>[];
      offset?: string;
    };
    records.push(...body.records);
    offset = body.offset;
  } while (offset);

  return records;
}

// A single 300ms retry survives one transient blip, but a cold cache means
// every dashboard tab's ~7 parallel routes independently miss at once, all
// walking overlapping tables at the same instant — that thundering herd can
// blow past Airtable's 5 req/sec limit repeatedly, not just once. Backing
// off across a few attempts gives the rate-limit window time to actually
// clear instead of retrying once into the same collision.
const RETRY_DELAYS_MS = [300, 800, 1800];

async function walkAllPagesWithRetry(
  baseId: string,
  tableId: string,
  params: ListParams,
  revalidateSeconds: number
): Promise<AirtableRecord<unknown>[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await walkAllPages(baseId, tableId, params, revalidateSeconds);
    } catch (err) {
      const canRetry =
        err instanceof AirtableError &&
        RETRYABLE_STATUSES.has(err.status) &&
        attempt < RETRY_DELAYS_MS.length;
      if (!canRetry) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Every dashboard tab fires several API routes in parallel, most needing the
 * same tables, and reading a table means many sequential 100-row requests.
 * So the assembled rows are cached (in Vercel's Runtime Cache, shared by all
 * routes and kept across deploys), keyed by table and query.
 *
 * Stale-while-revalidate, done by hand: Next's `unstable_cache` did NOT
 * serve stale data in these route handlers, so whoever opened the dashboard
 * after the 60s window waited 3-6s per section for Airtable (measured
 * 2026-10-22). Here a cached copy older than `freshSeconds` is still
 * answered with right away, and a re-read runs after the response (`waitUntil`).
 * The client re-fetches each section shortly after it first loads (see
 * useSectionData), so a stale answer is replaced within seconds. Only a key
 * never seen before, or one older than `maxStaleSeconds`, makes the request
 * wait for Airtable.
 */
const CACHE_VERSION = "v1";
type CacheEntry = { at: number; records: AirtableRecord<unknown>[] };

const memory = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AirtableRecord<unknown>[]>>();

function cacheKey(scope: string, baseId: string, tableId: string, params: ListParams): string {
  return `airtable:${CACHE_VERSION}:${scope}:${baseId}:${tableId}:${JSON.stringify(params)}`;
}

async function readEntry(key: string, freshSeconds: number): Promise<CacheEntry | null> {
  const local = memory.get(key);
  // A fresh copy in this instance's memory skips the download from the shared cache.
  if (local && Date.now() - local.at < freshSeconds * 1000) return local;
  let shared: CacheEntry | null = null;
  try {
    shared = (await getCache().get(key)) as CacheEntry | null;
  } catch {
    // Runtime Cache unavailable: fall back to this instance's memory.
  }
  if (shared && (!local || shared.at > local.at)) {
    memory.set(key, shared);
    return shared;
  }
  return local ?? null;
}

function refresh(
  key: string,
  load: () => Promise<AirtableRecord<unknown>[]>
): Promise<AirtableRecord<unknown>[]> {
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    const records = await load();
    const entry: CacheEntry = { at: Date.now(), records };
    memory.set(key, entry);
    try {
      await getCache().set(key, entry, { ttl: 7 * 24 * 60 * 60, name: "" });
    } catch {
      // Too big or cache unavailable: the in-memory copy still serves this instance.
    }
    return records;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function staleWhileRevalidate(
  key: string,
  load: () => Promise<AirtableRecord<unknown>[]>,
  freshSeconds: number,
  maxStaleSeconds: number
): Promise<AirtableRecord<unknown>[]> {
  const entry = await readEntry(key, freshSeconds);
  const age = entry ? (Date.now() - entry.at) / 1000 : Infinity;
  if (!entry || age > maxStaleSeconds) return refresh(key, load);
  if (age > freshSeconds) {
    waitUntil(refresh(key, load).catch(() => undefined));
  }
  return entry.records;
}

const FRESH_SECONDS = 60;
/** Even a week-old copy is shown first: the client re-fetches it seconds later. */
const MAX_STALE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Fetches every record from an Airtable table, following the `offset`
 * pagination cursor until exhausted. Always runs server-side.
 */
export async function airtableListAll<TFields = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  params: ListParams = {},
  revalidateSeconds = 60
): Promise<AirtableRecord<TFields>[]> {
  const records = await staleWhileRevalidate(
    cacheKey("all", baseId, tableId, params),
    () => walkAllPagesWithRetry(baseId, tableId, params, 0),
    Math.max(revalidateSeconds, FRESH_SECONDS),
    MAX_STALE_SECONDS
  );
  return records as AirtableRecord<TFields>[];
}

/**
 * Same as airtableListAll but never cached: for checks that must see rows
 * filed minutes ago (the 9 AM missing EOD / Post Call Note check).
 */
export async function airtableListFresh<TFields = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  params: ListParams = {}
): Promise<AirtableRecord<TFields>[]> {
  const records = await walkAllPagesWithRetry(baseId, tableId, params, 0);
  return records as AirtableRecord<TFields>[];
}

/**
 * How long a partition of a big table is kept before it is read again, and
 * how far back the "recently changed" read looks. The second MUST be longer
 * than the first, so any row changed since a partition was last read is
 * always picked up by the recent read.
 */
const PARTITION_TTL_SECONDS = 12 * 60 * 60;
const RECENT_HOURS = 13;
/** Half-months read on their own; everything older than this many months is one partition. */
const PARTITION_MONTHS = 4;

/**
 * A partition is re-read in the background once it is 6h old, and never
 * served past PARTITION_TTL_SECONDS, so the RECENT_HOURS read always covers
 * every change made since the partition was read.
 */
function cachedPartition(baseId: string, tableId: string, params: ListParams) {
  return staleWhileRevalidate(
    cacheKey("partition", baseId, tableId, params),
    () => walkAllPagesWithRetry(baseId, tableId, params, 0),
    PARTITION_TTL_SECONDS / 2,
    PARTITION_TTL_SECONDS
  );
}
function cachedRecent(baseId: string, tableId: string, params: ListParams) {
  return staleWhileRevalidate(
    cacheKey("recent", baseId, tableId, params),
    () => walkAllPagesWithRetry(baseId, tableId, params, 0),
    FRESH_SECONDS,
    MAX_STALE_SECONDS
  );
}

/** Formulas that split a table by when each row was created, with no row in two of them. */
function creationPartitions(now: Date): string[] {
  const months: string[] = [];
  for (let i = PARTITION_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const month = (m: string) => `DATETIME_FORMAT(CREATED_TIME(),'YYYY-MM')='${m}'`;
  return [
    `IS_BEFORE(CREATED_TIME(),'${months[0]}-01')`,
    ...months.flatMap((m) => [
      `AND(${month(m)},DAY(CREATED_TIME())<=15)`,
      `AND(${month(m)},DAY(CREATED_TIME())>15)`,
    ]),
  ];
}

/**
 * `airtableListAll` for big, append-mostly tables (Leads, Speed to Lead).
 *
 * Reading one of those start to finish takes many seconds (Airtable hands
 * out 100 rows per request, one request at a time), and the 60 second cache
 * above made some visitor pay for that every minute. It was also one cache
 * entry per table, which stops being stored at all once it passes 2MB.
 *
 * Here the table is split by creation date into half-month partitions, each
 * its own cache entry kept for 12 hours, and what makes the result current
 * is a small extra read, refreshed every minute, of just the rows created or
 * edited in the last 13 hours. Those are laid over the partitions by record
 * ID. New rows and edits therefore still show within a minute; a DELETED row
 * can linger until its partition is next read (up to 12 hours).
 */
export async function airtableListAllIncremental<TFields = Record<string, unknown>>(
  baseId: string,
  tableId: string
): Promise<AirtableRecord<TFields>[]> {
  const formulas = creationPartitions(new Date());
  const merged = new Map<string, AirtableRecord<unknown>>();
  // A few at a time: Airtable allows 5 requests a second per base.
  for (let i = 0; i < formulas.length; i += 3) {
    const batch = await Promise.all(
      formulas
        .slice(i, i + 3)
        .map((filterByFormula) => cachedPartition(baseId, tableId, { filterByFormula }))
    );
    for (const records of batch) for (const r of records) merged.set(r.id, r);
  }
  const recent = await cachedRecent(
    baseId,
    tableId,
    {
      filterByFormula: `OR(DATETIME_DIFF(NOW(),CREATED_TIME(),'hours')<${RECENT_HOURS},DATETIME_DIFF(NOW(),LAST_MODIFIED_TIME(),'hours')<${RECENT_HOURS})`,
    }
  );
  for (const r of recent) merged.set(r.id, r);
  return [...merged.values()] as AirtableRecord<TFields>[];
}
