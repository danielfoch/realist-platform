/**
 * Server-side event tracking for key user actions.
 * Stores events in PostgreSQL and exposes a query API.
 */

import { Request, Response } from 'express';
import { db } from './db';
import { logger } from './logger';

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
  | 'subscription_canceled';

export interface TrackEventInput {
  user_id?: number | null;
  event: EventName;
  properties?: Record<string, unknown> | null;
  session_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
}

// ---------- Core tracking ----------

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO user_events (user_id, event, properties, session_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.user_id ?? null,
        input.event,
        input.properties ? JSON.stringify(input.properties) : null,
        input.session_id ?? null,
        input.ip_address ?? null,
        input.user_agent ?? null,
        input.referrer ?? null,
      ],
    );
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
  const { event, properties, session_id } = req.body;

  if (!event) {
    res.status(400).json({ success: false, error: 'event is required' });
    return;
  }

  const userId = (req as any).user?.id ?? null;
  const ip = req.ip || req.socket.remoteAddress || null;

  await trackEvent({
    user_id: userId,
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