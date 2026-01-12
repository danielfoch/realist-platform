import type { Express } from "express";
import { createServer, type Server } from "http";
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
  users,
  renoQuoteLineItemSchema,
  renoQuoteAssumptionsSchema,
  type RenoQuoteLineItem,
  type RenoQuoteAssumptions,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getEvents, forceRefreshEvents, clearEventCache } from "./eventbrite";
import { setupAuth, registerAuthRoutes, isAuthenticated, isAdmin } from "./auth";
import { exportToGoogleSheets } from "./googleSheets";
import { calculateRenoQuotePricing, getLineItemCatalog } from "./renoQuotePricing";

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

      const analysis = await storage.createAnalysis({
        ...validatedData.analysis,
        leadId: lead.id,
        propertyId: property.id,
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

      res.json({
        success: true,
        data: {
          leadId: lead.id,
          propertyId: property.id,
          analysisId: analysis.id,
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

      res.json({ success: true, data: { leadId: lead.id } });
    } catch (error) {
      console.error("Error creating engagement lead:", error);
      res.status(500).json({ error: "Failed to submit request" });
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

      // TODO: When email service is configured, send email directly to host
      // For now, the webhook will handle routing to the host via GHL workflows
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
      
      console.log("[Google Sheets Export] User ID:", userId || "anonymous");
      
      if (userId) {
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

      const spreadsheetUrl = await exportToGoogleSheets({
        address: address || "Property Analysis",
        strategy: strategy || "buy_hold",
        inputs,
        results,
      }, userTokens || undefined);

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
      const { name, email, question } = req.body;
      
      if (!name || !email || !question) {
        res.status(400).json({ error: "Name, email, and question are required" });
        return;
      }

      // Store in database
      const storedQuestion = await storage.createPodcastQuestion({ name, email, question });

      // Send email notification via webhook or direct email
      const webhookUrl = process.env.GHL_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "podcast_question",
              name,
              email,
              question,
              submittedAt: new Date().toISOString(),
            }),
          });
        } catch (webhookError) {
          console.error("Webhook notification failed:", webhookError);
        }
      }

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

  // Create checkout session for subscription
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { tier } = req.body;
      
      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      
      // Get or create Stripe customer
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
      
      // Define price IDs for each tier
      const priceIds: Record<string, string> = {
        starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
        pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
      };
      
      const priceId = priceIds[tier];
      if (!priceId) {
        res.status(400).json({ error: "Invalid tier" });
        return;
      }
      
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/professional/dashboard?success=true`,
        cancel_url: `${baseUrl}/professional/dashboard?canceled=true`,
        metadata: { userId, tier },
      });
      
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
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
  // BRANDING ASSETS ROUTES
  // ============================================

  app.get("/api/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const branding = await storage.getBrandingAssets(userId);
      res.json(branding || {});
    } catch (error) {
      console.error("Error fetching branding:", error);
      res.status(500).json({ error: "Failed to fetch branding" });
    }
  });

  app.put("/api/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Check if user has starter or pro tier
      const subscription = await storage.getProfessionalSubscription(userId);
      if (!subscription || subscription.tier === 'free') {
        res.status(403).json({ error: "Branding requires a paid subscription" });
        return;
      }
      
      const branding = await storage.upsertBrandingAssets({ ...req.body, userId });
      res.json(branding);
    } catch (error) {
      console.error("Error updating branding:", error);
      res.status(500).json({ error: "Failed to update branding" });
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

  return httpServer;
}
