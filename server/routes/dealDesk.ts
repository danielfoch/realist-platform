import { type Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { logUserActivity } from "../userActivity";
import { isAdmin } from "../auth";
import { scoreLeadInput, selectEmailTriggers } from "@shared/leadScoring";
import { queueEmailTrigger } from "../emailTriggerProducer";

const dealDeskSubmitSchema = z.object({
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

export function registerDealDeskRoutes(app: Express) {
  app.post("/api/deal-desk/submit", async (req, res) => {
    try {
      const input = dealDeskSubmitSchema.parse(req.body);
      const sessionUserId = (req as any).session?.userId || null;

      const lead = await storage.upsertLeadByEmail({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        consent: input.consentEmail,
        consentSms: input.consentSms,
        leadSource: "Deal Desk",
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
        source: "deal_desk",
      });

      await logUserActivity(req, {
        userId: sessionUserId,
        sessionId: (req as any).sessionID || null,
        eventName: "deal_submitted",
        sourcePage: "/deal-desk",
        dealId: deal.id,
        source: "deal_desk",
        metadata: {
          leadId: lead.id,
          opportunityId: opportunity.id,
          intentScore: scoreResult.intentScore,
          status: scoreResult.status,
          market: input.market,
          propertyType: input.propertyType,
        },
      });

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

      res.json({
        ok: true,
        leadId: lead.id,
        dealId: deal.id,
        opportunityId: opportunity.id,
        intentScore: scoreResult.intentScore,
        status: scoreResult.status,
        suggestedNextAction: scoreResult.suggestedNextAction,
      });
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
