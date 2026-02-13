/**
 * Express API routes for listings.
 */

import { Router, Request, Response } from 'express';
import { QueryResultRow } from 'pg';
import { db as defaultDb } from './db';
import {
  validateListingParams,
  validateListingQuery,
  validateMapQuery,
  validateStatsQuery,
  validateTopInvestmentQuery,
} from './validation';

interface DatabaseAdapter {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]) => Promise<{ rows: T[] }>;
}

interface ListingQuery {
  city?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  propertyType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
  investmentFocus?: boolean | string;
  minCapRate?: number;
  maxCapRate?: number;
}

export function createApiRouter(database: DatabaseAdapter = defaultDb): Router {
  const router = Router();

  router.get('/listings', validateListingQuery, async (req: Request<unknown, unknown, unknown, ListingQuery>, res: Response) => {
    const {
      city,
      province,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      propertyType,
      status = 'Active',
      sortBy = 'list_date',
      sortOrder = 'DESC',
      page = 1,
      limit = 20,
      investmentFocus = false,
      minCapRate,
      maxCapRate,
    } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount += 1;
    }

    if (city) {
      conditions.push(`address_city ILIKE $${paramCount}`);
      params.push(`%${city}%`);
      paramCount += 1;
    }

    if (province) {
      conditions.push(`address_province = $${paramCount}`);
      params.push(province);
      paramCount += 1;
    }

    if (typeof minPrice === 'number') {
      conditions.push(`list_price >= $${paramCount}`);
      params.push(minPrice);
      paramCount += 1;
    }

    if (typeof maxPrice === 'number') {
      conditions.push(`list_price <= $${paramCount}`);
      params.push(maxPrice);
      paramCount += 1;
    }

    if (typeof minBedrooms === 'number') {
      conditions.push(`bedrooms >= $${paramCount}`);
      params.push(minBedrooms);
      paramCount += 1;
    }

    if (typeof maxBedrooms === 'number') {
      conditions.push(`bedrooms <= $${paramCount}`);
      params.push(maxBedrooms);
      paramCount += 1;
    }

    if (propertyType) {
      conditions.push(`property_type = $${paramCount}`);
      params.push(propertyType);
      paramCount += 1;
    }

    const investmentEnabled = investmentFocus === true || investmentFocus === 'true';
    if (investmentEnabled) {
      conditions.push('cap_rate IS NOT NULL');
    }

    if (typeof minCapRate === 'number') {
      conditions.push(`cap_rate >= $${paramCount}`);
      params.push(minCapRate);
      paramCount += 1;
    }

    if (typeof maxCapRate === 'number') {
      conditions.push(`cap_rate <= $${paramCount}`);
      params.push(maxCapRate);
      paramCount += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortColumns = new Set([
      'list_date',
      'list_price',
      'cap_rate',
      'gross_yield',
      'cash_flow_monthly',
      'bedrooms',
      'square_footage',
    ]);

    const sortColumn = validSortColumns.has(sortBy) ? sortBy : 'list_date';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(Math.max(1, limit), 100);
    const offset = (pageNum - 1) * limitNum;

    try {
      const countResult = await database.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM listings ${whereClause}`,
        params,
      );
      const total = Number.parseInt(countResult.rows[0]?.total || '0', 10);

      const query = `
        SELECT
          l.*,
          (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', p.id,
                'url', p.photo_url,
                'isPrimary', p.is_primary,
                'sequence', p.sequence_number
              ) ORDER BY p.sequence_number
            ), '[]'::json)
            FROM listing_photos p
            WHERE p.listing_id = l.id
          ) AS photos,
          (
            SELECT json_build_object(
              'name', a.full_name,
              'phone', a.phone,
              'email', a.email,
              'photo', a.photo_url
            )
            FROM agents a
            WHERE a.id = l.listing_agent_id
          ) AS agent,
          (
            SELECT json_build_object(
              'name', b.name,
              'phone', b.phone,
              'website', b.website
            )
            FROM brokerages b
            WHERE b.id = l.listing_brokerage_id
          ) AS brokerage
        FROM listings l
        ${whereClause}
        ORDER BY ${sortColumn} ${order}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      const listingResult = await database.query(query, [...params, limitNum, offset]);

      res.json({
        success: true,
        data: listingResult.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/listings/:mlsNumber', validateListingParams, async (req: Request<{ mlsNumber: string }>, res: Response) => {
    try {
      const result = await database.query(
        `
        SELECT
          l.*,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', p.id,
              'url', p.photo_url,
              'isPrimary', p.is_primary,
              'sequence', p.sequence_number,
              'caption', p.caption
            ) ORDER BY p.sequence_number), '[]'::json)
            FROM listing_photos p WHERE p.listing_id = l.id
          ) AS photos,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'type', r.room_type,
              'level', r.room_level,
              'dimensions', r.dimensions,
              'description', r.description
            )), '[]'::json)
            FROM listing_rooms r WHERE r.listing_id = l.id
          ) AS rooms,
          (
            SELECT json_build_object(
              'id', a.id,
              'name', a.full_name,
              'phone', a.phone,
              'email', a.email,
              'photo', a.photo_url,
              'designation', a.designation
            )
            FROM agents a WHERE a.id = l.listing_agent_id
          ) AS agent,
          (
            SELECT json_build_object(
              'id', b.id,
              'name', b.name,
              'phone', b.phone,
              'email', b.email,
              'website', b.website,
              'address', b.address
            )
            FROM brokerages b WHERE b.id = l.listing_brokerage_id
          ) AS brokerage,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'changeType', h.change_type,
              'oldValue', h.old_value,
              'newValue', h.new_value,
              'changedAt', h.changed_at,
              'notes', h.notes
            ) ORDER BY h.changed_at DESC), '[]'::json)
            FROM listing_history h WHERE h.listing_id = l.id
          ) AS history
        FROM listings l
        WHERE l.mls_number = $1
      `,
        [req.params.mlsNumber],
      );

      if (!result.rows[0]) {
        res.status(404).json({ success: false, error: 'Listing not found' });
        return;
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/listings/investment/top', validateTopInvestmentQuery, async (req: Request, res: Response) => {
    try {
      const { limit = 50, city, province } = req.query as { limit?: number; city?: string; province?: string };
      const conditions: string[] = ['status = $1', 'cap_rate IS NOT NULL'];
      const params: unknown[] = ['Active'];
      let paramCount = 2;

      if (city) {
        conditions.push(`address_city ILIKE $${paramCount}`);
        params.push(`%${city}%`);
        paramCount += 1;
      }

      if (province) {
        conditions.push(`address_province = $${paramCount}`);
        params.push(province);
        paramCount += 1;
      }

      const query = `
        SELECT
          mls_number,
          address_street,
          address_city,
          address_province,
          list_price,
          bedrooms,
          bathrooms_full,
          square_footage,
          cap_rate,
          gross_yield,
          cash_flow_monthly,
          estimated_monthly_rent,
          (
            SELECT photo_url FROM listing_photos
            WHERE listing_id = listings.id AND is_primary = true
            LIMIT 1
          ) AS primary_photo
        FROM listings
        WHERE ${conditions.join(' AND ')}
        ORDER BY cap_rate DESC
        LIMIT $${paramCount}
      `;

      const result = await database.query(query, [...params, limit]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/listings/map', validateMapQuery, async (req: Request, res: Response) => {
    try {
      const { bounds, minPrice, maxPrice, propertyType, status = 'Active' } = req.query as {
        bounds?: string;
        minPrice?: number;
        maxPrice?: number;
        propertyType?: string;
        status?: string;
      };

      const conditions: string[] = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
      const params: unknown[] = [];
      let paramCount = 1;

      if (status) {
        conditions.push(`status = $${paramCount}`);
        params.push(status);
        paramCount += 1;
      }

      if (bounds) {
        const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map((value) => Number.parseFloat(value));
        conditions.push(`latitude BETWEEN $${paramCount} AND $${paramCount + 1}`);
        conditions.push(`longitude BETWEEN $${paramCount + 2} AND $${paramCount + 3}`);
        params.push(minLat, maxLat, minLng, maxLng);
        paramCount += 4;
      }

      if (typeof minPrice === 'number') {
        conditions.push(`list_price >= $${paramCount}`);
        params.push(minPrice);
        paramCount += 1;
      }

      if (typeof maxPrice === 'number') {
        conditions.push(`list_price <= $${paramCount}`);
        params.push(maxPrice);
        paramCount += 1;
      }

      if (propertyType) {
        conditions.push(`property_type = $${paramCount}`);
        params.push(propertyType);
        paramCount += 1;
      }

      const result = await database.query(
        `
          SELECT
            id,
            mls_number,
            latitude,
            longitude,
            list_price,
            bedrooms,
            bathrooms_full,
            address_street,
            address_city,
            property_type,
            structure_type,
            cap_rate,
            (
              SELECT photo_url FROM listing_photos
              WHERE listing_id = listings.id AND is_primary = true
              LIMIT 1
            ) AS photo
          FROM listings
          WHERE ${conditions.join(' AND ')}
          LIMIT 500
        `,
        params,
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  router.get('/stats', validateStatsQuery, async (req: Request, res: Response) => {
    try {
      const { city, province } = req.query as { city?: string; province?: string };
      const conditions: string[] = ['status = $1'];
      const params: unknown[] = ['Active'];
      let paramCount = 2;

      if (city) {
        conditions.push(`address_city ILIKE $${paramCount}`);
        params.push(`%${city}%`);
        paramCount += 1;
      }

      if (province) {
        conditions.push(`address_province = $${paramCount}`);
        params.push(province);
        paramCount += 1;
      }

      const result = await database.query(
        `
          SELECT
            COUNT(*) AS total_listings,
            AVG(list_price) AS avg_price,
            MIN(list_price) AS min_price,
            MAX(list_price) AS max_price,
            AVG(cap_rate) FILTER (WHERE cap_rate IS NOT NULL) AS avg_cap_rate,
            COUNT(*) FILTER (WHERE cap_rate IS NOT NULL) AS investment_listings,
            AVG(square_footage) AS avg_sqft,
            COUNT(*) FILTER (WHERE property_type = 'Residential') AS residential_count,
            COUNT(*) FILTER (WHERE property_type = 'Commercial') AS commercial_count
          FROM listings
          WHERE ${conditions.join(' AND ')}
        `,
        params,
      );

      res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

const router = createApiRouter();
export default router;
