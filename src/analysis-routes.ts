/**
 * Deal Analysis Persistence API Routes
 * Implements Non-Negotiable #4: Analysis Memory
 * Preserves investor underwriting activity so the system remembers what users analyze.
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { logger } from './logger';
import { authenticateToken, authenticateOptional, AuthRequest } from './auth-middleware';

const router = Router();

interface SaveAnalysisBody {
  propertyAddress: string;
  metrics?: Record<string, number | string>;
  inputs?: Record<string, number | string>;
  verdictCheck?: string;
  listingId?: string;
  city?: string;
  province?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  matchedListing?: boolean;
  notes?: string;
}

/**
 * POST /api/analyses
 * Save a deal analysis to user history (open — anonymous or authenticated)
 */
router.post('/', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const { propertyAddress, metrics, inputs, verdictCheck, listingId, city, province, propertyType, bedrooms, bathrooms, sqft, yearBuilt, matchedListing, notes } = req.body;

    if (!propertyAddress) {
      res.status(400).json({ error: 'Property address is required' });
      return;
    }

    // Metrics validation is optional — we don't block saving just because metrics are incomplete
    if (metrics && typeof metrics !== 'object') {
      logger.debug('Invalid metrics for analysis persistence', { metrics: JSON.stringify(metrics) });
    }

    const userId = req.userId || null;

    const result = await db.query(
      `INSERT INTO deal_analyses (
        property_address, user_id, metrics, inputs, verdict_check,
        listing_id, city, province, property_type, bedrooms,
        bathrooms, sqft, year_built, matched_listing, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        propertyAddress,
        userId,
        metrics ? metrics : null,
        inputs ? inputs : null,
        verdictCheck || '✅ Strong',
        listingId,
        city,
        province,
        propertyType,
        bedrooms,
        bathrooms,
        sqft,
        yearBuilt,
        matchedListing,
        notes || null,
      ]
    );

    const analysisId = (result.rows as any[])[0].id;
    res.json({ success: true, analysisId });
    logger.debug('Analysis saved', { analysisId, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/analyses
 * List analyses for the authenticated user, ordered by recency
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await db.query(
      `SELECT id, property_address, metrics, inputs, verdict_check, listing_id, city, property_type, bedrooms, sqft, year_built, analyzed_at
       FROM deal_analyses
       WHERE user_id = $1
       ORDER BY analyzed_at DESC
       LIMIT 50`,
      [userId],
    );

    const analyses = (result.rows as any[]).map((row) => ({
      id: row.id,
      propertyAddress: row.property_address,
      city: row.city,
      propertyType: row.property_type,
      listingId: row.listing_id,
      bedrooms: row.bedrooms,
      sqft: row.sqft,
      yearBuilt: row.year_built,
      metrics: row.metrics || {},
      inputs: row.inputs || {},
      notes: row.notes || null,
      analyzedAt: row.analyzed_at,
    }));

    res.json(analyses);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/analyses/:id
 * Retrieve a single analysis by ID (authenticated, user-scoped)
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await db.query(
      `SELECT * FROM deal_analyses WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if ((result as any).rowCount > 0) {
      const row = (result.rows as any[])[0];
      const analysis = {
        id: row.id,
        propertyAddress: row.property_address,
        city: row.city,
        province: row.province,
        propertyType: row.property_type,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        sqft: row.sqft,
        yearBuilt: row.year_built,
        metrics: row.metrics || {},
        inputs: row.inputs || {},
        notes: row.notes || null,
        analyzedAt: row.analyzed_at,
      };
      res.json(analysis);
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/analyses/:id/notes
 * Update notes on an existing analysis (authenticated, owner-only)
 */
router.patch('/:id/notes', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (notes === undefined) {
      res.status(400).json({ error: 'Notes field is required' });
      return;
    }

    const result = await db.query(
      `UPDATE deal_analyses SET notes = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
      [notes, id, userId],
    );

    if ((result as any).rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/analyses/:id
 * Remove an analysis from history (authenticated, owner-only)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await db.query(
      `DELETE FROM deal_analyses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId],
    );

    if ((result as any).rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
