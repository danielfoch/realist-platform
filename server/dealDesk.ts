/**
 * Deal Desk supplemental API — dashboard summary, assignment, SLA sweep,
 * entity exports, and intent-score recompute.
 *
 * The primary Deal Desk endpoints (submit, opportunity list/status, email
 * triggers, settings) live in server/routes/dealDesk.ts — the production
 * module the client + email queue use. This module only registers the
 * endpoints that module lacks; overlapping routes were removed in the merge.
 *
 * Ported from the idx app (src/deal-desk-routes.ts + src/intent.ts), adapted
 * to Drizzle, the live users / user_activity_events tables, and the live
 * session-based admin auth.
 */

import type { Express, Request, Response, NextFunction } from "express";
import "express-session";
import { and, eq, gte, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  opportunities,
  assignments,
} from "@shared/schema";
import { queueEmailTrigger as queueEmailTriggerTransport } from "./emailTriggerProducer";
import {
  computeIntentScore,
  intentBand,
  suggestedNextAction,
  type ScorableEvent,
  type IntentBand,
} from "@shared/dealDeskScoring";

const HOT_SLA_MINUTES = 30;
const SCORING_WINDOW_DAYS = 90;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Admin auth: a logged-in admin session (same check as server/auth.ts
 * isAdmin), or — for cron/automation callers like the sweep — an
 * x-api-key matching DEAL_DESK_API_KEY.
 */
async function requireDealDeskAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"] || req.query.api_key;
    const configuredKey = process.env.DEAL_DESK_API_KEY;
    if (configuredKey && apiKey === configuredKey) {
      next();
      return;
    }
    if (!req.session?.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }
    next();
  } catch (error) {
    console.error("[deal-desk] admin auth check failed:", error);
    res.status(500).json({ success: false, error: "Failed to verify admin status" });
  }
}

async function queueEmailTrigger(
  userId: string | null,
  opportunityId: string | null,
  triggerType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Unified transport producer (server/emailTriggerProducer.ts): writes a
  // notification_queue row by default, an email_triggers row under
  // EMAIL_TRIGGER_TRANSPORT=legacy. One pending trigger per (user, type) is
  // preserved on both paths.
  await queueEmailTriggerTransport({ userId, opportunityId, triggerType, payload });
}

export interface IntentResult {
  score: number;
  band: IntentBand;
  nextAction: string;
}

/**
 * Recompute a user's intent score from their recent activity events +
 * profile, and persist it to any open opportunities they have.
 */
export async function recomputeIntentForUser(userId: string): Promise<IntentResult | null> {
  try {
    const since = daysAgo(SCORING_WINDOW_DAYS);
    const [eventRows, userRows, oppRows] = await Promise.all([
      db.execute(sql`
        SELECT event_name, created_at, analysis_id FROM user_activity_events
        WHERE user_id = ${userId} AND created_at >= ${since}
      `),
      db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1),
      db.select({
        id: opportunities.id,
        financingHelp: opportunities.financingHelp,
        buyingHelp: opportunities.buyingHelp,
      }).from(opportunities).where(and(
        eq(opportunities.userId, userId),
        notInArray(opportunities.status, ["closed", "lost"]),
      )),
    ]);

    const events: ScorableEvent[] = (eventRows.rows as Array<{ event_name: string; created_at: Date | string; analysis_id: string | null }>).map((e) => ({
      event: e.event_name,
      created_at: e.created_at,
      deal_id: e.analysis_id,
    }));

    const hasPhone = Boolean(userRows[0]?.phone);
    const financingHelp = oppRows.some((o) => o.financingHelp);
    const buyingHelp = oppRows.some((o) => o.buyingHelp);

    const score = computeIntentScore(events, { hasPhone, financingHelp, buyingHelp });
    const band = intentBand(score);
    const nextAction = suggestedNextAction(band);

    if (oppRows.length > 0) {
      await db.update(opportunities)
        .set({ intentScore: score, suggestedNextAction: nextAction, updatedAt: new Date() })
        .where(and(
          eq(opportunities.userId, userId),
          notInArray(opportunities.status, ["closed", "lost"]),
        ));
    }

    return { score, band, nextAction };
  } catch (error) {
    console.error("[deal-desk] failed to recompute intent score:", error);
    return null;
  }
}

export function registerDealDeskRoutes(app: Express): void {
  /**
   * GET /api/deal-desk/dashboard
   * Summary counts for the admin view.
   */
  app.get("/api/deal-desk/dashboard", requireDealDeskAdmin, async (_req: Request, res: Response) => {
    try {
      const slaCutoff = minutesAgo(HOT_SLA_MINUTES);
      const weekAgo = daysAgo(7);

      const [counts, lostReasons, recentEvents, dealsThisWeek] = await Promise.all([
        db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE intent_score >= 80 AND status NOT IN ('closed','lost'))::int as hot,
            COUNT(*) FILTER (WHERE intent_score >= 50 AND intent_score < 80 AND status NOT IN ('closed','lost'))::int as warm,
            COUNT(*) FILTER (WHERE status = 'new')::int as new_submissions,
            COUNT(*) FILTER (WHERE status = 'booked_call')::int as calls_booked,
            COUNT(*) FILTER (WHERE status IN ('contacted','booked_call','preapproval_started','buyer_agency_signed','showing_booked','offer_submitted'))::int as active,
            COUNT(*) FILTER (WHERE status = 'closed')::int as closed,
            COUNT(*) FILTER (WHERE status = 'lost')::int as lost,
            COUNT(*) FILTER (WHERE intent_score >= 80 AND first_contacted_at IS NULL AND status IN ('new','hot') AND created_at < ${slaCutoff})::int as sla_breaches
          FROM opportunities
        `),
        db.execute(sql`
          SELECT lost_reason, COUNT(*)::int as count FROM opportunities
          WHERE status = 'lost' AND lost_reason IS NOT NULL
          GROUP BY lost_reason ORDER BY count DESC
        `),
        db.execute(sql`
          SELECT e.id, e.event_name as event, e.user_id, e.analysis_id as deal_id, e.created_at, u.email
          FROM user_activity_events e LEFT JOIN users u ON u.id = e.user_id
          ORDER BY e.created_at DESC LIMIT 25
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM property_analyses WHERE created_at >= ${weekAgo}
        `),
      ]);

      res.json({
        success: true,
        data: {
          counts: counts.rows[0],
          deals_analyzed_7d: (dealsThisWeek.rows[0] as { count?: number } | undefined)?.count ?? 0,
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
   * POST /api/deal-desk/opportunities/:id/assign
   */
  app.post("/api/deal-desk/opportunities/:id/assign", requireDealDeskAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assignedTo, assignedBy } = req.body || {};

    if (!assignedTo) {
      res.status(400).json({ success: false, error: "assignedTo is required" });
      return;
    }

    try {
      const updated = await db.update(opportunities)
        .set({ assignedTo: String(assignedTo), updatedAt: new Date() })
        .where(eq(opportunities.id, id))
        .returning({ id: opportunities.id });
      if (updated.length === 0) {
        res.status(404).json({ success: false, error: "Opportunity not found" });
        return;
      }
      await db.insert(assignments).values({
        opportunityId: id,
        assignedTo: String(assignedTo),
        assignedBy: assignedBy ? String(assignedBy) : "admin",
      });
      res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /api/deal-desk/sweep
   * SLA + behavioural trigger sweep. Idempotent (pending-trigger dedupe) —
   * call from cron every 15 minutes with x-api-key: DEAL_DESK_API_KEY.
   */
  app.post("/api/deal-desk/sweep", requireDealDeskAdmin, async (_req: Request, res: Response) => {
    try {
      let created = 0;

      // 1. SLA breach: hot, uncontacted, past the clock → nag the assignee
      const breaches = await db.select({
        id: opportunities.id,
        userId: opportunities.userId,
        assignedTo: opportunities.assignedTo,
      }).from(opportunities).where(and(
        gte(opportunities.intentScore, 80),
        sql`${opportunities.firstContactedAt} IS NULL`,
        inArray(opportunities.status, ["new", "hot"]),
        sql`${opportunities.createdAt} < ${minutesAgo(HOT_SLA_MINUTES)}`,
      ));
      for (const b of breaches) {
        await queueEmailTrigger(b.userId, b.id, "sla_breach_nag", { assigned_to: b.assignedTo, opportunity_id: b.id });
        created++;
      }

      // 2. Saved a deal, never submitted, 48h+
      const savedNoSubmit = await db.execute(sql`
        SELECT DISTINCT e.user_id FROM user_activity_events e
        WHERE e.event_name IN ('deal_saved', 'deal_analyzer_saved', 'listing_saved', 'saved_listing', 'underwriting_exported_or_saved')
          AND e.created_at < ${hoursAgo(48)}
          AND e.created_at > ${daysAgo(14)}
          AND e.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_activity_events s
            WHERE s.user_id = e.user_id AND s.event_name = 'deal_submitted' AND s.created_at > e.created_at
          )
      `);
      for (const r of savedNoSubmit.rows as Array<{ user_id: string }>) {
        await queueEmailTrigger(r.user_id, null, "saved_deal_no_submit", {});
        created++;
      }

      // 3. Started underwriting, abandoned 24h+
      const abandoned = await db.execute(sql`
        SELECT DISTINCT e.user_id FROM user_activity_events e
        WHERE e.event_name IN ('model_run', 'deal_analyzer_start', 'underwriting_started', 'analysis_started')
          AND e.created_at < ${hoursAgo(24)}
          AND e.created_at > ${daysAgo(7)}
          AND e.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_activity_events s
            WHERE s.user_id = e.user_id
              AND s.event_name IN ('deal_saved', 'deal_analyzer_saved', 'underwriting_exported_or_saved', 'analysis_completed', 'deal_submitted')
              AND s.created_at > e.created_at
          )
      `);
      for (const r of abandoned.rows as Array<{ user_id: string }>) {
        await queueEmailTrigger(r.user_id, null, "abandoned_underwriting", {});
        created++;
      }

      // 4. Financing interest signal
      const financing = await db.execute(sql`
        SELECT DISTINCT user_id FROM user_activity_events
        WHERE event_name IN ('financing_changed', 'financing_assumption_changed')
          AND created_at > ${daysAgo(7)}
          AND user_id IS NOT NULL
      `);
      for (const r of financing.rows as Array<{ user_id: string }>) {
        await queueEmailTrigger(r.user_id, null, "financing_interest", {});
        created++;
      }

      res.json({ success: true, data: { triggers_created: created, sla_breaches: breaches.length } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/deal-desk/export/:entity?format=csv|json
   * Exports for Clyde: users, deals, opportunities, events, triggers.
   */
  app.get("/api/deal-desk/export/:entity", requireDealDeskAdmin, async (req: Request, res: Response) => {
    const { entity } = req.params;
    const format = (req.query.format as string) || "json";

    const queries: Record<string, SQL> = {
      users: sql`SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at,
                   (SELECT status FROM email_consent c WHERE c.user_id = u.id AND c.channel = 'email' ORDER BY c.created_at DESC LIMIT 1) as email_consent
                 FROM users u ORDER BY u.created_at DESC LIMIT 10000`,
      deals: sql`SELECT id, listing_mls_number, user_id, city, province, property_type, listing_price, calculated_metrics, created_at
                 FROM property_analyses ORDER BY created_at DESC LIMIT 10000`,
      opportunities: sql`SELECT o.*, u.email FROM opportunities o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10000`,
      events: sql`SELECT id, user_id, analysis_id as deal_id, event_name as event, metadata as properties, session_id, created_at
                  FROM user_activity_events ORDER BY created_at DESC LIMIT 10000`,
      triggers: sql`SELECT id, user_id, opportunity_id, trigger_type, payload, status, created_at, sent_at
                    FROM email_triggers ORDER BY created_at DESC LIMIT 10000`,
    };

    const query = queries[entity];
    if (!query) {
      res.status(400).json({ success: false, error: `entity must be one of: ${Object.keys(queries).join(", ")}` });
      return;
    }

    try {
      const result = await db.execute(query);

      if (format === "csv") {
        const rows = result.rows as Record<string, unknown>[];
        if (rows.length === 0) {
          res.type("text/csv").send("");
          return;
        }
        const headers = Object.keys(rows[0]);
        const escape = (v: unknown): string => {
          if (v === null || v === undefined) return "";
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
        res.type("text/csv").attachment(`${entity}.csv`).send(csv);
      } else {
        res.json({ success: true, data: result.rows });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: message });
    }
  });
}
