/**
 * Deal Desk API — submission, opportunity management, SLA sweep, exports.
 *
 * The canonical intent-routing layer: submissions become Opportunities,
 * every state change writes StatusHistory and an ActivityEvent, and the
 * email_triggers queue feeds downstream automation (Resend/Clyde).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { logger } from './logger';
import { trackEvent } from './event-tracking';
import { recomputeIntentForUser } from './intent';
import { computeDealScore, dealVerdict, intentBand } from './scoring';

const OPPORTUNITY_STATUSES = [
  'new', 'hot', 'warm', 'nurture', 'contacted', 'booked_call',
  'preapproval_started', 'buyer_agency_signed', 'showing_booked',
  'offer_submitted', 'closed', 'lost',
] as const;

const DEFAULT_ASSIGNEE = process.env.DEAL_DESK_DEFAULT_ASSIGNEE || 'dan';
const HOT_SLA_MINUTES = 30;

// Admin auth — same pattern as content-routes
function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.DEAL_DESK_API_KEY || process.env.CONTENT_API_KEY || process.env.RENT_API_KEY;

  if (!validApiKey) {
    res.status(401).json({ success: false, error: 'API key not configured' });
    return;
  }
  if (apiKey !== validApiKey) {
    res.status(401).json({ success: false, error: 'Invalid API key' });
    return;
  }
  next();
}

async function queueEmailTrigger(
  userId: number,
  opportunityId: number | null,
  triggerType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Partial unique index dedupes pending triggers per (user, type)
  await db.query(
    `INSERT INTO email_triggers (user_id, opportunity_id, trigger_type, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [userId, opportunityId, triggerType, JSON.stringify(payload)],
  );
}

export function createDealDeskRouter(): Router {
  const router = Router();

  /**
   * POST /api/deal-desk/submit
   * Public submission — creates/updates User, Deal, Opportunity, consent,
   * events, and the hot-lead email trigger in one flow.
   */
  router.post('/submit', async (req: Request, res: Response) => {
    const {
      name, email, phone, propertyAddress, listingUrl, market, propertyType,
      purchasePrice, estimatedRent, financingHelp, buyingHelp, notes,
      consentEmail, analysisId, sessionId, source,
    } = req.body;

    if (!email || !propertyAddress) {
      res.status(400).json({ success: false, error: 'email and propertyAddress are required' });
      return;
    }

    try {
      // 1. Upsert user by email
      const userResult = await db.query<{ id: number }>(
        `INSERT INTO users (email, full_name, phone)
         VALUES (LOWER($1), $2, $3)
         ON CONFLICT (email) DO UPDATE SET
           full_name = COALESCE(EXCLUDED.full_name, users.full_name),
           phone = COALESCE(EXCLUDED.phone, users.phone),
           updated_at = NOW()
         RETURNING id`,
        [email, name || null, phone || null],
      );
      const userId = userResult.rows[0].id;

      // 2. Consent ledger (CASL: record when/how consent was given)
      if (consentEmail !== undefined) {
        await db.query(
          `INSERT INTO email_consent (user_id, channel, status, source)
           VALUES ($1, 'email', $2, 'deal_desk_form')`,
          [userId, consentEmail ? 'granted' : 'revoked'],
        );
      }

      // 3. Attach or create the deal
      let dealId: number | null = null;
      let dealScore: number | null = null;

      if (analysisId) {
        const existing = await db.query<{ id: number; metrics: Record<string, unknown> | null }>(
          'SELECT id, metrics FROM deal_analyses WHERE id = $1',
          [analysisId],
        );
        if (existing.rows.length > 0) {
          dealId = existing.rows[0].id;
          // Claim anonymous analyses for this user
          await db.query(
            'UPDATE deal_analyses SET user_id = COALESCE(user_id, $1) WHERE id = $2',
            [userId, dealId],
          );
          const metrics = existing.rows[0].metrics || {};
          dealScore = computeDealScore({
            cashFlowMonthly: Number(metrics['cash_flow_monthly']) || null,
            dscr: Number(metrics['dscr']) || null,
            capRate: Number(metrics['cap_rate']) || null,
            askingPrice: Number(purchasePrice) || null,
            maxOfferPrice: Number(metrics['max_offer_price']) || null,
          });
        }
      }

      if (!dealId) {
        const dealResult = await db.query<{ id: number }>(
          `INSERT INTO deal_analyses (property_address, user_id, city, property_type, inputs)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            propertyAddress,
            userId,
            market || null,
            propertyType || null,
            JSON.stringify({
              listing_url: listingUrl || null,
              purchase_price: purchasePrice || null,
              estimated_rent: estimatedRent || null,
              submitted_via: 'deal_desk_form',
            }),
          ],
        );
        dealId = dealResult.rows[0].id;
      }

      if (dealScore !== null) {
        await db.query(
          'UPDATE deal_analyses SET deal_score = $1, verdict = $2 WHERE id = $3',
          [dealScore, dealVerdict(dealScore), dealId],
        );
      }

      // 4. Log the submission event (also fires webhook + intent recompute)
      await trackEvent({
        user_id: userId,
        deal_id: dealId,
        event: 'deal_submitted',
        properties: { source: source || 'deal_desk_form', market: market || null },
        session_id: sessionId || null,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      // 5. Create the opportunity
      const oppResult = await db.query<{ id: number }>(
        `INSERT INTO opportunities (user_id, deal_id, deal_score, status, assigned_to, source, financing_help, buying_help, notes)
         VALUES ($1, $2, $3, 'new', $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          userId, dealId, dealScore, DEFAULT_ASSIGNEE,
          source || 'deal_desk_form',
          Boolean(financingHelp), Boolean(buyingHelp),
          notes || null,
        ],
      );
      const opportunityId = oppResult.rows[0].id;

      await db.query(
        `INSERT INTO assignments (opportunity_id, assigned_to, assigned_by) VALUES ($1, $2, 'system')`,
        [opportunityId, DEFAULT_ASSIGNEE],
      );
      await db.query(
        `INSERT INTO status_history (opportunity_id, old_status, new_status, changed_by)
         VALUES ($1, NULL, 'new', 'system')`,
        [opportunityId],
      );

      // 6. Score intent now that the submission event exists
      const intent = await recomputeIntentForUser(userId);
      const score = intent?.score ?? 0;
      const band = intentBand(score);

      // 7. Hot leads get the immediate-followup trigger
      if (band === 'hot' && consentEmail) {
        await queueEmailTrigger(userId, opportunityId, 'hot_lead_immediate_followup', {
          property_address: propertyAddress,
          market: market || null,
          intent_score: score,
        });
      }

      res.json({
        success: true,
        data: {
          opportunityId,
          dealId,
          intentScore: score,
          band,
          dealScore,
          suggestedNextAction: intent?.nextAction ?? null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Deal Desk submission failed', { error: message });
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/deal-desk/opportunities
   * Admin queue — filterable by status/band/assignee, sorted by heat.
   */
  router.get('/opportunities', authenticateApiKey, async (req: Request, res: Response) => {
    const { status, band, assigned_to, limit = '100' } = req.query;

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (status) {
        conditions.push(`o.status = $${idx++}`);
        params.push(status as string);
      }
      if (assigned_to) {
        conditions.push(`o.assigned_to = $${idx++}`);
        params.push(assigned_to as string);
      }
      if (band === 'hot') conditions.push('o.intent_score >= 80');
      else if (band === 'warm') conditions.push('o.intent_score >= 50 AND o.intent_score < 80');
      else if (band === 'nurture') conditions.push('o.intent_score >= 20 AND o.intent_score < 50');

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(Math.min(Number(limit) || 100, 500));

      const result = await db.query(
        `SELECT
           o.id, o.intent_score, o.deal_score, o.status, o.assigned_to,
           o.suggested_next_action, o.source, o.financing_help, o.buying_help,
           o.lost_reason, o.notes, o.first_contacted_at, o.created_at, o.updated_at,
           u.id as user_id, u.full_name, u.email, u.phone,
           d.id as deal_id, d.property_address, d.city as market, d.verdict,
           (SELECT MAX(e.created_at) FROM user_events e WHERE e.user_id = u.id) as latest_activity,
           (o.intent_score >= 80 AND o.first_contacted_at IS NULL
             AND o.status IN ('new', 'hot')
             AND o.created_at < NOW() - INTERVAL '${HOT_SLA_MINUTES} minutes') as sla_breached
         FROM opportunities o
         JOIN users u ON u.id = o.user_id
         LEFT JOIN deal_analyses d ON d.id = o.deal_id
         ${where}
         ORDER BY o.intent_score DESC, o.created_at DESC
         LIMIT $${idx}`,
        params,
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/deal-desk/dashboard
   * Summary counts for the admin view.
   */
  router.get('/dashboard', authenticateApiKey, async (_req: Request, res: Response) => {
    try {
      const [counts, lostReasons, recentEvents, dealsThisWeek] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) FILTER (WHERE intent_score >= 80 AND status NOT IN ('closed','lost'))::int as hot,
             COUNT(*) FILTER (WHERE intent_score >= 50 AND intent_score < 80 AND status NOT IN ('closed','lost'))::int as warm,
             COUNT(*) FILTER (WHERE status = 'new')::int as new_submissions,
             COUNT(*) FILTER (WHERE status = 'booked_call')::int as calls_booked,
             COUNT(*) FILTER (WHERE status IN ('contacted','booked_call','preapproval_started','buyer_agency_signed','showing_booked','offer_submitted'))::int as active,
             COUNT(*) FILTER (WHERE status = 'closed')::int as closed,
             COUNT(*) FILTER (WHERE status = 'lost')::int as lost,
             COUNT(*) FILTER (WHERE intent_score >= 80 AND first_contacted_at IS NULL AND status IN ('new','hot') AND created_at < NOW() - INTERVAL '${HOT_SLA_MINUTES} minutes')::int as sla_breaches
           FROM opportunities`,
        ),
        db.query(
          `SELECT lost_reason, COUNT(*)::int as count FROM opportunities
           WHERE status = 'lost' AND lost_reason IS NOT NULL
           GROUP BY lost_reason ORDER BY count DESC`,
        ),
        db.query(
          `SELECT e.id, e.event, e.user_id, e.deal_id, e.created_at, u.email
           FROM user_events e LEFT JOIN users u ON u.id = e.user_id
           ORDER BY e.created_at DESC LIMIT 25`,
        ),
        db.query(
          `SELECT COUNT(*)::int as count FROM deal_analyses WHERE analyzed_at >= NOW() - INTERVAL '7 days'`,
        ),
      ]);

      res.json({
        success: true,
        data: {
          counts: counts.rows[0],
          deals_analyzed_7d: dealsThisWeek.rows[0]?.count ?? 0,
          lost_by_reason: lostReasons.rows,
          recent_events: recentEvents.rows,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * PATCH /api/deal-desk/opportunities/:id/status
   * Status changes write StatusHistory + crm_status_updated event.
   * Lost requires a reason — a lost opportunity without one is a wasted label.
   */
  router.patch('/opportunities/:id/status', authenticateApiKey, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, lostReason, changedBy } = req.body;

    if (!status || !OPPORTUNITY_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: `status must be one of: ${OPPORTUNITY_STATUSES.join(', ')}` });
      return;
    }
    if (status === 'lost' && !lostReason) {
      res.status(400).json({ success: false, error: 'lostReason is required when marking lost' });
      return;
    }

    try {
      const current = await db.query<{ status: string; user_id: number; deal_id: number | null; first_contacted_at: Date | null }>(
        'SELECT status, user_id, deal_id, first_contacted_at FROM opportunities WHERE id = $1',
        [id],
      );
      if (current.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Opportunity not found' });
        return;
      }
      const { status: oldStatus, user_id: userId, deal_id: dealId, first_contacted_at: firstContacted } = current.rows[0];

      const marksContact = ['contacted', 'booked_call', 'preapproval_started', 'buyer_agency_signed', 'showing_booked', 'offer_submitted', 'closed'].includes(status);

      await db.query(
        `UPDATE opportunities
         SET status = $1,
             lost_reason = $2,
             first_contacted_at = CASE WHEN $3 AND first_contacted_at IS NULL THEN NOW() ELSE first_contacted_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [status, status === 'lost' ? lostReason : null, marksContact && !firstContacted, id],
      );

      await db.query(
        `INSERT INTO status_history (opportunity_id, old_status, new_status, changed_by, lost_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, oldStatus, status, changedBy || 'admin', status === 'lost' ? lostReason : null],
      );

      await trackEvent({
        user_id: userId,
        deal_id: dealId,
        event: 'crm_status_updated',
        properties: { opportunity_id: Number(id), old_status: oldStatus, new_status: status, changed_by: changedBy || 'admin' },
      });

      if (status === 'lost') {
        await trackEvent({
          user_id: userId,
          deal_id: dealId,
          event: 'lost_reason_added',
          properties: { opportunity_id: Number(id), lost_reason: lostReason },
        });
        // Lost-with-reason feeds the nurture loop
        await queueEmailTrigger(userId, Number(id), 'lost_reason_nurture', { lost_reason: lostReason });
      }
      if (status === 'closed') {
        await trackEvent({
          user_id: userId,
          deal_id: dealId,
          event: 'closed',
          properties: { opportunity_id: Number(id) },
        });
      }

      res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /api/deal-desk/opportunities/:id/assign
   */
  router.post('/opportunities/:id/assign', authenticateApiKey, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assignedTo, assignedBy } = req.body;

    if (!assignedTo) {
      res.status(400).json({ success: false, error: 'assignedTo is required' });
      return;
    }

    try {
      const result = await db.query(
        'UPDATE opportunities SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [assignedTo, id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Opportunity not found' });
        return;
      }
      await db.query(
        'INSERT INTO assignments (opportunity_id, assigned_to, assigned_by) VALUES ($1, $2, $3)',
        [id, assignedTo, assignedBy || 'admin'],
      );
      res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /api/deal-desk/sweep
   * SLA + behavioural trigger sweep. Idempotent (pending-trigger dedupe) —
   * call from cron every 15 minutes.
   */
  router.post('/sweep', authenticateApiKey, async (_req: Request, res: Response) => {
    try {
      let created = 0;

      // 1. SLA breach: hot, uncontacted, past the clock → nag the assignee
      const breaches = await db.query<{ id: number; user_id: number; assigned_to: string | null }>(
        `SELECT id, user_id, assigned_to FROM opportunities
         WHERE intent_score >= 80 AND first_contacted_at IS NULL
           AND status IN ('new', 'hot')
           AND created_at < NOW() - INTERVAL '${HOT_SLA_MINUTES} minutes'`,
      );
      for (const b of breaches.rows) {
        await queueEmailTrigger(b.user_id, b.id, 'sla_breach_nag', { assigned_to: b.assigned_to, opportunity_id: b.id });
        created++;
      }

      // 2. Saved a deal, never submitted, 48h+
      const savedNoSubmit = await db.query<{ user_id: number }>(
        `SELECT DISTINCT e.user_id FROM user_events e
         WHERE e.event IN ('deal_saved', 'deal_analyzer_saved')
           AND e.created_at < NOW() - INTERVAL '48 hours'
           AND e.created_at > NOW() - INTERVAL '14 days'
           AND e.user_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM user_events s
             WHERE s.user_id = e.user_id AND s.event = 'deal_submitted' AND s.created_at > e.created_at
           )`,
      );
      for (const r of savedNoSubmit.rows) {
        await queueEmailTrigger(r.user_id, null, 'saved_deal_no_submit', {});
        created++;
      }

      // 3. Started underwriting, abandoned 24h+
      const abandoned = await db.query<{ user_id: number }>(
        `SELECT DISTINCT e.user_id FROM user_events e
         WHERE e.event IN ('model_run', 'deal_analyzer_start')
           AND e.created_at < NOW() - INTERVAL '24 hours'
           AND e.created_at > NOW() - INTERVAL '7 days'
           AND e.user_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM user_events s
             WHERE s.user_id = e.user_id
               AND s.event IN ('deal_saved', 'deal_analyzer_saved', 'deal_submitted')
               AND s.created_at > e.created_at
           )`,
      );
      for (const r of abandoned.rows) {
        await queueEmailTrigger(r.user_id, null, 'abandoned_underwriting', {});
        created++;
      }

      // 4. Financing interest signal
      const financing = await db.query<{ user_id: number }>(
        `SELECT DISTINCT user_id FROM user_events
         WHERE event = 'financing_changed'
           AND created_at > NOW() - INTERVAL '7 days'
           AND user_id IS NOT NULL`,
      );
      for (const r of financing.rows) {
        await queueEmailTrigger(r.user_id, null, 'financing_interest', {});
        created++;
      }

      res.json({ success: true, data: { triggers_created: created, sla_breaches: breaches.rows.length } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/deal-desk/export/:entity?format=csv|json
   * Exports for Clyde: users, deals, opportunities, events, triggers.
   */
  router.get('/export/:entity', authenticateApiKey, async (req: Request, res: Response) => {
    const { entity } = req.params;
    const format = (req.query.format as string) || 'json';

    const queries: Record<string, string> = {
      users: `SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
                (SELECT status FROM email_consent c WHERE c.user_id = u.id AND c.channel = 'email' ORDER BY c.created_at DESC LIMIT 1) as email_consent
              FROM users u ORDER BY u.created_at DESC LIMIT 10000`,
      deals: `SELECT id, property_address, user_id, city, province, property_type, deal_score, verdict, metrics, analyzed_at
              FROM deal_analyses ORDER BY analyzed_at DESC LIMIT 10000`,
      opportunities: `SELECT o.*, u.email FROM opportunities o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10000`,
      events: `SELECT id, user_id, deal_id, event, properties, session_id, created_at
               FROM user_events ORDER BY created_at DESC LIMIT 10000`,
      triggers: `SELECT id, user_id, opportunity_id, trigger_type, payload, status, created_at, sent_at
                 FROM email_triggers ORDER BY created_at DESC LIMIT 10000`,
    };

    const sql = queries[entity];
    if (!sql) {
      res.status(400).json({ success: false, error: `entity must be one of: ${Object.keys(queries).join(', ')}` });
      return;
    }

    try {
      const result = await db.query(sql);

      if (format === 'csv') {
        const rows = result.rows as Record<string, unknown>[];
        if (rows.length === 0) {
          res.type('text/csv').send('');
          return;
        }
        const headers = Object.keys(rows[0]);
        const escape = (v: unknown): string => {
          if (v === null || v === undefined) return '';
          const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
        res.type('text/csv').attachment(`${entity}.csv`).send(csv);
      } else {
        res.json({ success: true, data: result.rows });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

export default createDealDeskRouter();
