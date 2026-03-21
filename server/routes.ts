import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { google } from "googleapis";
import { storage } from "./storage";
import { db } from "./db";
import { 
  insertLeadSchema, 
  insertPropertySchema, 
  insertAnalysisSchema, 
  insertSavedDealSchema,
  insertInvestorProfileSchema,
  insertInvestorKycSchema,
  insertPortfolioPropertySchema,
  insertIndustryPartnerSchema,
  insertCoachingWaitlistSchema,
  insertUnderwritingNoteSchema,
  insertListingCommentSchema,
  insertVoteSchema,
  users,
  renoQuoteLineItemSchema,
  renoQuoteAssumptionsSchema,
  type RenoQuoteLineItem,
  type RenoQuoteAssumptions,
  trueCostInquiries,
  trueCostBreakdowns,
  capstoneProjects,
  capstoneProperties,
  capstoneCostModels,
  capstoneProformas,
  analyses,
  rentPulse,
  rentListings,
  underwritingNotes,
  listingComments,
  insertBlogPostSchema,
  insertGuideSchema,
  dataCache,
  distressSnapshots,
} from "@shared/schema";
import { eq, and, desc, inArray, sql, count } from "drizzle-orm";
import { z } from "zod";
import { getEvents, forceRefreshEvents, clearEventCache } from "./eventbrite";
import { setupAuth, registerAuthRoutes, isAuthenticated, isAdmin } from "./auth";
import { passwordResetTokens } from "@shared/models/auth";
import { exportToGoogleSheets } from "./googleSheets";
import { calculateRenoQuotePricing, getLineItemCatalog } from "./renoQuotePricing";
import { 
  sendPodcastQuestionNotification, 
  sendLeadNotification, 
  sendRenoQuoteNotification,
  sendContactHostNotification,
  sendExpertApplicationNotification,
  sendMarketExpertApplyNotification,
  sendCoachingWaitlistNotification,
  sendNotificationEmail,
  sendMLIQuoteNotification,
  sendRealtorIntroEmail,
  sendWelcomeAccountEmail,
} from "./resend";
import { authStorage } from "./replit_integrations/auth/storage";
import { 
  calculateTrueCost, 
  cities, 
  homeTypes, 
  buyerTypes,
  municipalities,
  matchMunicipality,
  type TrueCostInput,
} from "./costData";

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit.entries()) {
    if (now > entry.resetTime) {
      rateLimit.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

const createLeadRequestSchema = z.object({
  lead: insertLeadSchema,
  property: insertPropertySchema.omit({ leadId: true }),
  analysis: insertAnalysisSchema.omit({ leadId: true, propertyId: true }),
});

async function sendWebhook(leadId: string, payload: object) {
  const webhookUrl = process.env.GHL_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("No GHL_WEBHOOK_URL configured, skipping webhook");
    return;
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      
      await storage.createWebhookLog({
        leadId,
        endpoint: webhookUrl,
        payloadJson: payload,
        status: response.ok ? "success" : "failed",
        response: responseText,
        attempts: attempt,
      });

      if (response.ok) {
        console.log(`Webhook sent successfully on attempt ${attempt}`);
        return;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${responseText}`);
    } catch (error) {
      lastError = error as Error;
      console.error(`Webhook attempt ${attempt} failed:`, error);
    }

    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  await storage.createWebhookLog({
    leadId,
    endpoint: webhookUrl,
    payloadJson: payload,
    status: "failed",
    response: lastError?.message || "Unknown error",
    attempts: maxAttempts,
  });
}

// Backup leads to Google Sheets via webhook
async function sendToGoogleSheets(leadData: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  source: string;
  tags?: string[];
}) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!url || !secret) {
    console.log("Google Sheets webhook not configured, skipping backup");
    return;
  }

  try {
    const payload = {
      event_id: crypto.randomUUID(),
      event_ts: new Date().toISOString(),
      event_type: "lead_created",
      email: leadData.email,
      first_name: leadData.firstName,
      last_name: leadData.lastName,
      phone: leadData.phone,
      source_primary: "realist",
      source_detail: leadData.source,
      tags: leadData.tags || [],
    };

    const body = JSON.stringify(payload);
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const webhookUrl = url.includes("?") ? `${url}&sig=${sig}` : `${url}?sig=${sig}`;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    if (response.ok) {
      console.log(`Lead backed up to Google Sheets: ${leadData.email}`);
    } else {
      console.error(`Google Sheets backup failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Google Sheets backup error:", error);
  }
}

async function autoEnrollLeadAsUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  leadSource?: string;
}): Promise<{ userId: string; isNew: boolean }> {
  const emailLower = params.email.toLowerCase();

  const existingUser = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);
  if (existingUser.length > 0) {
    return { userId: existingUser[0].id, isNew: false };
  }

  let newUser;
  try {
    const [inserted] = await db.insert(users).values({
      email: emailLower,
      firstName: params.firstName || null,
      lastName: params.lastName || null,
      phone: params.phone || null,
      role: "user",
    }).returning();
    newUser = inserted;
  } catch (err: any) {
    if (err?.code === "23505") {
      const [existing] = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);
      if (existing) return { userId: existing.id, isNew: false };
    }
    throw err;
  }

  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.userId, newUser.id),
      sql`${passwordResetTokens.usedAt} IS NULL`
    ));

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: newUser.id,
    token: tokenHash,
    expiresAt,
  });

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.replit.app`
      : "https://realist.ca";
  const setupLink = `${baseUrl}/set-password?token=${rawToken}`;

  sendWelcomeAccountEmail({
    toEmail: emailLower,
    firstName: params.firstName || "there",
    setupLink,
    leadSource: params.leadSource,
  }).catch(err => console.error("Welcome email error:", err));

  console.log(`Auto-enrolled user for: ${emailLower} (setup link generated)`);
  return { userId: newUser.id, isNew: true };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Set up email/password authentication
  setupAuth(app);
  registerAuthRoutes(app);
  
  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = createLeadRequestSchema.parse(req.body);
      
      const lead = await storage.createLead(validatedData.lead);

      const property = await storage.createProperty({
        ...validatedData.property,
        leadId: lead.id,
      });

      const rawBody = req.body as any;
      const inputsData = (rawBody?.analysis?.inputsJson || {}) as Record<string, any>;
      const propertyData = (rawBody?.property || {}) as Record<string, any>;
      const analysis = await storage.createAnalysis({
        countryMode: validatedData.analysis.countryMode,
        strategyType: validatedData.analysis.strategyType,
        inputsJson: validatedData.analysis.inputsJson,
        resultsJson: validatedData.analysis.resultsJson,
        leadId: lead.id,
        propertyId: property.id,
        userId: (req.session as any)?.userId || null,
        address: propertyData.formattedAddress || null,
        city: propertyData.city || null,
        province: propertyData.region || null,
        rentInputs: inputsData.monthlyRent != null ? {
          monthlyRent: inputsData.monthlyRent,
          rentPerUnit: inputsData.rentPerUnit,
          numberOfUnits: inputsData.numberOfUnits,
          additionalIncome: inputsData.additionalIncome,
        } : null,
        vacancyRate: inputsData.vacancyRate != null ? Number(inputsData.vacancyRate) : null,
        expenseAssumptions: inputsData.operatingExpenses != null || inputsData.propertyTax != null || inputsData.insurance != null ? {
          operatingExpenses: inputsData.operatingExpenses,
          propertyTax: inputsData.propertyTax,
          insurance: inputsData.insurance,
          maintenance: inputsData.maintenance,
          managementFee: inputsData.managementFee,
          utilities: inputsData.utilities,
        } : null,
      });

      // Format phone to E.164 format for GHL
      const formatPhoneE164 = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      // Split name into firstName and lastName for GHL
      const nameParts = lead.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // GHL expects these specific fields in the JSON body
      sendWebhook(lead.id, {
        email: lead.email,
        firstName: firstName,
        lastName: lastName,
        phone: formatPhoneE164(lead.phone),
        fullName: lead.name,
        consent: lead.consent,
        leadSource: lead.leadSource,
        formTag: "deal_analyzer",
        propertyAddress: property.formattedAddress,
        propertyCity: property.city,
        propertyRegion: property.region,
        propertyCountry: property.country,
        analysisStrategy: analysis.strategyType,
        analysisCountryMode: analysis.countryMode,
        createdAt: lead.createdAt,
      }).catch(err => console.error("Webhook error:", err));

      // Backup to Google Sheets
      sendToGoogleSheets({
        email: lead.email,
        firstName,
        lastName,
        phone: lead.phone,
        source: "Deal Analyzer",
        tags: ["deal_analyzer", property.region || "unknown_region"],
      }).catch(err => console.error("Google Sheets backup error:", err));

      // Send email notification
      sendLeadNotification({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        address: property.formattedAddress,
        strategy: analysis.strategyType,
        source: lead.leadSource || 'Deal Analyzer',
      }).catch(err => console.error("Email notification error:", err));

      // Notify realtors who have claimed this market
      if (property.city && property.region) {
        (async () => {
          try {
            const activeClaims = await storage.getActiveClaimsForMarket(property.city!, property.region!);
            const baseUrl = process.env.REPLIT_DEV_DOMAIN
              ? `https://${process.env.REPLIT_DEV_DOMAIN}`
              : process.env.REPL_SLUG
                ? `https://${process.env.REPL_SLUG}.replit.app`
                : "https://realist.ca";

            for (const claim of activeClaims) {
              await storage.createRealtorLeadNotification({
                realtorClaimId: claim.id,
                realtorUserId: claim.userId,
                leadId: lead.id,
                propertyId: property.id,
                analysisId: analysis.id,
                dealAddress: property.formattedAddress,
                dealCity: property.city,
                dealRegion: property.region,
                dealStrategy: analysis.strategyType,
                status: "new",
                notifiedAt: new Date(),
              });

              // Send email alert to the realtor
              try {
                const [realtorUser] = await db.select().from(users).where(eq(users.id, claim.userId));
                if (realtorUser) {
                  const realtorName = `${realtorUser.firstName || ''} ${realtorUser.lastName || ''}`.trim() || realtorUser.email;
                  const { sendRealtorLeadAlert } = await import("./resend");
                  sendRealtorLeadAlert({
                    realtorEmail: realtorUser.email,
                    realtorName,
                    leadName: lead.name,
                    dealAddress: property.formattedAddress || undefined,
                    dealCity: property.city || undefined,
                    dealStrategy: analysis.strategyType,
                    claimUrl: `${baseUrl}/partner/network`,
                  }).catch(err => console.error("Realtor lead alert email error:", err));
                }
              } catch (emailErr) {
                console.error("Realtor alert email lookup error:", emailErr);
              }
            }
            if (activeClaims.length > 0) {
              console.log(`Notified ${activeClaims.length} realtor(s) for market: ${property.city}, ${property.region}`);
            }
          } catch (notifyErr) {
            console.error("Realtor notification error:", notifyErr);
          }
        })();
      }

      let userId: string | null = null;
      try {
        const enrollment = await autoEnrollLeadAsUser({
          email: lead.email,
          firstName,
          lastName,
          phone: lead.phone,
          leadSource: lead.leadSource || "Deal Analyzer",
        });
        userId = enrollment.userId;
      } catch (userError) {
        console.error("Auto-enroll user error:", userError);
      }

      res.json({
        success: true,
        data: {
          leadId: lead.id,
          propertyId: property.id,
          analysisId: analysis.id,
          userId,
        },
      });
    } catch (error) {
      console.error("Error creating lead:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          error: "Validation error", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: "Failed to create lead" 
        });
      }
    }
  });

  // MLI Select Quote Request endpoint
  app.post("/api/leads/mli-quote", async (req, res) => {
    try {
      const { name, email, phone, location, inputs, results } = req.body;

      if (!name || !email || !phone) {
        res.status(400).json({ error: "Name, email, and phone are required" });
        return;
      }

      // Create the lead
      const lead = await storage.createLead({
        name,
        email,
        phone,
        consent: true,
        leadSource: "MLI Select Calculator",
      });

      // Send email notification to nick@bldfinancial.ca
      sendMLIQuoteNotification({
        name,
        email,
        phone,
        location: location || inputs?.location,
        totalPoints: results?.totalPoints,
        tier: results?.tier,
        dscr: results?.base?.dscr,
        equityRequired: results?.base?.equityRequired,
        noi: results?.base?.noi,
        purchasePrice: inputs?.purchasePrice,
        loanAmount: inputs?.loanAmount || (inputs?.purchasePrice ? inputs.purchasePrice * (inputs.ltv || 75) / 100 : undefined),
        interestRate: inputs?.interestRate,
        stressTestResults: results ? { base: results.base, bear: results.bear, bull: results.bull } : undefined,
      }).catch(err => console.error("MLI quote notification error:", err));

      // Also send to GHL webhook
      const formatPhoneE164 = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      sendWebhook(lead.id, {
        email,
        firstName,
        lastName,
        phone: formatPhoneE164(phone),
        fullName: name,
        consent: true,
        leadSource: "MLI Select Calculator",
        formTag: "mli_select_quote",
        mliPoints: results?.totalPoints,
        mliTier: results?.tier,
        dscr: results?.base?.dscr,
        createdAt: lead.createdAt,
      }).catch(err => console.error("Webhook error:", err));

      // Backup to Google Sheets
      sendToGoogleSheets({
        email,
        firstName,
        lastName,
        phone,
        source: "MLI Select Calculator",
        tags: ["mli_select", location || "unknown_location"],
      }).catch(err => console.error("Google Sheets backup error:", err));

      autoEnrollLeadAsUser({
        email,
        firstName,
        lastName,
        phone,
        leadSource: "MLI Select Calculator",
      }).catch(err => console.error("Auto-enroll user error:", err));

      res.json({ success: true, data: { leadId: lead.id } });
    } catch (error) {
      console.error("Error creating MLI quote request:", error);
      res.status(500).json({ error: "Failed to submit quote request" });
    }
  });

  // Lead engagement endpoint with tagging for cashback, mortgage consultation, and local expert
  app.post("/api/leads/engage", async (req, res) => {
    try {
      const { name, email, phone, consent, formType, formTag, tags, dealInfo, province, city } = req.body;

      if (!name || !email || !phone) {
        res.status(400).json({ error: "Name, email, and phone are required" });
        return;
      }

      // Create the lead
      const lead = await storage.createLead({
        name,
        email,
        phone,
        consent: consent || false,
        leadSource: formType || "Deal Engagement",
      });

      // Format phone to E.164 format for GHL
      const formatPhoneE164 = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      // Split name into firstName and lastName for GHL
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Build tags array
      const allTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
      
      // Add province tag if provided
      if (province) {
        allTags.push(`LEAD_${province}`);
      }

      // Send to webhook with tags
      sendWebhook(lead.id, {
        email,
        firstName,
        lastName,
        phone: formatPhoneE164(phone),
        fullName: name,
        consent: consent || false,
        leadSource: formType || "Deal Engagement",
        formTag: formTag || "engagement",
        tags: allTags,
        formType,
        province,
        city,
        dealInfo: dealInfo || {},
        createdAt: lead.createdAt,
      }).catch(err => console.error("Webhook error:", err));

      // Backup to Google Sheets
      sendToGoogleSheets({
        email,
        firstName,
        lastName,
        phone,
        source: formType || "Deal Engagement",
        tags: allTags,
      }).catch(err => console.error("Google Sheets backup error:", err));

      // Send email notification
      sendLeadNotification({
        name,
        email,
        phone,
        strategy: formType,
        source: formTag || formType || 'Deal Engagement',
      }).catch(err => console.error("Email notification error:", err));

      autoEnrollLeadAsUser({
        email,
        firstName,
        lastName,
        phone,
        leadSource: formType || "Deal Engagement",
      }).catch(err => console.error("Auto-enroll user error:", err));

      res.json({ success: true, data: { leadId: lead.id } });
    } catch (error) {
      console.error("Error creating engagement lead:", error);
      res.status(500).json({ error: "Failed to submit request" });
    }
  });

  // Test endpoint for Google Sheets webhook
  app.post("/api/sheets/ping", async (req, res) => {
    try {
      const url = process.env.SHEETS_WEBHOOK_URL!;
      const secret = process.env.WEBHOOK_SECRET!;
      if (!url || !secret) throw new Error("Missing env vars");

      const payload = {
        event_id: crypto.randomUUID(),
        event_ts: new Date().toISOString(),
        event_type: "user_created",
        email: `test+${Date.now()}@example.com`,
        first_name: "Dan",
        last_name: "Test",
        source_primary: "realist",
        source_detail: "ping",
        tags: ["test"]
      };

      const body = JSON.stringify(payload);
      const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
      const webhookUrl = url.includes("?") ? `${url}&sig=${sig}` : `${url}?sig=${sig}`;

      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

      const text = await r.text();
      res.status(r.status).send(text);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.get("/api/admin/leads", isAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const [totalLeads, todayLeads, totalAnalyses] = await Promise.all([
        storage.getLeadsCount(),
        storage.getTodayLeadsCount(),
        storage.getAnalysisCount(),
      ]);

      res.json({
        totalLeads,
        todayLeads,
        totalAnalyses,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get all market expert applications (admin only)
  app.get("/api/admin/applications", isAdmin, async (req, res) => {
    try {
      const applications = await storage.getAllMarketExpertApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Zod schemas for admin endpoints
  const updateApplicationStatusSchema = z.object({
    status: z.enum(["approved", "rejected", "pending"]),
  });

  const updateUserRoleSchema = z.object({
    role: z.enum(["investor", "partner", "admin"]),
  });

  // Approve or reject a market expert application (admin only)
  app.patch("/api/admin/applications/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = updateApplicationStatusSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status", details: parsed.error.errors });
      }
      
      const { status } = parsed.data;
      const updates: { status: string; approvedAt?: Date } = { status };
      if (status === "approved") {
        updates.approvedAt = new Date();
      }
      
      const application = await storage.updateMarketExpertApplication(id, updates);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.createdAt);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = updateUserRoleSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid role", details: parsed.error.errors });
      }
      
      const { role } = parsed.data;
      const [updated] = await db.update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ id: updated.id, email: updated.email, role: updated.role });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.post("/api/admin/import-csv-users", isAdmin, async (req, res) => {
    try {
      const { users: csvUsers, sendEmails } = req.body;
      if (!Array.isArray(csvUsers) || csvUsers.length === 0) {
        return res.status(400).json({ error: "No users provided" });
      }
      const results = { imported: 0, existing: 0, failed: 0, details: [] as string[] };

      for (const row of csvUsers) {
        try {
          const email = (row.email || "").toLowerCase().trim();
          if (!email) { results.failed++; continue; }

          const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (existing) {
            results.existing++;
            continue;
          }

          const [newUser] = await db.insert(users).values({
            email,
            firstName: row.first_name || row.firstName || null,
            lastName: row.last_name || row.lastName || null,
            phone: row.phone || null,
            role: row.role || "user",
          }).returning();

          const rawToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await db.insert(passwordResetTokens).values({
            userId: newUser.id,
            token: tokenHash,
            expiresAt,
          });

          if (sendEmails !== false) {
            const baseUrl = process.env.REPLIT_DEV_DOMAIN
              ? `https://${process.env.REPLIT_DEV_DOMAIN}`
              : process.env.REPL_SLUG
                ? `https://${process.env.REPL_SLUG}.replit.app`
                : "https://realist.ca";
            sendWelcomeAccountEmail({
              toEmail: email,
              firstName: row.first_name || row.firstName || "there",
              setupLink: `${baseUrl}/set-password?token=${rawToken}`,
              leadSource: "Account Recovery",
            }).catch(err => console.error(`Welcome email error for ${email}:`, err));
          }

          results.imported++;
          results.details.push(email);
        } catch (err: any) {
          if (err?.code === "23505") { results.existing++; }
          else { results.failed++; console.error(`Import failed for ${row.email}:`, err); }
        }
      }

      console.log(`CSV import: ${results.imported} imported, ${results.existing} existing, ${results.failed} failed`);
      res.json({ success: true, ...results });
    } catch (error) {
      console.error("Error importing CSV users:", error);
      res.status(500).json({ error: "Failed to import users" });
    }
  });

  app.post("/api/admin/import-csv-leads", isAdmin, async (req, res) => {
    try {
      const { leads: csvLeads } = req.body;
      if (!Array.isArray(csvLeads) || csvLeads.length === 0) {
        return res.status(400).json({ error: "No leads provided" });
      }
      const results = { imported: 0, duplicate: 0, failed: 0 };

      for (const row of csvLeads) {
        try {
          const email = (row.email || "").trim();
          if (!email) { results.failed++; continue; }

          await storage.createLead({
            name: row.name || "",
            email,
            phone: row.phone || "",
            consent: row.consent === "true" || row.consent === true,
            leadSource: row.lead_source || row.leadSource || "Import",
          });
          results.imported++;
        } catch (err: any) {
          if (err?.code === "23505") { results.duplicate++; }
          else { results.failed++; }
        }
      }

      console.log(`CSV lead import: ${results.imported} imported, ${results.duplicate} duplicate, ${results.failed} failed`);
      res.json({ success: true, ...results });
    } catch (error) {
      console.error("Error importing CSV leads:", error);
      res.status(500).json({ error: "Failed to import leads" });
    }
  });

  app.post("/api/admin/backfill-lead-accounts", isAdmin, async (req, res) => {
    try {
      const leadRows = await storage.getAllLeads();
      const results = { created: 0, existing: 0, failed: 0, emails: [] as string[] };

      for (const lead of leadRows) {
        try {
          const nameParts = (lead.name || "").trim().split(' ');
          const enrollment = await autoEnrollLeadAsUser({
            email: lead.email,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            phone: lead.phone || undefined,
            leadSource: lead.leadSource || "Backfill",
          });
          if (enrollment.isNew) {
            results.created++;
            results.emails.push(lead.email);
          } else {
            results.existing++;
          }
        } catch (err) {
          results.failed++;
          console.error(`Backfill failed for ${lead.email}:`, err);
        }
      }

      console.log(`Backfill complete: ${results.created} created, ${results.existing} existing, ${results.failed} failed`);
      res.json({ success: true, ...results });
    } catch (error) {
      console.error("Error backfilling lead accounts:", error);
      res.status(500).json({ error: "Failed to backfill accounts" });
    }
  });

  app.post("/api/admin/city-reports/generate", isAdmin, async (req, res) => {
    try {
      const { city, province, month } = req.body;
      if (!city || !province) return res.status(400).json({ error: "city and province required" });
      const now = new Date();
      const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { generateCityReport } = await import("./cityReportGenerator");
      const result = await generateCityReport(city, province, targetMonth);
      res.json(result);
    } catch (error) {
      console.error("Error generating city report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.post("/api/admin/city-reports/generate-all", isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const targetMonth = req.body.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { TOP_30_CITIES, generateCityReport } = await import("./cityReportGenerator");
      const results = { published: 0, existing: 0, failed: 0, details: [] as string[] };
      for (const entry of TOP_30_CITIES) {
        try {
          const result = await generateCityReport(entry.city, entry.province, targetMonth);
          if (result.created) { results.published++; } else { results.existing++; }
          results.details.push(`${entry.city}: ${result.message}`);
        } catch (err: any) {
          results.failed++;
          results.details.push(`${entry.city}: FAILED — ${err.message}`);
        }
      }
      res.json(results);
    } catch (error) {
      console.error("Error generating all city reports:", error);
      res.status(500).json({ error: "Failed to generate reports" });
    }
  });

  app.get("/api/admin/city-reports/schedule", isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
      const { getCityScheduleForMonth } = await import("./cityReportGenerator");
      const schedule = getCityScheduleForMonth(year, month);
      res.json({ year, month, daysInMonth: new Date(year, month, 0).getDate(), schedule });
    } catch (error) {
      res.status(500).json({ error: "Failed to get schedule" });
    }
  });

  app.post("/api/admin/send-welcome-emails", isAdmin, async (req, res) => {
    try {
      const usersWithoutPasswords = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      }).from(users).where(sql`${users.passwordHash} IS NULL`);

      const results = { sent: 0, failed: 0, emails: [] as string[] };

      for (const user of usersWithoutPasswords) {
        try {
          await db.update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(and(
              eq(passwordResetTokens.userId, user.id),
              sql`${passwordResetTokens.usedAt} IS NULL`
            ));

          const rawToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await db.insert(passwordResetTokens).values({
            userId: user.id,
            token: tokenHash,
            expiresAt,
          });

          const baseUrl = process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : process.env.REPL_SLUG
              ? `https://${process.env.REPL_SLUG}.replit.app`
              : "https://realist.ca";

          await sendWelcomeAccountEmail({
            toEmail: user.email,
            firstName: user.firstName || "there",
            setupLink: `${baseUrl}/set-password?token=${rawToken}`,
            leadSource: "Account Recovery",
          });

          results.sent++;
          results.emails.push(user.email);

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          results.failed++;
          console.error(`Welcome email failed for ${user.email}:`, err);
        }
      }

      console.log(`Welcome email blast: ${results.sent} sent, ${results.failed} failed`);
      res.json({ success: true, ...results });
    } catch (error) {
      console.error("Error sending welcome emails:", error);
      res.status(500).json({ error: "Failed to send welcome emails" });
    }
  });

  // ============================================
  // MORTGAGE RATES API ROUTES
  // ============================================

  app.get("/api/mortgage-rates", async (req, res) => {
    try {
      const { getAllCurrentRates } = await import("./rateScraper");
      const rates = await getAllCurrentRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching mortgage rates:", error);
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  });

  app.get("/api/mortgage-rates/history", async (req, res) => {
    try {
      const { getRateHistory } = await import("./rateScraper");
      const rates = await getRateHistory(
        req.query.rateType as string | undefined,
        req.query.term as string | undefined,
      );
      res.json(rates);
    } catch (error) {
      console.error("Error fetching rate history:", error);
      res.status(500).json({ error: "Failed to fetch rate history" });
    }
  });

  app.post("/api/admin/mortgage-rates/scrape", isAdmin, async (req, res) => {
    try {
      const { runRateScrape } = await import("./rateScraper");
      const result = await runRateScrape();
      res.json(result);
    } catch (error) {
      console.error("Error running rate scrape:", error);
      res.status(500).json({ error: "Failed to scrape rates" });
    }
  });

  app.post("/api/admin/mortgage-rates", isAdmin, async (req, res) => {
    try {
      const { rateType, term, rate, provider, source, category, isInsured } = req.body;
      if (!rateType || !term || !rate || !provider) {
        return res.status(400).json({ error: "rateType, term, rate, provider required" });
      }
      const { mortgageRates: ratesTable } = await import("@shared/schema");
      const [result] = await db.insert(ratesTable).values({
        rateType, term, rate: parseFloat(rate), provider,
        source: source || "manual",
        category: category || "custom",
        isInsured: isInsured ?? false,
        lastUpdated: new Date(),
      }).returning();
      res.json(result);
    } catch (error) {
      console.error("Error adding rate:", error);
      res.status(500).json({ error: "Failed to add rate" });
    }
  });

  app.get("/api/rates/mortgage", async (req, res) => {
    try {
      const { getAllCurrentRates } = await import("./rateScraper");
      const rates = await getAllCurrentRates();
      const termYears = req.query.termYears as string || "5";
      const type = req.query.type as string || "fixed";
      const termLabel = `${termYears}-year`;

      const matching = rates.filter((r: any) => {
        if (type === "variable") {
          return r.rateType === "variable" && r.category === "best";
        }
        return r.rateType === "fixed" && r.term === termLabel && r.category === "best";
      });

      if (matching.length === 0) {
        const fallback = rates.filter((r: any) => r.rateType === type);
        if (fallback.length > 0) {
          const best = fallback.reduce((a: any, b: any) => a.rate < b.rate ? a : b);
          return res.json({ bestRate: best.rate, source: best.source, timestamp: best.lastUpdated, count: fallback.length });
        }
        return res.json({ bestRate: null, source: null, timestamp: null, count: 0 });
      }

      const best = matching.reduce((a: any, b: any) => a.rate < b.rate ? a : b);
      res.json({ bestRate: best.rate, source: best.source, timestamp: best.lastUpdated, count: matching.length });
    } catch (error) {
      console.error("Error fetching rate:", error);
      res.status(500).json({ error: "Failed to fetch rate" });
    }
  });

  app.get("/api/rate-forecast/latest", async (req, res) => {
    try {
      const { rateForecasts } = await import("@shared/schema");
      const forecasts = await db.select().from(rateForecasts).orderBy(sql`created_at DESC`).limit(1);
      if (forecasts.length === 0) {
        return res.json(null);
      }
      const f = forecasts[0];
      res.json({
        ...f,
        path: JSON.parse(f.pathJson),
        assumptions: f.assumptionsJson ? JSON.parse(f.assumptionsJson) : null,
      });
    } catch (error) {
      console.error("Error fetching forecast:", error);
      res.json(null);
    }
  });

  // ============================================
  // RENOQUOTE API ROUTES
  // ============================================

  const createRenoQuoteSchema = z.object({
    persona: z.enum(["homeowner", "investor", "multiplex"]),
    address: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().default("canada"),
    postalCode: z.string().optional(),
    propertyType: z.string().optional(),
    existingSqft: z.number().nullable().optional(),
    bedrooms: z.number().nullable().optional(),
    bathrooms: z.number().nullable().optional(),
    basementType: z.string().optional(),
    basementHeight: z.number().nullable().optional(),
    projectIntents: z.array(z.string()).optional(),
    lineItems: z.array(renoQuoteLineItemSchema),
    assumptions: renoQuoteAssumptionsSchema,
    leadName: z.string().optional(),
    leadEmail: z.string().email().optional(),
    leadPhone: z.string().optional(),
    leadConsent: z.boolean().default(false),
  });

  app.get("/api/reno-quotes/catalog", (req, res) => {
    const persona = (req.query.persona as string) || "homeowner";
    const validPersonas = ["homeowner", "investor", "multiplex"];
    const selectedPersona = validPersonas.includes(persona) ? persona : "homeowner";
    res.json(getLineItemCatalog(selectedPersona as "homeowner" | "investor" | "multiplex"));
  });

  app.post("/api/reno-quotes/calculate", (req, res) => {
    try {
      const parsed = createRenoQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }
      
      const { lineItems, assumptions, persona, country, region, city, existingSqft } = parsed.data;
      
      const pricingResult = calculateRenoQuotePricing(
        lineItems as RenoQuoteLineItem[],
        assumptions as RenoQuoteAssumptions,
        { country, region, city, existingSqft, persona }
      );
      
      res.json(pricingResult);
    } catch (error) {
      console.error("Error calculating reno quote:", error);
      res.status(500).json({ error: "Failed to calculate renovation estimate" });
    }
  });

  app.post("/api/reno-quotes", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      
      const parsed = createRenoQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }
      
      const { lineItems, assumptions, leadName, leadEmail, leadPhone, leadConsent, ...propertyData } = parsed.data;
      
      const pricingResult = calculateRenoQuotePricing(
        lineItems as RenoQuoteLineItem[],
        assumptions as RenoQuoteAssumptions,
        { 
          country: propertyData.country, 
          region: propertyData.region, 
          city: propertyData.city, 
          existingSqft: propertyData.existingSqft,
          persona: propertyData.persona
        }
      );
      
      let leadId: string | undefined;
      if (leadEmail && leadName) {
        const lead = await storage.createLead({
          name: leadName,
          email: leadEmail,
          phone: leadPhone || "",
          consent: leadConsent,
          leadSource: "RenoQuote Calculator",
        });
        leadId = lead.id;
        
        const webhookUrl = process.env.GHL_WEBHOOK_URL;
        if (webhookUrl) {
          sendWebhook(leadId, {
            source: "RenoQuote Calculator",
            formTag: "reno_quote",
            name: leadName,
            email: leadEmail,
            phone: leadPhone,
            persona: propertyData.persona,
            address: propertyData.address,
            city: propertyData.city,
            region: propertyData.region,
            country: propertyData.country,
            estimateLow: pricingResult.totalLow,
            estimateBase: pricingResult.totalBase,
            estimateHigh: pricingResult.totalHigh,
          });
        }

        // Send email notification
        sendRenoQuoteNotification({
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          address: propertyData.address,
          projectType: propertyData.persona,
          squareFootage: propertyData.existingSqft,
          estimatedTotal: pricingResult.totalBase,
        }).catch(err => console.error("Reno quote email error:", err));

        const renoNameParts = leadName.trim().split(' ');
        autoEnrollLeadAsUser({
          email: leadEmail,
          firstName: renoNameParts[0] || '',
          lastName: renoNameParts.slice(1).join(' ') || '',
          phone: leadPhone,
          leadSource: "RenoQuote Calculator",
        }).catch(err => console.error("Auto-enroll user error:", err));
      }
      
      const renoQuote = await storage.createRenoQuote({
        leadId,
        persona: propertyData.persona,
        address: propertyData.address,
        city: propertyData.city,
        region: propertyData.region,
        country: propertyData.country,
        postalCode: propertyData.postalCode,
        propertyType: propertyData.propertyType,
        existingSqft: propertyData.existingSqft,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        basementType: propertyData.basementType,
        basementHeight: propertyData.basementHeight,
        projectIntents: propertyData.projectIntents,
        lineItemsJson: lineItems,
        assumptionsJson: assumptions,
        pricingResultJson: pricingResult,
        leadName,
        leadEmail,
        leadPhone,
        leadConsent,
      });
      
      res.json({ id: renoQuote.id, pricingResult });
    } catch (error) {
      console.error("Error creating reno quote:", error);
      res.status(500).json({ error: "Failed to save renovation quote" });
    }
  });

  app.get("/api/reno-quotes/:id", async (req, res) => {
    try {
      const quote = await storage.getRenoQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching reno quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.get("/api/admin/reno-quotes", isAdmin, async (req, res) => {
    try {
      const quotes = await storage.getAllRenoQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching reno quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        res.status(404).json({ error: "Analysis not found" });
        return;
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  app.post("/api/analyses", async (req, res) => {
    try {
      const { countryMode, strategyType, inputsJson, resultsJson, address, city, province } = req.body;
      if (!countryMode || !strategyType || !inputsJson) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const userId = (req.session as any)?.userId || null;
      const analysis = await storage.createAnalysis({
        countryMode,
        strategyType,
        inputsJson,
        resultsJson: resultsJson || null,
        userId,
        address: address || null,
        city: city || null,
        province: province || null,
        leadId: null,
        propertyId: null,
        rentInputs: inputsJson.monthlyRent != null ? {
          monthlyRent: inputsJson.monthlyRent,
          rentPerUnit: inputsJson.rentPerUnit,
          numberOfUnits: inputsJson.numberOfUnits,
          additionalIncome: inputsJson.additionalIncome,
        } : null,
        vacancyRate: inputsJson.vacancyRate != null ? Number(inputsJson.vacancyRate) : null,
        expenseAssumptions: inputsJson.operatingExpenses != null || inputsJson.propertyTax != null ? {
          operatingExpenses: inputsJson.operatingExpenses,
          propertyTax: inputsJson.propertyTax,
          insurance: inputsJson.insurance,
          maintenance: inputsJson.maintenance,
          managementFee: inputsJson.managementFee,
          utilities: inputsJson.utilities,
        } : null,
      });
      res.json({ id: analysis.id });
    } catch (error) {
      console.error("Error saving analysis:", error);
      res.status(500).json({ error: "Failed to save analysis" });
    }
  });

  app.get("/api/rates", async (req, res) => {
    try {
      const cached = await storage.getDataCache("interest_rates");
      
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();
        const maxAge = 24 * 60 * 60 * 1000;
        
        if (cacheAge < maxAge) {
          res.json(cached.valueJson);
          return;
        }
      }

      const defaultRates = {
        conventional: {
          "1_year_fixed": 6.79,
          "2_year_fixed": 6.24,
          "3_year_fixed": 5.59,
          "5_year_fixed": 5.34,
          "variable": 5.90,
        },
        cmhc_mli_select: {
          base_spread: 1.10,
          bond_yield_estimate: 3.50,
          effective_rate: 4.60,
        },
        usa: {
          "30_year_fixed": 6.875,
          "15_year_fixed": 6.125,
          "arm_5_1": 6.50,
        },
        lastUpdated: new Date().toISOString(),
        source: "Estimated rates - for illustration only",
      };

      await storage.setDataCache({
        key: "interest_rates",
        valueJson: defaultRates,
        source: "fallback",
      });

      res.json(defaultRates);
    } catch (error) {
      console.error("Error fetching rates:", error);
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  });

  app.post("/api/admin/refresh-rates", async (req, res) => {
    try {
      const defaultRates = {
        conventional: {
          "1_year_fixed": 6.79,
          "2_year_fixed": 6.24,
          "3_year_fixed": 5.59,
          "5_year_fixed": 5.34,
          "variable": 5.90,
        },
        cmhc_mli_select: {
          base_spread: 1.10,
          bond_yield_estimate: 3.50,
          effective_rate: 4.60,
        },
        usa: {
          "30_year_fixed": 6.875,
          "15_year_fixed": 6.125,
          "arm_5_1": 6.50,
        },
        lastUpdated: new Date().toISOString(),
        source: "Refreshed - for illustration only",
      };

      await storage.setDataCache({
        key: "interest_rates",
        valueJson: defaultRates,
        source: "manual_refresh",
      });

      res.json({ success: true, data: defaultRates });
    } catch (error) {
      console.error("Error refreshing rates:", error);
      res.status(500).json({ error: "Failed to refresh rates" });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      const hasToken = !!process.env.EVENTBRITE_TOKEN;
      const nodeEnv = process.env.NODE_ENV || "unknown";
      console.log(`Events API called. Token available: ${hasToken}, NODE_ENV: ${nodeEnv}`);
      
      const result = await getEvents();
      
      console.log(`Events API returning ${result.events?.length || 0} events from source: ${result.source}`);
      
      res.json({
        ...result,
        debug: {
          tokenAvailable: hasToken,
          nodeEnv: nodeEnv,
          eventCount: result.events?.length || 0,
          source: result.source,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Error fetching events:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error stack:", errorStack);
      
      res.status(500).json({ 
        error: "Failed to fetch events",
        debug: {
          tokenAvailable: !!process.env.EVENTBRITE_TOKEN,
          nodeEnv: process.env.NODE_ENV || "unknown",
          errorMessage: errorMessage,
          timestamp: new Date().toISOString(),
        }
      });
    }
  });

  // Contact meetup host endpoint
  const contactHostSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10),
    message: z.string().min(10),
    hostId: z.string(),
    hostEmail: z.string().email(),
    hostName: z.string(),
    eventName: z.string(),
    eventId: z.string(),
    city: z.string(),
  });

  app.post("/api/events/contact-host", async (req, res) => {
    try {
      const data = contactHostSchema.parse(req.body);
      
      // Create a lead record for tracking
      const lead = await storage.createLead({
        name: data.name,
        email: data.email,
        phone: data.phone,
        consent: true,
        leadSource: `meetup_contact_${data.city.toLowerCase().replace(/\s+/g, '_')}`,
      });

      // Format phone to E.164 format
      const formatPhoneE164 = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      // Split name for CRM
      const nameParts = data.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Send to GHL with meetup contact tags
      await sendWebhook(lead.id, {
        email: data.email,
        firstName,
        lastName,
        phone: formatPhoneE164(data.phone),
        fullName: data.name,
        consent: true,
        leadSource: "meetup_contact",
        formTag: "meetup_contact",
        tags: ["meetup_contact", `MEETUP_${data.city.toUpperCase().replace(/\s+/g, '_')}`],
        customField: {
          meetup_message: data.message,
          meetup_event: data.eventName,
          meetup_host: data.hostName,
          meetup_host_email: data.hostEmail,
        },
      });

      // Send email notification to admin
      sendContactHostNotification({
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
        eventTitle: data.eventName,
        hostName: data.hostName,
      }).catch(err => console.error("Contact host email error:", err));

      const contactNameParts = data.name.trim().split(' ');
      autoEnrollLeadAsUser({
        email: data.email,
        firstName: contactNameParts[0] || '',
        lastName: contactNameParts.slice(1).join(' ') || '',
        phone: data.phone,
        leadSource: "Meetup Contact",
      }).catch(err => console.error("Auto-enroll user error:", err));

      console.log(`Meetup contact request: ${data.name} wants to contact ${data.hostName} (${data.hostEmail}) about ${data.eventName}`);

      res.json({ success: true, message: "Message sent to host" });
    } catch (error) {
      console.error("Error processing contact host request:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  // Market Expert Application endpoint
  const expertApplicationSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    province: z.string().min(1),
    city: z.string().min(1),
    brokerageName: z.string().min(1),
    licenseNumber: z.string().optional(),
    yearsExperience: z.string().min(1),
    specializations: z.string().optional(),
    bio: z.string().min(50),
    website: z.string().optional(),
    consent: z.boolean(),
  });

  app.post("/api/expert-applications", async (req, res) => {
    try {
      const data = expertApplicationSchema.parse(req.body);
      
      // Create a lead record
      const lead = await storage.createLead({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        consent: data.consent,
        leadSource: "Market Expert Application",
      });

      // Format phone to E.164 format
      const formatPhoneE164 = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      // Send to GHL with expert application tags
      await sendWebhook(lead.id, {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: formatPhoneE164(data.phone),
        fullName: `${data.firstName} ${data.lastName}`,
        consent: data.consent,
        leadSource: "Market Expert Application",
        formTag: "expert_application",
        tags: ["expert_application", `EXPERT_${data.province}`, "partner_application"],
        customField: {
          expert_province: data.province,
          expert_city: data.city,
          expert_brokerage: data.brokerageName,
          expert_license: data.licenseNumber || "",
          expert_experience: data.yearsExperience,
          expert_specializations: data.specializations || "",
          expert_bio: data.bio,
          expert_website: data.website || "",
        },
      });

      // Send email notification
      sendExpertApplicationNotification({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        company: data.brokerageName,
        expertise: data.specializations,
        markets: [data.city, data.province],
        website: data.website,
        message: data.bio,
      }).catch(err => console.error("Expert application email error:", err));

      autoEnrollLeadAsUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        leadSource: "Market Expert Application",
      }).catch(err => console.error("Auto-enroll user error:", err));

      console.log(`Market Expert Application received: ${data.firstName} ${data.lastName} from ${data.city}, ${data.province}`);

      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error("Error processing expert application:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to submit application" });
      }
    }
  });

  app.post("/api/admin/clear-event-cache", async (req, res) => {
    try {
      clearEventCache();
      res.json({ success: true, message: "Event cache cleared" });
    } catch (error) {
      console.error("Error clearing event cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // GET version for easy browser access
  app.get("/api/admin/refresh-events", async (req, res) => {
    try {
      console.log("Force refresh events triggered via GET");
      const result = await forceRefreshEvents();
      res.json({ success: true, ...result, eventCount: result.events?.length || 0 });
    } catch (error) {
      console.error("Error refreshing events:", error);
      res.status(500).json({ error: "Failed to refresh events" });
    }
  });

  app.post("/api/admin/refresh-events", async (req, res) => {
    try {
      const result = await forceRefreshEvents();
      res.json({ success: true, ...result, eventCount: result.events?.length || 0 });
    } catch (error) {
      console.error("Error refreshing events:", error);
      res.status(500).json({ error: "Failed to refresh events" });
    }
  });

  // Blog posts from Substack RSS feed
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const substackName = "padder";
      const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://${substackName}.substack.com/feed`;
      
      const response = await fetch(rss2jsonUrl);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/db", async (req, res) => {
    try {
      const { category, limit } = req.query;
      const posts = await storage.getBlogPosts({
        status: "published",
        category: category as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/admin/all", isAdmin, async (req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching all blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/db/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (post.status !== "published") return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  app.post("/api/blog/posts", isAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!data.slug && data.title) {
        data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (data.content && !data.readTimeMinutes) {
        const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
        data.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
      }
      if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date().toISOString();
      }
      const parsed = insertBlogPostSchema.parse(data);
      const existing = await storage.getBlogPostBySlug(parsed.slug || "");
      if (existing) return res.status(409).json({ error: "A post with this slug already exists" });
      const post = await storage.createBlogPost(parsed);
      res.status(201).json(post);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Validation failed", details: error.issues });
      console.error("Error creating blog post:", error);
      res.status(500).json({ error: "Failed to create blog post" });
    }
  });

  app.patch("/api/blog/posts/:id", isAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (data.content && !data.readTimeMinutes) {
        const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
        data.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
      }
      if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date().toISOString();
      }
      const parsed = insertBlogPostSchema.partial().parse(data);
      if (parsed.slug) {
        const existing = await storage.getBlogPostBySlug(parsed.slug);
        if (existing && existing.id !== req.params.id) return res.status(409).json({ error: "A post with this slug already exists" });
      }
      const post = await storage.updateBlogPost(req.params.id, parsed);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Validation failed", details: error.issues });
      console.error("Error updating blog post:", error);
      res.status(500).json({ error: "Failed to update blog post" });
    }
  });

  app.delete("/api/blog/posts/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteBlogPost(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ error: "Failed to delete blog post" });
    }
  });

  app.get("/api/guides/published", async (req, res) => {
    try {
      const { category } = req.query;
      const allGuides = await storage.getGuides({
        status: "published",
        category: category as string | undefined,
      });
      res.json(allGuides);
    } catch (error) {
      console.error("Error fetching guides:", error);
      res.status(500).json({ error: "Failed to fetch guides" });
    }
  });

  app.get("/api/guides/admin/all", isAdmin, async (req, res) => {
    try {
      const allGuides = await storage.getGuides();
      res.json(allGuides);
    } catch (error) {
      console.error("Error fetching all guides:", error);
      res.status(500).json({ error: "Failed to fetch guides" });
    }
  });

  app.get("/api/guides/by-slug/:slug", async (req, res) => {
    try {
      const guide = await storage.getGuideBySlug(req.params.slug);
      if (!guide) return res.status(404).json({ error: "Guide not found" });
      if (guide.status !== "published") return res.status(404).json({ error: "Guide not found" });
      res.json(guide);
    } catch (error) {
      console.error("Error fetching guide:", error);
      res.status(500).json({ error: "Failed to fetch guide" });
    }
  });

  app.post("/api/guides", isAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!data.slug && data.title) {
        data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (data.content && !data.readTimeMinutes) {
        const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
        data.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
      }
      if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date().toISOString();
      }
      const parsed = insertGuideSchema.parse(data);
      const existing = await storage.getGuideBySlug(parsed.slug || "");
      if (existing) return res.status(409).json({ error: "A guide with this slug already exists" });
      const guide = await storage.createGuide(parsed);
      res.status(201).json(guide);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Validation failed", details: error.issues });
      console.error("Error creating guide:", error);
      res.status(500).json({ error: "Failed to create guide" });
    }
  });

  app.patch("/api/guides/:id", isAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (data.content && !data.readTimeMinutes) {
        const words = data.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
        data.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
      }
      if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date().toISOString();
      }
      const parsed = insertGuideSchema.partial().parse(data);
      if (parsed.slug) {
        const existing = await storage.getGuideBySlug(parsed.slug);
        if (existing && existing.id !== req.params.id) return res.status(409).json({ error: "A guide with this slug already exists" });
      }
      const guide = await storage.updateGuide(req.params.id, parsed);
      if (!guide) return res.status(404).json({ error: "Guide not found" });
      res.json(guide);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Validation failed", details: error.issues });
      console.error("Error updating guide:", error);
      res.status(500).json({ error: "Failed to update guide" });
    }
  });

  app.delete("/api/guides/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteGuide(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting guide:", error);
      res.status(500).json({ error: "Failed to delete guide" });
    }
  });

  // Saved Deals API for Compare Deals feature
  app.post("/api/saved-deals", async (req, res) => {
    try {
      const validatedData = insertSavedDealSchema.parse(req.body);
      const userId = req.session.userId as string | undefined;
      const dealData = userId 
        ? { ...validatedData, userId }
        : validatedData;
      const deal = await storage.createSavedDeal(dealData);
      res.json({ success: true, data: deal });
    } catch (error) {
      console.error("Error saving deal:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ success: false, error: "Failed to save deal" });
      }
    }
  });

  app.get("/api/saved-deals", async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).json({ error: "Session ID required" });
        return;
      }
      const deals = await storage.getSavedDealsBySession(sessionId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching saved deals:", error);
      res.status(500).json({ error: "Failed to fetch saved deals" });
    }
  });

  app.get("/api/user/saved-deals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId as string;
      const deals = await storage.getSavedDealsByUser(userId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching user saved deals:", error);
      res.status(500).json({ error: "Failed to fetch saved deals" });
    }
  });

  app.delete("/api/user/saved-deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId as string;
      const deal = await storage.getSavedDeal(req.params.id);
      
      if (!deal) {
        res.status(404).json({ error: "Deal not found" });
        return;
      }
      
      if (deal.userId !== userId) {
        res.status(403).json({ error: "Not authorized to delete this deal" });
        return;
      }
      
      await storage.deleteSavedDeal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user saved deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  app.get("/api/saved-deals/:id", async (req, res) => {
    try {
      const deal = await storage.getSavedDeal(req.params.id);
      if (!deal) {
        res.status(404).json({ error: "Deal not found" });
        return;
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  app.delete("/api/saved-deals/:id", async (req, res) => {
    try {
      await storage.deleteSavedDeal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Google Sheets export
  app.post("/api/export/google-sheets", async (req, res) => {
    try {
      const { address, strategy, inputs, results } = req.body;
      
      if (!inputs || !results) {
        res.status(400).json({ error: "Missing required data" });
        return;
      }

      // Check if user has their own Google OAuth tokens
      const userId = req.session?.userId;
      let userTokens = null;
      let exportedToUserAccount = false;
      let userInfo: { name?: string; email?: string; phone?: string } = {};
      
      console.log("[Google Sheets Export] User ID:", userId || "anonymous");
      
      if (userId) {
        // Fetch user info
        const user = await authStorage.getUser(userId);
        if (user) {
          userInfo = {
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
            email: user.email || undefined,
            phone: user.phone || undefined,
          };
        }
        
        const googleToken = await storage.getGoogleOAuthToken(userId);
        console.log("[Google Sheets Export] Token found:", !!googleToken, googleToken?.googleEmail || "no email");
        if (googleToken) {
          userTokens = {
            accessToken: googleToken.accessToken,
            refreshToken: googleToken.refreshToken,
            expiresAt: googleToken.expiresAt,
          };
          exportedToUserAccount = true;
        }
      }
      
      console.log("[Google Sheets Export] Exporting to:", exportedToUserAccount ? "user account" : "shared account");
      console.log("[Google Sheets Export] User info:", userInfo);

      const spreadsheetUrl = await exportToGoogleSheets({
        address: address || "Property Analysis",
        strategy: strategy || "buy_hold",
        userInfo,
        inputs,
        results,
      }, userTokens || undefined);

      // Send email notification to danielfoch@gmail.com
      try {
        await sendNotificationEmail({
          to: "danielfoch@gmail.com",
          subject: `New Google Sheet Created: ${address || "Property Analysis"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">New Google Sheet Created</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Realist.ca Deal Analyzer Export</p>
              </div>
              
              <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Property Address</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${address || "Not specified"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">User Name</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${userInfo.name || "Not specified"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">User Email</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${userInfo.email || "Not specified"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">User Phone</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${userInfo.phone || "Not specified"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Strategy</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${strategy || "buy_hold"}</td>
                  </tr>
                </table>
                
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${spreadsheetUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Google Sheet</a>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">
                    Created on ${new Date().toLocaleString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div style="text-align: center; padding: 16px;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                  Realist.ca - Canada's #1 Real Estate Deal Analyzer
                </p>
              </div>
            </div>
          `,
        });
        console.log("[Google Sheets Export] Email notification sent to danielfoch@gmail.com");
      } catch (emailError) {
        console.error("[Google Sheets Export] Failed to send email notification:", emailError);
        // Don't fail the whole request if email fails
      }

      res.json({ 
        success: true, 
        url: spreadsheetUrl,
        exportedToUserAccount,
      });
    } catch (error) {
      console.error("Error exporting to Google Sheets:", error);
      res.status(500).json({ 
        error: "Failed to export to Google Sheets",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Google OAuth for user-owned exports
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.NODE_ENV === "production"
    ? "https://realist.ca/api/google/callback"
    : `https://${process.env.REPLIT_DEV_DOMAIN}/api/google/callback`;
  const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  // Check if Google OAuth is configured
  app.get("/api/google/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.json({ connected: false, configured: !!GOOGLE_CLIENT_ID });
        return;
      }

      const token = await storage.getGoogleOAuthToken(userId);
      res.json({ 
        connected: !!token, 
        configured: !!GOOGLE_CLIENT_ID,
        email: token?.googleEmail || null,
      });
    } catch (error) {
      console.error("Error checking Google status:", error);
      res.status(500).json({ error: "Failed to check Google status" });
    }
  });

  // Start Google OAuth flow
  app.get("/api/google/authorize", isAuthenticated, (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(400).json({ error: "Google OAuth not configured" });
      return;
    }

    console.log("[Google Sheets OAuth] Starting authorization flow");
    console.log("[Google Sheets OAuth] Redirect URI:", GOOGLE_REDIRECT_URI);
    console.log("[Google Sheets OAuth] NODE_ENV:", process.env.NODE_ENV);

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GOOGLE_SCOPES,
      prompt: "consent",
      state: req.session?.userId,
    });

    console.log("[Google Sheets OAuth] Auth URL:", authUrl);
    res.redirect(authUrl);
  });

  // Handle Google OAuth callback
  app.get("/api/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const sessionUserId = req.session?.userId;
      
      // Validate session and state match to prevent CSRF attacks
      if (!sessionUserId) {
        console.error("Google OAuth callback: No session user ID");
        res.redirect("/investor?error=google_auth_failed&reason=no_session");
        return;
      }
      
      if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        res.redirect("/investor?error=google_auth_failed");
        return;
      }
      
      // Critical security check: Ensure the state matches the session user
      if (state !== sessionUserId) {
        console.error(`Google OAuth callback: State mismatch. State: ${state}, Session: ${sessionUserId}`);
        res.redirect("/investor?error=google_auth_failed&reason=state_mismatch");
        return;
      }

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        res.redirect("/investor?error=google_not_configured");
        return;
      }

      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      // Save tokens to database using verified session user ID
      await storage.upsertGoogleOAuthToken({
        userId: sessionUserId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        tokenType: tokens.token_type || "Bearer",
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope || GOOGLE_SCOPES.join(" "),
        googleEmail,
      });

      console.log(`Google OAuth connected for user ${sessionUserId} (${googleEmail})`);
      res.redirect("/investor?google=connected");
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect("/investor?error=google_auth_failed");
    }
  });

  // Disconnect Google account
  app.post("/api/google/disconnect", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      await storage.deleteGoogleOAuthToken(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      res.status(500).json({ error: "Failed to disconnect Google" });
    }
  });

  // Podcast episodes from RSS feed
  app.get("/api/podcast/episodes", async (req, res) => {
    try {
      const rssUrl = "https://www.omnycontent.com/d/playlist/d75d2ff4-a4dd-4a19-bcb1-ad35013dfc83/1d7b066c-9af2-431a-bea7-aecd01493da3/69cdac4f-3b2e-45b4-ae6f-aecd0152873d/podcast.rss";
      
      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Realist/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML manually
      const episodes: any[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      // Get feed image
      const feedImageMatch = xmlText.match(/<image>[\s\S]*?<url>([^<]+)<\/url>[\s\S]*?<\/image>/);
      const feedImage = feedImageMatch ? feedImageMatch[1] : "";
      
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemXml = match[1];
        
        const getTagContent = (tag: string) => {
          const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
          const m = itemXml.match(regex);
          return m ? (m[1] || m[2] || "").trim() : "";
        };
        
        const getAttr = (tag: string, attr: string) => {
          const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`);
          const m = itemXml.match(regex);
          return m ? m[1] : "";
        };
        
        const title = getTagContent("title");
        const description = getTagContent("description") || getTagContent("itunes:summary");
        const pubDate = getTagContent("pubDate");
        const link = getTagContent("link");
        const duration = getTagContent("itunes:duration");
        const audioUrl = getAttr("enclosure", "url") || link;
        const imageUrl = getAttr("itunes:image", "href") || feedImage;
        
        episodes.push({
          title,
          description,
          pubDate,
          audioUrl,
          duration,
          link,
          imageUrl,
        });
      }
      
      res.json(episodes.slice(0, 50)); // Limit to 50 episodes
    } catch (error) {
      console.error("Error fetching podcast episodes:", error);
      res.status(500).json({ error: "Failed to fetch podcast episodes" });
    }
  });

  // Podcast Q&A question submission
  app.post("/api/podcast/question", async (req, res) => {
    try {
      const { firstName, lastName, email, question } = req.body;
      
      if (!firstName || !lastName || !email || !question) {
        res.status(400).json({ error: "First name, last name, email, and question are required" });
        return;
      }

      const fullName = `${firstName} ${lastName}`;

      // Store in database (using full name for backwards compatibility)
      const storedQuestion = await storage.createPodcastQuestion({ name: fullName, email, question });

      // Send email notification via Resend
      sendPodcastQuestionNotification({
        name: fullName,
        email,
        question,
      }).catch(err => console.error("Podcast question email error:", err));

      // Format phone to E.164 format for GHL (no phone for podcast, use placeholder)
      const formatPhoneE164 = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return '+' + cleaned;
        }
        if (cleaned.length === 10) {
          return '+1' + cleaned;
        }
        return '+' + cleaned;
      };

      // Send to GHL webhook with standardized format
      sendWebhook(storedQuestion.id.toString(), {
        email,
        firstName,
        lastName,
        fullName,
        phone: "",
        formTag: "podcast_question",
        leadSource: "Podcast Q&A",
        question,
        submittedAt: new Date().toISOString(),
      }).catch(err => console.error("Webhook error:", err));

      res.json({ success: true, data: storedQuestion });
    } catch (error) {
      console.error("Error submitting podcast question:", error);
      res.status(500).json({ error: "Failed to submit question" });
    }
  });

  // Get podcast questions (admin)
  app.get("/api/podcast/questions", async (req, res) => {
    try {
      const questions = await storage.getPodcastQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error fetching podcast questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  // ============================================
  // COACHING WAITLIST API ROUTES
  // ============================================

  // Submit coaching waitlist entry
  app.post("/api/coaching-waitlist", async (req, res) => {
    try {
      const { fullName, email, phone, mainProblem } = req.body;
      
      if (!fullName || !email || !phone || !mainProblem) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      const validatedData = insertCoachingWaitlistSchema.parse({
        fullName,
        email,
        phone,
        mainProblem,
      });

      const entry = await storage.createCoachingWaitlistEntry(validatedData);

      // Send email notification
      sendCoachingWaitlistNotification({
        fullName,
        email,
        phone,
        mainProblem,
      }).catch(err => console.error("Coaching waitlist email error:", err));

      // Send to GHL webhook
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      sendWebhook(entry.id, {
        email,
        firstName,
        lastName,
        fullName,
        phone,
        formTag: "coaching_waitlist",
        leadSource: "Coaching Waitlist",
        mainProblem,
        submittedAt: new Date().toISOString(),
      }).catch(err => console.error("Webhook error:", err));

      res.json({ success: true, data: entry });
    } catch (error) {
      console.error("Error submitting coaching waitlist:", error);
      res.status(500).json({ error: "Failed to join waitlist" });
    }
  });

  // Get coaching waitlist entries (admin)
  app.get("/api/coaching-waitlist", isAdmin, async (req, res) => {
    try {
      const entries = await storage.getCoachingWaitlistEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching coaching waitlist:", error);
      res.status(500).json({ error: "Failed to fetch waitlist" });
    }
  });

  // Update coaching waitlist entry status (admin)
  app.patch("/api/coaching-waitlist/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const updated = await storage.updateCoachingWaitlistEntry(id, { status, notes });
      if (!updated) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating coaching waitlist entry:", error);
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  // ============================================
  // INVESTOR PORTAL API ROUTES
  // ============================================

  // Get investor profile
  app.get("/api/investor/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const profile = await storage.getInvestorProfile(userId);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching investor profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Create investor profile (for signup flow)
  app.post("/api/investor/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const existingProfile = await storage.getInvestorProfile(userId);
      if (existingProfile) {
        res.json(existingProfile);
        return;
      }
      const profile = await storage.upsertInvestorProfile({ userId });
      res.json(profile);
    } catch (error) {
      console.error("Error creating investor profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  // Update investor profile
  app.put("/api/investor/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertInvestorProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.upsertInvestorProfile(validatedData);
      res.json(profile);
    } catch (error) {
      console.error("Error updating investor profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update profile" });
      }
    }
  });

  // Get investor KYC
  app.get("/api/investor/kyc", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const kyc = await storage.getInvestorKyc(userId);
      res.json(kyc || null);
    } catch (error) {
      console.error("Error fetching investor KYC:", error);
      res.status(500).json({ error: "Failed to fetch KYC" });
    }
  });

  // Update investor KYC
  app.put("/api/investor/kyc", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertInvestorKycSchema.parse({ ...req.body, userId });
      const kyc = await storage.upsertInvestorKyc(validatedData);
      res.json(kyc);
    } catch (error) {
      console.error("Error updating investor KYC:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update KYC" });
      }
    }
  });

  // Get portfolio properties
  app.get("/api/investor/portfolio", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const properties = await storage.getPortfolioProperties(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  // Add portfolio property
  app.post("/api/investor/portfolio", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertPortfolioPropertySchema.parse({ ...req.body, userId });
      const property = await storage.createPortfolioProperty(validatedData);
      res.json(property);
    } catch (error) {
      console.error("Error adding portfolio property:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to add property" });
      }
    }
  });

  // Update portfolio property
  app.put("/api/investor/portfolio/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const property = await storage.getPortfolioProperty(req.params.id);
      if (!property || property.userId !== userId) {
        res.status(404).json({ error: "Property not found" });
        return;
      }
      const updated = await storage.updatePortfolioProperty(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating portfolio property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  // Delete portfolio property
  app.delete("/api/investor/portfolio/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const property = await storage.getPortfolioProperty(req.params.id);
      if (!property || property.userId !== userId) {
        res.status(404).json({ error: "Property not found" });
        return;
      }
      await storage.deletePortfolioProperty(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting portfolio property:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // ============================================
  // INDUSTRY PARTNER PORTAL API ROUTES
  // ============================================

  // Get partner profile
  app.get("/api/partner/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const partner = await storage.getIndustryPartner(userId);
      res.json(partner || null);
    } catch (error) {
      console.error("Error fetching partner profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update partner profile
  app.put("/api/partner/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertIndustryPartnerSchema.parse({ ...req.body, userId });
      const partner = await storage.upsertIndustryPartner(validatedData);
      res.json(partner);
    } catch (error) {
      console.error("Error updating partner profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update profile" });
      }
    }
  });

  // Get partner leads
  app.get("/api/partner/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const partner = await storage.getIndustryPartner(userId);
      if (!partner) {
        res.status(404).json({ error: "Partner profile not found" });
        return;
      }
      const leads = await storage.getPartnerLeads(partner.id);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching partner leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Update partner lead status
  app.put("/api/partner/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const partner = await storage.getIndustryPartner(userId);
      if (!partner) {
        res.status(404).json({ error: "Partner profile not found" });
        return;
      }
      const updated = await storage.updatePartnerLead(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating partner lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Public endpoint to get approved partners by area (for display on site)
  app.get("/api/partners/public", async (req, res) => {
    try {
      const area = (req.query.area as string) || "";
      const partners = await storage.getApprovedPartnersByArea(area);
      // Return only public info
      res.json(partners.map(p => ({
        id: p.id,
        partnerType: p.partnerType,
        companyName: p.companyName,
        bio: p.bio,
        headshotUrl: p.headshotUrl,
        serviceAreas: p.serviceAreas,
        socialLinks: p.socialLinks,
        publicEmail: p.publicEmail,
      })));
    } catch (error) {
      console.error("Error fetching public partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // ============================================
  // REALTOR PARTNER NETWORK ROUTES
  // ============================================

  const claimMarketSchema = z.object({
    marketCity: z.string().min(1, "Market city is required"),
    marketRegion: z.string().min(1, "Market region is required"),
    signedName: z.string().min(1, "Full legal name is required"),
    signatureDataUrl: z.string().min(1, "Signature is required"),
  });

  app.post("/api/realtor-network/claim-market", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const parsed = claimMarketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const { marketCity, marketRegion, signedName, signatureDataUrl } = parsed.data;

      const existingClaims = await storage.getRealtorMarketClaimsByUser(userId);
      const alreadyClaimed = existingClaims.find(
        c => c.marketCity.toLowerCase() === marketCity.toLowerCase() && 
             c.marketRegion.toLowerCase() === marketRegion.toLowerCase() && 
             c.status === "active"
      );
      if (alreadyClaimed) {
        return res.status(400).json({ error: "You already have an active claim for this market" });
      }

      const partner = await storage.getIndustryPartner(userId);

      const claim = await storage.createRealtorMarketClaim({
        userId,
        partnerId: partner?.id || null,
        marketCity,
        marketRegion,
        status: "active",
        referralFeePercent: 25,
        referralAgreementSignedAt: new Date(),
        referralAgreementSignature: signatureDataUrl,
        referralAgreementSignedName: signedName,
      });

      res.json(claim);
    } catch (error) {
      console.error("Error claiming market:", error);
      res.status(500).json({ error: "Failed to claim market" });
    }
  });

  app.get("/api/realtor-network/my-claims", isAuthenticated, async (req: any, res) => {
    try {
      const claims = await storage.getRealtorMarketClaimsByUser(req.session.userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching market claims:", error);
      res.status(500).json({ error: "Failed to fetch market claims" });
    }
  });

  app.get("/api/realtor-network/my-leads", isAuthenticated, async (req: any, res) => {
    try {
      const notifications = await storage.getPendingNotificationsForRealtor(req.session.userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching realtor lead notifications:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/realtor-network/claim-lead/:notificationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { notificationId } = req.params;

      const notification = await storage.getRealtorLeadNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (notification.realtorUserId !== userId) {
        return res.status(403).json({ error: "Not your notification" });
      }
      if (notification.status === "claimed") {
        return res.status(400).json({ error: "Lead already claimed" });
      }

      const lead = await storage.getLead(notification.leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const partner = await storage.getIndustryPartner(userId);
      const realtorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const realtorEmail = partner?.publicEmail || user.email;
      const realtorPhone = partner?.phone || user.phone || undefined;
      const realtorCompany = partner?.companyName || undefined;

      let introResult;
      try {
        introResult = await sendRealtorIntroEmail({
          leadName: lead.name,
          leadEmail: lead.email,
          realtorName,
          realtorEmail,
          realtorPhone,
          realtorCompany,
          dealAddress: notification.dealAddress || undefined,
          dealCity: notification.dealCity || undefined,
          dealStrategy: notification.dealStrategy || undefined,
        });
      } catch (emailErr) {
        console.error("Failed to send intro email:", emailErr);
        return res.status(500).json({ error: "Failed to send introduction email" });
      }

      await storage.updateRealtorLeadNotification(notificationId, {
        status: "claimed",
        claimedAt: new Date(),
      });

      const introduction = await storage.createRealtorIntroduction({
        notificationId,
        realtorUserId: userId,
        leadName: lead.name,
        leadEmail: lead.email,
        realtorName,
        realtorEmail,
        realtorPhone: realtorPhone || null,
        realtorCompany: realtorCompany || null,
        introEmailSubject: introResult.subject,
        introEmailHtml: introResult.html,
        sentAt: new Date(),
      });

      res.json({ success: true, introduction });
    } catch (error) {
      console.error("Error claiming lead:", error);
      res.status(500).json({ error: "Failed to claim lead" });
    }
  });

  app.get("/api/realtor-network/introductions", isAuthenticated, async (req: any, res) => {
    try {
      const intros = await storage.getRealtorIntroductionsByRealtor(req.session.userId);
      res.json(intros);
    } catch (error) {
      console.error("Error fetching introductions:", error);
      res.status(500).json({ error: "Failed to fetch introductions" });
    }
  });

  // ============================================
  // PROFESSIONAL SUBSCRIPTION ROUTES
  // ============================================

  // Get current user's subscription
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      let subscription = await storage.getProfessionalSubscription(userId);
      
      if (!subscription) {
        subscription = await storage.upsertProfessionalSubscription({
          userId,
          tier: 'free',
          monthlyPullLimit: 5,
          pullsUsedThisMonth: 0,
        });
      }
      
      res.json(subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create new professional subscription with brokerage info
  app.post("/api/subscription/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { brokerageName, brokerageCity, brokerageProvince } = req.body;
      
      const subscription = await storage.upsertProfessionalSubscription({
        userId,
        tier: 'free',
        monthlyPullLimit: 5,
        pullsUsedThisMonth: 0,
        brokerageName: brokerageName || null,
        brokerageCity: brokerageCity || null,
        brokerageProvince: brokerageProvince || null,
      });
      
      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Update brokerage information
  app.patch("/api/subscription/brokerage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { brokerageName, brokerageCity, brokerageProvince } = req.body;
      
      const subscription = await storage.upsertProfessionalSubscription({
        userId,
        brokerageName,
        brokerageCity,
        brokerageProvince,
      });
      
      res.json(subscription);
    } catch (error) {
      console.error("Error updating brokerage:", error);
      res.status(500).json({ error: "Failed to update brokerage" });
    }
  });

  // Check and increment pull usage
  app.post("/api/subscription/use-pull", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await storage.incrementPullUsage(userId);
      res.json(result);
    } catch (error) {
      console.error("Error incrementing pull usage:", error);
      res.status(500).json({ error: "Failed to update usage" });
    }
  });

  // Get Stripe publishable key
  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error fetching Stripe key:", error);
      res.status(500).json({ error: "Failed to fetch Stripe key" });
    }
  });

  // Create checkout session for premium subscription ($10/mo)
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      let subscription = await storage.getProfessionalSubscription(userId);
      let customerId = subscription?.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          req.user.claims.email || `${userId}@realist.ca`,
          userId,
          req.user.claims.name
        );
        customerId = customer.id;
        await storage.upsertProfessionalSubscription({
          userId,
          tier: 'free',
          stripeCustomerId: customerId,
        });
      }
      
      const priceId = process.env.STRIPE_PREMIUM_PRICE_ID || process.env.STRIPE_STARTER_PRICE_ID || 'price_premium';
      
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/premium?success=true`,
        cancel_url: `${baseUrl}/premium?canceled=true`,
        metadata: { userId, tier: 'premium' },
      });
      
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Claim premium via BRA (buyer representation agreement) - free for 3 months
  app.post("/api/subscription/claim-bra-premium", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { signedName, signatureDataUrl } = req.body;

      if (!signedName || !signatureDataUrl) {
        res.status(400).json({ error: "Signed name and signature are required" });
        return;
      }

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      await storage.upsertProfessionalSubscription({
        userId,
        tier: 'premium',
        premiumSource: 'bra',
        braSignedAt: now,
        braExpiresAt: expiresAt,
        braSignedName: signedName,
        braSignatureDataUrl: signatureDataUrl,
        status: 'active',
      });

      res.json({ 
        success: true, 
        tier: 'premium',
        premiumSource: 'bra',
        braExpiresAt: expiresAt.toISOString(),
        redirectTo: '/tools/buybox',
      });
    } catch (error) {
      console.error("Error claiming BRA premium:", error);
      res.status(500).json({ error: "Failed to activate premium" });
    }
  });

  // Get premium status (enhanced subscription endpoint)
  app.get("/api/subscription/status", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        res.json({ tier: 'free', isPremium: false });
        return;
      }

      const subscription = await storage.getProfessionalSubscription(userId);
      if (!subscription || subscription.tier === 'free') {
        res.json({ tier: 'free', isPremium: false });
        return;
      }

      // Check if BRA-based premium has expired
      if (subscription.premiumSource === 'bra' && subscription.braExpiresAt) {
        if (new Date() > new Date(subscription.braExpiresAt)) {
          await storage.updateProfessionalSubscription(userId, {
            tier: 'free',
            status: 'expired',
          });
          res.json({ 
            tier: 'free', 
            isPremium: false, 
            braExpired: true,
            message: 'Your BRA-based premium has expired. Renew or subscribe to continue.',
          });
          return;
        }
      }

      res.json({
        tier: subscription.tier,
        isPremium: subscription.tier === 'premium',
        premiumSource: subscription.premiumSource,
        braExpiresAt: subscription.braExpiresAt,
        braSignedAt: subscription.braSignedAt,
        hasBraSigned: !!subscription.braSignedAt,
      });
    } catch (error) {
      console.error("Error fetching premium status:", error);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  // Experiment endpoints
  app.post("/api/experiments/assign", async (req: any, res) => {
    try {
      const { visitorId, experimentKey } = req.body;
      if (!visitorId || !experimentKey) {
        res.status(400).json({ error: "visitorId and experimentKey required" });
        return;
      }

      let assignment = await storage.getExperimentAssignment(visitorId, experimentKey);
      if (!assignment) {
        const variants = ['A', 'B', 'C'];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        assignment = await storage.createExperimentAssignment({
          visitorId,
          userId: req.session?.userId || null,
          experimentKey,
          variant,
        });
      }

      res.json({ variant: assignment.variant, experimentKey });
    } catch (error) {
      console.error("Error assigning experiment:", error);
      res.status(500).json({ error: "Failed to assign experiment" });
    }
  });

  app.post("/api/experiments/convert", async (req: any, res) => {
    try {
      const { visitorId, experimentKey } = req.body;
      if (!visitorId || !experimentKey) {
        res.status(400).json({ error: "visitorId and experimentKey required" });
        return;
      }
      await storage.markExperimentConverted(visitorId, experimentKey);
      res.json({ success: true });
    } catch (error) {
      console.error("Error converting experiment:", error);
      res.status(500).json({ error: "Failed to record conversion" });
    }
  });

  app.get("/api/experiments/stats/:key", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getExperimentStats(req.params.key);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching experiment stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Branding assets CRUD
  app.get("/api/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const branding = await storage.getBrandingAssets(userId);
      res.json(branding || null);
    } catch (error) {
      console.error("Error fetching branding:", error);
      res.status(500).json({ error: "Failed to fetch branding" });
    }
  });

  app.put("/api/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Check premium status
      const subscription = await storage.getProfessionalSubscription(userId);
      const isPremium = subscription?.tier === 'premium' && subscription?.status === 'active';
      if (!isPremium) {
        res.status(403).json({ error: "Premium subscription required for custom branding" });
        return;
      }

      const { companyName, primaryColor, secondaryColor, contactEmail, contactPhone, website, disclaimerText, logoUrl } = req.body;
      const branding = await storage.upsertBrandingAssets({
        userId,
        companyName: companyName || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        website: website || null,
        disclaimerText: disclaimerText || null,
        logoUrl: logoUrl || null,
      });

      res.json(branding);
    } catch (error) {
      console.error("Error updating branding:", error);
      res.status(500).json({ error: "Failed to update branding" });
    }
  });

  // Create customer portal session
  app.post("/api/subscription/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const subscription = await storage.getProfessionalSubscription(userId);
      
      if (!subscription?.stripeCustomerId) {
        res.status(400).json({ error: "No subscription found" });
        return;
      }
      
      const { stripeService } = await import("./stripeService");
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        subscription.stripeCustomerId,
        `${baseUrl}/professional/dashboard`
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });


  // ============================================
  // CREA DDF API ROUTES
  // ============================================

  app.post("/api/ddf/listings", async (req: any, res) => {
    try {
      const { isDdfConfigured, searchDdfListings, normalizeDdfToRepliersFormat } = await import("./creaDdf");

      if (!isDdfConfigured()) {
        res.status(503).json({ error: "CREA DDF not configured", available: false });
        return;
      }

      const {
        city,
        stateOrProvince,
        minPrice,
        maxPrice,
        minBeds,
        maxBeds,
        minUnits,
        propertySubType,
        excludeBusinessSales,
        excludeParking,
        pageNum,
        resultsPerPage,
        latitudeMin,
        latitudeMax,
        longitudeMin,
        longitudeMax,
      } = req.body;

      const sanitizedCity = typeof city === "string" ? city.slice(0, 100) : undefined;
      const sanitizedProvince = typeof stateOrProvince === "string" ? stateOrProvince.slice(0, 100) : undefined;
      const sanitizedSubType = typeof propertySubType === "string" ? propertySubType.slice(0, 100) : undefined;
      const top = Math.min(Math.max(Number(resultsPerPage) || 50, 1), 100);
      const pg = Math.max(Number(pageNum) || 1, 1);
      const skip = (pg - 1) * top;

      const result = await searchDdfListings({
        city: sanitizedCity || undefined,
        stateOrProvince: sanitizedProvince || undefined,
        minPrice: minPrice ? Math.max(0, Number(minPrice)) : undefined,
        maxPrice: maxPrice ? Math.max(0, Number(maxPrice)) : undefined,
        minBeds: minBeds ? Math.max(0, Number(minBeds)) : undefined,
        maxBeds: maxBeds ? Math.max(0, Number(maxBeds)) : undefined,
        minUnits: minUnits ? Math.max(1, Number(minUnits)) : undefined,
        propertySubType: sanitizedSubType || undefined,
        excludeBusinessSales: !!excludeBusinessSales,
        excludeParking: !!excludeParking,
        latitudeMin: latitudeMin ? Number(latitudeMin) : undefined,
        latitudeMax: latitudeMax ? Number(latitudeMax) : undefined,
        longitudeMin: longitudeMin ? Number(longitudeMin) : undefined,
        longitudeMax: longitudeMax ? Number(longitudeMax) : undefined,
        top,
        skip,
      });

      const normalizedListings = result.listings.map(normalizeDdfToRepliersFormat);

      res.json({
        listings: normalizedListings,
        count: result.count,
        numPages: result.numPages,
        page: result.page,
        source: "crea_ddf",
      });
    } catch (error: any) {
      console.error("DDF listings error:", error);
      res.status(500).json({ error: "Failed to fetch DDF listings" });
    }
  });

  app.get("/api/ddf/listing/:listingKey", async (req: any, res) => {
    try {
      const { isDdfConfigured, getDdfListing, normalizeDdfToRepliersFormat } = await import("./creaDdf");

      if (!isDdfConfigured()) {
        res.status(503).json({ error: "CREA DDF not configured" });
        return;
      }

      const listingKey = req.params.listingKey?.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!listingKey) {
        res.status(400).json({ error: "Invalid listing key" });
        return;
      }

      const listing = await getDdfListing(listingKey);
      if (!listing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      res.json({ listing: normalizeDdfToRepliersFormat(listing), source: "crea_ddf" });
    } catch (error: any) {
      console.error("DDF listing error:", error);
      res.status(500).json({ error: "Failed to fetch DDF listing" });
    }
  });

  app.get("/api/ddf/mls/:mlsNumber", async (req: any, res) => {
    try {
      const { isDdfConfigured, searchDdfByMlsNumber, normalizeDdfToRepliersFormat } = await import("./creaDdf");

      if (!isDdfConfigured()) {
        res.status(503).json({ error: "CREA DDF not configured", available: false });
        return;
      }

      const mlsNumber = req.params.mlsNumber?.replace(/[^a-zA-Z0-9]/g, "");
      if (!mlsNumber) {
        res.status(400).json({ error: "Invalid MLS number" });
        return;
      }

      const listing = await searchDdfByMlsNumber(mlsNumber);
      if (!listing) {
        res.status(404).json({ error: "No listing found for that MLS number" });
        return;
      }

      const normalized = normalizeDdfToRepliersFormat(listing);

      const parsedListing = {
        listingId: normalized.mlsNumber || mlsNumber,
        propertyId: listing.ListingKey || "",
        address: [listing.StreetNumber, listing.StreetName, listing.StreetSuffix].filter(Boolean).join(" ") || listing.UnparsedAddress || "",
        city: listing.City || "",
        province: listing.StateOrProvince || "",
        postalCode: listing.PostalCode || "",
        country: "canada" as const,
        price: listing.ListPrice || 0,
        bedrooms: listing.BedroomsTotal || 0,
        bathrooms: (listing.BathroomsTotalInteger || 0) + (listing.BathroomsPartial || 0),
        squareFootage: listing.LivingArea || listing.BuildingAreaTotal || 0,
        propertyType: listing.PropertySubType || listing.StructureType || "",
        buildingType: listing.StructureType || listing.PropertySubType || "",
        buildingStyle: (listing.ArchitecturalStyle || []).join(", "),
        storeys: listing.Stories || 0,
        landSize: "",
        imageUrl: normalized.images?.[0] || "",
        sourceUrl: `https://www.realtor.ca/real-estate/${listing.ListingKey}`,
        numberOfUnits: listing.NumberOfUnitsTotal || 0,
        totalActualRent: listing.TotalActualRent || 0,
        taxAnnualAmount: listing.TaxAnnualAmount || 0,
      };

      res.json({ listing: parsedListing, source: "crea_ddf" });
    } catch (error: any) {
      console.error("DDF MLS search error:", error);
      res.status(500).json({ error: "Failed to search by MLS number" });
    }
  });

  let ddfStatusCache: { result: any; expiresAt: number } | null = null;

  app.get("/api/ddf/status", async (_req: any, res) => {
    try {
      if (ddfStatusCache && Date.now() < ddfStatusCache.expiresAt) {
        res.json(ddfStatusCache.result);
        return;
      }

      const { isDdfConfigured, getDdfToken } = await import("./creaDdf");

      if (!isDdfConfigured()) {
        const result = { configured: false, authenticated: false };
        ddfStatusCache = { result, expiresAt: Date.now() + 60000 };
        res.json(result);
        return;
      }

      try {
        await getDdfToken();
        const result = { configured: true, authenticated: true };
        ddfStatusCache = { result, expiresAt: Date.now() + 300000 };
        res.json(result);
      } catch {
        const result = { configured: true, authenticated: false };
        ddfStatusCache = { result, expiresAt: Date.now() + 30000 };
        res.json(result);
      }
    } catch {
      res.json({ configured: false, authenticated: false });
    }
  });

  // ============================================
  // REPLIERS API PROXY ROUTES
  // ============================================

  app.post("/api/repliers/listings", async (req: any, res) => {
    try {
      const apiKey = process.env.REPLIERS_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Repliers API key not configured" });
        return;
      }

      const {
        map,
        minPrice, maxPrice,
        minBeds, maxBeds,
        minBaths, maxBaths,
        propertyType,
        status,
        pageNum,
        resultsPerPage,
        class: propClass,
        type: listingType,
        sortBy,
        city,
        area,
      } = req.body;

      const queryParams = new URLSearchParams();
      if (minPrice) queryParams.set("minPrice", String(minPrice));
      if (maxPrice) queryParams.set("maxPrice", String(maxPrice));
      if (minBeds) queryParams.set("minBeds", String(minBeds));
      if (maxBeds) queryParams.set("maxBeds", String(maxBeds));
      if (minBaths) queryParams.set("minBaths", String(minBaths));
      if (maxBaths) queryParams.set("maxBaths", String(maxBaths));
      if (propertyType) queryParams.set("propertyType", propertyType);
      if (status) queryParams.set("status", status);
      if (propClass) queryParams.set("class", propClass);
      if (listingType) queryParams.set("type", listingType);
      if (sortBy) queryParams.set("sortBy", sortBy);
      if (city) queryParams.set("city", city);
      if (area) queryParams.set("area", area);
      queryParams.set("pageNum", String(pageNum || 1));
      queryParams.set("resultsPerPage", String(resultsPerPage || 50));

      const body: Record<string, any> = {};
      if (map) {
        body.map = map;
      }

      const qs = queryParams.toString();
      const url = `https://api.repliers.io/listings${qs ? `?${qs}` : ""}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "REPLIERS-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Repliers API error:", response.status, errorText);
        res.status(response.status).json({ error: "Repliers API error", details: errorText });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error proxying Repliers listings:", error);
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  app.get("/api/repliers/listings/:mlsNumber", async (req: any, res) => {
    try {
      const apiKey = process.env.REPLIERS_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Repliers API key not configured" });
        return;
      }

      const { mlsNumber } = req.params;
      const response = await fetch(`https://api.repliers.io/listings/${encodeURIComponent(mlsNumber)}`, {
        method: "GET",
        headers: {
          "REPLIERS-API-KEY": apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Repliers API detail error:", response.status, errorText);
        res.status(response.status).json({ error: "Repliers API error", details: errorText });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching listing detail:", error);
      res.status(500).json({ error: "Failed to fetch listing detail" });
    }
  });

  app.get("/api/repliers/listings/:mlsNumber/similar", async (req: any, res) => {
    try {
      const apiKey = process.env.REPLIERS_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Repliers API key not configured" });
        return;
      }

      const { mlsNumber } = req.params;
      const response = await fetch(`https://api.repliers.io/listings/${encodeURIComponent(mlsNumber)}/similar`, {
        method: "GET",
        headers: {
          "REPLIERS-API-KEY": apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: "Repliers API error", details: errorText });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching similar listings:", error);
      res.status(500).json({ error: "Failed to fetch similar listings" });
    }
  });

  // ============================================
  // MARKET EXPERT ROUTES
  // ============================================

  // Get all approved market experts (public)
  app.get("/api/market-experts", async (_req, res) => {
    try {
      const experts = await storage.getApprovedMarketExperts();
      res.json(experts);
    } catch (error) {
      console.error("Error fetching market experts:", error);
      res.status(500).json({ error: "Failed to fetch market experts" });
    }
  });

  app.post("/api/market-expert/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { marketRegion, marketCity, includeMeetupHost } = req.body;
      
      const existingApplication = await storage.getMarketExpertApplication(userId);
      if (existingApplication && existingApplication.status === 'approved') {
        res.status(400).json({ error: "You are already an approved expert" });
        return;
      }
      
      const monthlyFee = includeMeetupHost ? 1250 : 1000;
      
      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      let subscription = await storage.getProfessionalSubscription(userId);
      let customerId = subscription?.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          req.user.claims.email || `${userId}@realist.ca`,
          userId,
          req.user.claims.name
        );
        customerId = customer.id;
        await storage.upsertProfessionalSubscription({
          userId,
          tier: 'free',
          stripeCustomerId: customerId,
        });
      }
      
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const expertPriceId = process.env.STRIPE_EXPERT_PRICE_ID;
      const meetupPriceId = process.env.STRIPE_MEETUP_PRICE_ID;
      
      if (!expertPriceId) {
        res.status(500).json({ error: "Expert pricing not configured" });
        return;
      }
      
      const lineItems: Array<{ price: string; quantity: number }> = [
        { price: expertPriceId, quantity: 1 }
      ];
      
      if (includeMeetupHost && meetupPriceId) {
        lineItems.push({ price: meetupPriceId, quantity: 1 });
      }
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: lineItems,
        success_url: `${baseUrl}/professional/dashboard?expert=success`,
        cancel_url: `${baseUrl}/professional/dashboard?expert=cancelled`,
        metadata: {
          userId,
          marketRegion,
          marketCity,
          includeMeetupHost: includeMeetupHost ? 'true' : 'false',
          type: 'featured_expert',
        },
      });
      
      if (!existingApplication) {
        await storage.createMarketExpertApplication({
          userId,
          marketRegion,
          marketCity,
          includeMeetupHost,
          monthlyFee,
          referralFeePercent: 20,
          status: 'pending_payment',
        });
      }
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating expert checkout:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/market-expert/application", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const application = await storage.getMarketExpertApplication(userId);
      res.json(application || null);
    } catch (error) {
      console.error("Error fetching expert application:", error);
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });

  // ============================================
  // PLATFORM ANALYTICS (Public for checkout display)
  // ============================================

  app.get("/api/analytics/deals-count", async (_req, res) => {
    try {
      const last30Days = await storage.getRecentAnalysisCount(30);
      res.json({ count: last30Days, period: "30 days" });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============================================
  // BUYBOX MANDATE SYSTEM ROUTES
  // ============================================

  // Helper to coerce empty strings to null for optional number fields
  const optionalNumber = z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().nullable().optional()
  );

  // BuyBox submission schema with coercion for string-to-number fields
  const buyBoxSubmissionSchema = z.object({
    agreement: z.object({
      signedName: z.string().min(1, "Signed name is required"),
      signatureDataUrl: z.string().min(1, "Signature is required"),
      termEndDate: z.string(),
      holdoverDays: z.coerce.number().int().min(0).optional().default(60),
      commissionPercent: z.coerce.number().min(0).max(100).optional().default(2.5),
      agreedToTerms: z.boolean(),
      extendedTermConsent: z.boolean(),
    }),
    mandate: z.object({
      polygonGeoJson: z.any(),
      centroidLat: optionalNumber,
      centroidLng: optionalNumber,
      areaName: z.string().optional().nullable(),
      targetPrice: optionalNumber,
      maxPrice: optionalNumber,
      lotFrontage: optionalNumber,
      lotFrontageUnit: z.string().optional().nullable(),
      lotDepth: optionalNumber,
      lotDepthUnit: z.string().optional().nullable(),
      totalLotArea: optionalNumber,
      totalLotAreaUnit: z.string().optional().nullable(),
      zoningPlanningStatus: z.string().optional().nullable(),
      buildingType: z.string().optional().nullable(),
      occupancy: z.string().optional().nullable(),
      targetClosingDate: z.string().optional().nullable(),
      possessionDate: z.string().optional().nullable(),
      offerConditions: z.array(z.string()).optional().nullable(),
      additionalNotes: z.string().optional().nullable(),
    }),
  });

  // Submit a new BuyBox mandate with agreement
  app.post("/api/buybox/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Validate request body
      const parseResult = buyBoxSubmissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid submission data", details: parseResult.error.errors });
        return;
      }
      
      const { agreement, mandate } = parseResult.data;

      if (!mandate.polygonGeoJson) {
        res.status(400).json({ error: "Target area polygon is required" });
        return;
      }

      // Generate agreement HTML
      const agreementHtml = generateBuyBoxAgreementHtml({
        signedName: agreement.signedName,
        termEndDate: agreement.termEndDate,
        holdoverDays: agreement.holdoverDays,
        commissionPercent: agreement.commissionPercent,
      });

      // Create the agreement record
      const agreementRecord = await storage.createBuyBoxAgreement({
        userId,
        agreementVersion: "1.0",
        agreementHtml,
        signedName: agreement.signedName,
        signatureDataUrl: agreement.signatureDataUrl,
        termStartDate: new Date(),
        termEndDate: new Date(agreement.termEndDate),
        holdoverDays: agreement.holdoverDays || 60,
        commissionPercent: agreement.commissionPercent || 2.5,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        signedAt: new Date(),
      });

      // Normalize optional fields to avoid undefined being sent to database
      const normalizedMandate = {
        userId,
        agreementId: agreementRecord.id,
        status: "new" as const,
        polygonGeoJson: mandate.polygonGeoJson,
        centroidLat: mandate.centroidLat ?? null,
        centroidLng: mandate.centroidLng ?? null,
        areaName: mandate.areaName ?? null,
        targetPrice: mandate.targetPrice ?? null,
        maxPrice: mandate.maxPrice ?? null,
        lotFrontage: mandate.lotFrontage ?? null,
        lotFrontageUnit: mandate.lotFrontageUnit ?? null,
        lotDepth: mandate.lotDepth ?? null,
        lotDepthUnit: mandate.lotDepthUnit ?? null,
        totalLotArea: mandate.totalLotArea ?? null,
        totalLotAreaUnit: mandate.totalLotAreaUnit ?? null,
        zoningPlanningStatus: mandate.zoningPlanningStatus ?? null,
        buildingType: mandate.buildingType ?? null,
        occupancy: mandate.occupancy ?? null,
        targetClosingDate: mandate.targetClosingDate ? new Date(mandate.targetClosingDate) : null,
        possessionDate: mandate.possessionDate ? new Date(mandate.possessionDate) : null,
        offerConditions: mandate.offerConditions ?? null,
        additionalNotes: mandate.additionalNotes ?? null,
      };

      // Create the mandate record
      const mandateRecord = await storage.createBuyBoxMandate(normalizedMandate);

      // Send email notification to admin
      try {
        const user = await authStorage.getUser(userId);
        await sendNotificationEmail({
          to: "danielfoch@gmail.com",
          subject: `New BuyBox Mandate Submitted`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #22c55e;">New BuyBox Mandate</h2>
              <p><strong>From:</strong> ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email})</p>
              <p><strong>Mandate ID:</strong> ${mandateRecord.id}</p>
              <p><strong>Budget:</strong> ${mandate.targetPrice ? `$${mandate.targetPrice.toLocaleString()}` : "Not specified"} - ${mandate.maxPrice ? `$${mandate.maxPrice.toLocaleString()}` : "Not specified"}</p>
              <p><strong>Building Type:</strong> ${mandate.buildingType || "Not specified"}</p>
              <p><strong>Signed Name:</strong> ${agreement.signedName}</p>
              <p><strong>Agreement Term:</strong> Ends ${new Date(agreement.termEndDate).toLocaleDateString()}</p>
              <p><strong>Commission:</strong> ${agreement.commissionPercent}%</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("[BuyBox] Failed to send notification email:", emailError);
      }

      res.json({ 
        success: true, 
        mandateId: mandateRecord.id,
        agreementId: agreementRecord.id,
      });
    } catch (error) {
      console.error("Error submitting BuyBox:", error);
      res.status(500).json({ error: "Failed to submit BuyBox mandate" });
    }
  });

  app.post("/api/buybox/submit-services", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { mandate, polygon, centroid, services } = req.body;

      if (!polygon || !services || !Array.isArray(services) || services.length === 0) {
        res.status(400).json({ error: "Polygon and at least one service are required" });
        return;
      }

      const CANONICAL_PRICING: Record<string, { pricePerUnit: number; minQty: number; maxQty: number }> = {
        direct_mail: { pricePerUnit: 2.50, minQty: 100, maxQty: 5000 },
        ai_phone_calls: { pricePerUnit: 1.00, minQty: 50, maxQty: 2000 },
        voicemail_drops: { pricePerUnit: 0.15, minQty: 100, maxQty: 10000 },
      };

      let totalAmount = 0;
      const validatedServices: { serviceId: string; qty: number; unitPrice: number; total: number }[] = [];

      for (const svc of services) {
        const pricing = CANONICAL_PRICING[svc.serviceId];
        if (!pricing) {
          res.status(400).json({ error: `Invalid service: ${svc.serviceId}` });
          return;
        }
        const qty = Math.max(pricing.minQty, Math.min(pricing.maxQty, parseInt(svc.qty) || pricing.minQty));
        const lineTotal = pricing.pricePerUnit * qty;
        totalAmount += lineTotal;
        validatedServices.push({
          serviceId: svc.serviceId,
          qty,
          unitPrice: pricing.pricePerUnit,
          total: lineTotal,
        });
      }

      const normalizedMandate = {
        userId,
        agreementId: null,
        status: "new" as const,
        polygonGeoJson: polygon,
        centroidLat: centroid?.lat ?? null,
        centroidLng: centroid?.lng ?? null,
        areaName: null,
        targetPrice: mandate?.targetPrice ?? null,
        maxPrice: mandate?.maxPrice ?? null,
        lotFrontage: mandate?.lotFrontage ?? null,
        lotFrontageUnit: mandate?.lotFrontageUnit ?? null,
        lotDepth: mandate?.lotDepth ?? null,
        lotDepthUnit: mandate?.lotDepthUnit ?? null,
        totalLotArea: mandate?.totalLotArea ?? null,
        totalLotAreaUnit: mandate?.totalLotAreaUnit ?? null,
        zoningPlanningStatus: mandate?.zoningPlanningStatus ?? null,
        buildingType: mandate?.buildingType ?? null,
        occupancy: mandate?.occupancy ?? null,
        targetClosingDate: mandate?.targetClosingDate ? new Date(mandate.targetClosingDate) : null,
        possessionDate: mandate?.possessionDate ? new Date(mandate.possessionDate) : null,
        offerConditions: mandate?.offerConditions ?? null,
        additionalNotes: mandate?.additionalNotes ?? null,
      };

      const mandateRecord = await storage.createBuyBoxMandate(normalizedMandate);

      try {
        const user = await authStorage.getUser(userId);
        const servicesSummary = services.map((s: any) =>
          `<li>${s.serviceId.replace(/_/g, ' ')}: ${s.qty} units × $${s.unitPrice.toFixed(2)} = $${s.total.toFixed(2)}</li>`
        ).join("");

        await sendNotificationEmail({
          to: "danielfoch@gmail.com",
          subject: `New BuyBox Services Order — $${totalAmount?.toFixed(2) || '0.00'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #22c55e;">New BuyBox Services Order</h2>
              <p><strong>From:</strong> ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email})</p>
              <p><strong>Mandate ID:</strong> ${mandateRecord.id}</p>
              <p><strong>Budget:</strong> ${mandate?.targetPrice ? `$${mandate.targetPrice.toLocaleString()}` : "N/A"} - ${mandate?.maxPrice ? `$${mandate.maxPrice.toLocaleString()}` : "N/A"}</p>
              <p><strong>Building Type:</strong> ${mandate?.buildingType || "N/A"}</p>
              <h3>Services Ordered:</h3>
              <ul>${servicesSummary}</ul>
              <p style="font-size: 18px; font-weight: bold; color: #22c55e;">Total: $${totalAmount?.toFixed(2) || '0.00'}</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("[BuyBox] Failed to send services notification email:", emailError);
      }

      res.json({
        success: true,
        mandateId: mandateRecord.id,
        services: services.map((s: any) => s.serviceId),
      });
    } catch (error) {
      console.error("Error submitting BuyBox services:", error);
      res.status(500).json({ error: "Failed to submit BuyBox services order" });
    }
  });

  // Get a specific BuyBox mandate (requires authentication and ownership/role check)
  app.get("/api/buybox/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await authStorage.getUser(userId);
      
      const mandate = await storage.getBuyBoxMandate(req.params.id);
      if (!mandate) {
        res.status(404).json({ error: "Mandate not found" });
        return;
      }
      
      // Only mandate owner, admin, or realtor can view
      if (mandate.userId !== userId && user?.role !== "admin" && user?.role !== "realtor") {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      
      res.json(mandate);
    } catch (error) {
      console.error("Error fetching BuyBox mandate:", error);
      res.status(500).json({ error: "Failed to fetch mandate" });
    }
  });

  // Get user's BuyBox mandates
  app.get("/api/buybox/user/mandates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const mandates = await storage.getBuyBoxMandatesByUser(userId);
      res.json(mandates);
    } catch (error) {
      console.error("Error fetching user mandates:", error);
      res.status(500).json({ error: "Failed to fetch mandates" });
    }
  });

  // Get all BuyBox mandates (for realtors/admin)
  app.get("/api/buybox/all/mandates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.session.userId);
      // Only allow admin or realtor roles
      if (!user || (user.role !== "admin" && user.role !== "realtor")) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const mandates = await storage.getAllBuyBoxMandates();
      res.json(mandates);
    } catch (error) {
      console.error("Error fetching all mandates:", error);
      res.status(500).json({ error: "Failed to fetch mandates" });
    }
  });

  // Submit a realtor response to a mandate
  app.post("/api/buybox/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await authStorage.getUser(userId);
      
      if (!user || (user.role !== "admin" && user.role !== "realtor")) {
        res.status(403).json({ error: "Only realtors can respond to mandates" });
        return;
      }

      const mandate = await storage.getBuyBoxMandate(req.params.id);
      if (!mandate) {
        res.status(404).json({ error: "Mandate not found" });
        return;
      }

      const { message, propertyAddress, propertyLink } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const response = await storage.createBuyBoxResponse({
        mandateId: mandate.id,
        realtorId: userId,
        message,
        propertyAddress,
        propertyLink,
      });

      // Create notification for mandate owner
      await storage.createBuyBoxNotification({
        userId: mandate.userId,
        type: "realtor_response",
        title: "New Response to Your BuyBox",
        message: `A realtor has responded to your property search mandate.`,
        mandateId: mandate.id,
      });

      res.json({ success: true, responseId: response.id });
    } catch (error) {
      console.error("Error submitting response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // Get responses for a mandate
  app.get("/api/buybox/:id/responses", isAuthenticated, async (req: any, res) => {
    try {
      const mandate = await storage.getBuyBoxMandate(req.params.id);
      if (!mandate) {
        res.status(404).json({ error: "Mandate not found" });
        return;
      }

      // Only mandate owner or realtors/admin can view responses
      const userId = req.session.userId;
      const user = await authStorage.getUser(userId);
      if (mandate.userId !== userId && user?.role !== "admin" && user?.role !== "realtor") {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const responses = await storage.getBuyBoxResponsesByMandate(req.params.id);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching responses:", error);
      res.status(500).json({ error: "Failed to fetch responses" });
    }
  });

  // Get user's notifications
  app.get("/api/buybox/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const notifications = await storage.getBuyBoxNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.post("/api/buybox/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markBuyBoxNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  // ============================================
  // CO-INVESTING COMPLIANCE ROUTES
  // ============================================

  // Get compliance status for current user
  app.get("/api/coinvest/compliance-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getCoInvestUserProfile(userId);
      
      const jurisdiction = profile?.selectedJurisdiction || profile?.region || null;
      const isOntario = jurisdiction === "ON";
      const braStatus = profile?.braStatus || "not_started";
      const coinvestAckStatus = profile?.coinvestAckStatus || "not_started";
      const isRepresented = braStatus === "signed" && coinvestAckStatus === "signed";
      
      // For Ontario: require both BRA and acknowledgment
      // For other jurisdictions: allow access (for now)
      const canAccess = !isOntario || isRepresented;
      
      res.json({
        jurisdiction,
        braStatus,
        braSignedAt: profile?.braSignedAt || null,
        coinvestAckStatus,
        coinvestAckSignedAt: profile?.coinvestAckSignedAt || null,
        isOntario,
        isRepresented,
        canAccess,
      });
    } catch (error) {
      console.error("Error fetching compliance status:", error);
      res.status(500).json({ error: "Failed to fetch compliance status" });
    }
  });

  // Set user's jurisdiction
  app.post("/api/coinvest/set-jurisdiction", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { jurisdiction } = req.body;
      
      if (!jurisdiction) {
        res.status(400).json({ error: "Jurisdiction is required" });
        return;
      }
      
      // Ensure profile exists and update jurisdiction
      await storage.upsertCoInvestUserProfile({
        userId,
        selectedJurisdiction: jurisdiction,
      });
      
      // Update BRA status fields separately
      await storage.updateCoInvestProfileBraStatus(userId, {
        selectedJurisdiction: jurisdiction,
      });
      
      // Log the event
      await storage.createCoInvestComplianceLog({
        userId,
        eventType: "jurisdiction_changed",
        metadata: { jurisdiction },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      
      res.json({ success: true, jurisdiction });
    } catch (error) {
      console.error("Error setting jurisdiction:", error);
      res.status(500).json({ error: "Failed to set jurisdiction" });
    }
  });

  // Sign BRA for co-investing
  app.post("/api/coinvest/sign-bra", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { signedName, signatureDataUrl } = req.body;
      
      if (!signedName || !signatureDataUrl) {
        res.status(400).json({ error: "Signed name and signature are required" });
        return;
      }
      
      // Ensure profile exists
      let profile = await storage.getCoInvestUserProfile(userId);
      if (!profile) {
        profile = await storage.upsertCoInvestUserProfile({ userId });
      }
      
      // Generate a unique document ID
      const braDocumentId = `coinvest-bra-${userId}-${Date.now()}`;
      
      // Update profile with BRA status
      await storage.updateCoInvestProfileBraStatus(userId, {
        braStatus: "signed",
        braSignedAt: new Date(),
        braDocumentId,
        braJurisdiction: profile?.selectedJurisdiction || "ON",
      });
      
      // Log the signing event
      await storage.createCoInvestComplianceLog({
        userId,
        eventType: "bra_signed",
        metadata: { signedName, braDocumentId },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      
      // Also create a BuyBox agreement record for unified tracking
      try {
        const termEndDate = new Date();
        termEndDate.setFullYear(termEndDate.getFullYear() + 1);
        
        await storage.createBuyBoxAgreement({
          userId,
          agreementVersion: "coinvest-1.0",
          agreementHtml: `Co-Investing Buyer Representation Agreement signed by ${signedName}`,
          signedName,
          signatureDataUrl,
          termStartDate: new Date(),
          termEndDate,
          holdoverDays: 60,
          commissionPercent: 2.5,
          ipAddress: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
          signedAt: new Date(),
        });
      } catch (buyboxError) {
        console.error("Error creating buybox agreement record:", buyboxError);
        // Continue - the co-invest record is the primary one
      }
      
      res.json({ success: true, braDocumentId });
    } catch (error) {
      console.error("Error signing BRA:", error);
      res.status(500).json({ error: "Failed to sign BRA" });
    }
  });

  // Sign Co-Invest Acknowledgement
  app.post("/api/coinvest/sign-acknowledgement", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { signedName } = req.body;
      
      if (!signedName) {
        res.status(400).json({ error: "Signed name is required" });
        return;
      }
      
      // Ensure profile exists
      let profile = await storage.getCoInvestUserProfile(userId);
      if (!profile) {
        res.status(400).json({ error: "Profile not found. Please complete BRA first." });
        return;
      }
      
      // Verify BRA is signed first
      if (profile.braStatus !== "signed") {
        res.status(400).json({ error: "BRA must be signed before acknowledgement" });
        return;
      }
      
      // Update profile with acknowledgement
      await storage.updateCoInvestProfileBraStatus(userId, {
        coinvestAckStatus: "signed",
        coinvestAckSignedAt: new Date(),
        coinvestAckVersion: "1.0",
        coinvestAckSignedName: signedName,
      });
      
      // Log the event
      await storage.createCoInvestComplianceLog({
        userId,
        eventType: "ack_signed",
        metadata: { signedName, version: "1.0" },
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error signing acknowledgement:", error);
      res.status(500).json({ error: "Failed to sign acknowledgement" });
    }
  });

  // Helper function to check if user can access co-invest features
  async function canAccessCoInvest(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const profile = await storage.getCoInvestUserProfile(userId);
    if (!profile) {
      return { allowed: true }; // New users go through onboarding
    }
    
    const jurisdiction = profile.selectedJurisdiction || profile.region;
    const isOntario = jurisdiction === "ON";
    
    if (!isOntario) {
      return { allowed: true };
    }
    
    const braOk = profile.braStatus === "signed";
    const ackOk = profile.coinvestAckStatus === "signed";
    
    if (!braOk) {
      return { allowed: false, reason: "BRA not signed" };
    }
    if (!ackOk) {
      return { allowed: false, reason: "Acknowledgement not signed" };
    }
    
    return { allowed: true };
  }

  // ============================================
  // CO-INVESTING ROUTES
  // ============================================

  // Get or create user's co-invest profile
  app.get("/api/coinvesting/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let profile = await storage.getCoInvestUserProfile(userId);
      res.json({ profile: profile || null });
    } catch (error) {
      console.error("Error fetching co-invest profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/coinvesting/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.upsertCoInvestUserProfile({
        ...req.body,
        userId,
      });
      res.json({ profile });
    } catch (error) {
      console.error("Error updating co-invest profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // List public groups
  app.get("/api/coinvesting/groups", async (req, res) => {
    try {
      const groups = await storage.getPublicCoInvestGroups();
      res.json({ groups });
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  // Get user's own groups
  app.get("/api/coinvesting/my-groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ownedGroups = await storage.getCoInvestGroupsByOwner(userId);
      const memberships = await storage.getCoInvestMembershipsByUser(userId);
      res.json({ ownedGroups, memberships });
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  // Create a new group - REQUIRES REPRESENTATION FOR ONTARIO
  app.post("/api/coinvesting/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check compliance status for Ontario users
      const accessCheck = await canAccessCoInvest(userId);
      if (!accessCheck.allowed) {
        await storage.createCoInvestComplianceLog({
          userId,
          eventType: "access_denied",
          metadata: { action: "create_group", reason: accessCheck.reason },
          ipAddress: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
        });
        res.status(403).json({ 
          error: "Representation required", 
          reason: accessCheck.reason,
          requiresRepresentation: true,
        });
        return;
      }
      
      const group = await storage.createCoInvestGroup({
        ...req.body,
        ownerUserId: userId,
      });
      
      // Auto-create owner membership
      await storage.createCoInvestMembership({
        groupId: group.id,
        userId: userId,
        role: "owner",
        status: "approved",
      });
      
      res.json({ group });
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  // Get single group - with visibility and auth checks
  app.get("/api/coinvesting/groups/:id", async (req: any, res) => {
    try {
      const group = await storage.getCoInvestGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      const userId = req.user?.id;
      const isOwner = userId && group.ownerUserId === userId;
      
      // Check visibility permissions
      if (group.visibility !== "public" && !isOwner) {
        // For private/unlisted groups, check if user is a member
        if (userId) {
          const membership = await storage.getUserMembershipInGroup(userId, group.id);
          if (!membership) {
            return res.status(403).json({ error: "Not authorized to view this group" });
          }
        } else {
          return res.status(403).json({ error: "Not authorized to view this group" });
        }
      }
      
      const checklistResult = group.checklistResultId 
        ? await storage.getCoInvestChecklistResult(group.checklistResultId)
        : null;
      
      // Only return full membership list to owner or approved members
      let memberships: any[] = [];
      if (isOwner) {
        memberships = await storage.getCoInvestMembershipsByGroup(group.id);
      } else if (userId) {
        const userMembership = await storage.getUserMembershipInGroup(userId, group.id);
        if (userMembership?.status === "approved") {
          // Approved members can see other approved members (not pending requests)
          const allMemberships = await storage.getCoInvestMembershipsByGroup(group.id);
          memberships = allMemberships.filter(m => m.status === "approved");
        } else if (userMembership) {
          // Non-approved members can only see their own membership
          memberships = [userMembership];
        }
      }
      // Anonymous users get empty memberships array (only see approved count if needed)
      
      res.json({ 
        group, 
        memberships,
        checklistResult,
        approvedMemberCount: (await storage.getCoInvestMembershipsByGroup(group.id))
          .filter(m => m.status === "approved").length
      });
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  // Update group
  app.patch("/api/coinvesting/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getCoInvestGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      if (group.ownerUserId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateCoInvestGroup(req.params.id, req.body);
      res.json({ group: updated });
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  // Request to join group
  // Request to join a group - REQUIRES REPRESENTATION FOR ONTARIO
  app.post("/api/coinvesting/groups/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = req.params.id;
      
      // Check compliance status for Ontario users
      const accessCheck = await canAccessCoInvest(userId);
      if (!accessCheck.allowed) {
        await storage.createCoInvestComplianceLog({
          userId,
          eventType: "access_denied",
          metadata: { action: "join_group", groupId, reason: accessCheck.reason },
          ipAddress: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
        });
        res.status(403).json({ 
          error: "Representation required", 
          reason: accessCheck.reason,
          requiresRepresentation: true,
        });
        return;
      }
      
      const group = await storage.getCoInvestGroup(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Check if already a member
      const existing = await storage.getUserMembershipInGroup(userId, groupId);
      if (existing) {
        return res.status(400).json({ error: "Already a member or pending" });
      }
      
      const membership = await storage.createCoInvestMembership({
        groupId,
        userId,
        role: "member",
        status: "requested",
        pledgedCapitalCad: req.body.pledgedCapitalCad,
        skillsOffered: req.body.skillsOffered,
        note: req.body.note,
      });
      
      res.json({ membership });
    } catch (error) {
      console.error("Error joining group:", error);
      res.status(500).json({ error: "Failed to join group" });
    }
  });

  // Approve/reject membership
  app.patch("/api/coinvesting/memberships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const membership = await storage.getCoInvestMembership(req.params.id);
      if (!membership) {
        return res.status(404).json({ error: "Membership not found" });
      }
      
      const group = await storage.getCoInvestGroup(membership.groupId);
      if (!group || group.ownerUserId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      // Validate status value - only allow valid transitions
      const validStatuses = ["approved", "rejected", "removed"];
      if (!req.body.status || !validStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      // Validate status transitions
      if (membership.status === "approved" && req.body.status === "approved") {
        return res.status(400).json({ error: "Member is already approved" });
      }
      
      const updated = await storage.updateCoInvestMembership(req.params.id, {
        status: req.body.status,
      });
      res.json({ membership: updated });
    } catch (error) {
      console.error("Error updating membership:", error);
      res.status(500).json({ error: "Failed to update membership" });
    }
  });

  // Save checklist result
  app.post("/api/coinvesting/checklist", isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.createCoInvestChecklistResult({
        ...req.body,
        userId: req.user.id,
      });
      res.json({ result });
    } catch (error) {
      console.error("Error saving checklist:", error);
      res.status(500).json({ error: "Failed to save checklist" });
    }
  });

  // Get messages for a group
  app.get("/api/coinvesting/groups/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = req.params.id;
      const userId = req.user.id;
      
      // Check membership
      const membership = await storage.getUserMembershipInGroup(userId, groupId);
      if (!membership || membership.status !== "approved") {
        return res.status(403).json({ error: "Must be an approved member" });
      }
      
      const messages = await storage.getCoInvestMessagesByGroup(groupId);
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Post a message
  // Post message to group - REQUIRES REPRESENTATION FOR ONTARIO
  app.post("/api/coinvesting/groups/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = req.params.id;
      const userId = req.user.id;
      
      // Check compliance status for Ontario users
      const accessCheck = await canAccessCoInvest(userId);
      if (!accessCheck.allowed) {
        await storage.createCoInvestComplianceLog({
          userId,
          eventType: "access_denied",
          metadata: { action: "post_message", groupId, reason: accessCheck.reason },
          ipAddress: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
        });
        res.status(403).json({ 
          error: "Representation required", 
          reason: accessCheck.reason,
          requiresRepresentation: true,
        });
        return;
      }
      
      // Check membership
      const membership = await storage.getUserMembershipInGroup(userId, groupId);
      if (!membership || membership.status !== "approved") {
        return res.status(403).json({ error: "Must be an approved member" });
      }
      
      const message = await storage.createCoInvestMessage({
        groupId,
        userId,
        message: req.body.message,
      });
      res.json({ message });
    } catch (error) {
      console.error("Error posting message:", error);
      res.status(500).json({ error: "Failed to post message" });
    }
  });

  // True Cost of Homeownership Calculator
  const trueCostInputSchema = z.object({
    homeValue: z.number().min(50000).max(50000000),
    city: z.string().min(1),
    isNewConstruction: z.boolean(),
    buyerType: z.enum(buyerTypes),
    homeType: z.enum(homeTypes),
    squareFootage: z.number().min(200).max(20000).optional(),
  });

  app.post("/api/true-cost/calculate", async (req, res) => {
    try {
      const input = trueCostInputSchema.parse(req.body);
      const breakdown = calculateTrueCost(input as TrueCostInput);
      
      // If user is authenticated, save inquiry and breakdown to database
      const isLoggedIn = req.isAuthenticated?.() && req.user;
      if (isLoggedIn && req.user) {
        const [inquiry] = await db.insert(trueCostInquiries).values({
          userId: req.user.id,
          homeValue: input.homeValue,
          city: input.city,
          homeType: input.homeType,
          buyerType: input.buyerType,
          isNewConstruction: input.isNewConstruction,
          squareFootage: input.squareFootage,
        }).returning();
        
        await db.insert(trueCostBreakdowns).values({
          inquiryId: inquiry.id,
          breakdownJson: breakdown,
        });
        
        return res.json({ ...breakdown, inquiryId: inquiry.id });
      }
      
      res.json(breakdown);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("True cost calculation error:", error);
      res.status(500).json({ error: "Failed to calculate costs" });
    }
  });

  app.get("/api/true-cost/options", (req, res) => {
    res.json({
      cities: cities,
      municipalities: Object.values(municipalities).map(m => ({
        name: m.name,
        region: m.region,
        developmentCharge: m.developmentCharge,
      })),
      homeTypes: homeTypes,
      buyerTypes: buyerTypes,
    });
  });

  app.get("/api/true-cost/match-city", (req, res) => {
    const input = req.query.q as string;
    if (!input || input.length < 2) {
      return res.json({ matches: [] });
    }
    const matched = matchMunicipality(input);
    if (matched) {
      return res.json({ 
        matches: [{ name: matched.name, region: matched.region, developmentCharge: matched.developmentCharge }] 
      });
    }
    // Return partial matches for autocomplete
    const normalized = input.toLowerCase().trim();
    const partialMatches = Object.values(municipalities)
      .filter(m => 
        m.name.toLowerCase().includes(normalized) || 
        m.aliases.some(a => a.includes(normalized))
      )
      .slice(0, 5)
      .map(m => ({ name: m.name, region: m.region, developmentCharge: m.developmentCharge }));
    res.json({ matches: partialMatches });
  });

  app.get("/api/true-cost/breakdown/:inquiryId", async (req, res) => {
    try {
      const { inquiryId } = req.params;
      
      const [breakdown] = await db
        .select()
        .from(trueCostBreakdowns)
        .where(eq(trueCostBreakdowns.inquiryId, inquiryId));
      
      if (!breakdown) {
        return res.status(404).json({ error: "Breakdown not found" });
      }
      
      res.json(breakdown.breakdownJson);
    } catch (error) {
      console.error("Error fetching breakdown:", error);
      res.status(500).json({ error: "Failed to fetch breakdown" });
    }
  });

  app.get("/api/true-cost/my-inquiries", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const inquiries = await db
        .select()
        .from(trueCostInquiries)
        .where(eq(trueCostInquiries.userId, req.user.id))
        .orderBy(sql`${trueCostInquiries.createdAt} DESC`);
      
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      res.status(500).json({ error: "Failed to fetch inquiries" });
    }
  });

  // Realtor.ca listing parser endpoint
  app.post("/api/listings/parse-realtor-ca", async (req, res) => {
    try {
      const { url, html: providedHtml } = req.body;
      
      let html: string;
      let sourceUrl = "";
      
      if (providedHtml && typeof providedHtml === "string") {
        // User provided HTML source directly
        html = providedHtml;
        // Try to extract URL from the HTML
        const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (canonicalMatch) {
          sourceUrl = canonicalMatch[1];
        }
      } else if (url && typeof url === "string") {
        const realtorCaPattern = /^https?:\/\/(www\.)?realtor\.ca\/(real-estate|immobilier)\/\d+/;
        if (!realtorCaPattern.test(url)) {
          return res.status(400).json({ error: "Please provide a valid realtor.ca listing URL" });
        }
        
        sourceUrl = url;
        
        const puppeteerExtra = await import("puppeteer-extra");
        const StealthPlugin = await import("puppeteer-extra-plugin-stealth");
        puppeteerExtra.default.use(StealthPlugin.default());
        
        let browser;
        try {
          browser = await puppeteerExtra.default.launch({
            executablePath: process.env.CHROMIUM_PATH || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
            headless: "new",
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--single-process",
              "--disable-blink-features=AutomationControlled",
            ],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          
          await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
          
          await page.waitForFunction(() => {
            return document.body.innerHTML.length > 10000;
          }, { timeout: 15000 }).catch(() => {});
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          html = await page.content();
          
          const hasListingData = html.includes('dataLayer') && (html.includes('property:') || html.includes('propertyType'))
            || html.includes('__NEXT_DATA__')
            || html.includes('listingData');
          const isBlocked = (html.includes('_Incapsula_Resource') && !hasListingData) || html.length < 3000;
          
          if (isBlocked) {
            return res.status(400).json({ 
              error: "Realtor.ca blocked the automated request. Please use the quick paste method below instead — it only takes 30 seconds.",
              blocked: true
            });
          }
        } catch (browserError: any) {
          console.error("Puppeteer error:", browserError.message);
          return res.status(400).json({ 
            error: "Could not load the listing page. Please try the paste method below instead.",
            blocked: true
          });
        } finally {
          if (browser) {
            await browser.close().catch(() => {});
          }
        }
      } else {
        return res.status(400).json({ error: "URL or HTML source is required" });
      }
      
      // Try multiple patterns to find property data
      let propertyBlock = "";
      
      // Pattern 1: dataLayer.push with property block
      const dataLayerMatch = html.match(/dataLayer\.push\(\{[\s\S]*?property:\s*\{([\s\S]*?)\}\s*\}\);/);
      if (dataLayerMatch) {
        propertyBlock = dataLayerMatch[1];
      }
      
      // Pattern 2: Look for __NEXT_DATA__ JSON (newer realtor.ca format)
      if (!propertyBlock) {
        const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const listing = nextData?.props?.pageProps?.listing || nextData?.props?.pageProps?.property;
            if (listing) {
              // Convert to property block format for extraction
              propertyBlock = JSON.stringify(listing);
            }
          } catch (e) {
            // JSON parse failed, continue to other patterns
          }
        }
      }
      
      // Pattern 3: Look for listingData variable
      if (!propertyBlock) {
        const listingDataMatch = html.match(/listingData\s*=\s*(\{[\s\S]*?\});/);
        if (listingDataMatch) {
          propertyBlock = listingDataMatch[1];
        }
      }
      
      // Pattern 4: Look for window.__PRELOADED_STATE__
      if (!propertyBlock) {
        const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (preloadedMatch) {
          propertyBlock = preloadedMatch[1];
        }
      }
      
      if (!propertyBlock) {
        // Check if it looks like a blocked page
        if (html.includes("_Incapsula_Resource") || html.length < 1000) {
          return res.status(400).json({ 
            error: "The page source appears to be blocked or incomplete. Please make sure you copied the full page source after the page fully loaded.",
            blocked: true
          });
        }
        return res.status(400).json({ error: "Could not parse listing data. Please make sure you copied the full page source from a realtor.ca listing page." });
      }
      
      // Extract property details using regex
      const extractField = (fieldName: string): string => {
        const match = propertyBlock.match(new RegExp(`${fieldName}:\\s*['"]([^'"]*?)['"]`));
        return match ? match[1] : "";
      };
      
      const price = extractField("price");
      const bedrooms = extractField("bedrooms");
      const bathrooms = extractField("bathrooms");
      const propertyType = extractField("propertyType");
      const buildingType = extractField("buildingType");
      const city = extractField("city");
      const province = extractField("province");
      const interiorFloorSpace = extractField("interiorFloorSpace");
      const listingId = extractField("listingID");
      const propertyId = extractField("propertyID");
      const storeys = extractField("storeys");
      const buildingStyle = extractField("buildingStyle");
      const landSize = extractField("landSize");
      
      // Extract address from title tag
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let address = "";
      if (titleMatch) {
        // Title format: "For sale: 4295 HORSESHOE VALLEY ROAD W, Springwater, Ontario L9X1G1 - S12360403 | REALTOR.ca"
        const titleText = titleMatch[1];
        const addressMatch = titleText.match(/For sale:\s*([^-|]+)/i);
        if (addressMatch) {
          // Get the street address part before the city
          const fullAddress = addressMatch[1].trim();
          const parts = fullAddress.split(",");
          if (parts.length > 0) {
            address = parts[0].trim();
          }
        }
      }
      
      // Extract postal code from title or meta
      let postalCode = "";
      if (titleMatch) {
        const postalMatch = titleMatch[1].match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
        if (postalMatch) {
          postalCode = postalMatch[1].replace(/\s/g, "").toUpperCase();
        }
      }
      
      // Convert square meters to square feet if needed
      let squareFootage = 0;
      if (interiorFloorSpace) {
        const sqmMatch = interiorFloorSpace.match(/([\d.]+)\s*m2/i);
        if (sqmMatch) {
          squareFootage = Math.round(parseFloat(sqmMatch[1]) * 10.764);
        }
        const sqftMatch = interiorFloorSpace.match(/([\d,]+)\s*(sq\.?\s*ft|sqft)/i);
        if (sqftMatch) {
          squareFootage = parseInt(sqftMatch[1].replace(/,/g, ""));
        }
      }
      
      // Extract first image URL
      const imageMatch = html.match(/og:image"\s+content="([^"]+)"/);
      const imageUrl = imageMatch ? imageMatch[1] : "";
      
      res.json({
        success: true,
        listing: {
          listingId,
          propertyId,
          address,
          city,
          province,
          postalCode,
          country: "canada",
          price: price ? parseFloat(price) : 0,
          bedrooms: bedrooms ? parseInt(bedrooms) : 0,
          bathrooms: bathrooms ? parseInt(bathrooms) : 0,
          squareFootage,
          propertyType,
          buildingType,
          buildingStyle,
          storeys: storeys ? parseInt(storeys) : 0,
          landSize,
          imageUrl,
          sourceUrl,
        },
      });
    } catch (error) {
      console.error("Error parsing realtor.ca listing:", error);
      res.status(500).json({ error: "Failed to parse listing. Please try again." });
    }
  });

  app.post("/api/listings/parse-zillow", async (req, res) => {
    try {
      const { url, html: providedHtml } = req.body;
      
      let html: string;
      let sourceUrl = "";
      
      if (providedHtml && typeof providedHtml === "string") {
        html = providedHtml;
        const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (canonicalMatch) {
          sourceUrl = canonicalMatch[1];
        }
      } else if (url && typeof url === "string") {
        const zillowPattern = /^https?:\/\/(www\.)?zillow\.com\/homedetails\//;
        if (!zillowPattern.test(url)) {
          return res.status(400).json({ error: "Please provide a valid Zillow listing URL (zillow.com/homedetails/...)" });
        }
        
        sourceUrl = url;
        
        const puppeteerExtra = await import("puppeteer-extra");
        const StealthPlugin = await import("puppeteer-extra-plugin-stealth");
        puppeteerExtra.default.use(StealthPlugin.default());
        
        let browser;
        try {
          browser = await puppeteerExtra.default.launch({
            executablePath: process.env.CHROMIUM_PATH || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
            headless: "new",
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--single-process",
              "--disable-blink-features=AutomationControlled",
            ],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          html = await page.content();
        } catch (browserError: any) {
          console.error("Zillow Puppeteer error:", browserError.message);
          return res.status(400).json({ 
            error: "Could not load the Zillow page. Please try the HTML paste method instead.",
            blocked: true,
          });
        } finally {
          if (browser) {
            await browser.close().catch(() => {});
          }
        }
        
        if ((html.includes("captcha") || html.includes("px-captcha")) && html.length < 5000) {
          return res.status(400).json({ 
            error: "Zillow blocked the request. Please use the 'Advanced Import' option to paste the page HTML instead.",
            blocked: true,
          });
        }
      } else {
        return res.status(400).json({ error: "URL or HTML source is required" });
      }
      
      let listingData: any = null;
      
      const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const propertyData = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
          if (propertyData) {
            const cacheKey = Object.keys(propertyData)[0];
            if (cacheKey) {
              const parsed = JSON.parse(propertyData[cacheKey]);
              listingData = parsed?.property;
            }
          }
          if (!listingData) {
            listingData = nextData?.props?.pageProps?.property;
          }
        } catch (e) {
          // continue to other patterns
        }
      }
      
      if (!listingData) {
        const ldJsonMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
        for (const match of ldJsonMatches) {
          try {
            const jsonData = JSON.parse(match[1]);
            if (jsonData["@type"] === "SingleFamilyResidence" || jsonData["@type"] === "Product" || jsonData["@type"] === "RealEstateListing") {
              listingData = jsonData;
              break;
            }
          } catch (e) {
            // continue
          }
        }
      }
      
      let address = "";
      let city = "";
      let state = "";
      let zipCode = "";
      let price = 0;
      let bedrooms = 0;
      let bathrooms = 0;
      let squareFootage = 0;
      let propertyType = "";
      let yearBuilt = "";
      let lotSize = "";
      let imageUrl = "";
      let zpid = "";
      
      if (listingData) {
        address = listingData.streetAddress || listingData.address?.streetAddress || "";
        city = listingData.city || listingData.address?.addressLocality || "";
        state = listingData.state || listingData.address?.addressRegion || "";
        zipCode = listingData.zipcode || listingData.address?.postalCode || "";
        price = listingData.price || listingData.offers?.price || 0;
        bedrooms = listingData.bedrooms || 0;
        bathrooms = listingData.bathrooms || 0;
        squareFootage = listingData.livingArea || listingData.floorSize?.value || 0;
        propertyType = listingData.homeType || listingData["@type"] || "";
        yearBuilt = listingData.yearBuilt || "";
        lotSize = listingData.lotSize || listingData.lotAreaValue || "";
        zpid = listingData.zpid || "";
      }
      
      if (!address) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          const parts = titleMatch[1].split("|")[0].split("-")[0].trim().split(",");
          if (parts.length > 0) address = parts[0].trim();
          if (parts.length > 1) city = parts[1].trim();
          if (parts.length > 2) {
            const stateZip = parts[2].trim().split(" ");
            state = stateZip[0] || "";
            zipCode = stateZip[1] || "";
          }
        }
      }
      
      if (!price) {
        const priceMatch = html.match(/\$[\d,]+(?:\.\d{2})?/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(/[$,]/g, ""));
        }
      }
      
      const metaPriceMatch = html.match(/property="product:price:amount"\s+content="([\d.]+)"/);
      if (metaPriceMatch && !price) {
        price = parseFloat(metaPriceMatch[1]);
      }
      
      if (!bedrooms) {
        const bedMatch = html.match(/(\d+)\s*(?:bed|bd)/i);
        if (bedMatch) bedrooms = parseInt(bedMatch[1]);
      }
      if (!bathrooms) {
        const bathMatch = html.match(/(\d+)\s*(?:bath|ba)/i);
        if (bathMatch) bathrooms = parseInt(bathMatch[1]);
      }
      if (!squareFootage) {
        const sqftMatch = html.match(/([\d,]+)\s*(?:sqft|sq\s*ft)/i);
        if (sqftMatch) squareFootage = parseInt(sqftMatch[1].replace(/,/g, ""));
      }
      
      const ogImageMatch = html.match(/og:image"\s+content="([^"]+)"/);
      if (ogImageMatch) imageUrl = ogImageMatch[1];
      
      if (!address && !city) {
        if (html.includes("captcha") || html.length < 2000) {
          return res.status(400).json({
            error: "The page source appears to be blocked. Please paste the full page source after the page fully loads.",
            blocked: true,
          });
        }
        return res.status(400).json({ error: "Could not parse listing data. Please make sure you copied the full page source from a Zillow listing page." });
      }
      
      res.json({
        success: true,
        listing: {
          listingId: zpid,
          propertyId: zpid,
          address,
          city,
          province: state,
          postalCode: zipCode,
          country: "usa",
          price,
          bedrooms,
          bathrooms,
          squareFootage,
          propertyType,
          buildingType: propertyType,
          buildingStyle: "",
          storeys: 0,
          landSize: typeof lotSize === "number" ? `${lotSize} sqft` : lotSize,
          yearBuilt,
          imageUrl,
          sourceUrl,
        },
      });
    } catch (error) {
      console.error("Error parsing Zillow listing:", error);
      res.status(500).json({ error: "Failed to parse listing. Please try again." });
    }
  });

  // ==========================================
  // Will It Plex - Capstone Project API Routes
  // ==========================================

  // Get all projects for current user
  app.get("/api/capstone/projects", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const projects = await db
        .select()
        .from(capstoneProjects)
        .where(eq(capstoneProjects.userId, req.user.id))
        .orderBy(sql`${capstoneProjects.updatedAt} DESC`);
      
      // Fetch related data for each project
      const projectsWithRelations = await Promise.all(
        projects.map(async (project) => {
          const [property] = await db
            .select()
            .from(capstoneProperties)
            .where(eq(capstoneProperties.projectId, project.id));
          
          const [costModel] = await db
            .select()
            .from(capstoneCostModels)
            .where(eq(capstoneCostModels.projectId, project.id));
          
          const [proforma] = await db
            .select()
            .from(capstoneProformas)
            .where(eq(capstoneProformas.projectId, project.id));
          
          return {
            ...project,
            property: property || null,
            costModel: costModel || null,
            proforma: proforma || null,
          };
        })
      );
      
      res.json(projectsWithRelations);
    } catch (error) {
      console.error("Error fetching capstone projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get single project by ID
  app.get("/api/capstone/projects/:id", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      
      const [project] = await db
        .select()
        .from(capstoneProjects)
        .where(and(
          eq(capstoneProjects.id, id),
          eq(capstoneProjects.userId, req.user.id)
        ));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const [property] = await db
        .select()
        .from(capstoneProperties)
        .where(eq(capstoneProperties.projectId, id));
      
      const [costModel] = await db
        .select()
        .from(capstoneCostModels)
        .where(eq(capstoneCostModels.projectId, id));
      
      const [proforma] = await db
        .select()
        .from(capstoneProformas)
        .where(eq(capstoneProformas.projectId, id));
      
      res.json({
        ...project,
        property: property || null,
        costModel: costModel || null,
        proforma: proforma || null,
      });
    } catch (error) {
      console.error("Error fetching capstone project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create new project
  app.post("/api/capstone/projects", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const [project] = await db
        .insert(capstoneProjects)
        .values({
          userId: req.user.id,
          status: "draft",
          currentStep: 1,
        })
        .returning();
      
      res.json({ project });
    } catch (error) {
      console.error("Error creating capstone project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // Update project
  app.patch("/api/capstone/projects/:id", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      const { strategy, currentStep, status, completedAt, title } = req.body;
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(capstoneProjects)
        .where(and(
          eq(capstoneProjects.id, id),
          eq(capstoneProjects.userId, req.user.id)
        ));
      
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const updateData: any = { updatedAt: new Date() };
      if (strategy !== undefined) updateData.strategy = strategy;
      if (currentStep !== undefined) updateData.currentStep = currentStep;
      if (status !== undefined) updateData.status = status;
      if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);
      if (title !== undefined) updateData.title = title;
      
      const [updated] = await db
        .update(capstoneProjects)
        .set(updateData)
        .where(eq(capstoneProjects.id, id))
        .returning();
      
      res.json({ project: updated });
    } catch (error) {
      console.error("Error updating capstone project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Save property to project
  app.post("/api/capstone/projects/:id/property", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      
      // Verify ownership
      const [project] = await db
        .select()
        .from(capstoneProjects)
        .where(and(
          eq(capstoneProjects.id, id),
          eq(capstoneProjects.userId, req.user.id)
        ));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Delete existing property if any
      await db
        .delete(capstoneProperties)
        .where(eq(capstoneProperties.projectId, id));
      
      // Insert new property
      const [property] = await db
        .insert(capstoneProperties)
        .values({
          projectId: id,
          sourceUrl: req.body.sourceUrl,
          listingId: req.body.listingId,
          address: req.body.address,
          city: req.body.city,
          province: req.body.province,
          postalCode: req.body.postalCode,
          price: req.body.price,
          annualTaxes: req.body.annualTaxes,
          lotFrontage: req.body.lotFrontage,
          lotDepth: req.body.lotDepth,
          lotArea: req.body.lotArea,
          bedrooms: req.body.bedrooms,
          bathrooms: req.body.bathrooms,
          squareFootage: req.body.squareFootage,
          propertyType: req.body.propertyType,
          buildingType: req.body.buildingType,
          imageUrl: req.body.imageUrl,
        })
        .returning();
      
      // Update project title if not set
      if (!project.title && req.body.address) {
        await db
          .update(capstoneProjects)
          .set({ title: req.body.address, updatedAt: new Date() })
          .where(eq(capstoneProjects.id, id));
      }
      
      res.json({ property });
    } catch (error) {
      console.error("Error saving capstone property:", error);
      res.status(500).json({ error: "Failed to save property" });
    }
  });

  // Save cost model
  app.post("/api/capstone/projects/:id/cost-model", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      
      // Verify ownership
      const [project] = await db
        .select()
        .from(capstoneProjects)
        .where(and(
          eq(capstoneProjects.id, id),
          eq(capstoneProjects.userId, req.user.id)
        ));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Delete existing cost model if any
      await db
        .delete(capstoneCostModels)
        .where(eq(capstoneCostModels.projectId, id));
      
      // Insert new cost model
      const [costModel] = await db
        .insert(capstoneCostModels)
        .values({
          projectId: id,
          ...req.body,
        })
        .returning();
      
      res.json({ costModel });
    } catch (error) {
      console.error("Error saving capstone cost model:", error);
      res.status(500).json({ error: "Failed to save cost model" });
    }
  });

  // Save proforma/results
  app.post("/api/capstone/projects/:id/proforma", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      
      // Verify ownership
      const [project] = await db
        .select()
        .from(capstoneProjects)
        .where(and(
          eq(capstoneProjects.id, id),
          eq(capstoneProjects.userId, req.user.id)
        ));
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Delete existing proforma if any
      await db
        .delete(capstoneProformas)
        .where(eq(capstoneProformas.projectId, id));
      
      // Insert new proforma
      const [proforma] = await db
        .insert(capstoneProformas)
        .values({
          projectId: id,
          ...req.body,
        })
        .returning();
      
      res.json({ proforma });
    } catch (error) {
      console.error("Error saving capstone proforma:", error);
      res.status(500).json({ error: "Failed to save proforma" });
    }
  });

  // ============================================
  // RENT PULSE API ROUTES
  // ============================================

  const rentIngestItemSchema = z.object({
    city: z.string().min(1),
    province: z.string().min(1),
    bedrooms: z.string().min(1),
    medianRent: z.number().int().positive(),
    averageRent: z.number().int().positive().optional(),
    sampleSize: z.number().int().positive(),
    minRent: z.number().int().positive().optional(),
    maxRent: z.number().int().positive().optional(),
    scrapedAt: z.string(),
  });

  const rentListingItemSchema = z.object({
    externalId: z.string().optional(),
    city: z.string().min(1),
    province: z.string().min(1),
    address: z.string().optional(),
    bedrooms: z.string().min(1),
    bathrooms: z.string().optional(),
    rent: z.number().int().positive(),
    squareFootage: z.number().int().positive().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    sourceUrl: z.string().optional(),
    sourcePlatform: z.string().optional(),
    listingDate: z.string().optional(),
    scrapedAt: z.string(),
  });

  const rentIngestSchema = z.object({
    pulse: z.array(rentIngestItemSchema).optional(),
    listings: z.array(rentListingItemSchema).optional(),
  });

  app.post("/api/rents/ingest", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
      const expectedKey = process.env.RENT_INGEST_KEY;
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsed = rentIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
      }

      const { pulse, listings } = parsed.data;
      let pulseInserted = 0;
      let listingsInserted = 0;

      if (pulse && pulse.length > 0) {
        const rows = pulse.map(p => ({
          city: p.city,
          province: p.province,
          bedrooms: p.bedrooms,
          medianRent: p.medianRent,
          averageRent: p.averageRent ?? null,
          sampleSize: p.sampleSize,
          minRent: p.minRent ?? null,
          maxRent: p.maxRent ?? null,
          scrapedAt: new Date(p.scrapedAt),
        }));
        await db.insert(rentPulse).values(rows);
        pulseInserted = rows.length;
      }

      if (listings && listings.length > 0) {
        const rows = listings.map(l => ({
          externalId: l.externalId ?? null,
          city: l.city,
          province: l.province,
          address: l.address ?? null,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms ?? null,
          rent: l.rent,
          squareFootage: l.squareFootage ?? null,
          lat: l.lat ?? null,
          lng: l.lng ?? null,
          sourceUrl: l.sourceUrl ?? null,
          sourcePlatform: l.sourcePlatform ?? null,
          listingDate: l.listingDate ? new Date(l.listingDate) : null,
          scrapedAt: new Date(l.scrapedAt),
        }));
        const BATCH_SIZE = 500;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          await db.insert(rentListings).values(rows.slice(i, i + BATCH_SIZE));
        }
        listingsInserted = rows.length;
      }

      res.json({ success: true, pulseInserted, listingsInserted });
    } catch (error) {
      console.error("Error ingesting rent data:", error);
      res.status(500).json({ error: "Failed to ingest rent data" });
    }
  });

  app.get("/api/rents/pulse", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const province = req.query.province as string | undefined;
      const bedrooms = req.query.bedrooms as string | undefined;

      let query = db
        .select()
        .from(rentPulse)
        .orderBy(desc(rentPulse.scrapedAt))
        .$dynamic();

      const conditions = [];
      if (city) conditions.push(eq(rentPulse.city, city));
      if (province) conditions.push(eq(rentPulse.province, province));
      if (bedrooms) conditions.push(eq(rentPulse.bedrooms, bedrooms));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query.limit(500);
      res.json(results);
    } catch (error) {
      console.error("Error fetching rent pulse:", error);
      res.status(500).json({ error: "Failed to fetch rent data" });
    }
  });

  app.get("/api/rents/cities", async (_req, res) => {
    try {
      const results = await db
        .selectDistinct({ city: rentPulse.city, province: rentPulse.province })
        .from(rentPulse)
        .orderBy(rentPulse.province, rentPulse.city);

      res.json(results);
    } catch (error) {
      console.error("Error fetching rent cities:", error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const period = req.query.period as string;
      const cityFilter = req.query.city as string | undefined;
      let dateFilter = sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL`;
      let aggregateDateFilter = sql`${analyses.resultsJson} IS NOT NULL`;

      if (period === 'monthly') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthStr = startOfMonth.toISOString();
        dateFilter = sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${monthStr}`;
        aggregateDateFilter = sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${monthStr}`;
      } else if (period === 'weekly') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const weekStr = startOfWeek.toISOString();
        dateFilter = sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStr}`;
        aggregateDateFilter = sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStr}`;
      }

      if (cityFilter) {
        dateFilter = sql`${dateFilter} AND LOWER(${analyses.city}) = LOWER(${cityFilter})`;
        aggregateDateFilter = sql`${aggregateDateFilter} AND LOWER(${analyses.city}) = LOWER(${cityFilter})`;
      }

      const analystResults = await db
        .select({
          userId: analyses.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          dealCount: count(analyses.id),
          avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
          avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
          avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
        })
        .from(analyses)
        .innerJoin(users, eq(analyses.userId, users.id))
        .where(dateFilter)
        .groupBy(analyses.userId, users.firstName, users.lastName, users.profileImageUrl, users.role)
        .orderBy(desc(count(analyses.id)))
        .limit(Math.min(Number(req.query.limit) || 25, 50));

      const leaderboard = analystResults.map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Anonymous",
        profileImageUrl: row.profileImageUrl,
        role: row.role || "investor",
        dealCount: Number(row.dealCount),
        avgDscr: row.avgDscr != null ? Math.round(Number(row.avgDscr) * 100) / 100 : null,
        avgCashOnCash: row.avgCashOnCash != null ? Math.round(Number(row.avgCashOnCash) * 100) / 100 : null,
        avgCapRate: row.avgCapRate != null ? Math.round(Number(row.avgCapRate) * 100) / 100 : null,
      }));

      const [aggregates] = await db
        .select({
          totalDeals: count(analyses.id),
          avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
          avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
          avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
          avgOfferRatio: sql<number>`AVG(
            CASE WHEN (${analyses.inputsJson}->>'purchasePrice')::numeric > 0 
                  AND (${analyses.inputsJson}->>'listingPrice')::numeric > 0
            THEN (${analyses.inputsJson}->>'purchasePrice')::numeric / (${analyses.inputsJson}->>'listingPrice')::numeric
            ELSE NULL END
          )`,
        })
        .from(analyses)
        .where(aggregateDateFilter);

      res.json({
        analysts: leaderboard,
        aggregates: {
          totalDeals: Number(aggregates?.totalDeals || 0),
          avgDscr: aggregates?.avgDscr != null ? Math.round(Number(aggregates.avgDscr) * 100) / 100 : null,
          avgCashOnCash: aggregates?.avgCashOnCash != null ? Math.round(Number(aggregates.avgCashOnCash) * 100) / 100 : null,
          avgCapRate: aggregates?.avgCapRate != null ? Math.round(Number(aggregates.avgCapRate) * 100) / 100 : null,
          avgOfferRatio: aggregates?.avgOfferRatio != null ? Math.round(Number(aggregates.avgOfferRatio) * 100) : null,
        },
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/weekly-stats", async (_req, res) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = startOfWeek.toISOString();

      const [stats] = await db
        .select({
          totalDeals: count(analyses.id),
          avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
          avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
          avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
        })
        .from(analyses)
        .where(sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStr}`);

      const cityResult = await db
        .select({
          city: analyses.city,
          dealCount: count(analyses.id),
        })
        .from(analyses)
        .where(sql`${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${weekStr} AND ${analyses.city} IS NOT NULL AND ${analyses.city} != ''`)
        .groupBy(analyses.city)
        .orderBy(desc(count(analyses.id)))
        .limit(1);

      res.json({
        totalDeals: Number(stats?.totalDeals || 0),
        avgCapRate: stats?.avgCapRate != null ? Math.round(Number(stats.avgCapRate) * 100) / 100 : null,
        avgCashOnCash: stats?.avgCashOnCash != null ? Math.round(Number(stats.avgCashOnCash) * 100) / 100 : null,
        avgDscr: stats?.avgDscr != null ? Math.round(Number(stats.avgDscr) * 100) / 100 : null,
        mostActiveCity: cityResult.length > 0 ? cityResult[0].city : null,
        mostActiveCityDeals: cityResult.length > 0 ? Number(cityResult[0].dealCount) : 0,
      });
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
      res.status(500).json({ error: "Failed to fetch weekly stats" });
    }
  });

  app.get("/api/user/stats", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.session.userId;

      const [userStats] = await db
        .select({
          totalDeals: count(analyses.id),
          avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
          avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
          avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
          firstAnalysis: sql<string>`MIN(${analyses.createdAt})`,
          lastAnalysis: sql<string>`MAX(${analyses.createdAt})`,
        })
        .from(analyses)
        .where(sql`${analyses.userId} = ${userId} AND ${analyses.resultsJson} IS NOT NULL`);

      const totalDeals = Number(userStats?.totalDeals || 0);

      const badges: { id: string; name: string; description: string; icon: string; earnedAt: string | null }[] = [];
      const badgeDefs = [
        { id: "analyst", name: "Analyst", description: "Analyzed 10 deals", icon: "search", threshold: 10 },
        { id: "power-user", name: "Power User", description: "Analyzed 50 deals", icon: "zap", threshold: 50 },
        { id: "deal-hunter", name: "Deal Hunter", description: "Analyzed 100 deals", icon: "target", threshold: 100 },
        { id: "veteran", name: "Veteran", description: "Analyzed 250 deals", icon: "shield", threshold: 250 },
        { id: "legend", name: "Legend", description: "Analyzed 500 deals", icon: "crown", threshold: 500 },
      ];

      for (const def of badgeDefs) {
        if (totalDeals >= def.threshold) {
          const [nthDeal] = await db
            .select({ createdAt: analyses.createdAt })
            .from(analyses)
            .where(sql`${analyses.userId} = ${userId} AND ${analyses.resultsJson} IS NOT NULL`)
            .orderBy(analyses.createdAt)
            .limit(1)
            .offset(def.threshold - 1);

          badges.push({
            id: def.id,
            name: def.name,
            description: def.description,
            icon: def.icon,
            earnedAt: nthDeal?.createdAt ? new Date(nthDeal.createdAt).toISOString() : null,
          });
        }
      }

      const allTimeRanking = await db
        .select({
          userId: analyses.userId,
          dealCount: count(analyses.id),
        })
        .from(analyses)
        .where(sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL`)
        .groupBy(analyses.userId)
        .orderBy(desc(count(analyses.id)));

      let rank: number | null = null;
      const rankIndex = allTimeRanking.findIndex(r => r.userId === userId);
      if (rankIndex >= 0) {
        rank = rankIndex + 1;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = startOfWeek.toISOString();
      const prevWeekStart = new Date(startOfWeek);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekStr = prevWeekStart.toISOString();

      const prevWeekRanking = await db
        .select({
          userId: analyses.userId,
          dealCount: count(analyses.id),
        })
        .from(analyses)
        .where(sql`${analyses.userId} IS NOT NULL AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} < ${weekStr}`)
        .groupBy(analyses.userId)
        .orderBy(desc(count(analyses.id)));

      let prevRank: number | null = null;
      const prevRankIndex = prevWeekRanking.findIndex(r => r.userId === userId);
      if (prevRankIndex >= 0) {
        prevRank = prevRankIndex + 1;
      }

      let rankChange: number | null = null;
      if (rank != null && prevRank != null) {
        rankChange = prevRank - rank;
      }

      const topCity = await db
        .select({
          city: analyses.city,
          dealCount: count(analyses.id),
        })
        .from(analyses)
        .where(sql`${analyses.userId} = ${userId} AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.city} IS NOT NULL AND ${analyses.city} != ''`)
        .groupBy(analyses.city)
        .orderBy(desc(count(analyses.id)))
        .limit(1);

      res.json({
        totalDeals,
        avgCapRate: userStats?.avgCapRate != null ? Math.round(Number(userStats.avgCapRate) * 100) / 100 : null,
        avgCashOnCash: userStats?.avgCashOnCash != null ? Math.round(Number(userStats.avgCashOnCash) * 100) / 100 : null,
        avgDscr: userStats?.avgDscr != null ? Math.round(Number(userStats.avgDscr) * 100) / 100 : null,
        rank,
        rankChange,
        totalUsers: allTimeRanking.length,
        badges,
        nextBadge: badgeDefs.find(b => totalDeals < b.threshold) || null,
        topCity: topCity.length > 0 ? topCity[0].city : null,
        topCityDeals: topCity.length > 0 ? Number(topCity[0].dealCount) : 0,
        firstAnalysis: userStats?.firstAnalysis || null,
        lastAnalysis: userStats?.lastAnalysis || null,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  app.get("/api/leaderboard/top-cities", async (req, res) => {
    try {
      const period = req.query.period as string | undefined;
      let dateFilter = sql`${analyses.city} IS NOT NULL AND ${analyses.city} != '' AND ${analyses.resultsJson} IS NOT NULL`;

      if (period === 'weekly') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const weekStr = startOfWeek.toISOString();
        dateFilter = sql`${dateFilter} AND ${analyses.createdAt} >= ${weekStr}`;
      } else if (period === 'monthly') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthStr = startOfMonth.toISOString();
        dateFilter = sql`${dateFilter} AND ${analyses.createdAt} >= ${monthStr}`;
      }

      const results = await db
        .select({
          city: analyses.city,
          province: analyses.province,
          dealCount: count(analyses.id),
          avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
          avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
          avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
          avgPurchasePrice: sql<number>`AVG((${analyses.inputsJson}->>'purchasePrice')::numeric)`,
        })
        .from(analyses)
        .where(dateFilter)
        .groupBy(analyses.city, analyses.province)
        .orderBy(desc(count(analyses.id)))
        .limit(25);

      const topCities = results.map((row, index) => ({
        rank: index + 1,
        city: row.city,
        province: row.province,
        dealCount: Number(row.dealCount),
        avgCashOnCash: row.avgCashOnCash != null ? Math.round(Number(row.avgCashOnCash) * 100) / 100 : null,
        avgCapRate: row.avgCapRate != null ? Math.round(Number(row.avgCapRate) * 100) / 100 : null,
        avgDscr: row.avgDscr != null ? Math.round(Number(row.avgDscr) * 100) / 100 : null,
        avgPurchasePrice: row.avgPurchasePrice != null ? Math.round(Number(row.avgPurchasePrice)) : null,
      }));

      res.json(topCities);
    } catch (error) {
      console.error("Error fetching top cities:", error);
      res.status(500).json({ error: "Failed to fetch top cities" });
    }
  });

  // ============================================
  // PARTNER JOIN / MATCHING ROUTES
  // ============================================

  app.post("/api/join/realtor", async (req, res) => {
    try {
      const { realtorApplications } = await import("@shared/schema");
      const { insertRealtorApplicationSchema } = await import("@shared/schema");
      const parsed = insertRealtorApplicationSchema.parse(req.body);
      const [application] = await db.insert(realtorApplications).values(parsed).returning();

      try {
        const webhookUrl = process.env.GHL_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...parsed,
              formTag: "realtor_application",
              source: "realist.ca",
            }),
          }).catch(() => {});
        }
      } catch {}

      try {
        const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
        if (sheetsUrl) {
          fetch(sheetsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "realtor_application",
              ...parsed,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      } catch {}

      res.json({ success: true, id: application.id });
    } catch (error: any) {
      console.error("Error creating realtor application:", error);
      res.status(400).json({ error: error.message || "Failed to submit application" });
    }
  });

  app.post("/api/join/lender", async (req, res) => {
    try {
      const { lenderApplications } = await import("@shared/schema");
      const { insertLenderApplicationSchema } = await import("@shared/schema");
      const parsed = insertLenderApplicationSchema.parse(req.body);
      const [application] = await db.insert(lenderApplications).values(parsed).returning();

      try {
        const webhookUrl = process.env.GHL_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...parsed,
              formTag: "lender_application",
              source: "realist.ca",
            }),
          }).catch(() => {});
        }
      } catch {}

      try {
        const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
        if (sheetsUrl) {
          fetch(sheetsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "lender_application",
              ...parsed,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      } catch {}

      res.json({ success: true, id: application.id });
    } catch (error: any) {
      console.error("Error creating lender application:", error);
      res.status(400).json({ error: error.message || "Failed to submit application" });
    }
  });

  app.post("/api/deal-match", async (req, res) => {
    try {
      const { dealMatchRequests } = await import("@shared/schema");
      const { insertDealMatchRequestSchema } = await import("@shared/schema");
      const parsed = insertDealMatchRequestSchema.parse({
        ...req.body,
        userId: req.session?.userId || null,
      });
      const [match] = await db.insert(dealMatchRequests).values(parsed).returning();

      try {
        const webhookUrl = process.env.GHL_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...parsed,
              formTag: "deal_match_request",
              source: "realist.ca",
            }),
          }).catch(() => {});
        }
      } catch {}

      res.json({ success: true, id: match.id });
    } catch (error: any) {
      console.error("Error creating deal match request:", error);
      res.status(400).json({ error: error.message || "Failed to submit match request" });
    }
  });

  // ============================================
  // MARKET REPORT ROUTES
  // ============================================

  const MAJOR_CANADIAN_CITIES = [
    { city: "Toronto", province: "ON" },
    { city: "Vancouver", province: "BC" },
    { city: "Calgary", province: "AB" },
    { city: "Edmonton", province: "AB" },
    { city: "Ottawa", province: "ON" },
    { city: "Montreal", province: "QC" },
    { city: "Winnipeg", province: "MB" },
    { city: "Hamilton", province: "ON" },
    { city: "Kitchener", province: "ON" },
    { city: "London", province: "ON" },
    { city: "Halifax", province: "NS" },
    { city: "Victoria", province: "BC" },
    { city: "Oshawa", province: "ON" },
    { city: "Windsor", province: "ON" },
    { city: "Saskatoon", province: "SK" },
    { city: "Regina", province: "SK" },
    { city: "St. Catharines", province: "ON" },
    { city: "Barrie", province: "ON" },
    { city: "Kelowna", province: "BC" },
    { city: "Guelph", province: "ON" },
    { city: "Moncton", province: "NB" },
    { city: "Brantford", province: "ON" },
    { city: "Fredericton", province: "NB" },
    { city: "Saint John", province: "NB" },
    { city: "Sudbury", province: "ON" },
    { city: "Kingston", province: "ON" },
    { city: "Waterloo", province: "ON" },
    { city: "Cambridge", province: "ON" },
    { city: "Mississauga", province: "ON" },
    { city: "Brampton", province: "ON" },
  ];

  app.post("/api/market-report/compute-snapshot", isAdmin, async (_req, res) => {
    try {
      const result = await computeMonthlySnapshot();
      res.json({ success: true, month: result.month, snapshotCount: result.count });
    } catch (error) {
      console.error("Error computing market snapshot:", error);
      res.status(500).json({ error: "Failed to compute market snapshot" });
    }
  });

  app.get("/api/market-report/latest", async (_req, res) => {
    try {
      const snapshots = await storage.getLatestMarketSnapshots();
      const months = await storage.getMarketSnapshotMonths();
      res.json({ snapshots, months, reportMonth: months[0] || null });
    } catch (error) {
      console.error("Error fetching market report:", error);
      res.status(500).json({ error: "Failed to fetch market report" });
    }
  });

  app.get("/api/market-report/history", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const province = req.query.province as string | undefined;
      const snapshots = await storage.getMarketSnapshots(city, province);
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching market history:", error);
      res.status(500).json({ error: "Failed to fetch market history" });
    }
  });

  app.get("/api/market-report/all", async (_req, res) => {
    try {
      const snapshots = await storage.getMarketSnapshots();
      const months = await storage.getMarketSnapshotMonths();
      res.json({ snapshots, months });
    } catch (error) {
      console.error("Error fetching all market data:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  app.get("/api/yield-history", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const province = req.query.province as string | undefined;
      const data = await storage.getCityYieldHistory(city, province);
      const months = await storage.getAllCityYieldHistoryMonths();
      res.json({ data, months });
    } catch (error) {
      console.error("Error fetching yield history:", error);
      res.status(500).json({ error: "Failed to fetch yield history" });
    }
  });

  app.post("/api/yield-history/compare", async (req, res) => {
    try {
      const { cities } = req.body;
      if (!Array.isArray(cities) || cities.length === 0 || cities.length > 10) {
        return res.status(400).json({ error: "cities array required (1-10 items)" });
      }
      const validCities = cities
        .filter((c: any) => typeof c?.city === "string" && typeof c?.province === "string" && c.city.length > 0 && c.province.length > 0)
        .map((c: any) => ({ city: String(c.city).trim(), province: String(c.province).trim() }));
      if (validCities.length === 0) {
        return res.status(400).json({ error: "No valid city entries" });
      }
      const data = await storage.getMultiCityYieldHistory(validCities);
      res.json(data);
    } catch (error) {
      console.error("Error fetching yield comparison:", error);
      res.status(500).json({ error: "Failed to fetch yield comparison" });
    }
  });

  app.post("/api/ddf-crawl/trigger", isAdmin, async (_req, res) => {
    try {
      const { runDdfYieldCrawl } = await import("./ddfYieldCrawler");
      res.json({ status: "started", message: "DDF yield crawl initiated in background" });
      runDdfYieldCrawl().then(result => {
        console.log("[ddf-crawler] Manual trigger complete:", result);
      }).catch(err => {
        console.error("[ddf-crawler] Manual trigger failed:", err);
      });
    } catch (error) {
      console.error("Error triggering DDF crawl:", error);
      res.status(500).json({ error: "Failed to trigger crawl" });
    }
  });

  app.get("/api/ddf-crawl/status", isAdmin, async (_req, res) => {
    try {
      const months = await storage.getAllCityYieldHistoryMonths();
      const latestMonth = months[0];
      let cityCounts: any[] = [];
      if (latestMonth) {
        const data = await storage.getCityYieldHistory(undefined, undefined);
        cityCounts = data
          .filter(d => d.month === latestMonth)
          .map(d => ({
            city: d.city,
            province: d.province,
            listings: d.listingCount,
            avgGrossYield: d.avgGrossYield,
          }));
      }
      res.json({ months, latestMonth, cities: cityCounts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crawl status" });
    }
  });

  async function computeMonthlySnapshot(targetMonth?: string) {
    const { CMHC_CITY_RENTS } = await import("@shared/cmhcRents");
    const now = new Date();
    const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [year, m] = month.split("-").map(Number);
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd = new Date(year, m, 1);

    const monthResults = await db
      .select({
        city: analyses.city,
        province: analyses.province,
        dealCount: count(analyses.id),
        avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
        avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
        avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
        avgPurchasePrice: sql<number>`AVG((${analyses.inputsJson}->>'purchasePrice')::numeric)`,
        avgVacancyRate: sql<number>`AVG(${analyses.vacancyRate})`,
        avgRentPerUnit: sql<number>`AVG((${analyses.resultsJson}->>'effectiveMonthlyIncome')::numeric)`,
      })
      .from(analyses)
      .where(sql`${analyses.city} IS NOT NULL AND ${analyses.city} != '' AND ${analyses.resultsJson} IS NOT NULL AND ${analyses.createdAt} >= ${monthStart} AND ${analyses.createdAt} < ${monthEnd}`)
      .groupBy(analyses.city, analyses.province);

    const allTimeResults = await db
      .select({
        city: analyses.city,
        province: analyses.province,
        dealCount: count(analyses.id),
        avgCapRate: sql<number>`AVG((${analyses.resultsJson}->>'capRate')::numeric)`,
        avgCashOnCash: sql<number>`AVG((${analyses.resultsJson}->>'cashOnCash')::numeric)`,
        avgDscr: sql<number>`AVG((${analyses.resultsJson}->>'dscr')::numeric)`,
        avgPurchasePrice: sql<number>`AVG((${analyses.inputsJson}->>'purchasePrice')::numeric)`,
        avgVacancyRate: sql<number>`AVG(${analyses.vacancyRate})`,
        avgRentPerUnit: sql<number>`AVG((${analyses.resultsJson}->>'effectiveMonthlyIncome')::numeric)`,
      })
      .from(analyses)
      .where(sql`${analyses.city} IS NOT NULL AND ${analyses.city} != '' AND ${analyses.resultsJson} IS NOT NULL`)
      .groupBy(analyses.city, analyses.province);

    const monthMap = new Map(monthResults.map(r => [`${r.city?.toLowerCase()}-${r.province?.toLowerCase()}`, r]));
    const allTimeMap = new Map(allTimeResults.map(r => [`${r.city?.toLowerCase()}-${r.province?.toLowerCase()}`, r]));

    let count_saved = 0;
    for (const { city, province } of MAJOR_CANADIAN_CITIES) {
      const key = `${city.toLowerCase()}-${province.toLowerCase()}`;
      const current = monthMap.get(key);
      const allTime = allTimeMap.get(key);
      const data = current || allTime;
      const cmhcRents = CMHC_CITY_RENTS[city];

      await storage.upsertMarketSnapshot({
        city,
        province,
        month,
        dealCount: data ? Number(data.dealCount) : 0,
        avgCapRate: data?.avgCapRate != null ? Math.round(Number(data.avgCapRate) * 100) / 100 : null,
        avgCashOnCash: data?.avgCashOnCash != null ? Math.round(Number(data.avgCashOnCash) * 100) / 100 : null,
        avgDscr: data?.avgDscr != null ? Math.round(Number(data.avgDscr) * 100) / 100 : null,
        avgPurchasePrice: data?.avgPurchasePrice != null ? Math.round(Number(data.avgPurchasePrice)) : null,
        avgRentPerUnit: data?.avgRentPerUnit != null ? Math.round(Number(data.avgRentPerUnit)) : null,
        medianCapRate: null,
        medianPurchasePrice: null,
        avgVacancyRate: data?.avgVacancyRate != null ? Math.round(Number(data.avgVacancyRate) * 100) / 100 : null,
        cmhcOneBed: cmhcRents?.oneBed ?? null,
        cmhcTwoBed: cmhcRents?.twoBed ?? null,
      });
      count_saved++;
    }
    return { month, count: count_saved };
  }

  // Run on server start if current month not yet snapshotted
  (async () => {
    try {
      const months = await storage.getMarketSnapshotMonths();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (!months.includes(currentMonth)) {
        console.log("[market-report] Computing initial snapshot for", currentMonth);
        await computeMonthlySnapshot(currentMonth);
        console.log("[market-report] Initial snapshot computed for", currentMonth);
      } else {
        console.log("[market-report] Snapshot already exists for", currentMonth);
      }
    } catch (error) {
      console.error("[market-report] Failed to compute initial snapshot:", error);
    }
  })();

  // Cron: check every hour, auto-compute snapshots + DDF yield crawl on the 1st of each month
  setInterval(async () => {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const months = await storage.getMarketSnapshotMonths();
      if (!months.includes(currentMonth)) {
        console.log("[market-report] Monthly cron: computing snapshot for", currentMonth);
        await computeMonthlySnapshot(currentMonth);
        console.log("[market-report] Monthly cron: snapshot complete for", currentMonth);
      }

      const yieldMonths = await storage.getAllCityYieldHistoryMonths();
      if (!yieldMonths.includes(currentMonth)) {
        console.log("[ddf-crawler] Monthly cron: starting yield crawl for", currentMonth);
        const { runDdfYieldCrawl } = await import("./ddfYieldCrawler");
        runDdfYieldCrawl(currentMonth).then(result => {
          console.log("[ddf-crawler] Monthly cron complete:", result);
        }).catch(err => {
          console.error("[ddf-crawler] Monthly cron failed:", err);
        });
      }
    } catch (error) {
      console.error("[market-report] Monthly cron failed:", error);
    }
  }, 60 * 60 * 1000);

  // Daily city report cron: check every hour, publish one city report per day
  let lastCityReportDate = "";
  setInterval(async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      if (todayStr === lastCityReportDate) return;

      const hour = now.getHours();
      if (hour < 8) return;

      console.log("[city-report] Daily cron: checking for today's report...");
      const { runDailyCityReport } = await import("./cityReportGenerator");
      const result = await runDailyCityReport();
      console.log(`[city-report] Daily cron result: ${result.action} — ${result.details}`);
      lastCityReportDate = todayStr;
    } catch (error) {
      console.error("[city-report] Daily cron failed:", error);
    }
  }, 60 * 60 * 1000);

  // Startup: generate today's city report if not yet published
  (async () => {
    try {
      const now = new Date();
      if (now.getHours() >= 8) {
        const { runDailyCityReport } = await import("./cityReportGenerator");
        const result = await runDailyCityReport();
        console.log(`[city-report] Startup check: ${result.action} — ${result.details}`);
      }
    } catch (error) {
      console.error("[city-report] Startup check failed:", error);
    }
  })();

  // Monthly distress report: check every 6 hours on 2nd-5th of month, generate snapshot + blog report
  let distressReportMonth = "";
  const runDistressReportIfNeeded = async () => {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (distressReportMonth === currentMonth) return;

      const existing = await db.select().from(distressSnapshots)
        .where(and(eq(distressSnapshots.month, currentMonth), sql`city IS NULL`))
        .limit(1);
      if (existing.length > 0) {
        distressReportMonth = currentMonth;
        return;
      }

      const dayOfMonth = now.getDate();
      if (dayOfMonth < 2) return;

      console.log("[distress-report] Monthly cron: starting distress report...");
      const { runMonthlyDistressReport } = await import("./distressReportGenerator");
      const result = await runMonthlyDistressReport();
      console.log(`[distress-report] Monthly cron result: ${result.action} — ${result.details}`);
      if (result.action === "published" || result.action === "exists") {
        distressReportMonth = currentMonth;
      }
    } catch (error) {
      console.error("[distress-report] Monthly cron failed:", error);
    }
  };
  setInterval(runDistressReportIfNeeded, 6 * 60 * 60 * 1000);
  runDistressReportIfNeeded();

  // Weekly mortgage rate scrape: check every 6 hours, run if >7 days since last update
  (async () => {
    try {
      const { runRateScrape, getAllCurrentRates } = await import("./rateScraper");
      const existing = await getAllCurrentRates();
      if (existing.length === 0) {
        console.log("[rate-scraper] No rates in DB, running initial scrape...");
        const result = await runRateScrape();
        console.log(`[rate-scraper] Initial scrape: ${result.updated} rates from ${result.sources.join(", ")}`);
      } else {
        const oldest = existing.reduce((min, r) => {
          const t = new Date(r.lastUpdated).getTime();
          return t < min ? t : min;
        }, Date.now());
        const daysSinceUpdate = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 7) {
          console.log("[rate-scraper] Rates older than 7 days, refreshing...");
          const result = await runRateScrape();
          console.log(`[rate-scraper] Refresh: ${result.updated} rates updated`);
        } else {
          console.log(`[rate-scraper] Rates are ${daysSinceUpdate.toFixed(1)} days old, skipping`);
        }
      }
    } catch (error) {
      console.error("[rate-scraper] Startup check failed:", error);
    }
  })();

  setInterval(async () => {
    try {
      const { getAllCurrentRates, runRateScrape } = await import("./rateScraper");
      const rates = await getAllCurrentRates();
      if (rates.length === 0) return;
      const oldest = rates.reduce((min, r) => {
        const t = new Date(r.lastUpdated).getTime();
        return t < min ? t : min;
      }, Date.now());
      const daysSinceUpdate = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) {
        console.log("[rate-scraper] Weekly cron: refreshing rates...");
        const result = await runRateScrape();
        console.log(`[rate-scraper] Weekly cron: ${result.updated} rates updated`);
      }
    } catch (error) {
      console.error("[rate-scraper] Weekly cron failed:", error);
    }
  }, 6 * 60 * 60 * 1000);

  // ============================================
  // COMMUNITY UNDERWRITING ROUTES
  // ============================================

  app.post("/api/community/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const parsed = insertUnderwritingNoteSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });

      const todayCount = await storage.getUserNotesCountForListingToday(userId, parsed.data.listingMlsNumber);
      if (todayCount >= 3) return res.status(429).json({ error: "Rate limit: max 3 notes per listing per day" });

      const note = await storage.createUnderwritingNote(parsed.data);

      await storage.createContributionEvent({
        userId,
        type: "note",
        points: 5,
        targetType: "underwriting_note",
        targetId: note.id,
      });

      await recomputeListingAggregate(parsed.data.listingMlsNumber);

      res.json(note);
    } catch (error) {
      console.error("Error creating underwriting note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.get("/api/community/notes/:mlsNumber", async (req, res) => {
    try {
      const notes = await storage.getUnderwritingNotesByListing(req.params.mlsNumber);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/community/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const parsed = insertListingCommentSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });

      const comment = await storage.createListingComment(parsed.data);

      await storage.createContributionEvent({
        userId,
        type: "comment",
        points: 1,
        targetType: "listing_comment",
        targetId: comment.id,
      });

      await recomputeListingAggregate(parsed.data.listingMlsNumber);

      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.get("/api/community/comments/:mlsNumber", async (req, res) => {
    try {
      const comments = await storage.getListingCommentsByListing(req.params.mlsNumber);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/community/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const parsed = insertVoteSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });

      const existingVote = await storage.getVote(userId, parsed.data.targetType, parsed.data.targetId);
      const oldValue = existingVote?.value || 0;
      const newValue = parsed.data.value;

      const vote = await storage.upsertVote(parsed.data);

      const delta = newValue - oldValue;
      if (delta !== 0) {
        let targetAuthorId: string | null = null;

        if (parsed.data.targetType === "underwriting_note") {
          await storage.updateUnderwritingNoteScore(parsed.data.targetId, delta);
          const allNotes = await db.select({ userId: underwritingNotes.userId }).from(underwritingNotes).where(eq(underwritingNotes.id, parsed.data.targetId));
          targetAuthorId = allNotes[0]?.userId || null;
        } else if (parsed.data.targetType === "listing_comment") {
          await storage.updateListingCommentScore(parsed.data.targetId, delta);
          const allComments = await db.select({ userId: listingComments.userId }).from(listingComments).where(eq(listingComments.id, parsed.data.targetId));
          targetAuthorId = allComments[0]?.userId || null;
        }

        if (targetAuthorId && targetAuthorId !== userId) {
          if (newValue === 1 && oldValue !== 1) {
            await storage.createContributionEvent({
              userId: targetAuthorId,
              type: "upvote_received",
              points: 2,
              targetType: parsed.data.targetType,
              targetId: parsed.data.targetId,
            });
          } else if (newValue === -1 && oldValue !== -1) {
            await storage.createContributionEvent({
              userId: targetAuthorId,
              type: "downvote_received",
              points: -1,
              targetType: parsed.data.targetType,
              targetId: parsed.data.targetId,
            });
          }
        }
      }

      res.json(vote);
    } catch (error) {
      console.error("Error voting:", error);
      res.status(500).json({ error: "Failed to vote" });
    }
  });

  app.get("/api/community/aggregate/:mlsNumber", async (req, res) => {
    try {
      const aggregate = await storage.getListingAggregate(req.params.mlsNumber);
      res.json(aggregate || null);
    } catch (error) {
      console.error("Error fetching aggregate:", error);
      res.status(500).json({ error: "Failed to fetch aggregate" });
    }
  });

  app.post("/api/community/aggregates", async (req, res) => {
    try {
      const { mlsNumbers } = req.body;
      if (!Array.isArray(mlsNumbers) || mlsNumbers.length === 0) {
        return res.json([]);
      }
      const aggregates = await storage.getListingAggregatesBatch(mlsNumbers.slice(0, 100));
      res.json(aggregates);
    } catch (error) {
      console.error("Error fetching aggregates:", error);
      res.status(500).json({ error: "Failed to fetch aggregates" });
    }
  });

  app.get("/api/leaderboard/contributions", async (req, res) => {
    try {
      const period = (req.query.period as string) === 'monthly' ? 'monthly' : 'all-time';
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const leaderboard = await storage.getContributionLeaderboard(period, limit);
      res.json(leaderboard.map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Anonymous",
        totalPoints: Number(row.totalPoints),
        role: row.role || "investor",
        profileImageUrl: row.profileImageUrl || null,
      })));
    } catch (error) {
      console.error("Error fetching contribution leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  async function recomputeListingAggregate(mlsNumber: string) {
    try {
      const notes = await storage.getUnderwritingNotesByListing(mlsNumber);
      const comments = await storage.getListingCommentsByListing(mlsNumber);

      let communityCapRate: number | null = null;
      let rentsUsedJson: any = null;

      if (notes.length > 0) {
        const bestNote = notes[0];
        if (bestNote.rentsJson && bestNote.expenseRatio !== null && bestNote.vacancy !== null) {
          const rents = bestNote.rentsJson as number[];
          const totalRent = Array.isArray(rents) ? rents.reduce((a: number, b: number) => a + b, 0) : 0;
          rentsUsedJson = bestNote.rentsJson;
          communityCapRate = null;
        }
      }

      await storage.upsertListingAggregate({
        listingMlsNumber: mlsNumber,
        communityCapRate,
        rentsUsedJson,
        analysisCount: notes.length,
        commentCount: comments.length,
        lastAnalysisAt: notes.length > 0 ? notes[0].createdAt : null,
      });
    } catch (error) {
      console.error("Error recomputing listing aggregate:", error);
    }
  }

  // ─── Distress Deals Browser ─────────────────────
  const SEARCH_TERMS_BY_CATEGORY: Record<string, string[]> = {
    foreclosure_pos: [
      "power of sale",
      "foreclosure",
      "bank owned",
      "court ordered sale",
      "judicial sale",
      "mortgagee sale",
      "receivership",
      "reprise de finance",
      "estate sale",
    ],
    motivated: [
      "motivated",
      "priced to sell",
      "must sell",
      "price reduced",
      "immediate possession",
      "fixer upper",
      "handyman special",
      "bring an offer",
    ],
    vtb: [
      "vendor take back",
      "vtb",
      "seller financing",
      "owner financing",
      "vendor financing",
      "financement vendeur",
    ],
    commercial: [
      "commercial property",
      "commercial building",
      "retail space",
      "office space",
      "warehouse",
      "mixed use",
      "strip mall",
      "storefront",
      "triple net",
      "zoned commercial",
      "business for sale",
      "investment property",
    ],
  };

  app.post("/api/multiplex-fit", async (req, res) => {
    try {
      const { name, email, phone, consent, assessmentData, fitScore, fitTier, recommendation } = req.body;

      if (!name || !email || !phone) {
        res.status(400).json({ error: "Name, email, and phone are required" });
        return;
      }

      const lead = await storage.createLead({
        name,
        email,
        phone,
        consent: consent || false,
        leadSource: "Multiplex Investor Fit Assessment",
      });

      const formatPhoneE164 = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) return '+' + cleaned;
        if (cleaned.length === 10) return '+1' + cleaned;
        return '+' + cleaned;
      };

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const tags = ["multiplexmasterclass", `fit_${fitTier}`, `rec_${recommendation}`];
      if (assessmentData?.province) tags.push(`LEAD_${assessmentData.province}`);
      if (assessmentData?.goal) tags.push(`goal_${assessmentData.goal.replace(/\s+/g, "_").toLowerCase()}`);
      if (assessmentData?.capital) tags.push(`capital_${assessmentData.capital.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`);

      sendWebhook(lead.id, {
        email,
        firstName,
        lastName,
        fullName: name,
        phone: formatPhoneE164(phone),
        consent: consent || false,
        leadSource: "Multiplex Investor Fit Assessment",
        formTag: "multiplexmasterclass",
        tags,
        fitScore,
        fitTier,
        recommendation,
        province: assessmentData?.province || "",
        city: assessmentData?.city || "",
        investingLocally: assessmentData?.investingLocally || "",
        goal: assessmentData?.goal || "",
        capital: assessmentData?.capital || "",
        experience: assessmentData?.experience || "",
        contractorComfort: assessmentData?.contractorComfort || "",
        delayTolerance: assessmentData?.delayTolerance || "",
        geographicFlexibility: assessmentData?.geographicFlexibility || "",
        helpPreference: assessmentData?.helpPreference || "",
        createdAt: lead.createdAt,
      }).catch(err => console.error("Multiplex fit webhook error:", err));

      sendToGoogleSheets({
        name,
        email,
        phone,
        source: "Multiplex Investor Fit Assessment",
        notes: `Score: ${fitScore}, Tier: ${fitTier}, Rec: ${recommendation}, Province: ${assessmentData?.province}, City: ${assessmentData?.city}, Goal: ${assessmentData?.goal}, Capital: ${assessmentData?.capital}`,
      }).catch(err => console.error("Google Sheets error:", err));

      autoEnrollLeadAsUser({
        email,
        firstName,
        lastName: lastName || undefined,
        phone,
        leadSource: "Multiplex Investor Fit Assessment",
      }).catch(err => console.error("Auto-enroll error:", err));

      res.json({ success: true, leadId: lead.id });
    } catch (error: any) {
      console.error("Multiplex fit submission error:", error);
      res.status(500).json({ error: "Submission failed" });
    }
  });

  app.get("/api/distress-deals", async (req, res) => {
    req.setTimeout(300000);
    res.setTimeout(300000);
    try {
      const { scoreDistress } = await import("@shared/distressScoring");
      const { searchDdfByRemarks, normalizeDdfToRepliersFormat, isDdfConfigured } = await import("./creaDdf");

      if (!isDdfConfigured()) {
        res.status(503).json({ error: "DDF not configured" });
        return;
      }

      const categories = (req.query.categories as string || "").split(",").filter(Boolean);
      const excludeKeywords = (req.query.excludeKeywords as string || "").split(",").filter(Boolean);
      const minScore = req.query.minScore ? Number(req.query.minScore) : 1;

      const allCategoryKeys = Object.keys(SEARCH_TERMS_BY_CATEGORY);

      const cacheKey = `distress-v5:all`;

      function applyFilters(listings: any[]) {
        let filtered = listings.filter((l: any) => (l.distress?.distressScore || 0) >= minScore);
        if (categories.length > 0) {
          filtered = filtered.filter((l: any) =>
            categories.some((cat: string) => l.distress?.categoriesTriggered?.[cat])
          );
        }
        if (excludeKeywords.length > 0) {
          const lowerExclude = excludeKeywords.map((k: string) => k.toLowerCase().trim());
          filtered = filtered.filter((l: any) => {
            const remark = (l.rawRemarks || "").toLowerCase();
            return !lowerExclude.some((kw: string) => remark.includes(kw));
          });
        }
        return filtered;
      }

      const [cachedRow] = await db.select().from(dataCache)
        .where(and(eq(dataCache.key, cacheKey), sql`fetched_at > NOW() - INTERVAL '24 hours'`));
      if (cachedRow) {
        const cachedData = cachedRow.valueJson as any;
        const filteredListings = applyFilters(cachedData.listings as any[]);
        res.json({
          listings: filteredListings,
          totalCount: filteredListings.length,
          totalDdfScanned: cachedData.totalDdfScanned || 0,
        });
        return;
      }

      const [staleRow] = await db.select().from(dataCache)
        .where(eq(dataCache.key, cacheKey));
      if (staleRow) {
        const staleData = staleRow.valueJson as any;
        const filteredListings = applyFilters(staleData.listings as any[]);
        console.log(`[distress-deals] Serving stale cache (${filteredListings.length} listings) while pre-warm refreshes`);
        res.json({
          listings: filteredListings,
          totalCount: filteredListings.length,
          totalDdfScanned: staleData.totalDdfScanned || 0,
          stale: true,
        });
        return;
      }

      res.json({
        listings: [],
        totalCount: 0,
        totalDdfScanned: 0,
        warming: true,
        message: "Data is being loaded for the first time. Please refresh in a few minutes.",
      });
      return;

      /* Legacy live-fetch code removed — all data comes from pre-warm cache */
      const searchTerms: string[] = [];
      for (const cat of allCategoryKeys) {
        searchTerms.push(...(SEARCH_TERMS_BY_CATEGORY[cat] || []));
      }
      const uniqueTerms = [...new Set(searchTerms)];

      const allListings = new Map<string, any>();
      let totalDdfScanned = 0;

      const CONCURRENCY = 2;
      const TERM_TIMEOUT = 60000;
      for (let c = 0; c < uniqueTerms.length; c += CONCURRENCY) {
        const termChunk = uniqueTerms.slice(c, c + CONCURRENCY);
        const results = await Promise.allSettled(
          termChunk.map(term => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TERM_TIMEOUT);
            return searchDdfByRemarks({
              searchTerms: [term],
              top: 200,
              signal: controller.signal,
            }).finally(() => clearTimeout(timer));
          })
        );
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === "fulfilled") {
            totalDdfScanned += r.value.count;
            for (const raw of r.value.listings) {
              const key = raw.ListingKey || raw.ListingId || "";
              if (key && !allListings.has(key)) {
                allListings.set(key, raw);
              }
            }
            console.log(`[distress-deals] "${termChunk[i]}": ${r.value.count} matches, ${r.value.listings.length} fetched`);
          } else {
            console.error(`[distress-deals] "${termChunk[i]}" error:`, (r.reason as any)?.message || r.reason);
          }
        }
      }
      console.log(`[distress-deals] Total: ${allListings.size} unique listings from ${uniqueTerms.length} searches`);

      let allScored = Array.from(allListings.values()).map(raw => {
        const normalized = normalizeDdfToRepliersFormat(raw);
        const remarks = raw.PublicRemarks || "";
        const listingProvince = raw.StateOrProvince || "";
        const distress = scoreDistress(remarks, listingProvince);
        return { ...normalized, distress, rawRemarks: remarks };
      });

      allScored.sort((a, b) => b.distress.distressScore - a.distress.distressScore);

      const cacheData = {
        listings: allScored,
        totalDdfScanned,
      };

      await db.insert(dataCache).values({
        key: cacheKey,
        valueJson: cacheData,
        source: "distress-deals",
      }).onConflictDoUpdate({
        target: dataCache.key,
        set: { valueJson: cacheData, fetchedAt: new Date(), source: "distress-deals" },
      });

      const filtered = applyFilters(allScored);
      res.json({
        listings: filtered,
        totalCount: filtered.length,
        totalDdfScanned,
      });
    } catch (error: any) {
      console.error("[distress-deals] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch distress deals" });
    }
  });

  // ─── Distress Deals Pre-Warm ─────────────────────
  async function prewarmDistressDeals() {
    const { isDdfConfigured } = await import("./creaDdf");
    if (!isDdfConfigured()) {
      console.log("[distress-prewarm] DDF not configured, skipping");
      return;
    }
    const cacheKey = `distress-v5:all`;
    const [existing] = await db.select().from(dataCache)
      .where(and(eq(dataCache.key, cacheKey), sql`fetched_at > NOW() - INTERVAL '12 hours'`));
    if (existing) {
      console.log("[distress-prewarm] Cache fresh, skipping");
      return;
    }
    console.log("[distress-prewarm] Warming all distress deals...");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 600000);
      const resp = await fetch("http://localhost:5000/api/distress-deals?limit=9999", { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        console.error(`[distress-prewarm] Failed: HTTP ${resp.status}`);
        return;
      }
      const data = await resp.json();
      console.log(`[distress-prewarm] Warmed ${data.totalCount} listings`);
    } catch (err: any) {
      console.error(`[distress-prewarm] Failed:`, err.message);
    }
  }

  setTimeout(() => prewarmDistressDeals(), 15000);
  setInterval(() => prewarmDistressDeals(), 12 * 60 * 60 * 1000);

  // ─── Distress Report API ─────────────────────
  app.get("/api/distress-snapshots", async (req, res) => {
    try {
      const month = req.query.month as string | undefined;
      const province = req.query.province as string | undefined;

      let query = db.select().from(distressSnapshots);
      const conditions = [];
      if (month) conditions.push(eq(distressSnapshots.month, month));
      if (province) conditions.push(eq(distressSnapshots.province, province));

      const rows = conditions.length
        ? await query.where(and(...conditions)).orderBy(desc(distressSnapshots.month))
        : await query.orderBy(desc(distressSnapshots.month));

      res.json(rows);
    } catch (error: any) {
      console.error("[distress-snapshots] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch distress snapshots" });
    }
  });

  app.get("/api/distress-snapshots/months", async (_req, res) => {
    try {
      const rows = await db.selectDistinct({ month: distressSnapshots.month })
        .from(distressSnapshots)
        .orderBy(desc(distressSnapshots.month));
      res.json(rows.map(r => r.month));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch months" });
    }
  });

  app.post("/api/admin/distress-report/generate", isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const month = (req.body.month as string) || defaultMonth;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
        return;
      }
      const { captureDistressSnapshots, generateDistressReport } = await import("./distressReportGenerator");
      console.log(`[distress-report] Admin triggered for ${month}`);
      const snapResult = await captureDistressSnapshots(month);
      const reportResult = await generateDistressReport(month);
      res.json({ ...reportResult, snapshots: snapResult });
    } catch (error: any) {
      console.error("[distress-report] Admin trigger failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Indigenous Land Claim Screener ─────────────────────
  const { screenLocation, getFeatureGeoJSON } = await import("./landClaimScreener");
  const { importAllLayers, checkAndImportIfEmpty } = await import("./indigenousDataImporter");

  checkAndImportIfEmpty().catch(err => console.error("[indigenous-import] Startup check failed:", err.message));

  const { checkAndSeedWatchOverlays, seedWatchOverlays } = await import("./watchOverlaySeeder");
  checkAndSeedWatchOverlays().catch(err => console.error("[watch-overlays] Startup seed failed:", err.message));

  app.post("/api/land-claim-screener/register", async (req: any, res) => {
    try {
      const registerSchema = z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().max(100).optional(),
        email: z.string().email().max(200),
        phone: z.string().min(1).max(30),
        address: z.string().min(1).max(500),
      });
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { firstName, lastName, email, phone, address } = parsed.data;
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;

      const formatPhoneE164 = (phoneNumber: string): string => {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('1') && cleaned.length === 11) return '+' + cleaned;
        if (cleaned.length === 10) return '+1' + cleaned;
        return '+' + cleaned;
      };

      const lead = await storage.createLead({
        name: fullName,
        email,
        phone,
        consent: true,
        leadSource: "Land Claim Screener",
      });

      sendWebhook(lead.id, {
        email,
        firstName,
        lastName: lastName || "",
        fullName,
        phone: formatPhoneE164(phone),
        companyName: address,
        leadSource: "Land Claim Screener",
        formTag: "land_claim_screener",
        tags: ["land_claim_screener"],
        notes: `Address to screen: ${address}`,
        createdAt: lead.createdAt,
      }).catch(err => console.error("Webhook error:", err));

      sendToGoogleSheets({
        name: fullName,
        email,
        phone,
        source: "Land Claim Screener",
        notes: `Address to screen: ${address}`,
      }).catch(err => console.error("Google Sheets error:", err));

      autoEnrollLeadAsUser({
        email,
        firstName,
        lastName: lastName || undefined,
      }).catch(err => console.error("Auto-enroll error:", err));

      res.json({ success: true, leadId: lead.id });
    } catch (error: any) {
      console.error("Screener registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/land-claim-screener/screen", async (req: any, res) => {
    try {
      const screenSchema = z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        bufferMeters: z.number().min(0).max(5000).default(0),
        address: z.string().max(500).optional(),
      });
      const parsed = screenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { lat, lng, bufferMeters, address } = parsed.data;

      const result = await screenLocation(lat, lng, bufferMeters);

      const userId = req.session?.userId || null;
      const screening = await storage.createScreening({
        userId,
        searchedAddress: address || null,
        lat,
        lng,
        screeningMethod: "point_plus_buffer",
        bufferMeters,
        resultStatus: result.status,
        completenessStatus: result.completeness,
        summaryJson: JSON.stringify({ summary: result.summary, hitsCount: result.hitsCount }),
      });

      for (const hit of result.hits) {
        await storage.createScreeningHit({
          screeningId: screening.id,
          featureId: hit.featureId,
          hitType: hit.hitType,
          distanceMeters: hit.distanceMeters,
          notes: `${hit.layerName}: ${hit.featureName}`,
        });
      }

      res.json({ ...result, screeningId: screening.id });
    } catch (error: any) {
      console.error("Error running screening:", error);
      res.status(500).json({ error: "Screening failed" });
    }
  });

  app.get("/api/land-claim-screener/features", async (_req, res) => {
    try {
      const geojson = await getFeatureGeoJSON();
      res.json(geojson);
    } catch (error: any) {
      console.error("Error fetching features:", error);
      res.status(500).json({ error: "Failed to load features" });
    }
  });

  app.get("/api/land-claim-screener/layers", async (_req, res) => {
    try {
      const layers = await storage.getIndigenousLayers();
      res.json(layers.filter(l => l.active));
    } catch (error: any) {
      console.error("Error fetching layers:", error);
      res.status(500).json({ error: "Failed to load layers" });
    }
  });

  app.get("/api/land-claim-screener/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const screeningsResult = await storage.getScreeningsByUser(userId);
      res.json(screeningsResult);
    } catch (error: any) {
      console.error("Error fetching screening history:", error);
      res.status(500).json({ error: "Failed to load history" });
    }
  });

  app.post("/api/admin/indigenous/import", isAdmin, async (_req, res) => {
    try {
      const result = await importAllLayers();
      res.json(result);
    } catch (error: any) {
      console.error("Error importing indigenous data:", error);
      res.status(500).json({ error: "Import failed: " + error.message });
    }
  });

  app.get("/api/admin/indigenous/layers", isAdmin, async (_req, res) => {
    try {
      const layers = await storage.getIndigenousLayers();
      res.json(layers);
    } catch (error: any) {
      console.error("Error fetching admin layers:", error);
      res.status(500).json({ error: "Failed to load layers" });
    }
  });

  app.post("/api/admin/watch-overlays", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        slug: z.string().min(1).max(200),
        overlayName: z.string().min(1).max(500),
        overlayGroup: z.string().default("high_sensitivity"),
        jurisdiction: z.string().optional(),
        nationName: z.string().optional(),
        legalContextType: z.string().optional(),
        sourceSummary: z.string().optional(),
        sourceUrl: z.string().optional(),
        sourceDate: z.string().optional(),
        geometryMethod: z.string().optional(),
        geometryConfidence: z.enum(["high", "medium", "low"]).optional(),
        authorityLevel: z.string().optional(),
        disclaimerText: z.string().optional(),
        statusLabel: z.string().optional(),
        active: z.boolean().default(true),
        createdBy: z.string().optional(),
        digitizationNotes: z.string().optional(),
        geojson: z.any().optional(),
      });
      const parsed = createSchema.parse(req.body);
      const { geojson, ...overlayData } = parsed;
      const overlay = await storage.createWatchOverlay(overlayData as any);
      if (geojson) {
        const geojsonStr = JSON.stringify(geojson);
        await db.execute(sql`
          UPDATE watch_overlays
          SET geom = ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326)
          WHERE id = ${overlay.id}
        `);
      }
      res.json(overlay);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      res.status(500).json({ error: "Failed to create overlay" });
    }
  });

  app.get("/api/admin/watch-overlays", isAdmin, async (_req, res) => {
    try {
      const overlays = await storage.getWatchOverlays();
      res.json(overlays);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load watch overlays" });
    }
  });

  app.put("/api/admin/watch-overlays/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { geojson, ...updates } = req.body;
      const updated = await storage.updateWatchOverlay(id, updates);
      if (!updated) {
        res.status(404).json({ error: "Overlay not found" });
        return;
      }
      if (geojson) {
        const geojsonStr = JSON.stringify(geojson);
        await db.execute(sql`
          UPDATE watch_overlays
          SET geom = ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326)
          WHERE id = ${id}
        `);
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update overlay" });
    }
  });

  app.delete("/api/admin/watch-overlays/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteWatchOverlay(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete overlay" });
    }
  });

  app.post("/api/admin/watch-overlays/seed", isAdmin, async (_req, res) => {
    try {
      const result = await seedWatchOverlays();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to seed overlays" });
    }
  });

  app.get("/api/land-claim-screener/watch-overlays", async (_req, res) => {
    try {
      const overlays = await storage.getWatchOverlays();
      res.json(overlays.filter(o => o.active));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load watch overlays" });
    }
  });

  // ===== GEOGRAPHIES & METRICS API =====

  app.get("/api/geographies", async (req, res) => {
    try {
      const { city, province, type, q } = req.query;
      if (q && typeof q === "string") {
        const results = await storage.searchGeographies(q);
        return res.json(results);
      }
      const results = await storage.getGeographies({
        city: city as string,
        province: province as string,
        type: type as string,
      });
      res.json(results);
    } catch (err) {
      console.error("[geographies] Error:", err);
      res.status(500).json({ error: "Failed to fetch geographies" });
    }
  });

  app.get("/api/geographies/:id", async (req, res) => {
    try {
      const geo = await storage.getGeography(req.params.id);
      if (!geo) return res.status(404).json({ error: "Geography not found" });
      res.json(geo);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch geography" });
    }
  });

  app.get("/api/metrics", async (req, res) => {
    try {
      const { geography_id, metric_type, start, end } = req.query;
      const results = await storage.getMetrics({
        geographyId: geography_id as string,
        metricType: metric_type as string,
        startDate: start as string,
        endDate: end as string,
      });
      res.json(results);
    } catch (err) {
      console.error("[metrics] Error:", err);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/metrics/types", async (_req, res) => {
    try {
      const types = await storage.getMetricTypes();
      res.json(types);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch metric types" });
    }
  });

  app.get("/api/area-scores", async (req, res) => {
    try {
      const { geography_id, start, end } = req.query;
      if (!geography_id) return res.status(400).json({ error: "geography_id required" });
      const results = await storage.getAreaScores(
        geography_id as string,
        start as string,
        end as string
      );
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch area scores" });
    }
  });

  app.get("/api/area-scores/latest", async (req, res) => {
    try {
      const { ids } = req.query;
      const geographyIds = ids ? (ids as string).split(",") : undefined;
      const results = await storage.getLatestAreaScores(geographyIds);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch latest area scores" });
    }
  });

  app.post("/api/saved-reports", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const report = await storage.createSavedReport({
        ...req.body,
        userId: req.session.userId,
        shareToken: token,
      });
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: "Failed to save report" });
    }
  });

  app.get("/api/saved-reports/:id", async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) return res.status(404).json({ error: "Report not found" });
      if (report.userId && req.session?.userId !== report.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.get("/api/saved-reports/share/:token", async (req, res) => {
    try {
      const report = await storage.getSavedReportByToken(req.params.token);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  return httpServer;
}

// Helper function to generate agreement HTML
function generateBuyBoxAgreementHtml(data: {
  signedName: string;
  termEndDate: string;
  holdoverDays: number;
  commissionPercent: number;
}): string {
  return `
    <html>
    <head><title>Buyer Representation Agreement</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1>Buyer Representation & BuyBox Terms</h1>
      <p><strong>Version:</strong> 1.0</p>
      <p><strong>Date Signed:</strong> ${new Date().toLocaleDateString()}</p>
      
      <h2>Parties</h2>
      <p><strong>Buyer:</strong> ${data.signedName}</p>
      <p><strong>Brokerage:</strong> Valery Real Estate Inc.</p>
      <p><strong>Agent:</strong> Daniel Foch (and referrals/assigns)</p>
      
      <h2>Term</h2>
      <p>This agreement begins on ${new Date().toLocaleDateString()} and expires on ${new Date(data.termEndDate).toLocaleDateString()}.</p>
      
      <h2>Holdover Period</h2>
      <p>${data.holdoverDays} days after agreement expiry.</p>
      
      <h2>Commission</h2>
      <p>Agreed commission rate: ${data.commissionPercent}%</p>
      
      <h2>Legal Notice</h2>
      <p>This document is not legal advice. Consult with a licensed real estate lawyer for professional guidance.</p>
    </body>
    </html>
  `;
}
