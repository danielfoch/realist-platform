/**
 * Example sync script — runs on YOUR Mac (or wherever the scraper lives).
 *
 * This is a reference implementation for the scraper-side push to Realist.ca.
 * Copy this into your scraper repo and adapt to your SQLite library of choice
 * (better-sqlite3, sqlite3, drizzle, prisma, etc).
 *
 * Boundary contract:
 *   POST https://realist.ca/api/ingest/us-listings
 *   Header: X-Ingest-Token: <shared secret>
 *   Body:   { "listings": [ { ...UsListing }, ... ] }    (1..1000 per batch)
 *   Response: 200 { ok, received, upserted, serverTime }
 *             401 invalid/missing token
 *             400 invalid payload  (details: {fieldErrors, formErrors})
 *             503 endpoint not configured server-side
 *             5xx server error -> safe to retry next run
 *
 * The endpoint is idempotent — keyed on (source, source_id). Re-sending the
 * same listing updates the existing row. The script marks rows as
 * synced_at = now() ONLY on a successful 200 so partial failures retry next run.
 *
 * Usage:
 *   REALIST_INGEST_URL="https://realist.ca/api/ingest/us-listings" \
 *   REALIST_INGEST_TOKEN="<shared secret>" \
 *   SQLITE_PATH="./us-listings.db" \
 *   npx tsx example-sync-us-listings.ts
 */

import Database from "better-sqlite3"; // npm i better-sqlite3

const INGEST_URL    = process.env.REALIST_INGEST_URL   ?? "https://realist.ca/api/ingest/us-listings";
const INGEST_TOKEN  = process.env.REALIST_INGEST_TOKEN ?? "";
const SQLITE_PATH   = process.env.SQLITE_PATH          ?? "./us-listings.db";
const BATCH_SIZE    = 250;
const MAX_BATCHES   = Number(process.env.MAX_BATCHES ?? 10_000);

if (!INGEST_TOKEN) {
  console.error("Missing REALIST_INGEST_TOKEN env var");
  process.exit(1);
}

type ScraperRow = {
  id: number;
  source: string;
  source_id: string;
  source_url: string | null;
  formatted_address: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  list_price: number | null;
  est_rent: number | null;
  est_taxes: number | null;
  est_hoa: number | null;
  days_on_market: number | null;
  list_date: string | null;          // ISO 8601
  status: string | null;
  motivated_seller_signals: string | null; // JSON array stored as text
  raw: string | null;                 // JSON blob stored as text
  scraped_at: string;                 // ISO 8601
  delisted_at: string | null;
};

// ── 1. Read unsynced rows from local SQLite ────────────────────────────────
const db = new Database(SQLITE_PATH);
db.pragma("journal_mode = WAL");

// One-time: make sure the tracking column exists. Idempotent.
db.exec(`ALTER TABLE listings ADD COLUMN synced_at TEXT`);
// (Wrap in try/catch in real code; SQLite throws if column already exists.)

const selectStmt = db.prepare(`
  SELECT * FROM listings
  WHERE synced_at IS NULL OR datetime(scraped_at) > datetime(synced_at)
  ORDER BY id
  LIMIT ?
`);
const markSyncedStmt = db.prepare(`UPDATE listings SET synced_at = ? WHERE id = ?`);

// ── 2. Transform SQLite row → Realist API payload ──────────────────────────
function toApiPayload(row: ScraperRow) {
  return {
    source: row.source,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    formattedAddress: row.formatted_address,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    county: row.county,
    lat: row.lat,
    lng: row.lng,
    propertyType: row.property_type,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    lotSqft: row.lot_sqft,
    yearBuilt: row.year_built,
    listPrice: row.list_price,
    estRent: row.est_rent,
    estTaxes: row.est_taxes,
    estHoa: row.est_hoa,
    daysOnMarket: row.days_on_market,
    listDate: row.list_date,
    status: row.status,
    motivatedSellerSignals: row.motivated_seller_signals
      ? JSON.parse(row.motivated_seller_signals)
      : null,
    raw: row.raw ? JSON.parse(row.raw) : null,
    scrapedAt: row.scraped_at,
    delistedAt: row.delisted_at,
  };
}

// ── 3. POST a batch with simple retry/backoff ──────────────────────────────
async function postBatch(payload: ReturnType<typeof toApiPayload>[]) {
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ingest-Token": INGEST_TOKEN,
        },
        body: JSON.stringify({ listings: payload }),
      });
      if (res.ok) return await res.json();
      const text = await res.text();
      // 4xx is a payload bug — don't retry, surface the error.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      // 5xx — back off and retry.
      console.warn(`[attempt ${attempt}] HTTP ${res.status}: ${text}`);
    } catch (err) {
      console.warn(`[attempt ${attempt}] network error:`, err);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error("postBatch exhausted retries");
}

// ── 4. Main loop ───────────────────────────────────────────────────────────
async function main() {
  let totalSynced = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const rows = selectStmt.all(BATCH_SIZE) as ScraperRow[];
    if (rows.length === 0) break;

    const payload = rows.map(toApiPayload);
    const result = await postBatch(payload);
    console.log(`Batch ${i + 1}: sent ${rows.length}, server upserted ${result.upserted}`);

    const now = new Date().toISOString();
    const tx = db.transaction((ids: number[]) => {
      for (const id of ids) markSyncedStmt.run(now, id);
    });
    tx(rows.map((r) => r.id));

    totalSynced += rows.length;
  }
  console.log(`Done. Synced ${totalSynced} listings.`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
