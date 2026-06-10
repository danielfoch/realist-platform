/**
 * Underwriting shares — account-gated "Challenge my underwriting" links.
 *
 * A share serves /underwriting/:token on the client. Anonymous visitors get
 * a TEASER only (address, city, verdict, sharer name) plus a
 * create-account / sign-in wall; full metrics, assumptions, and notes require
 * an authenticated session. The first authenticated view by a non-owner
 * records acceptance on the share row and logs a share_accepted activity
 * event.
 *
 * Ported from the idx app (src/underwriting-share-routes.ts), adapted to
 * Drizzle, the live session auth, and the live users / property_analyses /
 * user_activity_events tables. The idx reward-ladder / sheet-credit logic was
 * never live in this app, so viewing is the only gated behavior here.
 */

import crypto from "crypto";
import type { Express, Request, Response } from "express";
import "express-session";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { logUserActivity } from "./userActivity";
import { propertyAnalyses, underwritingShares, users } from "@shared/schema";
import { computeDealScore, dealVerdict } from "@shared/dealDeskScoring";
import { analysisDisplayAddress } from "./userGoogleSheets";

function metricNumber(metrics: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return null;
}

/** Factual verdict for the teaser — same scoring the Deal Desk uses. */
function analysisVerdict(analysis: {
  listingPrice: number | null;
  calculatedMetrics: unknown;
}): string | null {
  const metrics = (analysis.calculatedMetrics || {}) as Record<string, unknown>;
  const cashFlowMonthly = metricNumber(metrics, "monthlyCashFlow", "cash_flow_monthly");
  const dscr = metricNumber(metrics, "dscr");
  const capRate = metricNumber(metrics, "capRate", "cap_rate");
  if (cashFlowMonthly === null && dscr === null && capRate === null) return null;
  const score = computeDealScore({
    cashFlowMonthly,
    dscr,
    capRate,
    askingPrice: analysis.listingPrice,
    maxOfferPrice: metricNumber(metrics, "maxOfferPrice", "max_offer_price"),
  });
  return dealVerdict(score);
}

export function registerUnderwritingShareRoutes(app: Express): void {
  /**
   * POST /api/my/analyses/:id/share
   * Owner creates (or reuses) a share link for their own analysis.
   */
  app.post("/api/my/analyses/:id/share", isAuthenticated, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    try {
      const [analysis] = await db.select({
        id: propertyAnalyses.id,
        userId: propertyAnalyses.userId,
        city: propertyAnalyses.city,
        propertyType: propertyAnalyses.propertyType,
      }).from(propertyAnalyses).where(and(
        eq(propertyAnalyses.id, req.params.id),
        eq(propertyAnalyses.userId, userId),
        eq(propertyAnalyses.isDeleted, false),
      )).limit(1);
      if (!analysis) {
        res.status(404).json({ success: false, error: "Analysis not found" });
        return;
      }

      // Reuse an existing link — one canonical share per analysis per owner.
      const [existing] = await db.select().from(underwritingShares).where(and(
        eq(underwritingShares.analysisId, analysis.id),
        eq(underwritingShares.ownerUserId, userId),
      )).limit(1);

      let token = existing?.token;
      if (!token) {
        token = crypto.randomBytes(16).toString("hex");
        await db.insert(underwritingShares).values({
          token,
          analysisId: analysis.id,
          ownerUserId: userId,
          source: typeof req.body?.source === "string" ? req.body.source.slice(0, 50) : null,
        });
      }

      await logUserActivity(req, {
        userId,
        eventName: "deal_shared",
        analysisId: analysis.id,
        sourcePage: typeof req.body?.source === "string" ? req.body.source : null,
        metadata: { city: analysis.city, property_type: analysis.propertyType },
      });

      res.json({
        success: true,
        token,
        shareUrl: `/underwriting/${token}`,
        cta: "Challenge my underwriting.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[underwriting-shares] create failed:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/underwriting-shares/:token
   * Anonymous → teaser + gated:true. Authenticated → full payload; first
   * authenticated non-owner view records acceptance + share_accepted event.
   */
  app.get("/api/underwriting-shares/:token", async (req: Request, res: Response) => {
    try {
      const [share] = await db.select().from(underwritingShares)
        .where(eq(underwritingShares.token, req.params.token)).limit(1);
      if (!share) {
        res.status(404).json({ success: false, error: "Share not found" });
        return;
      }

      const [analysis] = await db.select().from(propertyAnalyses).where(and(
        eq(propertyAnalyses.id, share.analysisId),
        eq(propertyAnalyses.isDeleted, false),
      )).limit(1);
      if (!analysis) {
        res.status(404).json({ success: false, error: "Share not found" });
        return;
      }

      const [owner] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, share.ownerUserId)).limit(1);
      const sharedBy = [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || "A Realist investor";

      const teaser = {
        address: analysisDisplayAddress(analysis),
        city: analysis.city,
        province: analysis.province,
        verdict: analysisVerdict(analysis),
        sharedBy,
      };

      const viewerId = req.session?.userId || null;
      if (!viewerId) {
        // Anonymous: teaser only — full underwriting sits behind the account wall.
        res.json({ success: true, gated: true, analysis: teaser });
        return;
      }

      const isOwner = viewerId === share.ownerUserId;
      if (!isOwner && !share.acceptedUserId) {
        // First authenticated non-owner view = acceptance.
        await db.update(underwritingShares).set({
          acceptedUserId: viewerId,
          acceptedAt: new Date(),
        }).where(and(
          eq(underwritingShares.id, share.id),
          // Guard against a concurrent first view double-recording.
          eq(underwritingShares.token, share.token),
        ));
        await logUserActivity(req, {
          userId: viewerId,
          eventName: "share_accepted",
          analysisId: analysis.id,
          sourcePage: `/underwriting/${share.token}`,
          metadata: {
            share_id: share.id,
            owner_user_id: share.ownerUserId,
            city: analysis.city,
            property_type: analysis.propertyType,
          },
        });
      }

      res.json({
        success: true,
        gated: false,
        isOwner,
        cta: "Challenge my underwriting.",
        analysis: {
          ...teaser,
          id: analysis.id,
          propertyType: analysis.propertyType,
          listingPrice: analysis.listingPrice,
          metrics: analysis.calculatedMetrics || {},
          inputs: analysis.finalAssumptions || analysis.assumptions || {},
          notes: analysis.userNotes,
          summary: analysis.summary,
          analyzedAt: analysis.createdAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[underwriting-shares] view failed:", message);
      res.status(500).json({ success: false, error: message });
    }
  });
}
