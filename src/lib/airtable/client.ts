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

async function walkAllPagesWithRetry(
  baseId: string,
  tableId: string,
  params: ListParams,
  revalidateSeconds: number
): Promise<AirtableRecord<unknown>[]> {
  try {
    return await walkAllPages(baseId, tableId, params, revalidateSeconds);
  } catch (err) {
    if (err instanceof AirtableError && RETRYABLE_STATUSES.has(err.status)) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return walkAllPages(baseId, tableId, params, revalidateSeconds);
    }
    throw err;
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
 * for a given table in a 30s window actually talks to Airtable; everyone
 * else gets it from Next's shared Data Cache.
 */
const cachedWalkAllPages = unstable_cache(walkAllPagesWithRetry, ["airtable-list-all"], {
  revalidate: 30,
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
