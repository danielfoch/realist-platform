/**
 * Saved Listings API Routes
 * Persistent bookmarking of listings by authenticated investors
 */

import { Router, Response } from 'express';
import { db } from './db';
import { AuthRequest, authenticateToken } from './auth-middleware';
import { trackEvent } from './event-tracking';

const router = Router();

interface SaveListingBody {
  listing_id?: number;
  address: string;
  city?: string;
  province?: string;
  price?: number;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  notes?: string;
}

/**
 * POST /api/saved-listings
 * Save (bookmark) a listing for the authenticated user. UPSERT on (user_id, listing_id).
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const body: SaveListingBody = req.body;
  const { listing_id, address, city, province, price, property_type, bedrooms, bathrooms, sqft, notes } = body;

  if (!address) {
    res.status(400).json({ success: false, error: 'address is required' });
    return;
  }

  if (listing_id === undefined && listing_id === null) {
    // Allow saving without a listing_id (manual address entry)
  }

  try {
    const result = await db.query(
      `INSERT INTO saved_listings (user_id, listing_id, address, city, province, price, property_type, bedrooms, bathrooms, sqft, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, listing_id) WHERE listing_id IS NOT NULL
       DO UPDATE SET address = EXCLUDED.address, city = EXCLUDED.city, province = EXCLUDED.province,
                     price = EXCLUDED.price, property_type = EXCLUDED.property_type,
                     bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms,
                     sqft = EXCLUDED.sqft, notes = EXCLUDED.notes
       RETURNING *`,
      [userId, listing_id ?? null, address, city ?? '', province ?? '', price ?? null, property_type ?? null, bedrooms ?? null, bathrooms ?? null, sqft ?? null, notes ?? null],
    );

    // Track event
    trackEvent({
      user_id: userId,
      event: 'listing_favorite',
      properties: { listing_id, address, action: 'add' },
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to save listing:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/saved-listings/count
 * Return count of saved listings for dashboard stat.
 */
router.get('/count', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const result = await db.query(
      'SELECT COUNT(*)::int as count FROM saved_listings WHERE user_id = $1',
      [userId],
    );
    res.json({ success: true, count: result.rows[0]?.count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/saved-listings
 * Get user's saved listings with pagination. Includes full listing details if matched.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  try {
    const dataResult = await db.query(
      `SELECT sl.*,
              l.mls_number, l.status, l.structure_type,
              l.latitude, l.longitude,
              l.estimated_monthly_rent, l.cap_rate, l.gross_yield, l.cash_flow_monthly,
              (SELECT photo_url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo
       FROM saved_listings sl
       LEFT JOIN listings l ON sl.listing_id = l.id
       WHERE sl.user_id = $1
       ORDER BY sl.saved_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const countResult = await db.query(
      'SELECT COUNT(*)::int as total FROM saved_listings WHERE user_id = $1',
      [userId],
    );

    const total = countResult.rows[0]?.total ?? 0;

    res.json({
      success: true,
      data: {
        saved_listings: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/saved-listings/:listingId
 * Remove a saved listing.
 */
router.delete('/:listingId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const listingId = parseInt(req.params.listingId);
  if (isNaN(listingId)) {
    res.status(400).json({ success: false, error: 'Invalid listingId' });
    return;
  }

  try {
    const result = await db.query(
      'DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2 RETURNING *',
      [userId, listingId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Saved listing not found' });
      return;
    }

    // Track event
    trackEvent({
      user_id: userId,
      event: 'listing_favorite',
      properties: { listing_id: listingId, action: 'remove' },
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export const savedListingsRouter = router;