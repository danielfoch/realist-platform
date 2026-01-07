import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertAnalysisSchema, insertSavedDealSchema } from "@shared/schema";
import { z } from "zod";
import { getEvents, forceRefreshEvents, clearEventCache } from "./eventbrite";

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
      const substackName = "danielfoch";
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
      const deal = await storage.createSavedDeal(validatedData);
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

  // Podcast episodes from RSS feed
  app.get("/api/podcast/episodes", async (req, res) => {
    try {
      const rssUrl = "https://www.omnycontent.com/d/playlist/d75d2ff4-a4dd-4a19-bcb1-ad35013dfc83/1d7b066f-9af2-431b-bea7-aecd0152873d/podcast.rss";
      const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      
      const response = await fetch(rss2jsonUrl);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      const episodes = data.items?.map((item: any) => ({
        title: item.title,
        description: item.description,
        pubDate: item.pubDate,
        audioUrl: item.enclosure?.link || item.link,
        duration: item.itunes?.duration || "",
        link: item.link,
        imageUrl: item.thumbnail || data.feed?.image,
      })) || [];
      
      res.json(episodes);
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

  return httpServer;
}
