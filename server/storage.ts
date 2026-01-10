import { 
  leads, 
  properties, 
  analyses, 
  webhookLogs,
  dataCache,
  savedDeals,
  podcastQuestions,
  investorProfiles,
  investorKyc,
  portfolioProperties,
  industryPartners,
  partnerLeads,
  professionalSubscriptions,
  brandingAssets,
  marketExpertApplications,
  verificationTokens,
  platformAnalytics,
  type Lead, 
  type InsertLead,
  type Property,
  type InsertProperty,
  type Analysis,
  type InsertAnalysis,
  type WebhookLog,
  type InsertWebhookLog,
  type DataCache,
  type InsertDataCache,
  type SavedDeal,
  type InsertSavedDeal,
  type PodcastQuestion,
  type InsertPodcastQuestion,
  type InvestorProfile,
  type InsertInvestorProfile,
  type InvestorKyc,
  type InsertInvestorKyc,
  type PortfolioProperty,
  type InsertPortfolioProperty,
  type IndustryPartner,
  type InsertIndustryPartner,
  type PartnerLead,
  type InsertPartnerLead,
  type ProfessionalSubscription,
  type InsertProfessionalSubscription,
  type BrandingAssets,
  type InsertBrandingAssets,
  type MarketExpertApplication,
  type InsertMarketExpertApplication,
  type VerificationToken,
  type InsertVerificationToken,
  type PlatformAnalytics,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  createLead(lead: InsertLead): Promise<Lead>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  getAllLeads(): Promise<Lead[]>;
  getLeadsCount(): Promise<number>;
  getTodayLeadsCount(): Promise<number>;

  createProperty(property: InsertProperty): Promise<Property>;
  getProperty(id: string): Promise<Property | undefined>;
  getPropertiesByLead(leadId: string): Promise<Property[]>;

  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAnalysesByLead(leadId: string): Promise<Analysis[]>;
  getAnalysisCount(): Promise<number>;

  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogsByLead(leadId: string): Promise<WebhookLog[]>;
  updateWebhookLog(id: string, updates: Partial<WebhookLog>): Promise<WebhookLog | undefined>;

  getDataCache(key: string): Promise<DataCache | undefined>;
  setDataCache(data: InsertDataCache): Promise<DataCache>;

  createSavedDeal(deal: InsertSavedDeal): Promise<SavedDeal>;
  getSavedDeal(id: string): Promise<SavedDeal | undefined>;
  getSavedDealsBySession(sessionId: string): Promise<SavedDeal[]>;
  deleteSavedDeal(id: string): Promise<void>;

  createPodcastQuestion(question: InsertPodcastQuestion): Promise<PodcastQuestion>;
  getPodcastQuestions(): Promise<PodcastQuestion[]>;

  // Investor Profile
  getInvestorProfile(userId: string): Promise<InvestorProfile | undefined>;
  upsertInvestorProfile(profile: InsertInvestorProfile): Promise<InvestorProfile>;

  // Investor KYC
  getInvestorKyc(userId: string): Promise<InvestorKyc | undefined>;
  upsertInvestorKyc(kyc: InsertInvestorKyc): Promise<InvestorKyc>;

  // Portfolio Properties
  getPortfolioProperties(userId: string): Promise<PortfolioProperty[]>;
  getPortfolioProperty(id: string): Promise<PortfolioProperty | undefined>;
  createPortfolioProperty(property: InsertPortfolioProperty): Promise<PortfolioProperty>;
  updatePortfolioProperty(id: string, updates: Partial<PortfolioProperty>): Promise<PortfolioProperty | undefined>;
  deletePortfolioProperty(id: string): Promise<void>;

  // Industry Partners
  getIndustryPartner(userId: string): Promise<IndustryPartner | undefined>;
  getIndustryPartnerById(id: string): Promise<IndustryPartner | undefined>;
  getApprovedPartnersByArea(area: string): Promise<IndustryPartner[]>;
  upsertIndustryPartner(partner: InsertIndustryPartner): Promise<IndustryPartner>;
  updateIndustryPartner(id: string, updates: Partial<IndustryPartner>): Promise<IndustryPartner | undefined>;

  // Partner Leads
  getPartnerLeads(partnerId: string): Promise<(PartnerLead & { lead: Lead })[]>;
  createPartnerLead(partnerLead: InsertPartnerLead): Promise<PartnerLead>;
  updatePartnerLead(id: string, updates: Partial<PartnerLead>): Promise<PartnerLead | undefined>;

  // Professional Subscriptions
  getProfessionalSubscription(userId: string): Promise<ProfessionalSubscription | undefined>;
  upsertProfessionalSubscription(subscription: InsertProfessionalSubscription): Promise<ProfessionalSubscription>;
  updateProfessionalSubscription(userId: string, updates: Partial<ProfessionalSubscription>): Promise<ProfessionalSubscription | undefined>;
  incrementPullUsage(userId: string): Promise<{ allowed: boolean; pullsUsed: number; limit: number }>;
  resetMonthlyPulls(userId: string): Promise<void>;

  // Branding Assets
  getBrandingAssets(userId: string): Promise<BrandingAssets | undefined>;
  upsertBrandingAssets(branding: InsertBrandingAssets): Promise<BrandingAssets>;

  // Market Expert Applications
  getMarketExpertApplication(userId: string): Promise<MarketExpertApplication | undefined>;
  createMarketExpertApplication(application: InsertMarketExpertApplication): Promise<MarketExpertApplication>;
  updateMarketExpertApplication(id: string, updates: Partial<MarketExpertApplication>): Promise<MarketExpertApplication | undefined>;

  // Verification Tokens
  createVerificationToken(token: InsertVerificationToken): Promise<VerificationToken>;
  getVerificationToken(token: string, type: string): Promise<VerificationToken | undefined>;
  markTokenVerified(id: string): Promise<void>;

  // Platform Analytics
  getAnalyticsForPeriod(startDate: Date, endDate: Date, region?: string): Promise<PlatformAnalytics[]>;
  getRecentAnalysisCount(days: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLeadsCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(leads);
    return Number(result?.count || 0);
  }

  async getTodayLeadsCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(gte(leads.createdAt, today));
    return Number(result?.count || 0);
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(insertProperty).returning();
    return property;
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }

  async getPropertiesByLead(leadId: string): Promise<Property[]> {
    return db.select().from(properties).where(eq(properties.leadId, leadId));
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const shareToken = randomUUID().slice(0, 8);
    const [analysis] = await db
      .insert(analyses)
      .values({ ...insertAnalysis, shareToken })
      .returning();
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    return analysis || undefined;
  }

  async getAnalysesByLead(leadId: string): Promise<Analysis[]> {
    return db.select().from(analyses).where(eq(analyses.leadId, leadId));
  }

  async getAnalysisCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(analyses);
    return Number(result?.count || 0);
  }

  async createWebhookLog(insertLog: InsertWebhookLog): Promise<WebhookLog> {
    const [log] = await db.insert(webhookLogs).values(insertLog).returning();
    return log;
  }

  async getWebhookLogsByLead(leadId: string): Promise<WebhookLog[]> {
    return db.select().from(webhookLogs).where(eq(webhookLogs.leadId, leadId));
  }

  async updateWebhookLog(id: string, updates: Partial<WebhookLog>): Promise<WebhookLog | undefined> {
    const [log] = await db
      .update(webhookLogs)
      .set(updates)
      .where(eq(webhookLogs.id, id))
      .returning();
    return log || undefined;
  }

  async getDataCache(key: string): Promise<DataCache | undefined> {
    const [cache] = await db.select().from(dataCache).where(eq(dataCache.key, key));
    return cache || undefined;
  }

  async setDataCache(insertData: InsertDataCache): Promise<DataCache> {
    const existing = await this.getDataCache(insertData.key);
    if (existing) {
      const [updated] = await db
        .update(dataCache)
        .set({ ...insertData, fetchedAt: new Date() })
        .where(eq(dataCache.key, insertData.key))
        .returning();
      return updated;
    }
    const [cache] = await db.insert(dataCache).values(insertData).returning();
    return cache;
  }

  async createSavedDeal(insertDeal: InsertSavedDeal): Promise<SavedDeal> {
    const [deal] = await db.insert(savedDeals).values(insertDeal).returning();
    return deal;
  }

  async getSavedDeal(id: string): Promise<SavedDeal | undefined> {
    const [deal] = await db.select().from(savedDeals).where(eq(savedDeals.id, id));
    return deal || undefined;
  }

  async getSavedDealsBySession(sessionId: string): Promise<SavedDeal[]> {
    return db.select().from(savedDeals).where(eq(savedDeals.sessionId, sessionId)).orderBy(desc(savedDeals.createdAt));
  }

  async deleteSavedDeal(id: string): Promise<void> {
    await db.delete(savedDeals).where(eq(savedDeals.id, id));
  }

  async createPodcastQuestion(insertQuestion: InsertPodcastQuestion): Promise<PodcastQuestion> {
    const [question] = await db.insert(podcastQuestions).values(insertQuestion).returning();
    return question;
  }

  async getPodcastQuestions(): Promise<PodcastQuestion[]> {
    return db.select().from(podcastQuestions).orderBy(desc(podcastQuestions.createdAt));
  }

  // Investor Profile
  async getInvestorProfile(userId: string): Promise<InvestorProfile | undefined> {
    const [profile] = await db.select().from(investorProfiles).where(eq(investorProfiles.userId, userId));
    return profile || undefined;
  }

  async upsertInvestorProfile(profile: InsertInvestorProfile): Promise<InvestorProfile> {
    const existing = await this.getInvestorProfile(profile.userId);
    if (existing) {
      const [updated] = await db
        .update(investorProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(investorProfiles.userId, profile.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(investorProfiles).values(profile).returning();
    return created;
  }

  // Investor KYC
  async getInvestorKyc(userId: string): Promise<InvestorKyc | undefined> {
    const [kyc] = await db.select().from(investorKyc).where(eq(investorKyc.userId, userId));
    return kyc || undefined;
  }

  async upsertInvestorKyc(kyc: InsertInvestorKyc): Promise<InvestorKyc> {
    const existing = await this.getInvestorKyc(kyc.userId);
    if (existing) {
      const [updated] = await db
        .update(investorKyc)
        .set({ ...kyc, updatedAt: new Date() })
        .where(eq(investorKyc.userId, kyc.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(investorKyc).values(kyc).returning();
    return created;
  }

  // Portfolio Properties
  async getPortfolioProperties(userId: string): Promise<PortfolioProperty[]> {
    return db.select().from(portfolioProperties).where(eq(portfolioProperties.userId, userId)).orderBy(desc(portfolioProperties.createdAt));
  }

  async getPortfolioProperty(id: string): Promise<PortfolioProperty | undefined> {
    const [property] = await db.select().from(portfolioProperties).where(eq(portfolioProperties.id, id));
    return property || undefined;
  }

  async createPortfolioProperty(property: InsertPortfolioProperty): Promise<PortfolioProperty> {
    const [created] = await db.insert(portfolioProperties).values(property).returning();
    return created;
  }

  async updatePortfolioProperty(id: string, updates: Partial<PortfolioProperty>): Promise<PortfolioProperty | undefined> {
    const [updated] = await db
      .update(portfolioProperties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(portfolioProperties.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePortfolioProperty(id: string): Promise<void> {
    await db.delete(portfolioProperties).where(eq(portfolioProperties.id, id));
  }

  // Industry Partners
  async getIndustryPartner(userId: string): Promise<IndustryPartner | undefined> {
    const [partner] = await db.select().from(industryPartners).where(eq(industryPartners.userId, userId));
    return partner || undefined;
  }

  async getIndustryPartnerById(id: string): Promise<IndustryPartner | undefined> {
    const [partner] = await db.select().from(industryPartners).where(eq(industryPartners.id, id));
    return partner || undefined;
  }

  async getApprovedPartnersByArea(area: string): Promise<IndustryPartner[]> {
    return db.select().from(industryPartners)
      .where(and(
        eq(industryPartners.isApproved, true),
        eq(industryPartners.isPublic, true)
      ));
  }

  async upsertIndustryPartner(partner: InsertIndustryPartner): Promise<IndustryPartner> {
    const existing = await this.getIndustryPartner(partner.userId);
    if (existing) {
      const [updated] = await db
        .update(industryPartners)
        .set({ ...partner, updatedAt: new Date() })
        .where(eq(industryPartners.userId, partner.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(industryPartners).values(partner).returning();
    return created;
  }

  async updateIndustryPartner(id: string, updates: Partial<IndustryPartner>): Promise<IndustryPartner | undefined> {
    const [updated] = await db
      .update(industryPartners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(industryPartners.id, id))
      .returning();
    return updated || undefined;
  }

  // Partner Leads
  async getPartnerLeads(partnerId: string): Promise<(PartnerLead & { lead: Lead })[]> {
    const results = await db
      .select()
      .from(partnerLeads)
      .innerJoin(leads, eq(partnerLeads.leadId, leads.id))
      .where(eq(partnerLeads.partnerId, partnerId))
      .orderBy(desc(partnerLeads.assignedAt));
    
    return results.map(r => ({
      ...r.partner_leads,
      lead: r.leads,
    }));
  }

  async createPartnerLead(partnerLead: InsertPartnerLead): Promise<PartnerLead> {
    const [created] = await db.insert(partnerLeads).values(partnerLead).returning();
    return created;
  }

  async updatePartnerLead(id: string, updates: Partial<PartnerLead>): Promise<PartnerLead | undefined> {
    const [updated] = await db
      .update(partnerLeads)
      .set(updates)
      .where(eq(partnerLeads.id, id))
      .returning();
    return updated || undefined;
  }

  // Professional Subscriptions
  async getProfessionalSubscription(userId: string): Promise<ProfessionalSubscription | undefined> {
    const [subscription] = await db.select().from(professionalSubscriptions).where(eq(professionalSubscriptions.userId, userId));
    return subscription || undefined;
  }

  async upsertProfessionalSubscription(subscription: InsertProfessionalSubscription): Promise<ProfessionalSubscription> {
    const existing = await this.getProfessionalSubscription(subscription.userId);
    if (existing) {
      const [updated] = await db
        .update(professionalSubscriptions)
        .set({ ...subscription, updatedAt: new Date() })
        .where(eq(professionalSubscriptions.userId, subscription.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(professionalSubscriptions).values(subscription).returning();
    return created;
  }

  async updateProfessionalSubscription(userId: string, updates: Partial<ProfessionalSubscription>): Promise<ProfessionalSubscription | undefined> {
    const [updated] = await db
      .update(professionalSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(professionalSubscriptions.userId, userId))
      .returning();
    return updated || undefined;
  }

  async incrementPullUsage(userId: string): Promise<{ allowed: boolean; pullsUsed: number; limit: number }> {
    let subscription = await this.getProfessionalSubscription(userId);
    
    if (!subscription) {
      subscription = await this.upsertProfessionalSubscription({
        userId,
        tier: 'free',
        monthlyPullLimit: 5,
        pullsUsedThisMonth: 0,
      });
    }

    const limit = subscription.monthlyPullLimit || 5;
    const currentUsage = subscription.pullsUsedThisMonth || 0;
    
    if (limit === -1) {
      await this.updateProfessionalSubscription(userId, {
        pullsUsedThisMonth: currentUsage + 1,
      });
      return { allowed: true, pullsUsed: currentUsage + 1, limit: -1 };
    }
    
    if (currentUsage >= limit) {
      return { allowed: false, pullsUsed: currentUsage, limit };
    }

    await this.updateProfessionalSubscription(userId, {
      pullsUsedThisMonth: currentUsage + 1,
    });

    return { allowed: true, pullsUsed: currentUsage + 1, limit };
  }

  async resetMonthlyPulls(userId: string): Promise<void> {
    await this.updateProfessionalSubscription(userId, {
      pullsUsedThisMonth: 0,
      periodStart: new Date(),
    });
  }

  // Branding Assets
  async getBrandingAssets(userId: string): Promise<BrandingAssets | undefined> {
    const [branding] = await db.select().from(brandingAssets).where(eq(brandingAssets.userId, userId));
    return branding || undefined;
  }

  async upsertBrandingAssets(branding: InsertBrandingAssets): Promise<BrandingAssets> {
    const existing = await this.getBrandingAssets(branding.userId);
    if (existing) {
      const [updated] = await db
        .update(brandingAssets)
        .set({ ...branding, updatedAt: new Date() })
        .where(eq(brandingAssets.userId, branding.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(brandingAssets).values(branding).returning();
    return created;
  }

  // Market Expert Applications
  async getMarketExpertApplication(userId: string): Promise<MarketExpertApplication | undefined> {
    const [application] = await db.select().from(marketExpertApplications).where(eq(marketExpertApplications.userId, userId));
    return application || undefined;
  }

  async createMarketExpertApplication(application: InsertMarketExpertApplication): Promise<MarketExpertApplication> {
    const [created] = await db.insert(marketExpertApplications).values(application).returning();
    return created;
  }

  async updateMarketExpertApplication(id: string, updates: Partial<MarketExpertApplication>): Promise<MarketExpertApplication | undefined> {
    const [updated] = await db
      .update(marketExpertApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketExpertApplications.id, id))
      .returning();
    return updated || undefined;
  }

  // Verification Tokens
  async createVerificationToken(token: InsertVerificationToken): Promise<VerificationToken> {
    const [created] = await db.insert(verificationTokens).values(token).returning();
    return created;
  }

  async getVerificationToken(token: string, type: string): Promise<VerificationToken | undefined> {
    const [found] = await db.select().from(verificationTokens)
      .where(and(eq(verificationTokens.token, token), eq(verificationTokens.type, type)));
    return found || undefined;
  }

  async markTokenVerified(id: string): Promise<void> {
    await db.update(verificationTokens)
      .set({ verifiedAt: new Date() })
      .where(eq(verificationTokens.id, id));
  }

  // Platform Analytics
  async getAnalyticsForPeriod(startDate: Date, endDate: Date, region?: string): Promise<PlatformAnalytics[]> {
    let query = db.select().from(platformAnalytics)
      .where(and(
        gte(platformAnalytics.date, startDate),
        gte(endDate, platformAnalytics.date)
      ));
    
    if (region) {
      query = db.select().from(platformAnalytics)
        .where(and(
          gte(platformAnalytics.date, startDate),
          gte(endDate, platformAnalytics.date),
          eq(platformAnalytics.region, region)
        ));
    }
    
    return query;
  }

  async getRecentAnalysisCount(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(analyses)
      .where(gte(analyses.createdAt, startDate));
    
    return Number(result?.count || 0);
  }
}

export const storage = new DatabaseStorage();
