import { unstable_cache } from "next/cache";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export class AirtableError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AirtableError";
    this.status = status;
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
 * Every dashboard tab fires several API routes in parallel (metrics,
 * lead-sources, cash-calendar, ...), and most of them need the same
 * underlying table (Leads, Marketing Daily Metrics, ...) — without sharing
 * a cache, each route independently re-walks the whole table (many
 * sequential paginated requests for a 1000+ row table), and enough of those
 * walks running at once can blow past Airtable's 5 req/sec-per-base rate
 * limit, which triggers the retry above to redo the *entire* walk. Caching
 * the assembled result here (not the raw fetch, which would replay expired
 * offset tokens — see walkAllPages above) means only the first route to ask
 * for a given table in this window actually talks to Airtable; everyone
 * else gets it from Next's shared Data Cache.
 *
 * 60 seconds: it's not just new records — the team goes back and corrects
 * historical rows too (a setter's data logged wrong on an earlier day, then
 * fixed later), and that correction needs to actually show up without
 * anyone having to know a cache exists. This cache doesn't distinguish new
 * vs. edited rows either way — a fresh table walk always reflects
 * whatever's in Airtable *right now*, edits included — so the only thing
 * this window controls is how long a correction can take to appear. Next
 * serves the stale cached value immediately and revalidates in the
 * background once a cached entry goes stale, so this doesn't cost
 * correctness, only recency — 60s keeps that recency tight while still
 * giving the parallel-request burst on every page load a real window to
 * share one Airtable walk instead of each route re-fetching independently.
 */
const cachedWalkAllPages = unstable_cache(walkAllPagesWithRetry, ["airtable-list-all"], {
  revalidate: 60,
});

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
  const records = await cachedWalkAllPages(baseId, tableId, params, revalidateSeconds);
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

const cachedPartition = unstable_cache(walkAllPagesWithRetry, ["airtable-partition"], {
  revalidate: PARTITION_TTL_SECONDS,
});
const cachedRecent = unstable_cache(walkAllPagesWithRetry, ["airtable-recent"], {
  revalidate: 60,
});

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
        .map((filterByFormula) => cachedPartition(baseId, tableId, { filterByFormula }, 60))
    );
    for (const records of batch) for (const r of records) merged.set(r.id, r);
  }
  const recent = await cachedRecent(
    baseId,
    tableId,
    {
      filterByFormula: `OR(DATETIME_DIFF(NOW(),CREATED_TIME(),'hours')<${RECENT_HOURS},DATETIME_DIFF(NOW(),LAST_MODIFIED_TIME(),'hours')<${RECENT_HOURS})`,
    },
    60
  );
  for (const r of recent) merged.set(r.id, r);
  return [...merged.values()] as AirtableRecord<TFields>[];
}
