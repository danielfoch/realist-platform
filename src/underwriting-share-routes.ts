import { createHash, randomUUID } from 'crypto';
import { Router, Response } from 'express';
import { db } from './db';
import { authenticateOptional, AuthRequest } from './auth-middleware';
import { decideShareReward, normalizeVisitorKey } from './underwriting-share-rewards';

const router = Router();

function hashRecipient(recipientEmail?: string): string | null {
  const normalized = recipientEmail?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return createHash('sha256').update(normalized).digest('hex');
}

async function countCreditedActionsToday(shareId: number): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM underwriting_share_actions
     WHERE share_id = $1
       AND credit_delta > 0
       AND created_at >= date_trunc('day', NOW())`,
    [shareId],
  );

  return Number.parseInt(result.rows[0]?.count || '0', 10);
}

async function recordShareAction(input: {
  shareId: number;
  actionType: string;
  visitorKey: string | null;
  recipientEmailHash: string | null;
  actorUserId: number | null;
  metadata?: Record<string, unknown>;
}) {
  const alreadyTrackedToday = await countCreditedActionsToday(input.shareId);
  const decision = decideShareReward({ ...input, alreadyTrackedToday });

  const duplicateCheck = await db.query<{ id: number }>(
    `SELECT id
     FROM underwriting_share_actions
     WHERE share_id = $1
       AND action_type = $2
       AND COALESCE(visitor_key, '') = COALESCE($3, '')
       AND COALESCE(recipient_email_hash, '') = COALESCE($4, '')
       AND COALESCE(actor_user_id, 0) = COALESCE($5, 0)
     LIMIT 1`,
    [input.shareId, input.actionType, input.visitorKey, input.recipientEmailHash, input.actorUserId],
  );

  const finalDecision = duplicateCheck.rows.length > 0
    ? { ...decision, creditDelta: 0, status: 'duplicate' as const, reason: 'Duplicate qualified action already tracked for this visitor/recipient.' }
    : decision;

  await db.query(
    `INSERT INTO underwriting_share_actions (
       share_id, action_type, visitor_key, recipient_email_hash, actor_user_id,
       qualified, status, credit_delta, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.shareId,
      input.actionType,
      input.visitorKey,
      input.recipientEmailHash,
      input.actorUserId,
      finalDecision.qualified,
      finalDecision.status,
      finalDecision.creditDelta,
      input.metadata || {},
    ],
  );

  if (finalDecision.creditDelta > 0) {
    await db.query(
      `UPDATE underwriting_shares
       SET qualified_action_count = qualified_action_count + 1,
           export_credit_balance = export_credit_balance + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [finalDecision.creditDelta, input.shareId],
    );
  }

  return finalDecision;
}

router.post('/analyses/:id/share', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(analysisId)) {
      res.status(400).json({ error: 'Valid analysis id is required' });
      return;
    }

    const userId = req.userId || null;
    const recipientEmailHash = hashRecipient(req.body?.recipientEmail);
    const token = randomUUID();

    const analysis = await db.query<{ id: number; user_id: number | null; property_address: string }>(
      `SELECT id, user_id, property_address
       FROM deal_analyses
       WHERE id = $1 AND ($2::int IS NULL OR user_id = $2 OR user_id IS NULL)
       LIMIT 1`,
      [analysisId, userId],
    );

    if (analysis.rows.length === 0) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const result = await db.query<{ id: number }>(
      `INSERT INTO underwriting_shares (
         analysis_id, owner_user_id, share_token, recipient_email_hash, cta, reward_status
       ) VALUES ($1, $2, $3, $4,
         'Challenge my underwriting.', 'pending')
       RETURNING id`,
      [analysisId, userId, token, recipientEmailHash],
    );

    res.json({
      success: true,
      shareId: result.rows[0].id,
      shareToken: token,
      cta: 'Challenge my underwriting.',
      shareUrl: `/underwriting/challenge/${token}`,
      rewardRules: {
        rawClicks: 'tracked only; no credits',
        qualifiedActions: ['unique_open', 'fork_challenge', 'signup', 'saved_version'],
        dailyCreditCap: 5,
        premiumCreditUse: 'Google Sheets export credits',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/underwriting-shares/:token', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const share = await db.query<{
      id: number;
      analysis_id: number;
      property_address: string;
      metrics: Record<string, unknown> | null;
      inputs: Record<string, unknown> | null;
      notes: string | null;
    }>(
      `SELECT s.id, s.analysis_id, a.property_address, a.metrics, a.inputs, a.notes
       FROM underwriting_shares s
       JOIN deal_analyses a ON a.id = s.analysis_id
       WHERE s.share_token = $1
       LIMIT 1`,
      [req.params.token],
    );

    if (share.rows.length === 0) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    const row = share.rows[0];
    const visitorKey = normalizeVisitorKey({
      visitorId: req.header('x-realist-visitor-id'),
      ip: req.ip,
      userAgent: req.header('user-agent'),
      actorUserId: req.userId || null,
    });

    const reward = await recordShareAction({
      shareId: row.id,
      actionType: 'unique_open',
      visitorKey,
      recipientEmailHash: null,
      actorUserId: req.userId || null,
      metadata: { source: 'share_open' },
    });

    res.json({
      success: true,
      cta: 'Challenge my underwriting.',
      analysis: {
        id: row.analysis_id,
        propertyAddress: row.property_address,
        metrics: row.metrics || {},
        inputs: row.inputs || {},
        notes: row.notes,
      },
      reward,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/underwriting-shares/:token/challenges', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const share = await db.query<{ id: number; analysis_id: number }>(
      `SELECT id, analysis_id FROM underwriting_shares WHERE share_token = $1 LIMIT 1`,
      [req.params.token],
    );

    if (share.rows.length === 0) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    const visitorKey = normalizeVisitorKey({
      visitorId: req.header('x-realist-visitor-id'),
      ip: req.ip,
      userAgent: req.header('user-agent'),
      actorUserId: req.userId || null,
    });

    const shouldSaveVersion = Boolean(req.body?.savedVersion && req.userId);
    const challengeType = shouldSaveVersion ? 'saved_version' : 'fork_challenge';
    let savedAnalysisId: number | null = null;

    if (shouldSaveVersion) {
      const saved = await db.query<{ id: number }>(
        `INSERT INTO deal_analyses (
           property_address, user_id, metrics, inputs, verdict_check,
           listing_id, city, province, property_type, bedrooms, bathrooms,
           sqft, year_built, matched_listing, notes
         )
         SELECT
           property_address, $2,
           COALESCE($3::jsonb, metrics),
           COALESCE($4::jsonb, inputs),
           verdict_check, listing_id, city, province, property_type, bedrooms,
           bathrooms, sqft, year_built, matched_listing,
           COALESCE($5::text, notes)
         FROM deal_analyses
         WHERE id = $1
         RETURNING id`,
        [
          share.rows[0].analysis_id,
          req.userId,
          req.body?.metrics ? JSON.stringify(req.body.metrics) : null,
          req.body?.inputs ? JSON.stringify(req.body.inputs) : null,
          req.body?.comment || null,
        ],
      );
      savedAnalysisId = saved.rows[0]?.id || null;
    }

    const reward = await recordShareAction({
      shareId: share.rows[0].id,
      actionType: challengeType,
      visitorKey,
      recipientEmailHash: hashRecipient(req.body?.recipientEmail),
      actorUserId: req.userId || null,
      metadata: {
        challengedInputs: req.body?.inputs || {},
        comment: req.body?.comment || null,
      },
    });

    res.json({
      success: true,
      cta: 'Challenge my underwriting.',
      reward,
      savedAnalysisId,
      nextStep: req.userId ? 'Share this challenged version onward.' : 'Create an account to save this version and share it onward.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
