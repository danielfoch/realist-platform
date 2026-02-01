import { 
  leads, 
  properties, 
  analyses, 
  webhookLogs,
  dataCache,
  savedDeals,
  podcastQuestions,
  coachingWaitlist,
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
  renoQuotes,
  googleOAuthTokens,
  buyBoxAgreements,
  buyBoxMandates,
  buyBoxResponses,
  buyBoxNotifications,
  coInvestUserProfiles,
  coInvestGroups,
  coInvestMemberships,
  coInvestChecklistResults,
  coInvestMessages,
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
  type CoachingWaitlist,
  type InsertCoachingWaitlist,
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
  type RenoQuote,
  type InsertRenoQuote,
  type GoogleOAuthToken,
  type InsertGoogleOAuthToken,
  type BuyBoxAgreement,
  type InsertBuyBoxAgreement,
  type BuyBoxMandate,
  type InsertBuyBoxMandate,
  type BuyBoxResponse,
  type InsertBuyBoxResponse,
  type BuyBoxNotification,
  type InsertBuyBoxNotification,
  type CoInvestUserProfile,
  type InsertCoInvestUserProfile,
  type CoInvestGroup,
  type InsertCoInvestGroup,
  type CoInvestMembership,
  type InsertCoInvestMembership,
  type CoInvestChecklistResult,
  type InsertCoInvestChecklistResult,
  type CoInvestMessage,
  type InsertCoInvestMessage,
} from "@shared/schema";
import { users, userOAuthAccounts, phoneVerificationCodes, type UserOAuthAccount, type InsertUserOAuthAccount, type PhoneVerificationCode, type InsertPhoneVerificationCode } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
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
  getSavedDealsByUser(userId: string): Promise<SavedDeal[]>;
  deleteSavedDeal(id: string): Promise<void>;

  createPodcastQuestion(question: InsertPodcastQuestion): Promise<PodcastQuestion>;
  getPodcastQuestions(): Promise<PodcastQuestion[]>;

  // Coaching Waitlist
  createCoachingWaitlistEntry(entry: InsertCoachingWaitlist): Promise<CoachingWaitlist>;
  getCoachingWaitlistEntries(): Promise<CoachingWaitlist[]>;
  updateCoachingWaitlistEntry(id: string, updates: Partial<CoachingWaitlist>): Promise<CoachingWaitlist | undefined>;

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
  getAllMarketExpertApplications(): Promise<Array<MarketExpertApplication & { user?: { email: string; firstName: string | null; lastName: string | null } }>>;
  getMarketExpertApplication(userId: string): Promise<MarketExpertApplication | undefined>;
  getMarketExpertApplicationBySubscription(subscriptionId: string): Promise<MarketExpertApplication | undefined>;
  getApprovedMarketExperts(): Promise<Array<{
    userId: string;
    name: string;
    marketRegion: string;
    marketCity: string | null;
    brokerageName: string | null;
    brokerageCity: string | null;
    brokerageProvince: string | null;
  }>>;
  createMarketExpertApplication(application: InsertMarketExpertApplication): Promise<MarketExpertApplication>;
  updateMarketExpertApplication(id: string, updates: Partial<MarketExpertApplication>): Promise<MarketExpertApplication | undefined>;

  // Verification Tokens
  createVerificationToken(token: InsertVerificationToken): Promise<VerificationToken>;
  getVerificationToken(token: string, type: string): Promise<VerificationToken | undefined>;
  markTokenVerified(id: string): Promise<void>;

  // Platform Analytics
  getAnalyticsForPeriod(startDate: Date, endDate: Date, region?: string): Promise<PlatformAnalytics[]>;
  getRecentAnalysisCount(days: number): Promise<number>;

  // RenoQuotes
  createRenoQuote(quote: InsertRenoQuote): Promise<RenoQuote>;
  getRenoQuote(id: string): Promise<RenoQuote | undefined>;
  getAllRenoQuotes(): Promise<RenoQuote[]>;
  getRenoQuotesCount(): Promise<number>;

  // Google OAuth Tokens
  getGoogleOAuthToken(userId: string): Promise<GoogleOAuthToken | undefined>;
  upsertGoogleOAuthToken(token: InsertGoogleOAuthToken): Promise<GoogleOAuthToken>;
  deleteGoogleOAuthToken(userId: string): Promise<void>;

  // User OAuth Accounts (for login with Google, etc.)
  getUserOAuthAccount(provider: string, providerUserId: string): Promise<UserOAuthAccount | undefined>;
  getUserOAuthAccountsByUser(userId: string): Promise<UserOAuthAccount[]>;
  createUserOAuthAccount(account: InsertUserOAuthAccount): Promise<UserOAuthAccount>;
  deleteUserOAuthAccount(userId: string, provider: string): Promise<void>;

  // Phone Verification
  createPhoneVerificationCode(code: InsertPhoneVerificationCode): Promise<PhoneVerificationCode>;
  getActivePhoneVerificationCode(userId: string): Promise<PhoneVerificationCode | undefined>;
  markPhoneVerified(userId: string, phone: string): Promise<void>;
  incrementVerificationAttempts(codeId: string): Promise<void>;
  deletePhoneVerificationCode(codeId: string): Promise<void>;

  // BuyBox System
  createBuyBoxAgreement(agreement: InsertBuyBoxAgreement): Promise<BuyBoxAgreement>;
  getBuyBoxAgreement(id: string): Promise<BuyBoxAgreement | undefined>;
  getBuyBoxAgreementsByUser(userId: string): Promise<BuyBoxAgreement[]>;
  
  createBuyBoxMandate(mandate: InsertBuyBoxMandate): Promise<BuyBoxMandate>;
  getBuyBoxMandate(id: string): Promise<BuyBoxMandate | undefined>;
  getBuyBoxMandatesByUser(userId: string): Promise<BuyBoxMandate[]>;
  getAllBuyBoxMandates(): Promise<BuyBoxMandate[]>;
  updateBuyBoxMandate(id: string, updates: Partial<BuyBoxMandate>): Promise<BuyBoxMandate | undefined>;
  
  createBuyBoxResponse(response: InsertBuyBoxResponse): Promise<BuyBoxResponse>;
  getBuyBoxResponsesByMandate(mandateId: string): Promise<BuyBoxResponse[]>;
  
  createBuyBoxNotification(notification: InsertBuyBoxNotification): Promise<BuyBoxNotification>;
  getBuyBoxNotificationsByUser(userId: string): Promise<BuyBoxNotification[]>;
  markBuyBoxNotificationRead(id: string): Promise<void>;

  // Co-Investing User Profiles
  getCoInvestUserProfile(userId: string): Promise<CoInvestUserProfile | undefined>;
  upsertCoInvestUserProfile(profile: InsertCoInvestUserProfile): Promise<CoInvestUserProfile>;

  // Co-Investing Groups
  createCoInvestGroup(group: InsertCoInvestGroup): Promise<CoInvestGroup>;
  getCoInvestGroup(id: string): Promise<CoInvestGroup | undefined>;
  getCoInvestGroupsByOwner(userId: string): Promise<CoInvestGroup[]>;
  getPublicCoInvestGroups(filters?: { jurisdiction?: string; propertyType?: string; strategy?: string; skillsNeeded?: string[]; tier?: string }): Promise<CoInvestGroup[]>;
  updateCoInvestGroup(id: string, updates: Partial<CoInvestGroup>): Promise<CoInvestGroup | undefined>;

  // Co-Investing Memberships
  createCoInvestMembership(membership: InsertCoInvestMembership): Promise<CoInvestMembership>;
  getCoInvestMembership(id: string): Promise<CoInvestMembership | undefined>;
  getCoInvestMembershipsByGroup(groupId: string): Promise<CoInvestMembership[]>;
  getCoInvestMembershipsByUser(userId: string): Promise<CoInvestMembership[]>;
  getUserMembershipInGroup(userId: string, groupId: string): Promise<CoInvestMembership | undefined>;
  updateCoInvestMembership(id: string, updates: Partial<CoInvestMembership>): Promise<CoInvestMembership | undefined>;

  // Co-Investing Checklist Results
  createCoInvestChecklistResult(result: InsertCoInvestChecklistResult): Promise<CoInvestChecklistResult>;
  getCoInvestChecklistResult(id: string): Promise<CoInvestChecklistResult | undefined>;
  getCoInvestChecklistResultsByGroup(groupId: string): Promise<CoInvestChecklistResult[]>;

  // Co-Investing Messages
  createCoInvestMessage(message: InsertCoInvestMessage): Promise<CoInvestMessage>;
  getCoInvestMessagesByGroup(groupId: string): Promise<CoInvestMessage[]>;
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

  async getSavedDealsByUser(userId: string): Promise<SavedDeal[]> {
    return db.select().from(savedDeals).where(eq(savedDeals.userId, userId)).orderBy(desc(savedDeals.createdAt));
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

  // Coaching Waitlist
  async createCoachingWaitlistEntry(entry: InsertCoachingWaitlist): Promise<CoachingWaitlist> {
    const [created] = await db.insert(coachingWaitlist).values(entry).returning();
    return created;
  }

  async getCoachingWaitlistEntries(): Promise<CoachingWaitlist[]> {
    return db.select().from(coachingWaitlist).orderBy(desc(coachingWaitlist.createdAt));
  }

  async updateCoachingWaitlistEntry(id: string, updates: Partial<CoachingWaitlist>): Promise<CoachingWaitlist | undefined> {
    const [updated] = await db.update(coachingWaitlist).set(updates).where(eq(coachingWaitlist.id, id)).returning();
    return updated || undefined;
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
  async getAllMarketExpertApplications(): Promise<Array<MarketExpertApplication & { user?: { email: string; firstName: string | null; lastName: string | null } }>> {
    const results = await db
      .select({
        id: marketExpertApplications.id,
        userId: marketExpertApplications.userId,
        marketRegion: marketExpertApplications.marketRegion,
        marketCity: marketExpertApplications.marketCity,
        packageType: marketExpertApplications.packageType,
        includeMeetupHost: marketExpertApplications.includeMeetupHost,
        monthlyFee: marketExpertApplications.monthlyFee,
        referralFeePercent: marketExpertApplications.referralFeePercent,
        stripeSubscriptionId: marketExpertApplications.stripeSubscriptionId,
        status: marketExpertApplications.status,
        approvedAt: marketExpertApplications.approvedAt,
        createdAt: marketExpertApplications.createdAt,
        updatedAt: marketExpertApplications.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(marketExpertApplications)
      .innerJoin(users, eq(marketExpertApplications.userId, users.id))
      .orderBy(marketExpertApplications.createdAt);
    
    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      marketRegion: r.marketRegion,
      marketCity: r.marketCity,
      packageType: r.packageType,
      includeMeetupHost: r.includeMeetupHost,
      monthlyFee: r.monthlyFee,
      referralFeePercent: r.referralFeePercent,
      stripeSubscriptionId: r.stripeSubscriptionId,
      status: r.status,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
      },
    }));
  }

  async getMarketExpertApplication(userId: string): Promise<MarketExpertApplication | undefined> {
    const [application] = await db.select().from(marketExpertApplications).where(eq(marketExpertApplications.userId, userId));
    return application || undefined;
  }

  async getMarketExpertApplicationBySubscription(subscriptionId: string): Promise<MarketExpertApplication | undefined> {
    const [application] = await db.select().from(marketExpertApplications).where(eq(marketExpertApplications.stripeSubscriptionId, subscriptionId));
    return application || undefined;
  }

  async getApprovedMarketExperts(): Promise<Array<{
    userId: string;
    name: string;
    marketRegion: string;
    marketCity: string | null;
    brokerageName: string | null;
    brokerageCity: string | null;
    brokerageProvince: string | null;
  }>> {
    const results = await db
      .select({
        userId: marketExpertApplications.userId,
        marketRegion: marketExpertApplications.marketRegion,
        marketCity: marketExpertApplications.marketCity,
        firstName: users.firstName,
        lastName: users.lastName,
        brokerageName: professionalSubscriptions.brokerageName,
        brokerageCity: professionalSubscriptions.brokerageCity,
        brokerageProvince: professionalSubscriptions.brokerageProvince,
      })
      .from(marketExpertApplications)
      .innerJoin(users, eq(marketExpertApplications.userId, users.id))
      .leftJoin(professionalSubscriptions, eq(marketExpertApplications.userId, professionalSubscriptions.userId))
      .where(eq(marketExpertApplications.status, 'approved'));
    
    return results.map(r => ({
      userId: r.userId,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown',
      marketRegion: r.marketRegion,
      marketCity: r.marketCity,
      brokerageName: r.brokerageName,
      brokerageCity: r.brokerageCity,
      brokerageProvince: r.brokerageProvince,
    }));
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
    const conditions = [
      gte(platformAnalytics.date, startDate),
      lte(platformAnalytics.date, endDate)
    ];
    
    if (region) {
      conditions.push(eq(platformAnalytics.region, region));
    }
    
    return db.select().from(platformAnalytics).where(and(...conditions));
  }

  async getRecentAnalysisCount(days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(analyses)
      .where(gte(analyses.createdAt, startDate));
    
    return Number(result?.count || 0);
  }

  // RenoQuotes
  async createRenoQuote(quote: InsertRenoQuote): Promise<RenoQuote> {
    const [created] = await db.insert(renoQuotes).values(quote).returning();
    return created;
  }

  async getRenoQuote(id: string): Promise<RenoQuote | undefined> {
    const [quote] = await db.select().from(renoQuotes).where(eq(renoQuotes.id, id));
    return quote || undefined;
  }

  async getAllRenoQuotes(): Promise<RenoQuote[]> {
    return db.select().from(renoQuotes).orderBy(desc(renoQuotes.createdAt));
  }

  async getRenoQuotesCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(renoQuotes);
    return Number(result?.count || 0);
  }

  // Google OAuth Tokens
  async getGoogleOAuthToken(userId: string): Promise<GoogleOAuthToken | undefined> {
    const [token] = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
    return token || undefined;
  }

  async upsertGoogleOAuthToken(token: InsertGoogleOAuthToken): Promise<GoogleOAuthToken> {
    const [result] = await db
      .insert(googleOAuthTokens)
      .values(token)
      .onConflictDoUpdate({
        target: googleOAuthTokens.userId,
        set: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
          scope: token.scope,
          googleEmail: token.googleEmail,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteGoogleOAuthToken(userId: string): Promise<void> {
    await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
  }

  // User OAuth Accounts (for login with Google, etc.)
  async getUserOAuthAccount(provider: string, providerUserId: string): Promise<UserOAuthAccount | undefined> {
    const [account] = await db.select().from(userOAuthAccounts)
      .where(and(
        eq(userOAuthAccounts.provider, provider),
        eq(userOAuthAccounts.providerUserId, providerUserId)
      ));
    return account || undefined;
  }

  async getUserOAuthAccountsByUser(userId: string): Promise<UserOAuthAccount[]> {
    return db.select().from(userOAuthAccounts).where(eq(userOAuthAccounts.userId, userId));
  }

  async createUserOAuthAccount(account: InsertUserOAuthAccount): Promise<UserOAuthAccount> {
    const [result] = await db.insert(userOAuthAccounts).values(account).returning();
    return result;
  }

  async deleteUserOAuthAccount(userId: string, provider: string): Promise<void> {
    await db.delete(userOAuthAccounts).where(
      and(
        eq(userOAuthAccounts.userId, userId),
        eq(userOAuthAccounts.provider, provider)
      )
    );
  }

  // Phone Verification
  async createPhoneVerificationCode(code: InsertPhoneVerificationCode): Promise<PhoneVerificationCode> {
    const [result] = await db.insert(phoneVerificationCodes).values(code).returning();
    return result;
  }

  async getActivePhoneVerificationCode(userId: string): Promise<PhoneVerificationCode | undefined> {
    const now = new Date();
    const [code] = await db.select().from(phoneVerificationCodes)
      .where(and(
        eq(phoneVerificationCodes.userId, userId),
        gte(phoneVerificationCodes.expiresAt, now),
        sql`${phoneVerificationCodes.verifiedAt} IS NULL`
      ))
      .orderBy(desc(phoneVerificationCodes.createdAt))
      .limit(1);
    return code || undefined;
  }

  async markPhoneVerified(userId: string, phone: string): Promise<void> {
    await db.update(users).set({ phone, phoneVerified: true }).where(eq(users.id, userId));
    await db.update(phoneVerificationCodes).set({ verifiedAt: new Date() })
      .where(and(
        eq(phoneVerificationCodes.userId, userId),
        eq(phoneVerificationCodes.phone, phone)
      ));
  }

  async incrementVerificationAttempts(codeId: string): Promise<void> {
    await db.execute(sql`UPDATE phone_verification_codes SET attempts = CAST(attempts AS INTEGER) + 1 WHERE id = ${codeId}`);
  }

  async deletePhoneVerificationCode(codeId: string): Promise<void> {
    await db.delete(phoneVerificationCodes).where(eq(phoneVerificationCodes.id, codeId));
  }

  // BuyBox System Implementation
  async createBuyBoxAgreement(agreement: InsertBuyBoxAgreement): Promise<BuyBoxAgreement> {
    const [result] = await db.insert(buyBoxAgreements).values(agreement).returning();
    return result;
  }

  async getBuyBoxAgreement(id: string): Promise<BuyBoxAgreement | undefined> {
    const [result] = await db.select().from(buyBoxAgreements).where(eq(buyBoxAgreements.id, id));
    return result || undefined;
  }

  async getBuyBoxAgreementsByUser(userId: string): Promise<BuyBoxAgreement[]> {
    return db.select().from(buyBoxAgreements)
      .where(eq(buyBoxAgreements.userId, userId))
      .orderBy(desc(buyBoxAgreements.createdAt));
  }

  async createBuyBoxMandate(mandate: InsertBuyBoxMandate): Promise<BuyBoxMandate> {
    const [result] = await db.insert(buyBoxMandates).values(mandate).returning();
    return result;
  }

  async getBuyBoxMandate(id: string): Promise<BuyBoxMandate | undefined> {
    const [result] = await db.select().from(buyBoxMandates).where(eq(buyBoxMandates.id, id));
    return result || undefined;
  }

  async getBuyBoxMandatesByUser(userId: string): Promise<BuyBoxMandate[]> {
    return db.select().from(buyBoxMandates)
      .where(eq(buyBoxMandates.userId, userId))
      .orderBy(desc(buyBoxMandates.createdAt));
  }

  async getAllBuyBoxMandates(): Promise<BuyBoxMandate[]> {
    return db.select().from(buyBoxMandates).orderBy(desc(buyBoxMandates.createdAt));
  }

  async updateBuyBoxMandate(id: string, updates: Partial<BuyBoxMandate>): Promise<BuyBoxMandate | undefined> {
    const [result] = await db.update(buyBoxMandates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(buyBoxMandates.id, id))
      .returning();
    return result || undefined;
  }

  async createBuyBoxResponse(response: InsertBuyBoxResponse): Promise<BuyBoxResponse> {
    const [result] = await db.insert(buyBoxResponses).values(response).returning();
    return result;
  }

  async getBuyBoxResponsesByMandate(mandateId: string): Promise<BuyBoxResponse[]> {
    return db.select().from(buyBoxResponses)
      .where(eq(buyBoxResponses.mandateId, mandateId))
      .orderBy(desc(buyBoxResponses.createdAt));
  }

  async createBuyBoxNotification(notification: InsertBuyBoxNotification): Promise<BuyBoxNotification> {
    const [result] = await db.insert(buyBoxNotifications).values(notification).returning();
    return result;
  }

  async getBuyBoxNotificationsByUser(userId: string): Promise<BuyBoxNotification[]> {
    return db.select().from(buyBoxNotifications)
      .where(eq(buyBoxNotifications.userId, userId))
      .orderBy(desc(buyBoxNotifications.createdAt));
  }

  async markBuyBoxNotificationRead(id: string): Promise<void> {
    await db.update(buyBoxNotifications)
      .set({ readAt: new Date() })
      .where(eq(buyBoxNotifications.id, id));
  }

  // Co-Investing User Profiles
  async getCoInvestUserProfile(userId: string): Promise<CoInvestUserProfile | undefined> {
    const [result] = await db.select().from(coInvestUserProfiles).where(eq(coInvestUserProfiles.userId, userId));
    return result || undefined;
  }

  async upsertCoInvestUserProfile(profile: InsertCoInvestUserProfile): Promise<CoInvestUserProfile> {
    const existing = await this.getCoInvestUserProfile(profile.userId);
    if (existing) {
      const [result] = await db.update(coInvestUserProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(coInvestUserProfiles.userId, profile.userId))
        .returning();
      return result;
    }
    const [result] = await db.insert(coInvestUserProfiles).values(profile).returning();
    return result;
  }

  // Co-Investing Groups
  async createCoInvestGroup(group: InsertCoInvestGroup): Promise<CoInvestGroup> {
    const [result] = await db.insert(coInvestGroups).values(group).returning();
    return result;
  }

  async getCoInvestGroup(id: string): Promise<CoInvestGroup | undefined> {
    const [result] = await db.select().from(coInvestGroups).where(eq(coInvestGroups.id, id));
    return result || undefined;
  }

  async getCoInvestGroupsByOwner(userId: string): Promise<CoInvestGroup[]> {
    return db.select().from(coInvestGroups)
      .where(eq(coInvestGroups.ownerUserId, userId))
      .orderBy(desc(coInvestGroups.createdAt));
  }

  async getPublicCoInvestGroups(filters?: { jurisdiction?: string; propertyType?: string; strategy?: string; skillsNeeded?: string[]; tier?: string }): Promise<CoInvestGroup[]> {
    let query = db.select().from(coInvestGroups)
      .where(eq(coInvestGroups.visibility, "public"))
      .orderBy(desc(coInvestGroups.createdAt));
    
    return query;
  }

  async updateCoInvestGroup(id: string, updates: Partial<CoInvestGroup>): Promise<CoInvestGroup | undefined> {
    const [result] = await db.update(coInvestGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(coInvestGroups.id, id))
      .returning();
    return result || undefined;
  }

  // Co-Investing Memberships
  async createCoInvestMembership(membership: InsertCoInvestMembership): Promise<CoInvestMembership> {
    const [result] = await db.insert(coInvestMemberships).values(membership).returning();
    return result;
  }

  async getCoInvestMembership(id: string): Promise<CoInvestMembership | undefined> {
    const [result] = await db.select().from(coInvestMemberships).where(eq(coInvestMemberships.id, id));
    return result || undefined;
  }

  async getCoInvestMembershipsByGroup(groupId: string): Promise<CoInvestMembership[]> {
    return db.select().from(coInvestMemberships)
      .where(eq(coInvestMemberships.groupId, groupId))
      .orderBy(desc(coInvestMemberships.createdAt));
  }

  async getCoInvestMembershipsByUser(userId: string): Promise<CoInvestMembership[]> {
    return db.select().from(coInvestMemberships)
      .where(eq(coInvestMemberships.userId, userId))
      .orderBy(desc(coInvestMemberships.createdAt));
  }

  async getUserMembershipInGroup(userId: string, groupId: string): Promise<CoInvestMembership | undefined> {
    const [result] = await db.select().from(coInvestMemberships)
      .where(and(
        eq(coInvestMemberships.userId, userId),
        eq(coInvestMemberships.groupId, groupId)
      ));
    return result || undefined;
  }

  async updateCoInvestMembership(id: string, updates: Partial<CoInvestMembership>): Promise<CoInvestMembership | undefined> {
    const [result] = await db.update(coInvestMemberships)
      .set(updates)
      .where(eq(coInvestMemberships.id, id))
      .returning();
    return result || undefined;
  }

  // Co-Investing Checklist Results
  async createCoInvestChecklistResult(result: InsertCoInvestChecklistResult): Promise<CoInvestChecklistResult> {
    const [created] = await db.insert(coInvestChecklistResults).values(result).returning();
    return created;
  }

  async getCoInvestChecklistResult(id: string): Promise<CoInvestChecklistResult | undefined> {
    const [result] = await db.select().from(coInvestChecklistResults).where(eq(coInvestChecklistResults.id, id));
    return result || undefined;
  }

  async getCoInvestChecklistResultsByGroup(groupId: string): Promise<CoInvestChecklistResult[]> {
    return db.select().from(coInvestChecklistResults)
      .where(eq(coInvestChecklistResults.groupId, groupId))
      .orderBy(desc(coInvestChecklistResults.createdAt));
  }

  // Co-Investing Messages
  async createCoInvestMessage(message: InsertCoInvestMessage): Promise<CoInvestMessage> {
    const [result] = await db.insert(coInvestMessages).values(message).returning();
    return result;
  }

  async getCoInvestMessagesByGroup(groupId: string): Promise<CoInvestMessage[]> {
    return db.select().from(coInvestMessages)
      .where(eq(coInvestMessages.groupId, groupId))
      .orderBy(coInvestMessages.createdAt);
  }
}

export const storage = new DatabaseStorage();
