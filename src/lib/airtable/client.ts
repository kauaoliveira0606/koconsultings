import { staleWhileRevalidate } from "@/lib/swr-cache";

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
 * So the assembled rows are cached, keyed by table and query, and served
 * stale-while-revalidate (see lib/swr-cache.ts): only a table never read
 * before, or one older than its max staleness, makes a request wait for
 * Airtable.
 */
const CACHE_VERSION = "v2";

function cacheKey(scope: string, baseId: string, tableId: string, params: ListParams): string {
  return `airtable:${CACHE_VERSION}:${scope}:${baseId}:${tableId}:${JSON.stringify(params)}`;
}

/**
 * Airtable allows 5 requests a second per base, and a table read is a run of
 * sequential page requests, so at most 3 reads per base go at once in this
 * instance; the rest queue (and the retry backoff covers other instances).
 */
const WALKS_PER_BASE = 3;
const basePools = new Map<string, { active: number; queue: (() => void)[] }>();

async function limitPerBase<T>(baseId: string, run: () => Promise<T>): Promise<T> {
  let pool = basePools.get(baseId);
  if (!pool) basePools.set(baseId, (pool = { active: 0, queue: [] }));
  if (pool.active >= WALKS_PER_BASE) await new Promise<void>((go) => pool.queue.push(go));
  else pool.active++;
  try {
    return await run();
  } finally {
    const next = pool.queue.shift();
    if (next) next();
    else pool.active--;
  }
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
    () => limitPerBase(baseId, () => walkAllPagesWithRetry(baseId, tableId, params, 0)),
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
    () => limitPerBase(baseId, () => walkAllPagesWithRetry(baseId, tableId, params, 0)),
    PARTITION_TTL_SECONDS / 2,
    PARTITION_TTL_SECONDS
  );
}
function cachedRecent(baseId: string, tableId: string, params: ListParams) {
  return staleWhileRevalidate(
    cacheKey("recent", baseId, tableId, params),
    () => limitPerBase(baseId, () => walkAllPagesWithRetry(baseId, tableId, params, 0)),
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
  tableId: string,
  /** Only these columns (smaller cache entries, faster reads); all when left out. */
  fields?: string[]
): Promise<AirtableRecord<TFields>[]> {
  const pick = fields ? { fields } : {};
  const formulas = creationPartitions(new Date());
  const merged = new Map<string, AirtableRecord<unknown>>();
  // All at once: cache hits cost Airtable nothing, and reads that do go to
  // Airtable are throttled per base in limitPerBase.
  const [partitions, recent] = await Promise.all([
    Promise.all(
      formulas.map((filterByFormula) =>
        cachedPartition(baseId, tableId, { filterByFormula, ...pick })
      )
    ),
    cachedRecent(baseId, tableId, {
      filterByFormula: `OR(DATETIME_DIFF(NOW(),CREATED_TIME(),'hours')<${RECENT_HOURS},DATETIME_DIFF(NOW(),LAST_MODIFIED_TIME(),'hours')<${RECENT_HOURS})`,
      ...pick,
    }),
  ]);
  for (const records of partitions) for (const r of records) merged.set(r.id, r);
  for (const r of recent) merged.set(r.id, r);
  return [...merged.values()] as AirtableRecord<TFields>[];
}
