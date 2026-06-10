/**
 * Import US listings from a HomeHarvest CSV export into the listings table.
 *
 * HomeHarvest (https://github.com/Bunsly/HomeHarvest) scrapes Realtor.com and
 * outputs a CSV with headers such as: property_url, mls, mls_id, status, style,
 * street, unit, city, state, zip_code, beds, full_baths, half_baths, sqft,
 * year_built, list_price, list_date, latitude, longitude, stories, hoa_fee,
 * primary_photo.
 *
 * Usage: npm run import:us -- path/to/us_listings.csv
 */

import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import { PoolClient } from 'pg';
import { db } from '../db';
import { logger } from '../logger';

dotenv.config();

const BATCH_SIZE = 100;

/**
 * Minimal RFC 4180 CSV parser (no dependencies).
 * Handles quoted fields containing commas, newlines, and escaped quotes ("").
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = (): void => {
    row.push(field);
    field = '';
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

    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }

    if (char === '\r') {
      if (content[i + 1] === '\n') {
        i += 1;
      }
      pushRow();
      i += 1;
      continue;
    }

    if (char === '\n') {
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

function toRecords(rows: string[][]): Record<string, string>[] {
  const headerRow = rows[0];
  if (!headerRow) {
    return [];
  }
  const headers = headerRow.map((header) => header.trim().toLowerCase());

  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = (cells[idx] ?? '').trim();
      });
      return record;
    });
}

function parseIntSafe(value?: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseFloatSafe(value?: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDateSafe(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapStatus(value?: string): string {
  if (!value) {
    return 'Active';
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === 'FOR_SALE') {
    return 'Active';
  }
  // Pass through capitalized, e.g. PENDING -> Pending, sold -> Sold
  const cleaned = value.trim().replace(/_/g, ' ').toLowerCase();
  return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 20);
}

interface UsListingRow {
  mls_number: string;
  status: string;
  list_date: Date | null;
  property_type: string | null;
  address_street: string | null;
  address_city: string;
  address_province: string | null;
  address_postal_code: string | null;
  address_country: string;
  latitude: number | null;
  longitude: number | null;
  list_price: number;
  bedrooms: number | null;
  bathrooms_full: number | null;
  bathrooms_half: number | null;
  square_footage: number | null;
  year_built: number | null;
  stories: number | null;
  maintenance_fee: number | null;
  source: string;
  raw_data: string;
  primary_photo: string | null;
}

export function mapRecord(record: Record<string, string>, index: number): UsListingRow | null {
  const listPrice = parseFloatSafe(record.list_price);
  const city = record.city;

  if (!listPrice || !city) {
    return null;
  }

  const mlsNumber = record.mls_id || `${record.mls || 'HH'}-${index}`;
  const street = record.street || '';
  const unit = record.unit || '';
  const addressStreet = street ? `${street}${unit ? ` ${unit}` : ''}` : null;

  return {
    mls_number: mlsNumber.slice(0, 50),
    status: mapStatus(record.status),
    list_date: parseDateSafe(record.list_date),
    property_type: record.style ? record.style.slice(0, 50) : null,
    address_street: addressStreet ? addressStreet.slice(0, 255) : null,
    address_city: city.slice(0, 100),
    address_province: record.state ? record.state.slice(0, 2).toUpperCase() : null,
    address_postal_code: record.zip_code ? record.zip_code.slice(0, 10) : null,
    address_country: 'USA',
    latitude: parseFloatSafe(record.latitude),
    longitude: parseFloatSafe(record.longitude),
    list_price: listPrice,
    bedrooms: parseIntSafe(record.beds),
    bathrooms_full: parseIntSafe(record.full_baths),
    bathrooms_half: parseIntSafe(record.half_baths),
    square_footage: parseIntSafe(record.sqft),
    year_built: parseIntSafe(record.year_built),
    stories: parseIntSafe(record.stories),
    maintenance_fee: parseFloatSafe(record.hoa_fee),
    source: 'homeharvest',
    raw_data: JSON.stringify(record),
    primary_photo: record.primary_photo || null,
  };
}

async function upsertListing(client: PoolClient, row: UsListingRow): Promise<'inserted' | 'updated'> {
  const { primary_photo: primaryPhoto, ...listing } = row;
  const entries = Object.entries(listing);
  const fields = entries.map(([key]) => key).join(', ');
  const placeholders = entries.map((_, idx) => `$${idx + 1}`).join(', ');
  const updates = entries
    .map(([key], idx) => `${key} = $${idx + 1}`)
    .join(', ');
  const values = entries.map(([, value]) => value);

  // mls_number has a UNIQUE constraint in 001_initial_schema.sql
  const result = await client.query<{ id: number; inserted: boolean }>(
    `INSERT INTO listings (${fields})
     VALUES (${placeholders})
     ON CONFLICT (mls_number)
     DO UPDATE SET ${updates}, synced_at = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    values,
  );

  const upserted = result.rows[0];
  if (!upserted) {
    throw new Error(`Upsert returned no row for ${row.mls_number}`);
  }

  if (primaryPhoto) {
    const existingPhoto = await client.query(
      'SELECT 1 FROM listing_photos WHERE listing_id = $1 AND photo_url = $2 LIMIT 1',
      [upserted.id, primaryPhoto],
    );
    if (existingPhoto.rows.length === 0) {
      await client.query(
        `INSERT INTO listing_photos (listing_id, photo_url, sequence_number, is_primary)
         VALUES ($1, $2, 1, true)`,
        [upserted.id, primaryPhoto],
      );
    }
  }

  return upserted.inserted ? 'inserted' : 'updated';
}

export async function importUsListings(csvPath: string): Promise<{ inserted: number; updated: number; skipped: number }> {
  const content = await fs.readFile(csvPath, 'utf8');
  const records = toRecords(parseCsv(content));

  logger.info('US listings import started', { csvPath, rowCount: records.length });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = records.slice(start, start + BATCH_SIZE);

    await db.transaction(async (client) => {
      for (let offset = 0; offset < batch.length; offset += 1) {
        const record = batch[offset];
        if (!record) {
          continue;
        }
        const row = mapRecord(record, start + offset);
        if (!row) {
          skipped += 1;
          continue;
        }

        const outcome = await upsertListing(client, row);
        if (outcome === 'inserted') {
          inserted += 1;
        } else {
          updated += 1;
        }
      }
    });

    logger.info('US listings import progress', {
      processed: Math.min(start + BATCH_SIZE, records.length),
      total: records.length,
      inserted,
      updated,
      skipped,
    });
  }

  logger.info('US listings import completed', { inserted, updated, skipped });
  return { inserted, updated, skipped };
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];

  if (!csvPath) {
    logger.error('Missing CSV path. Usage: npm run import:us -- path/to/us_listings.csv');
    process.exit(1);
  }

  try {
    await importUsListings(csvPath);
  } catch (error) {
    logger.error('US listings import failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  void main();
}
