/**
 * Booked-call leads — the deal/coaching call funnel.
 *
 * POST  /api/booked-call-leads       public — create a lead from any CTA
 *                                    (works signed-out; attaches the session
 *                                    user when present)
 * GET   /api/booked-call-leads       admin — review the pipeline (?status=)
 * PATCH /api/booked-call-leads/:id   admin — advance status / add notes;
 *                                    moving to "flipped" re-forwards the lead
 *                                    to the BLD destination
 *
 * Every lead is persisted first; forwarding to BLD is best-effort via the
 * env-driven stub in ./bldLeadDestination (currently unconfigured — nothing
 * leaves the app). Mirrors the coaching-waitlist route shape and the
 * underwritingShares module pattern (self-contained, direct db access).
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { isAdmin } from "./auth";
import { logUserActivity } from "./userActivity";
import { bookedCallLeads } from "@shared/schema";
import {
  bookedCallLeadRequestSchema,
  isBookedCallLeadStatus,
  BOOKED_CALL_LEAD_STATUSES,
} from "@shared/bookedCallLeads";
import { bldDestinationStatus, forwardLeadToBld } from "./bldLeadDestination";

export function registerBookedCallLeadRoutes(app: Express): void {
  // Startup visibility, mirroring the GHL_WEBHOOK_URL log in auth.ts.
  const dest = bldDestinationStatus();
  console.log(
    dest.configured
      ? `[bld-lead] BLD destination configured (${dest.webhook ? "webhook" : "email"}) — booked-call leads will be forwarded`
      : "[bld-lead] BLD_LEAD_WEBHOOK_URL / BLD_LEAD_EMAIL are NOT set — booked-call leads stored for admin review only"
  );

  /**
   * POST /api/booked-call-leads
   * Create a lead. Public: the email field *is* the gate — signed-out
   * visitors can still raise their hand, signed-in users get linked to
   * their account.
   */
  app.post("/api/booked-call-leads", async (req: Request, res: Response) => {
    try {
      const parsed = bookedCallLeadRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "Invalid request", details: parsed.error.issues });
        return;
      }
      const input = parsed.data;
      const userId = req.session?.userId ?? null;

      const [lead] = await db.insert(bookedCallLeads).values({
        userId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        intent: input.intent,
        sourcePage: input.sourcePage ?? null,
        underwritingId: input.underwritingId ?? null,
        analysisId: input.analysisId ?? null,
        dealSnapshot: input.dealSnapshot ?? null,
        message: input.message ?? null,
      }).returning();

      if (userId) {
        await logUserActivity(req, {
          userId,
          eventName: "booked_call_requested",
          analysisId: input.analysisId ?? null,
          sourcePage: input.sourcePage ?? null,
          metadata: { lead_id: lead.id, intent: input.intent, underwriting_id: input.underwritingId ?? null },
        });
      }

      // Best-effort forward — never blocks or fails the submission. With the
      // BLD destination unconfigured (current state) this is a no-op log.
      try {
        const forwarded = await forwardLeadToBld(lead, "created");
        if (forwarded.delivered) {
          await db.update(bookedCallLeads)
            .set({ forwardedAt: new Date(), forwardedVia: forwarded.via, updatedAt: new Date() })
            .where(eq(bookedCallLeads.id, lead.id));
        }
      } catch (err) {
        console.error("[booked-call-leads] forward failed:", err instanceof Error ? err.message : err);
      }

      res.status(201).json({ success: true, id: lead.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[booked-call-leads] create failed:", message);
      res.status(500).json({ success: false, error: "Failed to submit — please try again." });
    }
  });

  /**
   * GET /api/booked-call-leads?status=new
   * Admin pipeline review, newest first.
   */
  app.get("/api/booked-call-leads", isAdmin, async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      if (status !== undefined && !isBookedCallLeadStatus(status)) {
        res.status(400).json({ success: false, error: `Invalid status — expected one of: ${BOOKED_CALL_LEAD_STATUSES.join(", ")}` });
        return;
      }
      const leads = status
        ? await db.select().from(bookedCallLeads).where(eq(bookedCallLeads.status, status))
            .orderBy(desc(bookedCallLeads.createdAt)).limit(500)
        : await db.select().from(bookedCallLeads)
            .orderBy(desc(bookedCallLeads.createdAt)).limit(500);
      res.json(leads);
    } catch (err) {
      console.error("[booked-call-leads] list failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to fetch leads" });
    }
  });

  /**
   * PATCH /api/booked-call-leads/:id
   * Advance the pipeline (new → contacted → booked → flipped) and/or add
   * internal notes. Flipping re-forwards to the BLD destination.
   */
  app.patch("/api/booked-call-leads/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const { status, notes } = (req.body ?? {}) as { status?: unknown; notes?: unknown };
      if (status !== undefined && !isBookedCallLeadStatus(status)) {
        res.status(400).json({ success: false, error: `Invalid status — expected one of: ${BOOKED_CALL_LEAD_STATUSES.join(", ")}` });
        return;
      }
      if (notes !== undefined && typeof notes !== "string") {
        res.status(400).json({ success: false, error: "notes must be a string" });
        return;
      }
      if (status === undefined && notes === undefined) {
        res.status(400).json({ success: false, error: "Nothing to update — provide status and/or notes" });
        return;
      }

      const [updated] = await db.update(bookedCallLeads)
        .set({
          ...(status !== undefined ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(bookedCallLeads.id, req.params.id))
        .returning();
      if (!updated) {
        res.status(404).json({ success: false, error: "Lead not found" });
        return;
      }

      // The flip is the hand-off moment — forward to BLD (stub until wired).
      if (status === "flipped") {
        try {
          const forwarded = await forwardLeadToBld(updated, "flipped");
          if (forwarded.delivered) {
            const [reforwarded] = await db.update(bookedCallLeads)
              .set({ forwardedAt: new Date(), forwardedVia: forwarded.via, updatedAt: new Date() })
              .where(eq(bookedCallLeads.id, updated.id))
              .returning();
            res.json({ success: true, lead: reforwarded ?? updated });
            return;
          }
        } catch (err) {
          console.error("[booked-call-leads] flip forward failed:", err instanceof Error ? err.message : err);
        }
      }

      res.json({ success: true, lead: updated });
    } catch (err) {
      console.error("[booked-call-leads] update failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ success: false, error: "Failed to update lead" });
    }
  });
}
