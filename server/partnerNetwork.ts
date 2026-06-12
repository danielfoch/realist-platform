/**
 * Realist Partner Network — onboarding for realtors and mortgage brokers.
 *
 * Flow: landing page (/join/realtors, /join/mortgage-brokers) → signup/login →
 * onboarding wizard (/partner/onboarding) → POST /api/partner-network/join.
 * Joining signs the versioned referral agreement (25% realtor → Valery Real
 * Estate Inc., 50% mortgage broker → BLD Financial), claims a market, and
 * activates lead routing + the partner's CRM seat. No monthly fees.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { logUserActivity } from "./userActivity";
import { crmActivities, crmContacts, users, type Lead, type RealtorLeadNotification } from "@shared/schema";
import {
  NETWORK_PARTNER_TYPES,
  PARTNER_NETWORK_AGREEMENT_VERSION,
  REAL_ESTATE_BOARDS,
  buildReferralAgreement,
  getReferralTerms,
  type NetworkPartnerType,
} from "@shared/partnerNetwork";
import { sendPartnerNetworkWelcomeEmail } from "./resend";

const joinSchema = z.object({
  partnerType: z.enum(NETWORK_PARTNER_TYPES),
  marketCity: z.string().trim().min(1, "Market city is required"),
  marketRegion: z.string().trim().min(1, "Province/region is required"),
  realEstateBoard: z.string().trim().max(200).optional(),
  brokerageName: z.string().trim().min(1, "Brokerage/company name is required"),
  licenseNumber: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  signedName: z.string().trim().min(1, "Full legal name is required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
});

export function registerPartnerNetworkRoutes(app: Express): void {
  // Public: terms + boards for the onboarding wizard and landing pages.
  app.get("/api/partner-network/terms", (req: Request, res: Response) => {
    const requested = typeof req.query.type === "string" ? req.query.type : "realtor";
    const partnerType: NetworkPartnerType = requested === "mortgage_broker" ? "mortgage_broker" : "realtor";
    const terms = getReferralTerms(partnerType);
    res.json({
      terms,
      agreementVersion: PARTNER_NETWORK_AGREEMENT_VERSION,
      boards: REAL_ESTATE_BOARDS,
    });
  });

  app.post("/api/partner-network/join", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const parsed = joinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const data = parsed.data;

      const existingClaims = await storage.getRealtorMarketClaimsByUser(userId);
      const duplicate = existingClaims.find(
        (c) =>
          c.status === "active" &&
          (c.partnerType ?? "realtor") === data.partnerType &&
          c.marketCity.toLowerCase() === data.marketCity.toLowerCase() &&
          c.marketRegion.toLowerCase() === data.marketRegion.toLowerCase(),
      );
      if (duplicate) {
        return res.status(400).json({ error: "You already have an active claim for this market" });
      }

      const partner = await storage.upsertIndustryPartner({
        userId,
        partnerType: data.partnerType,
        companyName: data.brokerageName,
        licenseNumber: data.licenseNumber || null,
        phone: data.phone || null,
      });

      const terms = getReferralTerms(data.partnerType);
      const signedAt = new Date();
      const agreement = buildReferralAgreement({
        partnerType: data.partnerType,
        signedName: data.signedName,
        brokerageName: data.brokerageName,
        marketCity: data.marketCity,
        marketRegion: data.marketRegion,
        realEstateBoard: data.partnerType === "realtor" ? data.realEstateBoard || null : null,
        licenseNumber: data.licenseNumber || null,
        signedAtIso: signedAt.toISOString(),
      });

      const claim = await storage.createRealtorMarketClaim({
        userId,
        partnerId: partner.id,
        partnerType: data.partnerType,
        marketCity: data.marketCity,
        marketRegion: data.marketRegion,
        realEstateBoard: data.partnerType === "realtor" ? data.realEstateBoard || null : null,
        brokerageName: data.brokerageName,
        licenseNumber: data.licenseNumber || null,
        status: "active",
        referralFeePercent: terms.feePercent,
        referralPayeeName: terms.payeeName,
        referralPayeeCompany: terms.payeeCompany,
        referralAgreementVersion: agreement.version,
        referralAgreementText: agreement.text,
        referralAgreementSignedAt: signedAt,
        referralAgreementSignature: data.signatureDataUrl,
        referralAgreementSignedName: data.signedName,
        monthlyFee: 0,
      });

      logUserActivity(req, {
        userId,
        eventName: "partner_network_joined",
        source: "partner_network",
        sourcePage: "/partner/onboarding",
        metadata: {
          partnerType: data.partnerType,
          marketCity: data.marketCity,
          marketRegion: data.marketRegion,
          realEstateBoard: data.realEstateBoard || null,
          referralFeePercent: terms.feePercent,
          agreementVersion: agreement.version,
        },
      }).catch((err) => console.error("partner_network_joined event error:", err));

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (user) {
        sendPartnerNetworkWelcomeEmail({
          to: user.email,
          partnerName: data.signedName,
          partnerLabel: terms.partnerLabel,
          marketCity: data.marketCity,
          marketRegion: data.marketRegion,
          feePercent: terms.feePercent,
          payeeName: terms.payeeName,
          payeeCompany: terms.payeeCompany,
          agreementText: agreement.text,
        }).catch((err) => console.error("Partner welcome email error:", err));
      }

      res.json({ claim, agreement: { version: agreement.version, title: agreement.title } });
    } catch (error) {
      console.error("Partner network join error:", error);
      res.status(500).json({ error: "Failed to join the partner network" });
    }
  });
}

/**
 * CRM seat handoff: when a partner claims a lead, drop it into their CRM as a
 * contact with a system activity, so every referred lead is managed (and
 * instrumented) inside the platform. Idempotent per (owner, email).
 */
export async function handoffClaimedLeadToCrm(params: {
  req: Request | null;
  partnerUserId: string;
  lead: Lead;
  notification: RealtorLeadNotification;
}): Promise<string | null> {
  const { partnerUserId, lead, notification } = params;
  try {
    let [contact] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.ownerUserId, partnerUserId), eq(crmContacts.email, lead.email)))
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(crmContacts)
        .values({
          ownerUserId: partnerUserId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone ?? null,
          contactType: "investor",
          stage: "new",
          source: "realist_network",
          sourceDetail: notification.dealAddress || notification.dealCity || "Realist referred lead",
          targetMarket: notification.dealCity || null,
          consentEmail: lead.consent ?? false,
          data: { realtorLeadNotificationId: notification.id },
        })
        .returning();
    }

    await db.insert(crmActivities).values({
      contactId: contact.id,
      userId: partnerUserId,
      kind: "system",
      body: `Referred lead claimed via the Realist Partner Network${notification.dealAddress ? ` — was analyzing ${notification.dealAddress}` : ""}${notification.dealStrategy ? ` (${notification.dealStrategy.replace(/_/g, " ")})` : ""}. Introduction email sent.`,
      metadata: {
        realtorLeadNotificationId: notification.id,
        dealCity: notification.dealCity,
        dealRegion: notification.dealRegion,
        dealStrategy: notification.dealStrategy,
      },
    });

    logUserActivity(params.req, {
      userId: partnerUserId,
      eventName: "partner_lead_claimed",
      source: "partner_network",
      metadata: {
        leadId: lead.id,
        notificationId: notification.id,
        crmContactId: contact.id,
        dealCity: notification.dealCity,
        dealRegion: notification.dealRegion,
        dealStrategy: notification.dealStrategy,
      },
    }).catch((err) => console.error("partner_lead_claimed event error:", err));

    return contact.id;
  } catch (err) {
    console.error("CRM handoff for claimed lead failed:", err);
    return null;
  }
}
