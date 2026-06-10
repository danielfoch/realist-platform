/**
 * HomeHarvest CSV → us_listings mapping helpers.
 *
 * HomeHarvest (https://github.com/Bunsly/HomeHarvest) scrapes Realtor.com and
 * outputs a CSV with headers such as: property_url, mls, mls_id, status, style,
 * street, unit, city, state, zip_code, beds, full_baths, half_baths, sqft,
 * year_built, list_price, list_date, latitude, longitude, stories, hoa_fee,
 * days_on_mls, primary_photo.
 *
 * These helpers are pure (no I/O, no DB) so they can be unit-tested under
 * shared/ and consumed by the one-off importer job in server/importUsListings.ts.
 * The activity-derivation semantics intentionally mirror the
 * POST /api/ingest/us-listings endpoint in server/routes.ts so a CSV import
 * and an HTTP ingest of the same listing land in the same state.
 */

/**
 * Minimal RFC 4180 CSV parser (no dependencies).
 * Handles quoted fields containing commas, newlines, and escaped quotes ("").
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = (): void => {
    row.push(field);
    field = "";
  };

  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (char === "\r") {
      if (content[i + 1] === "\n") {
        i += 1;
      }
      pushRow();
      i += 1;
      continue;
    }

    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Flush trailing field/row (file may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

/** Convert raw CSV rows (header row first) into trimmed keyed records. */
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  const headerRow = rows[0];
  if (!headerRow) {
    return [];
  }
  const headers = headerRow.map((header) => header.trim().toLowerCase());

  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = (cells[idx] ?? "").trim();
      });
      return record;
    });
}

function parseNumberSafe(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntSafe(value?: string): number | null {
  const parsed = parseNumberSafe(value);
  return parsed == null ? null : Math.round(parsed);
}

function parseDateSafe(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface UsListingActivity {
  isActive: boolean;
  isSold: boolean;
  isOffMarket: boolean;
  isUnderContract: boolean;
}

/**
 * Derive activity flags from a raw source status string.
 * Mirrors /api/ingest/us-listings: SOLD / OFF_MARKET / PENDING-style statuses
 * force isActive=false; everything else (FOR_SALE, unknown, blank) is active.
 */
export function deriveUsListingActivity(status: string | null | undefined): UsListingActivity {
  const normalized = (status || "").toLowerCase().replace(/[\s-]+/g, "_");
  const isSold = ["sold", "closed", "recently_sold"].includes(normalized);
  const isOffMarket = ["off_market", "off_market_unknown", "inactive", "delisted"].includes(normalized);
  const isUnderContract = ["pending", "pending_sale", "under_contract", "contingent"].includes(normalized);
  return {
    isActive: !(isSold || isOffMarket || isUnderContract),
    isSold,
    isOffMarket,
    isUnderContract,
  };
}

/**
 * Shape accepted by insertUsListingSchema (shared/schema.ts). Country is
 * structural: every row in us_listings is a US listing; Canadian listings
 * live in ddf_listing_snapshots written by the DDF crawler.
 */
export interface MappedUsListing {
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  formattedAddress: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  listPrice: number | null;
  estHoa: number | null;
  daysOnMarket: number | null;
  listDate: Date | null;
  status: string | null;
  isActive: boolean;
  statusConfidence: string;
  raw: Record<string, string>;
  scrapedAt: Date;
}

/**
 * Map one HomeHarvest CSV record to a us_listings row.
 *
 * Returns null (caller counts it as skipped) when the row has no usable
 * list_price or city — same skip rule as the original idx importer.
 *
 * Upsert key: (source='homeharvest', sourceId). sourceId prefers `mls_id`;
 * rows without one fall back to `${mls || 'HH'}-${rowIndex}` which keeps them
 * importable but NOT stable across re-scrapes — documented in US_LISTINGS.md.
 */
export function mapHomeHarvestCsvRecord(
  record: Record<string, string>,
  index: number,
  scrapedAt: Date = new Date(),
): MappedUsListing | null {
  const listPrice = parseNumberSafe(record.list_price);
  const city = record.city || null;
  if (!listPrice || !city) {
    return null;
  }

  const sourceId = record.mls_id || `${record.mls || "HH"}-${index}`;
  const street = record.street || "";
  const unit = record.unit || "";
  const streetAddress = street ? `${street}${unit ? ` ${unit}` : ""}` : null;
  const state = record.state ? record.state.toUpperCase().slice(0, 2) : null;
  const postalCode = record.zip_code || null;
  const formattedAddress = [streetAddress, city, state, postalCode].filter(Boolean).join(", ");

  const fullBaths = parseNumberSafe(record.full_baths);
  const halfBaths = parseNumberSafe(record.half_baths);
  const baths = fullBaths == null && halfBaths == null
    ? null
    : (fullBaths ?? 0) + 0.5 * (halfBaths ?? 0);

  const status = record.status || null;
  const activity = deriveUsListingActivity(status);

  return {
    source: "homeharvest",
    sourceId,
    sourceUrl: record.property_url || null,
    formattedAddress,
    streetAddress,
    city,
    state,
    postalCode,
    county: record.county || null,
    lat: parseNumberSafe(record.latitude),
    lng: parseNumberSafe(record.longitude),
    propertyType: record.style || null,
    beds: parseNumberSafe(record.beds),
    baths,
    sqft: parseIntSafe(record.sqft),
    lotSqft: parseIntSafe(record.lot_sqft),
    yearBuilt: parseIntSafe(record.year_built),
    listPrice: Math.round(listPrice),
    estHoa: parseIntSafe(record.hoa_fee),
    daysOnMarket: parseIntSafe(record.days_on_mls) ?? parseIntSafe(record.days_on_market),
    listDate: parseDateSafe(record.list_date),
    // Status text is stored as-sent (e.g. "FOR_SALE"); visibility on the map
    // and /listings/us page is governed by isActive, matching the HTTP ingest.
    status,
    isActive: activity.isActive,
    statusConfidence: "high",
    raw: record,
    scrapedAt,
  };
}
