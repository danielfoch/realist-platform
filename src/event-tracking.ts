/**
 * Server-side event tracking for key user actions.
 * Stores events in PostgreSQL and exposes a query API.
 */

import { createHmac } from 'crypto';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { Request, Response } from 'express';
import { db } from './db';
import { logger } from './logger';
import { recomputeIntentForUser } from './intent';

// ---------- Types ----------

export type EventName =
  | 'page_view'
  | 'signup_started'
  | 'signup_completed'
  | 'login'
  | 'logout'
  | 'listing_search'
  | 'listing_view'
  | 'listing_favorite'
  | 'deal_analyzer_start'
  | 'deal_analyzer_report_generated'
  | 'deal_analyzer_saved'
  | 'lead_form_started'
  | 'lead_form_submitted'
  | 'realtor_signup_started'
  | 'realtor_signup_completed'
  | 'realtor_market_claimed'
  | 'realtor_lead_claimed'
  | 'subscription_checkout_started'
  | 'subscription_completed'
  | 'subscription_canceled'
  // Deal Desk loop vocabulary
  | 'model_run'
  | 'assumption_edited'
  | 'deal_saved'
  | 'deal_rejected'
  | 'report_exported'
  | 'financing_changed'
  | 'market_researched'
  | 'return_threshold_hit'
  | 'deal_desk_cta_clicked'
  | 'deal_submitted'
  | 'buyer_rep_requested'
  | 'referral_requested'
  | 'document_sent'
  | 'document_signed'
  | 'call_booked'
  | 'offer_recommended'
  | 'offer_drafted'
  | 'offer_submitted'
  | 'crm_status_updated'
  | 'lost_reason_added'
  | 'closed'
  | 'cashback_due'
  | 'analysis_shared'
  | 'share_accepted';

/** Events that affect intent scoring — recompute on insert. */
const SCORING_EVENTS = new Set<string>([
  'model_run',
  'assumption_edited',
  'deal_saved',
  'deal_rejected',
  'report_exported',
  'financing_changed',
  'market_researched',
  'return_threshold_hit',
  'deal_desk_cta_clicked',
  'deal_submitted',
  'buyer_rep_requested',
  'referral_requested',
  'call_booked',
  'analysis_shared',
  'share_accepted',
]);

export interface TrackEventInput {
  user_id?: number | null;
  deal_id?: number | null;
  event: EventName;
  properties?: Record<string, unknown> | null;
  session_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
}

// ---------- Outbound webhook (downstream automations / Clyde) ----------

function emitWebhook(input: TrackEventInput): void {
  const url = process.env.REALIST_WEBHOOK_URL;
  if (!url) return;

  try {
    const body = JSON.stringify({
      type: 'activity_event',
      event: input.event,
      user_id: input.user_id ?? null,
      deal_id: input.deal_id ?? null,
      session_id: input.session_id ?? null,
      properties: input.properties ?? null,
      emitted_at: new Date().toISOString(),
    });

    const secret = process.env.REALIST_WEBHOOK_SECRET || '';
    const signature = secret ? createHmac('sha256', secret).update(body).digest('hex') : '';

    const target = new URL(url);
    const makeRequest = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = makeRequest(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(signature ? { 'X-Realist-Signature': `sha256=${signature}` } : {}),
        },
        timeout: 5000,
      },
      (res) => res.resume(),
    );
    req.on('error', (err) => logger.warn('Webhook emit failed', { error: err.message }));
    req.on('timeout', () => req.destroy());
    req.write(body);
    req.end();
  } catch (err) {
    logger.warn('Webhook emit failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

// ---------- Core tracking ----------

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO user_events (user_id, deal_id, event, properties, session_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.user_id ?? null,
        input.deal_id ?? null,
        input.event,
        input.properties ? JSON.stringify(input.properties) : null,
        input.session_id ?? null,
        input.ip_address ?? null,
        input.user_agent ?? null,
        input.referrer ?? null,
      ],
    );

    emitWebhook(input);

    // Scoring-relevant events keep open opportunities' intent_score live
    if (input.user_id && SCORING_EVENTS.has(input.event)) {
      void recomputeIntentForUser(input.user_id);
    }
  } catch (err) {
    // Never fail the request because of tracking
    logger.error('Failed to track event', {
      event: input.event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------- Express middleware to auto-track page views ----------

export function eventTrackingMiddleware() {
  return (req: Request, _res: Response, next: () => void) => {
    // Will be used by the /track endpoint — nothing to do on every request
    next();
  };
}

// ---------- REST handlers ----------

/**
 * POST /api/events/track
 * Public-facing endpoint called from the frontend.
 */
export async function handleTrackEvent(req: Request, res: Response): Promise<void> {
  const { event, properties, session_id, deal_id, user_id } = req.body;

  if (!event) {
    res.status(400).json({ success: false, error: 'event is required' });
    return;
  }

  const userId = (req as any).user?.id ?? (typeof user_id === 'number' ? user_id : null);
  const ip = req.ip || req.socket.remoteAddress || null;

  await trackEvent({
    user_id: userId,
    deal_id: typeof deal_id === 'number' ? deal_id : null,
    event: event as EventName,
    properties: properties ?? null,
    session_id: session_id ?? null,
    ip_address: ip,
    user_agent: req.headers['user-agent'] || null,
    referrer: req.headers['referer'] || null,
  });

  res.json({ success: true });
}

/**
 * GET /api/events
 * Admin endpoint — query events with filters.
 */
export async function handleGetEvents(req: Request, res: Response): Promise<void> {
  const { event, user_id, limit = '100', offset = '0' } = req.query;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (event) {
      conditions.push(`event = $${idx++}`);
      params.push(event as string);
    }
    if (user_id) {
      conditions.push(`user_id = $${idx++}`);
      params.push(Number(user_id));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(Number(limit), Number(offset));

    const result = await db.query(
      `SELECT id, user_id, event, properties, session_id, ip_address, created_at
       FROM user_events ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM user_events ${where}`,
      params.slice(0, -2),
    );

    res.json({
      success: true,
      data: {
        events: result.rows,
        total: countResult.rows[0]?.total ?? 0,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/events/summary
 * Returns aggregate counts by event name for a date range.
 */
export async function handleGetEventSummary(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(from as string);
    }
    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(to as string);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT event, COUNT(*)::int as count, COUNT(DISTINCT user_id)::int as unique_users
       FROM user_events ${where}
       GROUP BY event
       ORDER BY count DESC`,
      params,
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
}

export async function handleGetBroadcastStats(req: Request, res: Response) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [eventsResult, dealsResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int as count FROM user_events
         WHERE event IN ('deal_analyzer_report_generated', 'model_run')
         AND created_at >= $1`,
        [weekAgo.toISOString()]
      ),
      db.query(
        `SELECT
           COUNT(*)::int as total_deals,
           AVG((metrics->>'cap_rate')::float)::float as avg_cap_rate,
           AVG((metrics->>'irr')::float)::float as avg_irr,
           MODE() WITHIN GROUP (ORDER BY city) as top_market,
           MODE() WITHIN GROUP (ORDER BY property_type) as top_property_type
         FROM deal_analyses
         WHERE analyzed_at >= $1`,
        [weekAgo.toISOString()]
      )
    ]);

    const events = eventsResult.rows[0]?.count || 0;
    const deals = dealsResult.rows[0];

    res.json({
      success: true,
      data: {
        deals_analyzed: events,
        total_analyzed_deals: parseInt(deals?.total_deals) || 0,
        avg_cap_rate: parseFloat((deals?.avg_cap_rate || 0).toFixed(2)),
        avg_irr: parseFloat((deals?.avg_irr || 0).toFixed(1)),
        top_market: deals?.top_market || 'Canada',
        top_property_type: deals?.top_property_type || 'Multiplex',
        period_start: weekAgo.toISOString().split('T')[0],
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
}