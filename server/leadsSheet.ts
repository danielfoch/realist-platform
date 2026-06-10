// Append-only Google Sheets sink for new contacts and leads.
// Replaces GoHighLevel as the destination for signups, logins, deal analyses,
// partner applications, deal-match requests, and assorted lead forms.
//
// Auth reuses the Replit "google-sheet" connector via getUncachableGoogleSheetClient().
// OWNER-ACCOUNT USE IS INTENTIONAL: this is an ADMIN/internal export — every
// lead row lands in Dan's own leads spreadsheet, not a user's Drive. Do NOT
// migrate this to the per-user OAuth flow (server/userGoogleSheets.ts); that
// flow is for USER-facing exports only.
// Target spreadsheet defaults to the owner's sheet:
//   https://docs.google.com/spreadsheets/d/1r6LSoP5L5Sp1N0MDyTdw53ES_dxt4DxBk6ASHYTUgt4/edit
// Override with the LEADS_SHEET_ID env var if needed.

import { getUncachableGoogleSheetClient } from "./googleSheets";

const DEFAULT_SHEET_ID = "1r6LSoP5L5Sp1N0MDyTdw53ES_dxt4DxBk6ASHYTUgt4";

function getSheetId(): string {
  return process.env.LEADS_SHEET_ID || DEFAULT_SHEET_ID;
}

// In-memory cache of header arrays per tab so we don't re-read metadata every append.
// Key: `${spreadsheetId}::${tab}` -> string[] of header columns currently in row 1.
const headerCache = new Map<string, string[]>();

function cacheKey(spreadsheetId: string, tab: string): string {
  return `${spreadsheetId}::${tab}`;
}

async function ensureTabAndHeader(
  sheets: any,
  spreadsheetId: string,
  tab: string,
  fields: Record<string, any>,
): Promise<string[]> {
  const ck = cacheKey(spreadsheetId, tab);
  const cached = headerCache.get(ck);
  if (cached) {
    // If a new field key appears we don't see in the cached header, extend it.
    const newKeys = Object.keys(fields).filter((k) => !cached.includes(k));
    if (newKeys.length === 0) return cached;
    const updated = [...cached, ...newKeys];
    await writeHeaderRow(sheets, spreadsheetId, tab, updated);
    headerCache.set(ck, updated);
    return updated;
  }

  // Cold path: check whether the tab already exists.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabTitles: string[] = (meta.data.sheets || [])
    .map((s: any) => s.properties?.title)
    .filter(Boolean);

  if (!existingTabTitles.includes(tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
    const header = Object.keys(fields);
    await writeHeaderRow(sheets, spreadsheetId, tab, header);
    headerCache.set(ck, header);
    return header;
  }

  // Tab exists - read its current row 1.
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!1:1`,
  });
  const existingHeader: string[] = headerResp.data.values?.[0] || [];

  if (existingHeader.length === 0) {
    const header = Object.keys(fields);
    await writeHeaderRow(sheets, spreadsheetId, tab, header);
    headerCache.set(ck, header);
    return header;
  }

  const newKeys = Object.keys(fields).filter((k) => !existingHeader.includes(k));
  if (newKeys.length === 0) {
    headerCache.set(ck, existingHeader);
    return existingHeader;
  }
  const updated = [...existingHeader, ...newKeys];
  await writeHeaderRow(sheets, spreadsheetId, tab, updated);
  headerCache.set(ck, updated);
  return updated;
}

async function writeHeaderRow(
  sheets: any,
  spreadsheetId: string,
  tab: string,
  header: string[],
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header] },
  });
}

function toCell(value: any): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (Array.isArray(value)) return value.join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Append a new contact/lead row to the owner's Google Sheet.
 * Fire-and-forget: never throws, errors are logged.
 *
 * @param tab   Sheet tab name (e.g. "Signups", "Logins", "Deals", "Leads",
 *              "Realtors", "Lenders", "DealLeads", "DealMatch",
 *              "Inspectors", "MarketExperts", "CoachingWaitlist",
 *              "ContactHost", "PartnershipInquiries", "InvestorSignups",
 *              "InvestorLeads").
 * @param fields Arbitrary key/value record. A "timestamp" column is auto-added
 *               if not provided.
 */
export async function appendLead(
  tab: string,
  fields: Record<string, any>,
): Promise<void> {
  try {
    const spreadsheetId = getSheetId();
    const rowFields: Record<string, any> = {
      timestamp: new Date().toISOString(),
      ...fields,
    };
    const sheets = await getUncachableGoogleSheetClient();
    const header = await ensureTabAndHeader(sheets, spreadsheetId, tab, rowFields);
    const row = header.map((h) => toCell(rowFields[h]));
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[leads-sheet] appended to ${tab}: ${rowFields.email || rowFields.name || ""}`);
    }
  } catch (err: any) {
    console.error(`[leads-sheet] append failed (tab=${tab}):`, err?.message || err);
  }
}
