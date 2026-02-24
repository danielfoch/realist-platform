/**
 * Express API routes for listings.
 */

import { Router, Request, Response } from 'express';
import { QueryResultRow } from 'pg';
import { db as defaultDb } from './db';
import { isDemoMode, getDemoListings, getDemoListingByMls, filterDemoListings } from './demo-data';
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
    // Demo mode - return mock data without database
    if (isDemoMode()) {
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

      const result = filterDemoListings({
        city,
        province,
        minPrice: typeof minPrice === 'number' ? minPrice : undefined,
        maxPrice: typeof maxPrice === 'number' ? maxPrice : undefined,
        minBedrooms: typeof minBedrooms === 'number' ? minBedrooms : undefined,
        maxBedrooms: typeof maxBedrooms === 'number' ? maxBedrooms : undefined,
        propertyType,
        status: status as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'ASC' | 'DESC',
        page: typeof page === 'number' ? page : 1,
        limit: typeof limit === 'number' ? limit : 20,
        investmentFocus: investmentFocus === true || investmentFocus === 'true',
        minCapRate: typeof minCapRate === 'number' ? minCapRate : undefined,
        maxCapRate: typeof maxCapRate === 'number' ? maxCapRate : undefined,
      });

      return res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }

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
    // Demo mode
    if (isDemoMode()) {
      const listing = getDemoListingByMls(req.params.mlsNumber);
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      return res.json({ success: true, data: listing });
    }

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
    // Demo mode
    if (isDemoMode()) {
      const { limit = 50, city, province } = req.query as { limit?: number; city?: string; province?: string };
      const result = filterDemoListings({
        status: 'Active',
        investmentFocus: true,
        sortBy: 'cap_rate',
        sortOrder: 'DESC',
        limit: limit || 50,
        city,
        province,
      });
      return res.json({ success: true, data: result.data });
    }

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
    // Demo mode
    if (isDemoMode()) {
      const { bounds, minPrice, maxPrice, propertyType, status = 'Active' } = req.query as {
        bounds?: string;
        minPrice?: number;
        maxPrice?: number;
        propertyType?: string;
        status?: string;
      };

      const result = filterDemoListings({
        status,
        propertyType,
        minPrice: typeof minPrice === 'number' ? minPrice : undefined,
        maxPrice: typeof maxPrice === 'number' ? maxPrice : undefined,
        sortBy: 'cap_rate',
        sortOrder: 'DESC',
        limit: 100,
      });

      return res.json({ success: true, data: result.data });
    }

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
    // Demo mode
    if (isDemoMode()) {
      const listings = getDemoListings();
      const prices = listings.map(l => l.list_price);
      const capRates = listings.map(l => l.cap_rate).filter(c => c != null);
      const sqfts = listings.map(l => l.square_footage).filter(s => s != null);

      return res.json({
        success: true,
        data: {
          total_listings: listings.length,
          avg_price: prices.reduce((a, b) => a + b, 0) / prices.length,
          min_price: Math.min(...prices),
          max_price: Math.max(...prices),
          avg_cap_rate: capRates.length > 0 ? capRates.reduce((a, b) => a + b, 0) / capRates.length : null,
          investment_listings: capRates.length,
          avg_sqft: sqfts.length > 0 ? sqfts.reduce((a, b) => a + b, 0) / sqfts.length : null,
          avg_rent: listings.reduce((a, b) => a + (b.estimated_monthly_rent || 0), 0) / listings.length,
          cities: [...new Set(listings.map(l => l.address_city))],
        },
      });
    }

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

  // Rent data ingestion endpoint - receives rent data from scraper and calculates cap rates
  // POST /api/rents/ingest
  router.post('/rents/ingest', async (req: Request, res: Response) => {
    try {
      // Validate API key
      const apiKey = req.headers['x-api-key'] as string;
      const expectedApiKey = process.env.RENT_API_KEY;
      
      if (expectedApiKey && apiKey !== expectedApiKey) {
        res.status(401).json({ success: false, error: 'Invalid API key' });
        return;
      }

      const { rents, source = 'scraper' } = req.body;
      
      if (!rents || !Array.isArray(rents)) {
        res.status(400).json({ success: false, error: 'Expected rents array in request body' });
        return;
      }

      const results = {
        matched: 0,
        updated: 0,
        created: 0,
        errors: 0,
        details: [] as { address: string; status: string; error?: string }[],
      };

      for (const rent of rents) {
        try {
          const { 
            mlsNumber, 
            address, 
            city, 
            province, 
            monthlyRent, 
            bedrooms,
            source: rentSource 
          } = rent;

          if (!monthlyRent || monthlyRent <= 0) {
            results.errors++;
            results.details.push({ address: address || mlsNumber || 'unknown', status: 'error', error: 'Invalid rent amount' });
            continue;
          }

          // Try to find matching listing by MLS number first, then by address
          let listingQuery: { rows: QueryResultRow[] };
          
          if (mlsNumber) {
            listingQuery = await database.query(
              'SELECT id, list_price, address_street, address_city, address_province FROM listings WHERE mls_number = $1',
              [mlsNumber]
            );
          } else if (address && city) {
            listingQuery = await database.query(
              `SELECT id, list_price, address_street, address_city, address_province 
               FROM listings 
               WHERE LOWER(address_street) = LOWER($1) AND LOWER(address_city) = LOWER($2)`,
              [address, city]
            );
          } else {
            results.errors++;
            results.details.push({ address: address || 'unknown', status: 'error', error: 'No MLS number or address provided' });
            continue;
          }

          if (listingQuery.rows.length === 0) {
            // No matching listing found - could create a pending record or just skip
            results.details.push({ 
              address: address || mlsNumber || 'unknown', 
              status: 'no_match',
              error: 'No matching listing found in database'
            });
            continue;
          }

          const listing = listingQuery.rows[0] as { id: number; list_price: number; address_street: string; address_city: string; address_province: string };
          const listPrice = Number(listing.list_price);

          if (!listPrice || listPrice <= 0) {
            results.errors++;
            results.details.push({ 
              address: listing.address_street, 
              status: 'error', 
              error: 'Listing has no valid price' 
            });
            continue;
          }

          // Calculate cap rate using the formula: (Monthly Rent × 12 × 0.6) / Listing Price
          const annualRent = monthlyRent * 12;
          const noi = annualRent * 0.6; // 60% NOI ratio
          const capRate = (noi / listPrice) * 100;
          const grossYield = (annualRent / listPrice) * 100;

          // Update the listing with rent data and calculated cap rate
          await database.query(
            `UPDATE listings 
             SET estimated_monthly_rent = $1,
                 cap_rate = $2,
                 gross_yield = $3,
                 rent_data_source = $4,
                 rent_data_updated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [monthlyRent, Math.round(capRate * 100) / 100, Math.round(grossYield * 100) / 100, rentSource || source, listing.id]
          );

          results.matched++;
          results.updated++;
          results.details.push({ 
            address: listing.address_street, 
            status: 'updated',
          });

        } catch (rentError) {
          results.errors++;
          const addr = rent?.address || 'unknown';
          results.details.push({ address: addr, status: 'error', error: String(rentError) });
        }
      }

      res.json({ 
        success: true, 
        data: results,
        message: `Processed ${rents.length} rent records: ${results.updated} updated, ${results.errors} errors`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // Cap rate preview endpoint - calculate cap rate without storing
  // GET /api/cap-rate/preview?price=500000&rent=2500
  router.get('/cap-rate/preview', async (req: Request, res: Response) => {
    try {
      const { price, rent, maintenanceFee } = req.query;
      
      const listPrice = Number(price);
      const monthlyRent = Number(rent);
      const maintenance = maintenanceFee ? Number(maintenanceFee) : 0;
      
      if (!listPrice || listPrice <= 0) {
        res.status(400).json({ success: false, error: 'Invalid or missing price parameter' });
        return;
      }
      
      if (!monthlyRent || monthlyRent <= 0) {
        res.status(400).json({ success: false, error: 'Invalid or missing rent parameter' });
        return;
      }

      // Calculate cap rate: (Monthly Rent × 12 × 0.6) / Listing Price
      const annualRent = monthlyRent * 12;
      const noi = annualRent * 0.6; // 60% NOI ratio
      const capRate = (noi / listPrice) * 100;
      const grossYield = (annualRent / listPrice) * 100;
      
      // Cash flow with mortgage estimate (20% down, 5% rate, 25yr amort)
      const downPayment = listPrice * 0.2;
      const loanAmount = listPrice - downPayment;
      const monthlyRate = 0.05 / 12;
      const payments = 25 * 12;
      const monthlyMortgage = (loanAmount * (monthlyRate * (1 + monthlyRate) ** payments)) / ((1 + monthlyRate) ** payments - 1);
      const monthlyExpenses = (annualRent - noi) / 12 + maintenance + monthlyMortgage;
      const cashFlow = monthlyRent - monthlyExpenses;

      res.json({
        success: true,
        data: {
          listPrice,
          monthlyRent,
          maintenanceFee: maintenance,
          annualRent,
          noi,
          capRate: Math.round(capRate * 100) / 100,
          grossYield: Math.round(grossYield * 100) / 100,
          cashFlowMonthly: Math.round(cashFlow * 100) / 100,
          assumptions: {
            noiRatio: '60%',
            downPayment: '20%',
            interestRate: '5%',
            amortizationYears: 25,
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

const router = createApiRouter();
export default router;
