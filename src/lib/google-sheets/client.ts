import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleSheetsError";
    this.status = status;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getCredentials(): { clientEmail: string; privateKey: string } {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new GoogleSheetsError(
      "Missing GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY environment variables",
      500
    );
  }
  return { clientEmail, privateKey };
}

// Cached at module scope so warm serverless instances reuse the token
// instead of round-tripping to Google on every request.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const { clientEmail, privateKey } = getCredentials();
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signInput = `${header}.${claim}`;
  const signature = base64url(createSign("RSA-SHA256").update(signInput).sign(privateKey));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new GoogleSheetsError(`Google OAuth token request failed (${res.status}): ${await res.text()}`, res.status);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: body.access_token, expiresAt: now + body.expires_in };
  return cachedToken.accessToken;
}

export type SheetRow = Record<string, string>;

/**
 * Fetches every row of a named tab as header-keyed objects. Google Sheets'
 * default FORMATTED_VALUE render option returns date cells as "M/D/YYYY"
 * text (not ISO) — see parse.ts for the corresponding parser.
 */
export async function sheetsGetRows(
  spreadsheetId: string,
  sheetName: string,
  revalidateSeconds = 60
): Promise<SheetRow[]> {
  const accessToken = await getAccessToken();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?majorDimension=ROWS`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new GoogleSheetsError(
      `Google Sheets request failed for ${spreadsheetId}/${sheetName} (${res.status}): ${await res.text()}`,
      res.status
    );
  }

  const body = (await res.json()) as { values?: string[][] };
  const values = body.values ?? [];
  if (values.length === 0) return [];

  const [headerRow, ...dataRows] = values;
  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
    .map((row) => {
      const record: SheetRow = {};
      headerRow.forEach((header, i) => {
        record[header] = row[i] ?? "";
      });
      return record;
    });
}
