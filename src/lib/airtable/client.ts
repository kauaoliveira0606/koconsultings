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

/**
 * Fetches every record from an Airtable table, following the `offset`
 * pagination cursor until exhausted. Always runs server-side. Retries the
 * whole walk once on a transient Airtable error (expired iterator, rate
 * limit, 5xx) so one hiccup doesn't blank a section.
 */
export async function airtableListAll<TFields = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  params: ListParams = {},
  revalidateSeconds = 60
): Promise<AirtableRecord<TFields>[]> {
  try {
    return await walkAllPages<TFields>(baseId, tableId, params, revalidateSeconds);
  } catch (err) {
    if (err instanceof AirtableError && RETRYABLE_STATUSES.has(err.status)) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return walkAllPages<TFields>(baseId, tableId, params, revalidateSeconds);
    }
    throw err;
  }
}
