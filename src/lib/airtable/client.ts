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

function getCredentials() {
  const pat = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!pat || !baseId) {
    throw new AirtableError(
      "Missing AIRTABLE_PAT or AIRTABLE_BASE_ID environment variables",
      500
    );
  }
  return { pat, baseId };
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
 * Fetches every record from an Airtable table, following the `offset`
 * pagination cursor until exhausted. Always runs server-side.
 */
export async function airtableListAll<TFields = Record<string, unknown>>(
  tableId: string,
  params: ListParams = {},
  revalidateSeconds = 60
): Promise<AirtableRecord<TFields>[]> {
  const { pat, baseId } = getCredentials();
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    const qs = buildQueryString(params, offset);
    const url = `${AIRTABLE_API_BASE}/${baseId}/${tableId}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      next: { revalidate: revalidateSeconds },
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
