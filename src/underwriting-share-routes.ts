import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { db as defaultDb } from './db';
import { authenticateOptional, authenticateToken, AuthRequest } from './auth-middleware';

export type QualifiedShareAction = 'unique_open' | 'challenge' | 'fork' | 'signup' | 'saved_version';

type DatabaseAdapter = {
  query: (text: string, params?: readonly unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

interface QualifiedActionPolicy {
  creditAmount: number;
  dailyShareCap: number;
  dailyRecipientCap: number;
}

const ACTION_POLICIES: Record<QualifiedShareAction, QualifiedActionPolicy> = {
  unique_open: { creditAmount: 1, dailyShareCap: 5, dailyRecipientCap: 1 },
  challenge: { creditAmount: 2, dailyShareCap: 8, dailyRecipientCap: 2 },
  fork: { creditAmount: 3, dailyShareCap: 8, dailyRecipientCap: 2 },
  signup: { creditAmount: 5, dailyShareCap: 5, dailyRecipientCap: 1 },
  saved_version: { creditAmount: 4, dailyShareCap: 8, dailyRecipientCap: 2 },
};

const QUALIFIED_ACTIONS: QualifiedShareAction[] = [
  'unique_open',
  'challenge',
  'fork',
  'signup',
  'saved_version',
];

function randomToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export async function createUnderwritingShare(database: DatabaseAdapter, input: {
  analysisId: number | string;
  inviterUserId: number | null;
  source?: string;
  parentShareId?: number | null;
  parentShareActionId?: number | null;
  parentShareDepth?: number | null;
}) {
  const token = randomToken();
  const source = hasNonEmptyString(input.source) ? input.source.trim().slice(0, 64) : 'analysis';
  const parentShareId = input.parentShareId || null;
  const parentShareActionId = input.parentShareActionId || null;
  const shareDepth = parentShareId ? Number(input.parentShareDepth || 0) + 1 : 0;

  const created = await database.query(
    `INSERT INTO underwriting_shares (
       analysis_id, inviter_user_id, token, status, source, parent_share_id, parent_share_action_id, share_depth
     ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
     RETURNING id, token, share_depth`,
    [input.analysisId, input.inviterUserId, token, source, parentShareId, parentShareActionId, shareDepth],
  );

  const row = created.rows[0];
  return {
    id: row.id,
    token: row.token,
    shareDepth: Number(row.share_depth || shareDepth),
    shareUrl: `/underwriting/${row.token}`,
    cta: 'Challenge my underwriting.',
    rewardPolicy: getRewardPolicySnapshot(),
  };
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function getRecipientHash(req: Request, explicitRecipient?: string) {
  const visitor = typeof explicitRecipient === 'string' && explicitRecipient.trim()
    ? explicitRecipient.trim().toLowerCase()
    : `${getClientIp(req)}:${req.headers['user-agent'] || 'unknown'}`;

  return sha256(visitor);
}

export function getActionPolicy(action: QualifiedShareAction) {
  return ACTION_POLICIES[action];
}

export function getRewardPolicySnapshot() {
  return Object.fromEntries(
    QUALIFIED_ACTIONS.map((action) => [action, ACTION_POLICIES[action]]),
  ) as Record<QualifiedShareAction, QualifiedActionPolicy>;
}

function isQualifiedShareAction(action: string): action is QualifiedShareAction {
  return Object.prototype.hasOwnProperty.call(ACTION_POLICIES, action);
}

function hasObjectKeys(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function hasNonEmptyString(value: unknown, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength;
}

export function hasMeaningfulChallengePayload(action: QualifiedShareAction, metadata: unknown) {
  if (action === 'unique_open' || action === 'signup') {
    return true;
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const payload = metadata as Record<string, unknown>;
  const challengedFields = payload.challengedFields;
  const challengedFieldCount = Array.isArray(challengedFields)
    ? challengedFields.filter((field) => hasNonEmptyString(field)).length
    : 0;

  return (
    challengedFieldCount > 0
    || hasObjectKeys(payload.assumptions)
    || hasObjectKeys(payload.inputs)
    || hasObjectKeys(payload.metrics)
    || hasNonEmptyString(payload.comment, 10)
    || hasNonEmptyString(payload.notes, 10)
  );
}

async function countDailyShareActions(database: DatabaseAdapter, shareId: number, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM underwriting_share_actions
     WHERE share_id = $1 AND action = $2 AND qualified = true AND created_at >= CURRENT_DATE`,
    [shareId, action],
  );

  return Number(result.rows[0]?.count || 0);
}

async function countDailyRecipientActions(database: DatabaseAdapter, recipientHash: string, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM underwriting_share_actions
     WHERE recipient_hash = $1 AND action = $2 AND qualified = true AND created_at >= CURRENT_DATE`,
    [recipientHash, action],
  );

  return Number(result.rows[0]?.count || 0);
}

async function findExistingAction(database: DatabaseAdapter, shareId: number, recipientHash: string, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT id, qualified, credit_amount
     FROM underwriting_share_actions
     WHERE share_id = $1 AND recipient_hash = $2 AND action = $3
     LIMIT 1`,
    [shareId, recipientHash, action],
  );

  return result.rows[0] || null;
}

export async function recordQualifiedShareAction(database: DatabaseAdapter, input: {
  shareId: number;
  inviterUserId: number | null;
  action: QualifiedShareAction;
  recipientHash: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findExistingAction(database, input.shareId, input.recipientHash, input.action);
  if (existing) {
    return {
      status: 'duplicate' as const,
      qualified: Boolean(existing.qualified),
      creditAmount: Number(existing.credit_amount || 0),
    };
  }

  const policy = ACTION_POLICIES[input.action];
  const [shareActionCount, recipientActionCount] = await Promise.all([
    countDailyShareActions(database, input.shareId, input.action),
    countDailyRecipientActions(database, input.recipientHash, input.action),
  ]);

  const qualified = shareActionCount < policy.dailyShareCap && recipientActionCount < policy.dailyRecipientCap;
  const creditAmount = qualified ? policy.creditAmount : 0;
  const status = qualified ? 'qualified' : 'capped';

  const result = await database.query(
    `INSERT INTO underwriting_share_actions (
       share_id, action, recipient_hash, qualified, credit_type, credit_amount, metadata
     ) VALUES ($1, $2, $3, $4, 'google_sheets_export', $5, $6)
     RETURNING id`,
    [input.shareId, input.action, input.recipientHash, qualified, creditAmount, input.metadata || {}],
  );

  const actionId = result.rows[0]?.id;

  if (qualified && input.inviterUserId && creditAmount > 0) {
    await database.query(
      `INSERT INTO premium_credit_ledger (
         user_id, share_id, share_action_id, credit_type, credit_amount, reason
       ) VALUES ($1, $2, $3, 'google_sheets_export', $4, $5)`,
      [input.inviterUserId, input.shareId, actionId, creditAmount, `Qualified underwriting share action: ${input.action}`],
    );
  }

  await database.query(
    `UPDATE underwriting_shares
     SET qualified_action_count = qualified_action_count + $2,
         credit_awarded = credit_awarded + $3,
         last_qualified_action_at = CASE WHEN $2 = 1 THEN NOW() ELSE last_qualified_action_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [input.shareId, qualified ? 1 : 0, creditAmount],
  );

  return { status, qualified, creditAmount, actionId };
}

export async function getShareActionSummary(database: DatabaseAdapter, shareId: number, recentLimit = 10) {
  const summaryResult = await database.query(
    `SELECT action,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE qualified = true)::int AS qualified_count,
            COUNT(*) FILTER (WHERE qualified = false)::int AS capped_count,
            COALESCE(SUM(credit_amount), 0)::int AS credit_awarded,
            MAX(created_at) AS last_action_at
     FROM underwriting_share_actions
     WHERE share_id = $1
     GROUP BY action`,
    [shareId],
  );

  const byAction = Object.fromEntries(
    QUALIFIED_ACTIONS.map((action) => [
      action,
      {
        totalCount: 0,
        qualifiedCount: 0,
        cappedCount: 0,
        creditAwarded: 0,
        lastActionAt: null as string | null,
      },
    ]),
  ) as Record<QualifiedShareAction, {
    totalCount: number;
    qualifiedCount: number;
    cappedCount: number;
    creditAwarded: number;
    lastActionAt: string | null;
  }>;

  for (const row of summaryResult.rows) {
    if (!isQualifiedShareAction(row.action)) {
      continue;
    }

    byAction[row.action] = {
      totalCount: Number(row.total_count || 0),
      qualifiedCount: Number(row.qualified_count || 0),
      cappedCount: Number(row.capped_count || 0),
      creditAwarded: Number(row.credit_awarded || 0),
      lastActionAt: row.last_action_at || null,
    };
  }

  const recentResult = await database.query(
    `SELECT id, action, qualified, credit_type, credit_amount, metadata, created_at
     FROM underwriting_share_actions
     WHERE share_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [shareId, recentLimit],
  );

  return {
    byAction,
    totals: Object.values(byAction).reduce(
      (totals, actionSummary) => ({
        totalCount: totals.totalCount + actionSummary.totalCount,
        qualifiedCount: totals.qualifiedCount + actionSummary.qualifiedCount,
        cappedCount: totals.cappedCount + actionSummary.cappedCount,
        creditAwarded: totals.creditAwarded + actionSummary.creditAwarded,
      }),
      { totalCount: 0, qualifiedCount: 0, cappedCount: 0, creditAwarded: 0 },
    ),
    recentActions: recentResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      qualified: Boolean(row.qualified),
      creditType: row.credit_type,
      creditAmount: Number(row.credit_amount || 0),
      metadata: row.metadata || {},
      createdAt: row.created_at,
    })),
  };
}

export function createUnderwritingShareRouter(database: DatabaseAdapter = defaultDb): Router {
  const router = Router();

  router.post('/analyses/:id/share', authenticateOptional, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId || null;
      const result = await database.query(
        `SELECT id, user_id FROM deal_analyses WHERE id = $1 AND ($2::int IS NULL OR user_id = $2)`,
        [id, userId],
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: 'Analysis not found' });
        return;
      }

      const created = await createUnderwritingShare(database, {
        analysisId: id,
        inviterUserId: userId,
        source: req.body?.source || 'analysis',
      });

      res.json({
        success: true,
        shareId: created.id,
        token: created.token,
        shareUrl: created.shareUrl,
        cta: created.cta,
        shareDepth: created.shareDepth,
        rewardPolicy: created.rewardPolicy,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/underwriting-shares/:token', async (req: Request, res: Response) => {
    try {
      const result = await database.query(
        `SELECT s.id, s.token, s.status, s.analysis_id, s.inviter_user_id,
                a.property_address, a.metrics, a.inputs, a.verdict_check, a.notes, a.city, a.province
         FROM underwriting_shares s
         JOIN deal_analyses a ON a.id = s.analysis_id
         WHERE s.token = $1`,
        [req.params.token],
      );

      const row = result.rows[0];
      if (!row || row.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const recipientHash = getRecipientHash(req, req.query.recipient as string | undefined);
      const open = await recordQualifiedShareAction(database, {
        shareId: row.id,
        inviterUserId: row.inviter_user_id,
        action: 'unique_open',
        recipientHash,
        metadata: { referrer: req.headers.referer || null },
      });

      res.json({
        token: row.token,
        cta: 'Challenge my underwriting.',
        analysis: {
          id: row.analysis_id,
          propertyAddress: row.property_address,
          city: row.city,
          province: row.province,
          metrics: row.metrics || {},
          inputs: row.inputs || {},
          verdictCheck: row.verdict_check,
          notes: row.notes,
        },
        visitorQualification: open,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/underwriting-shares/:token/actions', authenticateOptional, async (req: AuthRequest, res: Response) => {
    try {
      const { action, recipient, metadata } = req.body || {};
      if (!isQualifiedShareAction(action) || action === 'unique_open') {
        res.status(400).json({ error: 'A qualified action is required: challenge, fork, signup, saved_version' });
        return;
      }

      if (!hasMeaningfulChallengePayload(action, metadata)) {
        res.status(400).json({
          error: 'Challenge/fork actions need changed assumptions, challenged fields, metrics, inputs, notes, or a comment before credits can qualify',
        });
        return;
      }

      const shareResult = await database.query(
        `SELECT id, inviter_user_id, analysis_id, status, share_depth FROM underwriting_shares WHERE token = $1`,
        [req.params.token],
      );
      const share = shareResult.rows[0];
      if (!share || share.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const recorded = await recordQualifiedShareAction(database, {
        shareId: share.id,
        inviterUserId: share.inviter_user_id,
        action,
        recipientHash: getRecipientHash(req, recipient),
        metadata: { ...(metadata || {}), userId: req.userId || null },
      });

      let savedAnalysisId: number | null = null;
      let onwardShare: Awaited<ReturnType<typeof createUnderwritingShare>> | null = null;

      if (recorded.status === 'qualified' && (action === 'fork' || action === 'saved_version') && req.userId) {
        const source = await database.query(`SELECT * FROM deal_analyses WHERE id = $1`, [share.analysis_id]);
        const sourceAnalysis = source.rows[0];
        if (sourceAnalysis) {
          const saved = await database.query(
            `INSERT INTO deal_analyses (
               property_address, user_id, metrics, inputs, verdict_check, listing_id, city, province,
               property_type, bedrooms, bathrooms, sqft, year_built, matched_listing, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [
              sourceAnalysis.property_address,
              req.userId,
              metadata?.metrics || sourceAnalysis.metrics,
              metadata?.inputs || sourceAnalysis.inputs,
              metadata?.verdictCheck || sourceAnalysis.verdict_check,
              sourceAnalysis.listing_id,
              sourceAnalysis.city,
              sourceAnalysis.province,
              sourceAnalysis.property_type,
              sourceAnalysis.bedrooms,
              sourceAnalysis.bathrooms,
              sourceAnalysis.sqft,
              sourceAnalysis.year_built,
              sourceAnalysis.matched_listing,
              metadata?.notes || `Forked via “Challenge my underwriting.” share ${req.params.token}`,
            ],
          );
          savedAnalysisId = saved.rows[0]?.id || null;

          if (savedAnalysisId) {
            onwardShare = await createUnderwritingShare(database, {
              analysisId: savedAnalysisId,
              inviterUserId: req.userId,
              source: `challenger_${action}`,
              parentShareId: share.id,
              parentShareActionId: recorded.actionId || null,
              parentShareDepth: Number(share.share_depth || 0),
            });

            if (recorded.actionId) {
              await database.query(
                `UPDATE underwriting_share_actions
                 SET metadata = metadata || $2::jsonb
                 WHERE id = $1`,
                [recorded.actionId, { savedAnalysisId, onwardShareId: onwardShare.id, onwardShareToken: onwardShare.token }],
              );
            }
          }
        }
      }

      res.json({ success: true, ...recorded, savedAnalysisId, onwardShare });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/underwriting-shares/:token/status', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const result = await database.query(
        `SELECT id, token, status, qualified_action_count, credit_awarded, last_qualified_action_at,
                parent_share_id, parent_share_action_id, share_depth
         FROM underwriting_shares
         WHERE token = $1 AND inviter_user_id = $2`,
        [req.params.token, req.userId],
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const share = result.rows[0];
      const actionSummary = await getShareActionSummary(database, share.id);

      res.json({
        ...share,
        cta: 'Challenge my underwriting.',
        shareUrl: `/underwriting/${share.token}`,
        rewardPolicy: getRewardPolicySnapshot(),
        actionSummary,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export default createUnderwritingShareRouter;
