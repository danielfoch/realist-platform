/**
 * CREA DDF Listing Sync Script
 * Fetches listings from DDF and updates database with investment metrics.
 */

import axios from 'axios';
import { QueryResultRow } from 'pg';
import { DDFClient, Listing } from './ddf-client';
import { db } from './db';
import { calculateInvestmentMetrics } from './investment-metrics';
import { logger } from './logger';
import { withRetry } from './retry';

export interface SyncConfig {
  incrementalSync: boolean;
  lookbackDays: number;
  batchSize: number;
  calculateInvestmentMetrics: boolean;
}

interface RentData {
  city: string;
  province: string;
  bedrooms: number;
  averageRent: number;
  sampleSize: number;
}

type SyncOutcome = 'inserted' | 'updated' | 'skipped';

interface ListingRow extends QueryResultRow {
  id: number;
  list_price: string | null;
  status: string;
}

interface SyncRunRow extends QueryResultRow {
  id: number;
}

interface ListingUpsertData extends Record<string, unknown> {
  status: string;
  list_price: number | null;
  address_city: string | null;
  address_province: string | null;
  bedrooms: number | null;
  maintenance_fee: number | null;
  estimated_monthly_rent?: number;
  cap_rate?: number;
  gross_yield?: number;
  cash_flow_monthly?: number;
  rent_data_source?: string;
  rent_data_updated_at?: Date;
}

export class ListingSyncService {
  private readonly ddfClient: DDFClient;
  private readonly rentApiUrl: string;

  constructor(credentials: { username: string; password: string }, rentApiUrl = 'https://realist.ca/api/rents') {
    this.ddfClient = new DDFClient(credentials);
    this.rentApiUrl = rentApiUrl;
  }

  async sync(
    config: SyncConfig = {
      incrementalSync: true,
      lookbackDays: 1,
      batchSize: 100,
      calculateInvestmentMetrics: true,
    },
  ): Promise<void> {
    const startTime = Date.now();
    const runId = await this.createSyncRun(config);

    logger.info('Sync started', { runId, config });

    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    try {
      const authenticated = await this.ddfClient.login();
      if (!authenticated) {
        throw new Error('Failed to authenticate with CREA DDF');
      }

      let modifiedSince: Date | undefined;
      if (config.incrementalSync) {
        modifiedSince = (await this.getLastSyncTime()) || undefined;
        if (!modifiedSince) {
          modifiedSince = new Date();
          modifiedSince.setDate(modifiedSince.getDate() - config.lookbackDays);
        }
      }

      logger.info('Fetching listings from DDF', {
        runId,
        modifiedSince: modifiedSince?.toISOString(),
        batchSize: config.batchSize,
      });

      const listings = await this.ddfClient.searchListings({
        status: ['Active', 'Pending', 'Sold'],
        modifiedSince,
        limit: config.batchSize,
      });

      logger.info('Listings fetched', { runId, listingCount: listings.length });

      for (const listing of listings) {
        try {
          const result = await this.processListing(listing, config.calculateInvestmentMetrics);
          if (result === 'inserted') {
            inserted += 1;
          } else if (result === 'updated') {
            updated += 1;
          }
          processed += 1;

          if (processed % 25 === 0) {
            logger.info('Sync progress', {
              runId,
              processed,
              total: listings.length,
              inserted,
              updated,
              failed,
            });
          }
        } catch (error) {
          failed += 1;
          logger.error('Listing processing failed', {
            runId,
            mlsNumber: listing.MlsNumber,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await db.query('SELECT refresh_investment_listings()');

      const durationMs = Date.now() - startTime;
      await this.completeSyncRun(runId, 'success', {
        processed,
        inserted,
        updated,
        failed,
        durationMs,
      });

      logger.info('Sync completed', {
        runId,
        durationMs,
        processed,
        inserted,
        updated,
        failed,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      await this.completeSyncRun(runId, 'failed', {
        processed,
        inserted,
        updated,
        failed,
        durationMs,
        errorMessage: message,
      });

      logger.error('Sync failed', {
        runId,
        durationMs,
        error: message,
      });

      throw error;
    } finally {
      await this.ddfClient.logout();
    }
  }

  private async processListing(listing: Listing, calculateMetrics: boolean): Promise<SyncOutcome> {
    if (!listing.MlsNumber) {
      return 'skipped';
    }

    const existing = await db.query<ListingRow>(
      'SELECT id, list_price, status FROM listings WHERE mls_number = $1',
      [listing.MlsNumber],
    );

    const parsed = this.parseListing(listing);
    const listPrice = parsed.list_price;
    const city = parsed.address_city;
    const province = parsed.address_province;
    const bedrooms = parsed.bedrooms || 1;
    const maintenanceFee = parsed.maintenance_fee || 0;

    if (calculateMetrics && listPrice && city && province) {
      const rentData = await this.fetchRentData(city, province, bedrooms);
      if (rentData?.averageRent) {
        const metrics = calculateInvestmentMetrics({
          listPrice,
          monthlyRent: rentData.averageRent,
          maintenanceFee,
        });

        parsed.estimated_monthly_rent = metrics.estimated_monthly_rent;
        parsed.cap_rate = metrics.cap_rate;
        parsed.gross_yield = metrics.gross_yield;
        parsed.cash_flow_monthly = metrics.cash_flow_monthly;
        parsed.rent_data_source = 'realist_rent_api';
        parsed.rent_data_updated_at = new Date();
      }
    }

    if (existing.rows.length > 0) {
      const existingListing = existing.rows[0];

      if (!existingListing) {
        return 'skipped';
      }

      if (existingListing.list_price !== null && parsed.list_price !== null && Number(existingListing.list_price) !== parsed.list_price) {
        await db.query(
          `INSERT INTO listing_history (listing_id, change_type, old_value, new_value, changed_at)
           VALUES ($1, 'price_change', $2, $3, NOW())`,
          [existingListing.id, existingListing.list_price, String(parsed.list_price)],
        );
      }

      if (existingListing.status !== parsed.status) {
        await db.query(
          `INSERT INTO listing_history (listing_id, change_type, old_value, new_value, changed_at)
           VALUES ($1, 'status_change', $2, $3, NOW())`,
          [existingListing.id, existingListing.status, parsed.status],
        );
      }

      const entries = Object.entries(parsed);
      const updateFields = entries.map(([key], idx) => `${key} = $${idx + 2}`).join(', ');
      const updateValues = entries.map(([, value]) => value);

      await db.query(`UPDATE listings SET ${updateFields} WHERE mls_number = $1`, [listing.MlsNumber, ...updateValues]);
      return 'updated';
    }

    const entries = Object.entries(parsed);
    const fields = entries.map(([key]) => key).join(', ');
    const placeholders = entries.map((_, idx) => `$${idx + 1}`).join(', ');
    const values = entries.map(([, value]) => value);

    const result = await db.query<{ id: number }>(
      `INSERT INTO listings (${fields}) VALUES (${placeholders}) RETURNING id`,
      values,
    );

    const listingId = result.rows[0]?.id;

    if (listingId) {
      try {
        const photos = await this.ddfClient.getPhotos(listing.ListingKey);
        await this.savePhotos(listingId, photos);
      } catch (error) {
        logger.warn('Photo sync failed for listing', {
          mlsNumber: listing.MlsNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return 'inserted';
  }

  private parseListing(listing: Listing): ListingUpsertData {
    const parseDate = (value?: string): Date | null => {
      if (!value) {
        return null;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const parseIntSafe = (value?: string): number | null => {
      if (!value) {
        return null;
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const parseFloatSafe = (value?: string): number | null => {
      if (!value) {
        return null;
      }
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    return {
      mls_number: listing.MlsNumber,
      status: this.mapStatus(listing.StandardStatus),
      list_date: parseDate(listing.ListingContractDate),
      sold_date: parseDate(listing.CloseDate),
      last_updated: new Date(),
      property_type: listing.PropertyType || null,
      structure_type: listing.PropertySubType || null,
      address_street: listing.StreetAddress || null,
      address_unit: listing.UnitNumber || null,
      address_city: listing.City || null,
      address_province: listing.StateOrProvince || null,
      address_postal_code: listing.PostalCode || null,
      latitude: parseFloatSafe(listing.Latitude),
      longitude: parseFloatSafe(listing.Longitude),
      list_price: parseFloatSafe(listing.ListPrice),
      sold_price: parseFloatSafe(listing.ClosePrice),
      original_price: parseFloatSafe(listing.OriginalListPrice),
      bedrooms: parseIntSafe(listing.BedroomsTotal),
      bedrooms_plus: parseIntSafe(listing.BedroomsPlus),
      bathrooms_full: parseIntSafe(listing.BathroomsFull),
      bathrooms_half: parseIntSafe(listing.BathroomsHalf),
      square_footage: parseIntSafe(listing.LivingArea),
      lot_size_sqft: parseIntSafe(listing.LotSizeSquareFeet),
      lot_size_acres: parseFloatSafe(listing.LotSizeAcres),
      year_built: parseIntSafe(listing.YearBuilt),
      parking_spaces: parseIntSafe(listing.ParkingTotal),
      garage_spaces: parseIntSafe(listing.GarageSpaces),
      public_remarks: listing.PublicRemarks || null,
      ownership_type: listing.OwnershipType || null,
      maintenance_fee: parseFloatSafe(listing.MaintenanceFee),
      virtual_tour_url: listing.VirtualTourURL || null,
      raw_data: listing,
      ddf_last_modified: parseDate(listing.ModificationTimestamp),
      synced_at: new Date(),
    };
  }

  private async fetchRentData(city: string, province: string, bedrooms: number): Promise<RentData | null> {
    try {
      const response = await withRetry(
        () =>
          axios.get<RentData>(`${this.rentApiUrl}/average`, {
            params: {
              city,
              province,
              bedrooms,
            },
            timeout: 5000,
          }),
        {
          attempts: 3,
          baseDelayMs: 150,
          maxDelayMs: 1200,
          shouldRetry: () => true,
        },
      );

      return response.data;
    } catch (error) {
      logger.warn('Rent data unavailable', {
        city,
        province,
        bedrooms,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async savePhotos(listingId: number, photoUrls: string[]): Promise<void> {
    for (let i = 0; i < photoUrls.length; i += 1) {
      const url = photoUrls[i];
      if (!url) {
        continue;
      }
      await db.query(
        `INSERT INTO listing_photos (listing_id, photo_url, sequence_number, is_primary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [listingId, url, i, i === 0],
      );
    }
  }

  private async getLastSyncTime(): Promise<Date | null> {
    const result = await db.query<{ last_sync: Date | null }>('SELECT MAX(synced_at) AS last_sync FROM listings');
    return result.rows[0]?.last_sync || null;
  }

  private mapStatus(ddfStatus: string): string {
    const statusMap: Record<string, string> = {
      Active: 'Active',
      Pending: 'Pending',
      Sold: 'Sold',
      Expired: 'Expired',
      Cancelled: 'Cancelled',
      Closed: 'Sold',
    };

    return statusMap[ddfStatus] || 'Active';
  }

  private async createSyncRun(config: SyncConfig): Promise<number> {
    const result = await db.query<SyncRunRow>(
      `INSERT INTO sync_runs (status, incremental_sync, batch_size)
       VALUES ('running', $1, $2)
       RETURNING id`,
      [config.incrementalSync, config.batchSize],
    );

    const runId = result.rows[0]?.id;
    if (!runId) {
      throw new Error('Failed to create sync run record');
    }

    return runId;
  }

  private async completeSyncRun(
    runId: number,
    status: 'success' | 'failed',
    stats: {
      processed: number;
      inserted: number;
      updated: number;
      failed: number;
      durationMs: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    await db.query(
      `UPDATE sync_runs
       SET status = $2,
           processed_count = $3,
           inserted_count = $4,
           updated_count = $5,
           failed_count = $6,
           duration_ms = $7,
           error_message = $8,
           finished_at = NOW()
       WHERE id = $1`,
      [runId, status, stats.processed, stats.inserted, stats.updated, stats.failed, stats.durationMs, stats.errorMessage || null],
    );
  }
}

if (require.main === module) {
  const username = process.env.DDF_USERNAME;
  const password = process.env.DDF_PASSWORD;

  if (!username || !password) {
    logger.error('Missing DDF credentials. Set DDF_USERNAME and DDF_PASSWORD.');
    process.exit(1);
  }

  const service = new ListingSyncService({ username, password });

  service
    .sync({
      incrementalSync: !process.argv.includes('--full'),
      lookbackDays: 7,
      batchSize: 100,
      calculateInvestmentMetrics: true,
    })
    .then(() => {
      logger.info('Sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}

export default ListingSyncService;
