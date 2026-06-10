/**
 * Integration routes — per-user Google Sheets connection + export.
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { logger } from './logger';
import { authenticateToken, AuthRequest } from './auth-middleware';
import { trackEvent } from './event-tracking';
import {
  isGoogleConfigured,
  buildAuthUrl,
  verifyState,
  exchangeCodeAndStore,
  getConnection,
  disconnect,
  exportAnalysisToSheet,
} from './google-sheets';

const router = Router();

/**
 * GET /api/integrations/google/status
 */
router.get('/google/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!isGoogleConfigured()) {
      res.json({ success: true, data: { configured: false, connected: false } });
      return;
    }
    const connection = await getConnection(req.userId!);
    res.json({
      success: true,
      data: { configured: true, connected: Boolean(connection), email: connection?.externalEmail ?? null },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/integrations/google/auth-url
 * Returns the consent URL for THIS user (state is HMAC-signed).
 */
router.get('/google/auth-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!isGoogleConfigured()) {
      res.status(503).json({ success: false, error: 'Google OAuth is not configured (set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)' });
      return;
    }
    res.json({ success: true, data: { url: buildAuthUrl(req.userId!) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/integrations/google/callback
 * Google redirects here. State identifies + authenticates the user.
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect('/investor/analyses?google=denied');
    return;
  }
  const userId = typeof state === 'string' ? verifyState(state) : null;
  if (!userId || typeof code !== 'string') {
    res.status(400).send('Invalid or expired authorization state. Please try connecting again.');
    return;
  }

  try {
    await exchangeCodeAndStore(userId, code);
    res.redirect('/investor/analyses?google=connected');
  } catch (err) {
    logger.error('Google OAuth callback failed', { userId, error: err instanceof Error ? err.message : String(err) });
    res.redirect('/investor/analyses?google=error');
  }
});

/**
 * DELETE /api/integrations/google
 */
router.delete('/google', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await disconnect(req.userId!);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/integrations/google/export/:analysisId
 * Creates a spreadsheet in the user's own Drive from their analysis.
 */
router.post('/google/export/:analysisId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { analysisId } = req.params;
  const userId = req.userId!;

  try {
    const result = await db.query(
      `SELECT id, property_address, city, province, property_type, bedrooms, bathrooms, sqft,
              verdict_check, metrics, inputs, notes, analyzed_at
       FROM deal_analyses WHERE id = $1 AND user_id = $2`,
      [analysisId, userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Analysis not found' });
      return;
    }

    const analysis = result.rows[0] as Parameters<typeof exportAnalysisToSheet>[1];
    const spreadsheetUrl = await exportAnalysisToSheet(userId, analysis);

    await trackEvent({
      user_id: userId,
      deal_id: Number(analysisId),
      event: 'report_exported',
      properties: { destination: 'google_sheets', spreadsheet_url: spreadsheetUrl },
    });

    res.json({ success: true, data: { spreadsheetUrl } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not connected')) {
      res.status(409).json({ success: false, error: 'google_not_connected' });
      return;
    }
    logger.error('Sheets export failed', { userId, analysisId, error: message });
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
