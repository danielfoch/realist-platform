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
  coInvestComplianceLogs,
  experimentAssignments,
  realtorMarketClaims,
  realtorLeadNotifications,
  realtorIntroductions,
  underwritingNotes,
  listingComments,
  votes,
  contributionEvents,
  listingAnalysisAggregates,
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
  type CoInvestComplianceLog,
  type InsertCoInvestComplianceLog,
  type ExperimentAssignment,
  type InsertExperimentAssignment,
  type RealtorMarketClaim,
  type InsertRealtorMarketClaim,
  type RealtorLeadNotification,
  type InsertRealtorLeadNotification,
  type RealtorIntroduction,
  type InsertRealtorIntroduction,
  type UnderwritingNote,
  type InsertUnderwritingNote,
  type ListingComment,
  type InsertListingComment,
  type Vote,
  type InsertVote,
  type ContributionEvent,
  type InsertContributionEvent,
  type ListingAnalysisAggregate,
  type InsertListingAnalysisAggregate,
  marketSnapshots,
  type MarketSnapshot,
  type InsertMarketSnapshot,
  ddfListingSnapshots,
  type DdfListingSnapshot,
  type InsertDdfListingSnapshot,
  cityYieldHistory,
  type CityYieldHistory,
  type InsertCityYieldHistory,
  blogPosts,
  type BlogPost,
  type InsertBlogPost,
  guides,
  type Guide,
  type InsertGuide,
} from "@shared/schema";
import { users, userOAuthAccounts, phoneVerificationCodes, type UserOAuthAccount, type InsertUserOAuthAccount, type PhoneVerificationCode, type InsertPhoneVerificationCode } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, inArray, asc } from "drizzle-orm";
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
  
  // Co-Invest Compliance
  createCoInvestComplianceLog(log: InsertCoInvestComplianceLog): Promise<CoInvestComplianceLog>;
  getCoInvestComplianceLogsByUser(userId: string): Promise<CoInvestComplianceLog[]>;
  updateCoInvestProfileBraStatus(userId: string, data: {
    braStatus?: string;
    braSignedAt?: Date;
    braDocumentId?: string;
    braJurisdiction?: string;
    coinvestAckStatus?: string;
    coinvestAckSignedAt?: Date;
    coinvestAckVersion?: string;
    coinvestAckSignedName?: string;
    coinvestAckSignatureDataUrl?: string;
    selectedJurisdiction?: string;
  }): Promise<CoInvestUserProfile | undefined>;

  // Experiment Assignments
  getExperimentAssignment(visitorId: string, experimentKey: string): Promise<ExperimentAssignment | undefined>;
  createExperimentAssignment(assignment: InsertExperimentAssignment): Promise<ExperimentAssignment>;
  markExperimentConverted(visitorId: string, experimentKey: string): Promise<void>;
  getExperimentStats(experimentKey: string): Promise<{ variant: string; total: number; converted: number }[]>;

  // Realtor Partner Network
  createRealtorMarketClaim(claim: InsertRealtorMarketClaim): Promise<RealtorMarketClaim>;
  getRealtorMarketClaim(id: string): Promise<RealtorMarketClaim | undefined>;
  getRealtorMarketClaimsByUser(userId: string): Promise<RealtorMarketClaim[]>;
  getActiveClaimsForMarket(city: string, region: string): Promise<RealtorMarketClaim[]>;
  updateRealtorMarketClaim(id: string, updates: Partial<RealtorMarketClaim>): Promise<RealtorMarketClaim | undefined>;

  createRealtorLeadNotification(notification: InsertRealtorLeadNotification): Promise<RealtorLeadNotification>;
  getRealtorLeadNotification(id: string): Promise<RealtorLeadNotification | undefined>;
  getRealtorLeadNotificationsByClaim(claimId: string): Promise<RealtorLeadNotification[]>;
  getPendingNotificationsForRealtor(userId: string): Promise<(RealtorLeadNotification & { lead: Lead })[]>;
  updateRealtorLeadNotification(id: string, updates: Partial<RealtorLeadNotification>): Promise<RealtorLeadNotification | undefined>;

  createRealtorIntroduction(intro: InsertRealtorIntroduction): Promise<RealtorIntroduction>;
  getRealtorIntroductionsByRealtor(userId: string): Promise<RealtorIntroduction[]>;
  getRealtorIntroduction(id: string): Promise<RealtorIntroduction | undefined>;

  // Community Underwriting
  createUnderwritingNote(note: InsertUnderwritingNote): Promise<UnderwritingNote>;
  getUnderwritingNotesByListing(mlsNumber: string): Promise<(UnderwritingNote & { user: { id: string; name: string | null } })[]>;
  getUserNotesCountForListingToday(userId: string, mlsNumber: string): Promise<number>;
  updateUnderwritingNoteScore(id: string, delta: number): Promise<void>;

  createListingComment(comment: InsertListingComment): Promise<ListingComment>;
  getListingCommentsByListing(mlsNumber: string): Promise<(ListingComment & { user: { id: string; name: string | null } })[]>;
  updateListingCommentScore(id: string, delta: number): Promise<void>;

  upsertVote(vote: InsertVote): Promise<Vote>;
  getVote(userId: string, targetType: string, targetId: string): Promise<Vote | undefined>;
  getUserVotesForTargets(userId: string, targetType: string, targetIds: string[]): Promise<Vote[]>;

  createContributionEvent(event: InsertContributionEvent): Promise<ContributionEvent>;
  getContributionLeaderboard(period: 'monthly' | 'all-time', limit?: number): Promise<{ userId: string; firstName: string | null; lastName: string | null; totalPoints: number; role: string | null; profileImageUrl: string | null }[]>;

  getListingAggregate(mlsNumber: string): Promise<ListingAnalysisAggregate | undefined>;
  getListingAggregatesBatch(mlsNumbers: string[]): Promise<ListingAnalysisAggregate[]>;
  upsertListingAggregate(data: InsertListingAnalysisAggregate): Promise<ListingAnalysisAggregate>;

  upsertMarketSnapshot(data: InsertMarketSnapshot): Promise<MarketSnapshot>;
  getMarketSnapshots(city?: string, province?: string): Promise<MarketSnapshot[]>;
  getLatestMarketSnapshots(): Promise<MarketSnapshot[]>;
  getMarketSnapshotMonths(): Promise<string[]>;

  insertDdfListingSnapshot(data: InsertDdfListingSnapshot): Promise<DdfListingSnapshot>;
  insertDdfListingSnapshotsBatch(data: InsertDdfListingSnapshot[]): Promise<number>;
  getDdfSnapshotsByCity(city: string, month: string): Promise<DdfListingSnapshot[]>;

  upsertCityYieldHistory(data: InsertCityYieldHistory): Promise<CityYieldHistory>;
  getCityYieldHistory(city?: string, province?: string): Promise<CityYieldHistory[]>;
  getAllCityYieldHistoryMonths(): Promise<string[]>;
  getMultiCityYieldHistory(cities: { city: string; province: string }[]): Promise<CityYieldHistory[]>;

  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<void>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPosts(opts?: { status?: string; category?: string; limit?: number }): Promise<BlogPost[]>;

  createGuide(guide: InsertGuide): Promise<Guide>;
  updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide | undefined>;
  deleteGuide(id: string): Promise<void>;
  getGuide(id: string): Promise<Guide | undefined>;
  getGuideBySlug(slug: string): Promise<Guide | undefined>;
  getGuides(opts?: { status?: string; category?: string }): Promise<Guide[]>;
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

  async createCoInvestComplianceLog(log: InsertCoInvestComplianceLog): Promise<CoInvestComplianceLog> {
    const [result] = await db.insert(coInvestComplianceLogs).values(log).returning();
    return result;
  }

  async getCoInvestComplianceLogsByUser(userId: string): Promise<CoInvestComplianceLog[]> {
    return db.select().from(coInvestComplianceLogs)
      .where(eq(coInvestComplianceLogs.userId, userId))
      .orderBy(desc(coInvestComplianceLogs.createdAt));
  }

  async updateCoInvestProfileBraStatus(userId: string, data: {
    braStatus?: string;
    braSignedAt?: Date;
    braDocumentId?: string;
    braJurisdiction?: string;
    coinvestAckStatus?: string;
    coinvestAckSignedAt?: Date;
    coinvestAckVersion?: string;
    coinvestAckSignedName?: string;
    coinvestAckSignatureDataUrl?: string;
    selectedJurisdiction?: string;
  }): Promise<CoInvestUserProfile | undefined> {
    const [result] = await db.update(coInvestUserProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coInvestUserProfiles.userId, userId))
      .returning();
    return result;
  }

  async getExperimentAssignment(visitorId: string, experimentKey: string): Promise<ExperimentAssignment | undefined> {
    const [result] = await db.select().from(experimentAssignments)
      .where(and(
        eq(experimentAssignments.visitorId, visitorId),
        eq(experimentAssignments.experimentKey, experimentKey)
      ));
    return result;
  }

  async createExperimentAssignment(assignment: InsertExperimentAssignment): Promise<ExperimentAssignment> {
    const [result] = await db.insert(experimentAssignments).values(assignment).returning();
    return result;
  }

  async markExperimentConverted(visitorId: string, experimentKey: string): Promise<void> {
    await db.update(experimentAssignments)
      .set({ convertedAt: new Date() })
      .where(and(
        eq(experimentAssignments.visitorId, visitorId),
        eq(experimentAssignments.experimentKey, experimentKey)
      ));
  }

  async getExperimentStats(experimentKey: string): Promise<{ variant: string; total: number; converted: number }[]> {
    const results = await db.select({
      variant: experimentAssignments.variant,
      total: sql<number>`count(*)::int`,
      converted: sql<number>`count(${experimentAssignments.convertedAt})::int`,
    }).from(experimentAssignments)
      .where(eq(experimentAssignments.experimentKey, experimentKey))
      .groupBy(experimentAssignments.variant);
    return results;
  }

  async createRealtorMarketClaim(claim: InsertRealtorMarketClaim): Promise<RealtorMarketClaim> {
    const [result] = await db.insert(realtorMarketClaims).values(claim).returning();
    return result;
  }

  async getRealtorMarketClaim(id: string): Promise<RealtorMarketClaim | undefined> {
    const [result] = await db.select().from(realtorMarketClaims).where(eq(realtorMarketClaims.id, id));
    return result;
  }

  async getRealtorMarketClaimsByUser(userId: string): Promise<RealtorMarketClaim[]> {
    return db.select().from(realtorMarketClaims)
      .where(eq(realtorMarketClaims.userId, userId))
      .orderBy(desc(realtorMarketClaims.createdAt));
  }

  async getActiveClaimsForMarket(city: string, region: string): Promise<RealtorMarketClaim[]> {
    return db.select().from(realtorMarketClaims)
      .where(and(
        sql`LOWER(${realtorMarketClaims.marketCity}) = LOWER(${city})`,
        sql`LOWER(${realtorMarketClaims.marketRegion}) = LOWER(${region})`,
        eq(realtorMarketClaims.status, "active")
      ));
  }

  async updateRealtorMarketClaim(id: string, updates: Partial<RealtorMarketClaim>): Promise<RealtorMarketClaim | undefined> {
    const [result] = await db.update(realtorMarketClaims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(realtorMarketClaims.id, id))
      .returning();
    return result;
  }

  async createRealtorLeadNotification(notification: InsertRealtorLeadNotification): Promise<RealtorLeadNotification> {
    const [result] = await db.insert(realtorLeadNotifications).values(notification).returning();
    return result;
  }

  async getRealtorLeadNotification(id: string): Promise<RealtorLeadNotification | undefined> {
    const [result] = await db.select().from(realtorLeadNotifications).where(eq(realtorLeadNotifications.id, id));
    return result;
  }

  async getRealtorLeadNotificationsByClaim(claimId: string): Promise<RealtorLeadNotification[]> {
    return db.select().from(realtorLeadNotifications)
      .where(eq(realtorLeadNotifications.realtorClaimId, claimId))
      .orderBy(desc(realtorLeadNotifications.createdAt));
  }

  async getPendingNotificationsForRealtor(userId: string): Promise<(RealtorLeadNotification & { lead: Lead })[]> {
    const results = await db.select({
      notification: realtorLeadNotifications,
      lead: leads,
    }).from(realtorLeadNotifications)
      .innerJoin(leads, eq(realtorLeadNotifications.leadId, leads.id))
      .where(eq(realtorLeadNotifications.realtorUserId, userId))
      .orderBy(desc(realtorLeadNotifications.createdAt));
    return results.map(r => ({ ...r.notification, lead: r.lead }));
  }

  async updateRealtorLeadNotification(id: string, updates: Partial<RealtorLeadNotification>): Promise<RealtorLeadNotification | undefined> {
    const [result] = await db.update(realtorLeadNotifications)
      .set(updates)
      .where(eq(realtorLeadNotifications.id, id))
      .returning();
    return result;
  }

  async createRealtorIntroduction(intro: InsertRealtorIntroduction): Promise<RealtorIntroduction> {
    const [result] = await db.insert(realtorIntroductions).values(intro).returning();
    return result;
  }

  async getRealtorIntroductionsByRealtor(userId: string): Promise<RealtorIntroduction[]> {
    return db.select().from(realtorIntroductions)
      .where(eq(realtorIntroductions.realtorUserId, userId))
      .orderBy(desc(realtorIntroductions.createdAt));
  }

  async getRealtorIntroduction(id: string): Promise<RealtorIntroduction | undefined> {
    const [result] = await db.select().from(realtorIntroductions).where(eq(realtorIntroductions.id, id));
    return result;
  }

  // Community Underwriting
  async createUnderwritingNote(note: InsertUnderwritingNote): Promise<UnderwritingNote> {
    const [result] = await db.insert(underwritingNotes).values(note).returning();
    return result;
  }

  async getUnderwritingNotesByListing(mlsNumber: string): Promise<(UnderwritingNote & { user: { id: string; name: string | null } })[]> {
    const results = await db.select({
      note: underwritingNotes,
      user: { id: users.id, name: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, 'Anonymous')` },
    }).from(underwritingNotes)
      .innerJoin(users, eq(underwritingNotes.userId, users.id))
      .where(eq(underwritingNotes.listingMlsNumber, mlsNumber))
      .orderBy(desc(underwritingNotes.score), desc(underwritingNotes.createdAt));
    return results.map(r => ({ ...r.note, user: r.user }));
  }

  async getUserNotesCountForListingToday(userId: string, mlsNumber: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(underwritingNotes)
      .where(and(
        eq(underwritingNotes.userId, userId),
        eq(underwritingNotes.listingMlsNumber, mlsNumber),
        gte(underwritingNotes.createdAt, today)
      ));
    return Number(result?.count || 0);
  }

  async updateUnderwritingNoteScore(id: string, delta: number): Promise<void> {
    await db.update(underwritingNotes)
      .set({ score: sql`GREATEST(0, COALESCE(${underwritingNotes.score}, 0) + ${delta})` })
      .where(eq(underwritingNotes.id, id));
  }

  async createListingComment(comment: InsertListingComment): Promise<ListingComment> {
    const [result] = await db.insert(listingComments).values(comment).returning();
    return result;
  }

  async getListingCommentsByListing(mlsNumber: string): Promise<(ListingComment & { user: { id: string; name: string | null } })[]> {
    const results = await db.select({
      comment: listingComments,
      user: { id: users.id, name: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, 'Anonymous')` },
    }).from(listingComments)
      .innerJoin(users, eq(listingComments.userId, users.id))
      .where(eq(listingComments.listingMlsNumber, mlsNumber))
      .orderBy(desc(listingComments.score), desc(listingComments.createdAt));
    return results.map(r => ({ ...r.comment, user: r.user }));
  }

  async updateListingCommentScore(id: string, delta: number): Promise<void> {
    await db.update(listingComments)
      .set({ score: sql`GREATEST(0, COALESCE(${listingComments.score}, 0) + ${delta})` })
      .where(eq(listingComments.id, id));
  }

  async upsertVote(vote: InsertVote): Promise<Vote> {
    const existing = await this.getVote(vote.userId, vote.targetType, vote.targetId);
    if (existing) {
      const [result] = await db.update(votes)
        .set({ value: vote.value })
        .where(eq(votes.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(votes).values(vote).returning();
    return result;
  }

  async getVote(userId: string, targetType: string, targetId: string): Promise<Vote | undefined> {
    const [result] = await db.select().from(votes)
      .where(and(
        eq(votes.userId, userId),
        eq(votes.targetType, targetType),
        eq(votes.targetId, targetId)
      ));
    return result;
  }

  async getUserVotesForTargets(userId: string, targetType: string, targetIds: string[]): Promise<Vote[]> {
    if (targetIds.length === 0) return [];
    return db.select().from(votes)
      .where(and(
        eq(votes.userId, userId),
        eq(votes.targetType, targetType),
        inArray(votes.targetId, targetIds)
      ));
  }

  async createContributionEvent(event: InsertContributionEvent): Promise<ContributionEvent> {
    const [result] = await db.insert(contributionEvents).values(event).returning();
    return result;
  }

  async getContributionLeaderboard(period: 'monthly' | 'all-time', limit: number = 20): Promise<{ userId: string; firstName: string | null; lastName: string | null; totalPoints: number; role: string | null; profileImageUrl: string | null }[]> {
    let query = db.select({
      userId: contributionEvents.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      totalPoints: sql<number>`COALESCE(SUM(${contributionEvents.points}), 0)`,
      role: users.role,
      profileImageUrl: users.profileImageUrl,
    }).from(contributionEvents)
      .innerJoin(users, eq(contributionEvents.userId, users.id));

    if (period === 'monthly') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      query = query.where(gte(contributionEvents.createdAt, startOfMonth)) as any;
    }

    return (query as any)
      .groupBy(contributionEvents.userId, users.firstName, users.lastName, users.role, users.profileImageUrl)
      .orderBy(desc(sql`COALESCE(SUM(${contributionEvents.points}), 0)`))
      .limit(limit);
  }

  async getListingAggregate(mlsNumber: string): Promise<ListingAnalysisAggregate | undefined> {
    const [result] = await db.select().from(listingAnalysisAggregates)
      .where(eq(listingAnalysisAggregates.listingMlsNumber, mlsNumber));
    return result;
  }

  async getListingAggregatesBatch(mlsNumbers: string[]): Promise<ListingAnalysisAggregate[]> {
    if (mlsNumbers.length === 0) return [];
    return db.select().from(listingAnalysisAggregates)
      .where(inArray(listingAnalysisAggregates.listingMlsNumber, mlsNumbers));
  }

  async upsertListingAggregate(data: InsertListingAnalysisAggregate): Promise<ListingAnalysisAggregate> {
    const existing = await this.getListingAggregate(data.listingMlsNumber);
    if (existing) {
      const [result] = await db.update(listingAnalysisAggregates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(listingAnalysisAggregates.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(listingAnalysisAggregates).values(data).returning();
    return result;
  }

  async upsertMarketSnapshot(data: InsertMarketSnapshot): Promise<MarketSnapshot> {
    const [existing] = await db.select().from(marketSnapshots)
      .where(and(
        eq(marketSnapshots.city, data.city),
        eq(marketSnapshots.province, data.province),
        eq(marketSnapshots.month, data.month),
      ));
    if (existing) {
      const [result] = await db.update(marketSnapshots)
        .set(data)
        .where(eq(marketSnapshots.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(marketSnapshots).values(data).returning();
    return result;
  }

  async getMarketSnapshots(city?: string, province?: string): Promise<MarketSnapshot[]> {
    const conditions = [];
    if (city) conditions.push(eq(marketSnapshots.city, city));
    if (province) conditions.push(eq(marketSnapshots.province, province));
    return db.select().from(marketSnapshots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(marketSnapshots.month), asc(marketSnapshots.city));
  }

  async getLatestMarketSnapshots(): Promise<MarketSnapshot[]> {
    const [latest] = await db.select({ month: marketSnapshots.month })
      .from(marketSnapshots)
      .orderBy(desc(marketSnapshots.month))
      .limit(1);
    if (!latest) return [];
    return db.select().from(marketSnapshots)
      .where(eq(marketSnapshots.month, latest.month))
      .orderBy(desc(marketSnapshots.dealCount));
  }

  async getMarketSnapshotMonths(): Promise<string[]> {
    const results = await db.selectDistinct({ month: marketSnapshots.month })
      .from(marketSnapshots)
      .orderBy(desc(marketSnapshots.month));
    return results.map(r => r.month);
  }

  async insertDdfListingSnapshot(data: InsertDdfListingSnapshot): Promise<DdfListingSnapshot> {
    const [result] = await db.insert(ddfListingSnapshots).values(data).returning();
    return result;
  }

  async insertDdfListingSnapshotsBatch(data: InsertDdfListingSnapshot[]): Promise<number> {
    if (data.length === 0) return 0;
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(ddfListingSnapshots).values(batch).onConflictDoNothing();
      inserted += batch.length;
    }
    return inserted;
  }

  async getDdfSnapshotsByCity(city: string, month: string): Promise<DdfListingSnapshot[]> {
    return db.select().from(ddfListingSnapshots)
      .where(and(
        eq(ddfListingSnapshots.city, city),
        eq(ddfListingSnapshots.snapshotMonth, month),
      ));
  }

  async upsertCityYieldHistory(data: InsertCityYieldHistory): Promise<CityYieldHistory> {
    const [existing] = await db.select().from(cityYieldHistory)
      .where(and(
        eq(cityYieldHistory.city, data.city),
        eq(cityYieldHistory.province, data.province),
        eq(cityYieldHistory.month, data.month),
      ));
    if (existing) {
      const [result] = await db.update(cityYieldHistory)
        .set(data)
        .where(eq(cityYieldHistory.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(cityYieldHistory).values(data).returning();
    return result;
  }

  async getCityYieldHistory(city?: string, province?: string): Promise<CityYieldHistory[]> {
    const conditions = [];
    if (city) conditions.push(eq(cityYieldHistory.city, city));
    if (province) conditions.push(eq(cityYieldHistory.province, province));
    return db.select().from(cityYieldHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(cityYieldHistory.month), asc(cityYieldHistory.city));
  }

  async getAllCityYieldHistoryMonths(): Promise<string[]> {
    const results = await db.selectDistinct({ month: cityYieldHistory.month })
      .from(cityYieldHistory)
      .orderBy(desc(cityYieldHistory.month));
    return results.map(r => r.month);
  }

  async getMultiCityYieldHistory(cities: { city: string; province: string }[]): Promise<CityYieldHistory[]> {
    if (cities.length === 0) return [];
    const conditions = cities.map(c => and(
      eq(cityYieldHistory.city, c.city),
      eq(cityYieldHistory.province, c.province),
    ));
    const orCondition = sql`(${sql.join(conditions.map(c => sql`(${c})`), sql` OR `)})`;
    return db.select().from(cityYieldHistory)
      .where(orCondition)
      .orderBy(asc(cityYieldHistory.month), asc(cityYieldHistory.city));
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [result] = await db.insert(blogPosts).values(post).returning();
    return result;
  }

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const [result] = await db.update(blogPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return result;
  }

  async deleteBlogPost(id: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [result] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return result;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [result] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return result;
  }

  async getBlogPosts(opts?: { status?: string; category?: string; limit?: number }): Promise<BlogPost[]> {
    const conditions: any[] = [];
    if (opts?.status) conditions.push(eq(blogPosts.status, opts.status));
    if (opts?.category) conditions.push(eq(blogPosts.category, opts.category));
    let query = db.select().from(blogPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(blogPosts.publishedAt));
    if (opts?.limit) query = query.limit(opts.limit) as any;
    return query;
  }

  async createGuide(guide: InsertGuide): Promise<Guide> {
    const [result] = await db.insert(guides).values(guide).returning();
    return result;
  }

  async updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide | undefined> {
    const [result] = await db.update(guides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guides.id, id))
      .returning();
    return result;
  }

  async deleteGuide(id: string): Promise<void> {
    await db.delete(guides).where(eq(guides.id, id));
  }

  async getGuide(id: string): Promise<Guide | undefined> {
    const [result] = await db.select().from(guides).where(eq(guides.id, id));
    return result;
  }

  async getGuideBySlug(slug: string): Promise<Guide | undefined> {
    const [result] = await db.select().from(guides).where(eq(guides.slug, slug));
    return result;
  }

  async getGuides(opts?: { status?: string; category?: string }): Promise<Guide[]> {
    const conditions: any[] = [];
    if (opts?.status) conditions.push(eq(guides.status, opts.status));
    if (opts?.category) conditions.push(eq(guides.category, opts.category));
    return db.select().from(guides)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(guides.sortOrder), desc(guides.publishedAt));
  }
}

export const storage = new DatabaseStorage();
