import { type Express } from "express";
import { z } from "zod";
import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { users, opportunities, assignments } from "@shared/schema";
import { logUserActivity } from "../userActivity";
import { isAdmin } from "../auth";
import { scoreLeadInput, selectEmailTriggers } from "@shared/leadScoring";
import { queueEmailTrigger } from "../emailTriggerProducer";

const HOT_SLA_MINUTES = 30;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const dealDeskSubmitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().nullable(),
  address: z.string().min(1, "Property address is required"),
  listingUrl: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  purchasePrice: z.number().positive().optional().nullable(),
  estimatedRent: z.number().positive().optional().nullable(),
  financingHelpWanted: z.boolean().default(false),
  buyingHelpWanted: z.boolean().default(false),
  userNotes: z.string().optional().nullable(),
  consentEmail: z.boolean().default(false),
  consentSms: z.boolean().default(false),
  reportExported: z.boolean().optional(),
  dealSaved: z.boolean().optional(),
  financingChanged: z.boolean().optional(),
  returnThresholdHit: z.boolean().optional(),
  repeatMarketSearches: z.boolean().optional(),
  dealDeskCtaClicked: z.boolean().optional(),
  analysisId: z.string().optional().nullable(),
});

export type DealDeskSubmitInput = z.infer<typeof dealDeskSubmitSchema>;

export async function submitDealDesk(input: DealDeskSubmitInput, opts: {
  req?: any;
  userId?: string | null;
  sessionId?: string | null;
  source?: string;
  sourcePage?: string;
} = {}) {
  const sessionUserId = opts.userId ?? opts.req?.session?.userId ?? null;
  const source = opts.source || "deal_desk";
  const sourcePage = opts.sourcePage || "/deal-desk";

  const lead = await storage.upsertLeadByEmail({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    consent: input.consentEmail,
    consentSms: input.consentSms,
    leadSource: source === "agent_api" ? "Deal Desk Agent API" : "Deal Desk",
  });

  const deal = await storage.createDeal({
    leadId: lead.id,
    userId: sessionUserId,
    analysisId: input.analysisId || null,
    address: input.address,
    listingUrl: input.listingUrl || null,
    market: input.market || null,
    propertyType: input.propertyType || null,
    purchasePrice: input.purchasePrice ?? null,
    estimatedRent: input.estimatedRent ?? null,
    financingHelpWanted: input.financingHelpWanted,
    buyingHelpWanted: input.buyingHelpWanted,
    userNotes: input.userNotes || null,
  });

  const scoreResult = scoreLeadInput({
    dealSubmitted: true,
    dealDeskCtaClicked: input.dealDeskCtaClicked,
    reportExported: input.reportExported,
    dealSaved: input.dealSaved,
    financingChanged: input.financingChanged,
    returnThresholdHit: input.returnThresholdHit,
    repeatMarketSearches: input.repeatMarketSearches,
    phoneProvided: !!(input.phone && input.phone.trim().length > 0),
    financingHelpWanted: input.financingHelpWanted,
    buyingHelpWanted: input.buyingHelpWanted,
  });

  const opportunity = await storage.createOpportunity({
    leadId: lead.id,
    userId: sessionUserId,
    dealId: deal.id,
    intentScore: scoreResult.intentScore,
    status: scoreResult.status,
    suggestedNextAction: scoreResult.suggestedNextAction,
    source,
  });

  if (opts.req) {
    await logUserActivity(opts.req, {
      userId: sessionUserId,
      sessionId: opts.sessionId ?? opts.req.sessionID ?? null,
      eventName: "deal_submitted",
      sourcePage,
      dealId: deal.id,
      source,
      metadata: {
        leadId: lead.id,
        opportunityId: opportunity.id,
        intentScore: scoreResult.intentScore,
        status: scoreResult.status,
        market: input.market,
        propertyType: input.propertyType,
      },
    });
  }

  const triggerTypes = selectEmailTriggers(
    scoreResult.status as "hot" | "warm" | "nurture" | "audience",
    input.financingHelpWanted,
  );
  await Promise.all(
    triggerTypes.map(triggerType =>
      queueEmailTrigger({
        leadId: lead.id,
        userId: sessionUserId,
        opportunityId: opportunity.id,
        triggerType,
        payload: {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          address: input.address,
          market: input.market || null,
          propertyType: input.propertyType || null,
          intentScore: scoreResult.intentScore,
          status: scoreResult.status,
          suggestedNextAction: scoreResult.suggestedNextAction,
          analysisId: input.analysisId || null,
        },
        // Legacy-transport parity: this site historically used a plain
        // insert (storage.createEmailTrigger), surfacing a pending
        // duplicate as a constraint error instead of silently skipping.
        onDuplicate: "throw",
      })
    )
  );

  return {
    ok: true,
    leadId: lead.id,
    dealId: deal.id,
    opportunityId: opportunity.id,
    intentScore: scoreResult.intentScore,
    status: scoreResult.status,
    suggestedNextAction: scoreResult.suggestedNextAction,
  };
}

export function registerDealDeskRoutes(app: Express) {
  app.post("/api/deal-desk/submit", async (req, res) => {
    try {
      const input = dealDeskSubmitSchema.parse(req.body);
      res.json(await submitDealDesk(input, { req }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Deal Desk submit error:", err);
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  app.get("/api/deal-desk/opportunities", isAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const data = await storage.listOpportunities({ status });
      res.json(data);
    } catch (err) {
      console.error("List opportunities error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.patch("/api/deal-desk/opportunities/bulk-status", isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.string().min(1)).min(1),
        status: z.string().min(1),
      });
      const { ids, status } = schema.parse(req.body);
      const adminUserId = (req as any).session?.userId || null;

      const updated = await Promise.all(
        ids.map(id => storage.updateOpportunityStatus(id, { status }))
      );

      await logUserActivity(req, {
        userId: adminUserId,
        sessionId: (req as any).sessionID || null,
        eventName: "crm_bulk_status_updated",
        dealId: null,
        source: "deal_desk_admin",
        metadata: { ids, newStatus: status, count: ids.length },
      });

      res.json({ ok: true, updated: updated.filter(Boolean).length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Bulk update opportunity status error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.patch("/api/deal-desk/opportunities/:id/status", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema = z.object({ status: z.string().min(1) });
      const { status } = schema.parse(req.body);
      const adminUserId = (req as any).session?.userId || null;

      const existing = await storage.getOpportunityById(id);
      const prevStatus = existing?.status;

      const opportunity = await storage.updateOpportunityStatus(
        id,
        { status },
        { changedByUserId: adminUserId, prevStatus },
      );
      if (!opportunity) {
        return res.status(404).json({ ok: false, error: "Not found" });
      }

      await logUserActivity(req, {
        userId: adminUserId,
        sessionId: (req as any).sessionID || null,
        eventName: "crm_status_updated",
        dealId: opportunity.dealId || null,
        source: "deal_desk_admin",
        metadata: { opportunityId: id, newStatus: status },
      });

      res.json({ ok: true, opportunity });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Update opportunity status error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.patch("/api/deal-desk/opportunities/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        status: z.string().min(1),
        assignedTo: z.string().optional().nullable(),
        lostReason: z.string().optional().nullable(),
        adminNotes: z.string().optional().nullable(),
      });
      const updates = schema.parse(req.body);
      const adminUserId = (req as any).session?.userId || null;

      const existing = await storage.getOpportunityById(id);

      const opportunity = await storage.updateOpportunityStatus(
        id,
        {
          status: updates.status,
          assignedTo: updates.assignedTo ?? undefined,
          lostReason: updates.lostReason ?? undefined,
          adminNotes: updates.adminNotes ?? undefined,
        },
        {
          changedByUserId: adminUserId,
          prevStatus: existing?.status,
          prevAssignedTo: existing?.assignedTo ?? null,
          prevNotes: existing?.adminNotes ?? null,
        },
      );
      if (!opportunity) {
        return res.status(404).json({ ok: false, error: "Not found" });
      }

      await logUserActivity(req, {
        userId: adminUserId,
        sessionId: (req as any).sessionID || null,
        eventName: "crm_status_updated",
        dealId: opportunity.dealId || null,
        source: "deal_desk_admin",
        metadata: {
          opportunityId: id,
          newStatus: updates.status,
          lostReason: updates.lostReason || null,
        },
      });

      if (updates.status === "lost" && updates.lostReason && opportunity.leadId) {
        await queueEmailTrigger({
          leadId: opportunity.leadId,
          userId: opportunity.userId,
          opportunityId: id,
          triggerType: "lost_reason_nurture",
          payload: {
            lostReason: updates.lostReason,
            opportunityId: id,
          },
          // Legacy-transport parity with the old plain insert (see above).
          onDuplicate: "throw",
        });
      }

      res.json({ ok: true, opportunity });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Update opportunity error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/deal-desk/opportunities/:id/history", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getOpportunityHistory(id);
      res.json(history);
    } catch (err) {
      console.error("Get opportunity history error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/deal-desk/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getDealDeskStats();
      res.json(stats);
    } catch (err) {
      console.error("Deal desk stats error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/deal-desk/activity", isAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const feed = await storage.getDealDeskActivityFeed(limit);
      res.json(feed);
    } catch (err) {
      console.error("Deal desk activity error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/deal-desk/email-triggers", isAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const triggers = await storage.listEmailTriggers(limit);
      res.json(triggers);
    } catch (err) {
      console.error("List email triggers error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.patch("/api/deal-desk/email-triggers/:id/retry", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.retryEmailTrigger(id);
      res.json({ ok: true });
    } catch (err) {
      console.error("Retry email trigger error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.post("/api/deal-desk/email-triggers/preview", isAdmin, async (req, res) => {
    try {
      const { buildEmailForTrigger, getSampleTriggerPayload, EMAIL_TRIGGER_TYPES } =
        await import("../emailQueue");
      const schema = z.object({
        triggerType: z.enum(EMAIL_TRIGGER_TYPES as unknown as [string, ...string[]]),
        payload: z.record(z.any()).optional(),
      });
      const { triggerType, payload } = schema.parse(req.body);
      const samplePayload = {
        ...getSampleTriggerPayload(triggerType),
        ...(payload || {}),
      };
      const { subject, html, audience } = buildEmailForTrigger(triggerType, samplePayload);
      res.json({ ok: true, triggerType, subject, html, audience });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Email trigger preview error:", err);
      res.status(500).json({ ok: false, error: "Failed to render preview" });
    }
  });

  app.post("/api/deal-desk/email-triggers/test-send", isAdmin, async (req, res) => {
    try {
      const { sendTestTriggerEmail, getSampleTriggerPayload, EMAIL_TRIGGER_TYPES } =
        await import("../emailQueue");
      const schema = z.object({
        triggerType: z.enum(EMAIL_TRIGGER_TYPES as unknown as [string, ...string[]]),
        payload: z.record(z.any()).optional(),
        to: z.string().email().optional(),
      });
      const { triggerType, payload, to } = schema.parse(req.body);

      let recipient = to;
      if (!recipient) {
        const { db } = await import("../db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const [u] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, (req as any).session.userId));
        recipient = u?.email;
      }

      if (!recipient) {
        return res.status(400).json({ ok: false, error: "No recipient email available for your admin account" });
      }

      const samplePayload = {
        ...getSampleTriggerPayload(triggerType),
        ...(payload || {}),
      };
      const { subject } = await sendTestTriggerEmail(triggerType, samplePayload, recipient);
      res.json({ ok: true, sentTo: recipient, subject });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ ok: false, errors: err.errors });
      }
      console.error("Email trigger test-send error:", err);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to send test email" });
    }
  });

  app.get("/api/deal-desk/export", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const envToken = process.env.DEAL_DESK_EXPORT_TOKEN;

    let authorized = !!(envToken && bearerToken && bearerToken === envToken);

    if (!authorized && (req as any).session?.userId) {
      try {
        const { db } = await import("../db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const [u] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, (req as any).session.userId));
        authorized = u?.role === "admin";
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const entity = (req.query.entity as string) || "opportunities";
      const format = (req.query.format as string) || "json";

      let data: any[] = [];
      switch (entity) {
        case "contacts":
          data = await storage.getAllLeads();
          break;
        case "deals":
          data = await storage.listDeals();
          break;
        case "opportunities":
          data = await storage.listOpportunities({});
          break;
        case "events":
          data = await storage.listRecentActivityEvents(500);
          break;
        default:
          return res.status(400).json({ ok: false, error: "Unknown entity. Use: contacts, deals, opportunities, events" });
      }

      if (format === "csv") {
        const csv = toCsv(data);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${entity}-${Date.now()}.csv"`);
        return res.send(csv);
      }

      res.json({ ok: true, entity, count: data.length, data });
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/deal-desk/settings", isAdmin, async (req, res) => {
    try {
      const notifyEmail = await storage.getAppSetting("deal_desk_notify_email");
      const envFallback =
        process.env.DEAL_DESK_NOTIFY_EMAIL ||
        process.env.PODCAST_NOTIFY_EMAIL ||
        null;
      const notifyEmails = notifyEmail
        ? notifyEmail.split(",").map(e => e.trim()).filter(Boolean)
        : [];
      const envFallbackEmails = envFallback
        ? envFallback.split(",").map(e => e.trim()).filter(Boolean)
        : [];
      res.json({
        ok: true,
        settings: {
          notifyEmail: notifyEmail ?? null,
          notifyEmails,
          envFallback,
          envFallbackEmails,
          effectiveEmail: notifyEmail ?? envFallback ?? null,
          effectiveEmails: notifyEmails.length ? notifyEmails : envFallbackEmails,
        },
      });
    } catch (err) {
      console.error("Settings GET error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.put("/api/deal-desk/settings", isAdmin, async (req, res) => {
    const schema = z.object({
      notifyEmails: z.array(z.string().email("Each entry must be a valid email address")).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const { notifyEmails } = parsed.data;
      const value = (notifyEmails ?? []).map(e => e.trim()).filter(Boolean).join(",");
      await storage.setAppSetting("deal_desk_notify_email", value);
      res.json({ ok: true });
    } catch (err) {
      console.error("Settings PUT error:", err);
      res.status(500).json({ ok: false });
    }
  });

  /**
   * GET /api/deal-desk/dashboard
   * Summary counts for the admin view.
   */
  app.get("/api/deal-desk/dashboard", isAdmin, async (_req, res) => {
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
  app.post("/api/deal-desk/opportunities/:id/assign", isAdmin, async (req, res) => {
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
   * SLA + behavioural trigger sweep. Idempotent (pending-trigger dedupe).
   */
  app.post("/api/deal-desk/sweep", isAdmin, async (_req, res) => {
    try {
      let created = 0;

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
        await queueEmailTrigger({
          userId: b.userId,
          opportunityId: b.id,
          triggerType: "sla_breach_nag",
          payload: { assigned_to: b.assignedTo, opportunity_id: b.id },
        });
        created++;
      }

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
        await queueEmailTrigger({ userId: r.user_id, triggerType: "saved_deal_no_submit" });
        created++;
      }

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
        await queueEmailTrigger({ userId: r.user_id, triggerType: "abandoned_underwriting" });
        created++;
      }

      const financing = await db.execute(sql`
        SELECT DISTINCT user_id FROM user_activity_events
        WHERE event_name IN ('financing_changed', 'financing_assumption_changed')
          AND created_at > ${daysAgo(7)}
          AND user_id IS NOT NULL
      `);
      for (const r of financing.rows as Array<{ user_id: string }>) {
        await queueEmailTrigger({ userId: r.user_id, triggerType: "financing_interest" });
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
   */
  app.get("/api/deal-desk/export/:entity", isAdmin, async (req, res) => {
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

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const flatRows = rows.map(row => {
    const flat: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "object" && v !== null) {
        flat[k] = JSON.stringify(v);
      } else {
        flat[k] = v;
      }
    }
    return flat;
  });
  const keys = Object.keys(flatRows[0]);
  const header = keys.join(",");
  const lines = flatRows.map(row =>
    keys.map(k => {
      const v = row[k];
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}
