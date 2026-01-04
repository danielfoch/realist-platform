import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertAnalysisSchema } from "@shared/schema";
import { z } from "zod";
import { getEvents, forceRefreshEvents } from "./eventbrite";

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

      sendWebhook(lead.id, {
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          consent: lead.consent,
          leadSource: lead.leadSource,
          createdAt: lead.createdAt,
        },
        property: {
          address: property.formattedAddress,
          city: property.city,
          region: property.region,
          country: property.country,
        },
        analysis: {
          strategy: analysis.strategyType,
          countryMode: analysis.countryMode,
        },
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

  app.get("/api/admin/leads", async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
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
      const result = await getEvents();
      res.json(result);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/admin/refresh-events", async (req, res) => {
    try {
      const result = await forceRefreshEvents();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error refreshing events:", error);
      res.status(500).json({ error: "Failed to refresh events" });
    }
  });

  return httpServer;
}
