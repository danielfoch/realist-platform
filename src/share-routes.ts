/**
 * Analysis sharing — share a deal analysis with someone by link/email.
 *
 * The recipient sees a teaser (address, city, verdict) without an account;
 * the full underwriting requires signing up. Acceptance links their new
 * account to the share, which is both an acquisition loop and an intent
 * signal for the owner's deal.
 */

import { randomBytes } from 'crypto';
import { Router, Response } from 'express';
import { db } from './db';
import { logger } from './logger';
import { authenticateToken, authenticateOptional, AuthRequest } from './auth-middleware';
import { trackEvent } from './event-tracking';

const router = Router();

function appBaseUrl(): string {
  return process.env.APP_BASE_URL || 'https://realist.ca';
}

/**
 * POST /api/shares
 * Body: { analysisId, recipientEmail? } — owner only.
 * Creates the share and queues the invite email.
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { analysisId, recipientEmail } = req.body;
  const userId = req.userId!;

  if (!analysisId) {
    res.status(400).json({ success: false, error: 'analysisId is required' });
    return;
  }

  try {
    const owned = await db.query<{ id: number; property_address: string }>(
      'SELECT id, property_address FROM deal_analyses WHERE id = $1 AND user_id = $2',
      [analysisId, userId],
    );
    if (owned.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Analysis not found' });
      return;
    }

    const token = randomBytes(24).toString('hex');
    const insert = await db.query<{ id: number }>(
      `INSERT INTO analysis_shares (analysis_id, owner_user_id, recipient_email, token)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [analysisId, userId, recipientEmail ? String(recipientEmail).toLowerCase() : null, token],
    );

    const shareUrl = `${appBaseUrl()}/shared/${token}`;

    if (recipientEmail) {
      // Invite email goes out via the email_triggers queue (Resend worker/Clyde)
      await db.query(
        `INSERT INTO email_triggers (user_id, trigger_type, payload)
         VALUES ($1, 'analysis_share_invite', $2)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          JSON.stringify({
            share_id: insert.rows[0].id,
            recipient_email: String(recipientEmail).toLowerCase(),
            share_url: shareUrl,
            property_address: owned.rows[0].property_address,
          }),
        ],
      );
    }

    await trackEvent({
      user_id: userId,
      deal_id: Number(analysisId),
      event: 'analysis_shared',
      properties: { share_id: insert.rows[0].id, has_recipient_email: Boolean(recipientEmail) },
    });

    res.json({ success: true, data: { shareUrl, token } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Share creation failed', { userId, analysisId, error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/shares
 * List shares created by the authenticated user.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.token, s.recipient_email, s.status, s.created_at, s.accepted_at,
              d.property_address, d.city
       FROM analysis_shares s
       JOIN deal_analyses d ON d.id = s.analysis_id
       WHERE s.owner_user_id = $1
       ORDER BY s.created_at DESC LIMIT 100`,
      [req.userId],
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * DELETE /api/shares/:id — revoke (owner only)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `UPDATE analysis_shares SET status = 'revoked' WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Share not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/shares/view/:token
 * Anonymous: teaser only (requiresAccount: true).
 * Authenticated: full analysis; first view marks the share accepted and
 * links the viewer's account.
 */
router.get('/view/:token', authenticateOptional, async (req: AuthRequest, res: Response) => {
  const { token } = req.params;

  try {
    const shareResult = await db.query<{
      id: number;
      analysis_id: number;
      owner_user_id: number;
      status: string;
    }>(
      `SELECT id, analysis_id, owner_user_id, status FROM analysis_shares WHERE token = $1`,
      [token],
    );
    if (shareResult.rows.length === 0 || shareResult.rows[0].status === 'revoked') {
      res.status(404).json({ success: false, error: 'Share not found or revoked' });
      return;
    }
    const share = shareResult.rows[0];

    const analysisResult = await db.query(
      `SELECT d.id, d.property_address, d.city, d.province, d.property_type, d.bedrooms,
              d.bathrooms, d.sqft, d.verdict_check, d.metrics, d.inputs, d.notes, d.analyzed_at,
              u.full_name as owner_name
       FROM deal_analyses d
       JOIN users u ON u.id = $2
       WHERE d.id = $1`,
      [share.analysis_id, share.owner_user_id],
    );
    if (analysisResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Analysis no longer exists' });
      return;
    }
    const a = analysisResult.rows[0] as Record<string, unknown>;

    const viewerId = req.userId || null;

    if (!viewerId) {
      // Account gate: teaser only
      res.json({
        success: true,
        data: {
          requiresAccount: true,
          preview: {
            propertyAddress: a.property_address,
            city: a.city,
            province: a.province,
            propertyType: a.property_type,
            verdict: a.verdict_check,
            ownerName: a.owner_name,
          },
        },
      });
      return;
    }

    if (share.status === 'pending' && viewerId !== share.owner_user_id) {
      await db.query(
        `UPDATE analysis_shares SET status = 'accepted', accepted_user_id = $1, accepted_at = NOW() WHERE id = $2`,
        [viewerId, share.id],
      );
      await trackEvent({
        user_id: viewerId,
        deal_id: share.analysis_id,
        event: 'share_accepted',
        properties: { share_id: share.id, owner_user_id: share.owner_user_id },
      });
    }

    res.json({
      success: true,
      data: {
        requiresAccount: false,
        analysis: {
          id: a.id,
          propertyAddress: a.property_address,
          city: a.city,
          province: a.province,
          propertyType: a.property_type,
          bedrooms: a.bedrooms,
          bathrooms: a.bathrooms,
          sqft: a.sqft,
          verdict: a.verdict_check,
          metrics: a.metrics || {},
          inputs: a.inputs || {},
          notes: a.notes,
          analyzedAt: a.analyzed_at,
          ownerName: a.owner_name,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Share view failed', { token, error: message });
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
