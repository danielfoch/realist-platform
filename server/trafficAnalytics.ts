import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { logUserActivity } from "./userActivity";
import {
  normalizeTrafficAttribution,
  type TrafficAttribution,
} from "@shared/trafficAnalytics";

const analyticsEventSchema = z.object({
  eventName: z.enum(["page_view", "ticket_cta_clicked", "outbound_click", "lead_conversion"]).default("page_view"),
  sessionId: z.string().max(120).optional().nullable(),
  visitorId: z.string().max(120).optional().nullable(),
  page: z.string().max(600).optional().nullable(),
  path: z.string().max(400).optional().nullable(),
  title: z.string().max(300).optional().nullable(),
  referrer: z.string().max(600).optional().nullable(),
  component: z.string().max(120).optional().nullable(),
  targetUrl: z.string().max(1000).optional().nullable(),
  attribution: z.record(z.string(), z.string()).optional().nullable(),
  firstTouch: z.record(z.string(), z.unknown()).optional().nullable(),
  currentTouch: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

function attributionFromRequest(bodyAttribution: Record<string, string> | null | undefined, query: unknown): TrafficAttribution {
  const params = new URLSearchParams();
  if (query && typeof query === "object") {
    for (const [key, raw] of Object.entries(query as Record<string, unknown>)) {
      if (typeof raw === "string") params.set(key, raw);
    }
  }
  const normalized = normalizeTrafficAttribution(params);
  return { ...normalized, ...(bodyAttribution ?? {}) };
}

function intQuery(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function registerTrafficAnalyticsRoutes(app: Express, requireAdmin: RequestHandler): void {
  app.post("/api/analytics/track", async (req, res) => {
    try {
      const input = analyticsEventSchema.parse(req.body ?? {});
      const attribution = attributionFromRequest(input.attribution, req.query);
      const source = attribution.source || attribution.utm_source || null;
      const page = input.page || input.path || null;
      const sessionUserId = (req as any).session?.userId || (req as any).user?.id || null;
      const sessionId = input.sessionId || (req as any).sessionID || null;

      await logUserActivity(req, {
        userId: sessionUserId,
        sessionId,
        eventName: input.eventName,
        source,
        sourcePage: page,
        component: input.component || "web_analytics",
        metadata: {
          ...input.metadata,
          path: input.path || page,
          page,
          title: input.title || null,
          referrer: input.referrer || req.headers.referer || null,
          targetUrl: input.targetUrl || null,
          visitorId: input.visitorId || null,
          attribution,
          firstTouch: input.firstTouch || null,
          currentTouch: input.currentTouch || null,
        },
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ ok: false, error: error.errors?.[0]?.message || "Invalid analytics event" });
    }
  });

  app.get("/api/admin/traffic/summary", requireAdmin, async (req, res) => {
    const days = intQuery(req.query.days, 30, 1, 365);
    const source = typeof req.query.source === "string" && req.query.source.trim() ? req.query.source.trim() : null;
    const page = typeof req.query.page === "string" && req.query.page.trim() ? req.query.page.trim() : null;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const conditions = [
      sql`created_at >= ${since}`,
      sql`event_name IN ('page_view', 'ticket_cta_clicked', 'outbound_click', 'lead_conversion')`,
    ];
    if (source) conditions.push(sql`COALESCE(source, metadata->'attribution'->>'source', metadata->'attribution'->>'utm_source') = ${source}`);
    if (page) conditions.push(sql`COALESCE(source_page, metadata->>'path', metadata->>'page') = ${page}`);
    const where = sql.join(conditions, sql` AND `);

    const totals = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS pageviews,
        COUNT(DISTINCT COALESCE(metadata->>'visitorId', session_id, hashed_ip))::int AS visitors,
        COUNT(*) FILTER (WHERE event_name = 'ticket_cta_clicked')::int AS ticket_clicks,
        COUNT(*) FILTER (WHERE event_name = 'outbound_click')::int AS outbound_clicks,
        COUNT(*) FILTER (WHERE event_name = 'lead_conversion')::int AS lead_conversions
      FROM user_activity_events
      WHERE ${where}
    `);

    const bySource = await db.execute(sql`
      SELECT
        COALESCE(source, metadata->'attribution'->>'source', metadata->'attribution'->>'utm_source', 'direct') AS source,
        COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS pageviews,
        COUNT(DISTINCT COALESCE(metadata->>'visitorId', session_id, hashed_ip))::int AS visitors,
        COUNT(*) FILTER (WHERE event_name = 'ticket_cta_clicked')::int AS ticket_clicks
      FROM user_activity_events
      WHERE ${where}
      GROUP BY 1
      ORDER BY pageviews DESC, ticket_clicks DESC
      LIMIT 50
    `);

    const byPage = await db.execute(sql`
      SELECT
        COALESCE(source_page, metadata->>'path', metadata->>'page', 'unknown') AS page,
        COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS pageviews,
        COUNT(DISTINCT COALESCE(metadata->>'visitorId', session_id, hashed_ip))::int AS visitors,
        COUNT(*) FILTER (WHERE event_name = 'ticket_cta_clicked')::int AS ticket_clicks
      FROM user_activity_events
      WHERE ${where}
      GROUP BY 1
      ORDER BY pageviews DESC, ticket_clicks DESC
      LIMIT 50
    `);

    const recent = await db.execute(sql`
      SELECT
        id,
        event_name AS "eventName",
        source,
        source_page AS "sourcePage",
        component,
        metadata,
        created_at AS "createdAt"
      FROM user_activity_events
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      days,
      filters: { source, page },
      totals: totals.rows[0] ?? { pageviews: 0, visitors: 0, ticketClicks: 0, outboundClicks: 0, leadConversions: 0 },
      bySource: bySource.rows,
      byPage: byPage.rows,
      recent: recent.rows,
    });
  });
}
