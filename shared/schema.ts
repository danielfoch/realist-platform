import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, real, uniqueIndex, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (required for Replit Auth)
export * from "./models/auth";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  consent: boolean("consent").default(false),
  leadSource: text("lead_source").default("Deal Analyzer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadsRelations = relations(leads, ({ many }) => ({
  properties: many(properties),
  analyses: many(analyses),
  webhookLogs: many(webhookLogs),
}));

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  formattedAddress: text("formatted_address").notNull(),
  streetAddress: text("street_address"),
  city: text("city"),
  region: text("region"),
  country: text("country").notNull(),
  postalCode: text("postal_code"),
  lat: real("lat"),
  lng: real("lng"),
  placeId: text("place_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  lead: one(leads, {
    fields: [properties.leadId],
    references: [leads.id],
  }),
  analyses: many(analyses),
}));

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  propertyId: varchar("property_id").references(() => properties.id),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  countryMode: text("country_mode").notNull(),
  strategyType: text("strategy_type").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  rentInputs: jsonb("rent_inputs"),
  vacancyRate: real("vacancy_rate"),
  expenseAssumptions: jsonb("expense_assumptions"),
  inputsJson: jsonb("inputs_json").notNull(),
  resultsJson: jsonb("results_json"),
  shareToken: varchar("share_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysesRelations = relations(analyses, ({ one }) => ({
  lead: one(leads, {
    fields: [analyses.leadId],
    references: [leads.id],
  }),
  property: one(properties, {
    fields: [analyses.propertyId],
    references: [properties.id],
  }),
}));

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  endpoint: text("endpoint").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  status: text("status").notNull(),
  response: text("response"),
  attempts: integer("attempts").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  lead: one(leads, {
    fields: [webhookLogs.leadId],
    references: [leads.id],
  }),
}));

export const dataCache = pgTable("data_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  valueJson: jsonb("value_json").notNull(),
  source: text("source"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const savedDeals = pgTable("saved_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  countryMode: text("country_mode").notNull(),
  strategyType: text("strategy_type").notNull(),
  mlsNumber: text("mls_number"),
  inputsJson: jsonb("inputs_json").notNull(),
  resultsJson: jsonb("results_json").notNull(),
  shareWithCommunity: boolean("share_with_community").default(true).notNull(),
  sessionId: varchar("session_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedDealsRelations = relations(savedDeals, ({ one }) => ({
  user: one(users, {
    fields: [savedDeals.userId],
    references: [users.id],
  }),
}));

export const podcastQuestions = pgTable("podcast_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  question: text("question").notNull(),
  answered: boolean("answered").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coachingWaitlist = pgTable("coaching_waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  mainProblem: text("main_problem").notNull(),
  status: text("status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyManagers = pgTable("property_managers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  calendlyUrl: text("calendly_url"),
  province: text("province").notNull(),
  provinceCode: text("province_code").notNull(),
  city: text("city"),
  bio: text("bio"),
  isApproved: boolean("is_approved").default(false),
  isFeatured: boolean("is_featured").default(false),
  subscriptionTier: text("subscription_tier"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const propertyManagersRelations = relations(propertyManagers, ({ one }) => ({
  user: one(users, {
    fields: [propertyManagers.userId],
    references: [users.id],
  }),
}));

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  leadId: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
  leadId: true,
  propertyId: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDataCacheSchema = createInsertSchema(dataCache).omit({
  id: true,
  fetchedAt: true,
});

export const insertSavedDealSchema = createInsertSchema(savedDeals).omit({
  id: true,
  createdAt: true,
});

export const insertPodcastQuestionSchema = createInsertSchema(podcastQuestions).omit({
  id: true,
  createdAt: true,
  answered: true,
});

export const insertCoachingWaitlistSchema = createInsertSchema(coachingWaitlist).omit({
  id: true,
  createdAt: true,
  status: true,
  notes: true,
});

export const insertPropertyManagerSchema = createInsertSchema(propertyManagers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

export type InsertDataCache = z.infer<typeof insertDataCacheSchema>;
export type DataCache = typeof dataCache.$inferSelect;

export type InsertSavedDeal = z.infer<typeof insertSavedDealSchema>;
export type SavedDeal = typeof savedDeals.$inferSelect;

export type InsertPodcastQuestion = z.infer<typeof insertPodcastQuestionSchema>;
export type PodcastQuestion = typeof podcastQuestions.$inferSelect;

export type InsertPropertyManager = z.infer<typeof insertPropertyManagerSchema>;
export type PropertyManager = typeof propertyManagers.$inferSelect;

export type InsertCoachingWaitlist = z.infer<typeof insertCoachingWaitlistSchema>;
export type CoachingWaitlist = typeof coachingWaitlist.$inferSelect;

export const strategyTypes = [
  "buy_hold",
  "flip",
  "brrr",
  "airbnb",
  "land_assembly",
  "multiplex",
] as const;

export type StrategyType = (typeof strategyTypes)[number];

export const buyHoldInputsSchema = z.object({
  purchasePrice: z.number().min(0),
  closingCosts: z.number().min(0).default(0),
  downPaymentPercent: z.number().min(0).max(100).default(20),
  interestRate: z.number().min(0).max(100).default(5),
  amortizationYears: z.number().min(1).max(40).default(25),
  loanTermYears: z.number().min(1).max(40).default(5),
  monthlyRent: z.number().min(0),
  vacancyPercent: z.number().min(0).max(100).default(5),
  propertyTax: z.number().min(0).default(0),
  insurance: z.number().min(0).default(0),
  utilities: z.number().min(0).default(0),
  maintenancePercent: z.number().min(0).max(100).default(5),
  managementPercent: z.number().min(0).max(100).default(0),
  capexReservePercent: z.number().min(0).max(100).default(5),
  otherExpenses: z.number().min(0).default(0),
  rentGrowthPercent: z.number().default(0),
  expenseInflationPercent: z.number().default(2),
  appreciationPercent: z.number().default(2),
  holdingPeriodYears: z.number().min(1).max(50).default(10),
  sellingCostsPercent: z.number().min(0).max(20).default(5),
  isCmhcMliSelect: z.boolean().default(false),
  cmhcMliPoints: z.number().min(0).max(100).default(0),
});

export type BuyHoldInputs = z.infer<typeof buyHoldInputsSchema>;

export const analysisResultsSchema = z.object({
  capRate: z.number(),
  cashOnCash: z.number(),
  dscr: z.number(),
  irr: z.number().nullable(),
  monthlyNoi: z.number(),
  monthlyCashFlow: z.number(),
  annualNoi: z.number(),
  annualCashFlow: z.number(),
  totalCashInvested: z.number(),
  loanAmount: z.number(),
  monthlyMortgagePayment: z.number(),
  grossMonthlyIncome: z.number(),
  effectiveMonthlyIncome: z.number(),
  monthlyExpenses: z.number(),
  yearlyProjections: z.array(z.object({
    year: z.number(),
    grossRent: z.number(),
    vacancyLoss: z.number(),
    effectiveIncome: z.number(),
    expenses: z.object({
      propertyTax: z.number(),
      insurance: z.number(),
      utilities: z.number(),
      maintenance: z.number(),
      management: z.number(),
      capexReserve: z.number(),
      other: z.number(),
      total: z.number(),
    }),
    noi: z.number(),
    debtService: z.number(),
    cashFlow: z.number(),
    propertyValue: z.number(),
    loanBalance: z.number(),
    equity: z.number(),
    cumulativeCashFlow: z.number(),
    principalPaidThisYear: z.number(),
    cumulativePrincipalPaid: z.number(),
    capitalAppreciation: z.number(),
    totalReturn: z.number(),
  })),
  expenseBreakdown: z.object({
    propertyTax: z.number(),
    insurance: z.number(),
    utilities: z.number(),
    maintenance: z.number(),
    management: z.number(),
    capexReserve: z.number(),
    other: z.number(),
  }),
});

export type AnalysisResults = z.infer<typeof analysisResultsSchema>;

// ============================================
// INVESTOR PORTAL SCHEMAS
// ============================================

import { users } from "./models/auth";

export const investorProfiles = pgTable("investor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  phone: text("phone"),
  city: text("city"),
  province: text("province"),
  country: text("country").default("canada"),
  bio: text("bio"),
  investmentGoals: text("investment_goals"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const investorKyc = pgTable("investor_kyc", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  isAccreditedInvestor: boolean("is_accredited_investor").default(false),
  estimatedNetWorth: text("estimated_net_worth"),
  annualIncome: text("annual_income"),
  investmentExperience: text("investment_experience"),
  riskTolerance: text("risk_tolerance"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portfolioProperties = pgTable("portfolio_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  country: text("country").default("canada"),
  purchasePrice: real("purchase_price"),
  purchaseDate: timestamp("purchase_date"),
  currentValue: real("current_value"),
  monthlyRent: real("monthly_rent"),
  monthlyExpenses: real("monthly_expenses"),
  strategyType: text("strategy_type"),
  inputsJson: jsonb("inputs_json"),
  resultsJson: jsonb("results_json"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// INDUSTRY PARTNER PORTAL SCHEMAS
// ============================================

export const partnerTypes = ["realtor", "mortgage_broker", "lawyer", "accountant", "property_manager", "contractor", "appraiser", "inspector", "other"] as const;
export type PartnerType = (typeof partnerTypes)[number];

export const industryPartners = pgTable("industry_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  partnerType: text("partner_type").notNull(),
  companyName: text("company_name"),
  licenseNumber: text("license_number"),
  phone: text("phone"),
  publicEmail: text("public_email"),
  bio: text("bio"),
  headshotUrl: text("headshot_url"),
  serviceAreas: text("service_areas").array(),
  socialLinks: jsonb("social_links"),
  isApproved: boolean("is_approved").default(false),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const partnerLeads = pgTable("partner_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => industryPartners.id).notNull(),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  status: text("status").default("new"),
  notes: text("notes"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  contactedAt: timestamp("contacted_at"),
  closedAt: timestamp("closed_at"),
});

// Relations
export const investorProfilesRelations = relations(investorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [investorProfiles.userId],
    references: [users.id],
  }),
}));

export const investorKycRelations = relations(investorKyc, ({ one }) => ({
  user: one(users, {
    fields: [investorKyc.userId],
    references: [users.id],
  }),
}));

export const portfolioPropertiesRelations = relations(portfolioProperties, ({ one }) => ({
  user: one(users, {
    fields: [portfolioProperties.userId],
    references: [users.id],
  }),
}));

export const industryPartnersRelations = relations(industryPartners, ({ one, many }) => ({
  user: one(users, {
    fields: [industryPartners.userId],
    references: [users.id],
  }),
  partnerLeads: many(partnerLeads),
}));

export const partnerLeadsRelations = relations(partnerLeads, ({ one }) => ({
  partner: one(industryPartners, {
    fields: [partnerLeads.partnerId],
    references: [industryPartners.id],
  }),
  lead: one(leads, {
    fields: [partnerLeads.leadId],
    references: [leads.id],
  }),
}));

// Insert schemas
export const insertInvestorProfileSchema = createInsertSchema(investorProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvestorKycSchema = createInsertSchema(investorKyc).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioPropertySchema = createInsertSchema(portfolioProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIndustryPartnerSchema = createInsertSchema(industryPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isApproved: true,
});

export const insertPartnerLeadSchema = createInsertSchema(partnerLeads).omit({
  id: true,
  assignedAt: true,
});

export const realtorApplications = pgTable("realtor_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  brokerage: text("brokerage"),
  markets: text("markets").array(),
  assetTypes: text("asset_types").array(),
  dealTypes: text("deal_types").array(),
  avgDealSize: text("avg_deal_size"),
  referralFee: text("referral_fee"),
  referralAgreement: boolean("referral_agreement").default(false),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lenderApplications = pgTable("lender_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email").notNull(),
  phone: text("phone"),
  lendingTypes: text("lending_types").array(),
  targetMarkets: text("target_markets").array(),
  loanSizeMin: text("loan_size_min"),
  loanSizeMax: text("loan_size_max"),
  preferredDscr: text("preferred_dscr"),
  preferredLtv: text("preferred_ltv"),
  turnaroundTime: text("turnaround_time"),
  referralAgreement: boolean("referral_agreement").default(false),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dealMatchRequests = pgTable("deal_match_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  analysisId: varchar("analysis_id").references(() => analyses.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  matchTypes: text("match_types").array(),
  city: text("city"),
  province: text("province"),
  dealSummary: jsonb("deal_summary"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRealtorApplicationSchema = createInsertSchema(realtorApplications).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertLenderApplicationSchema = createInsertSchema(lenderApplications).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertDealMatchRequestSchema = createInsertSchema(dealMatchRequests).omit({
  id: true,
  status: true,
  createdAt: true,
});

// Types
export type InsertInvestorProfile = z.infer<typeof insertInvestorProfileSchema>;
export type InvestorProfile = typeof investorProfiles.$inferSelect;

export type InsertInvestorKyc = z.infer<typeof insertInvestorKycSchema>;
export type InvestorKyc = typeof investorKyc.$inferSelect;

export type InsertPortfolioProperty = z.infer<typeof insertPortfolioPropertySchema>;
export type PortfolioProperty = typeof portfolioProperties.$inferSelect;

export type InsertIndustryPartner = z.infer<typeof insertIndustryPartnerSchema>;
export type IndustryPartner = typeof industryPartners.$inferSelect;

export type InsertPartnerLead = z.infer<typeof insertPartnerLeadSchema>;
export type PartnerLead = typeof partnerLeads.$inferSelect;

// User role type for the extended user
export type UserRole = "investor" | "partner" | "admin";

// ============================================
// PROFESSIONAL SUBSCRIPTIONS & BILLING
// ============================================

export const subscriptionTiers = ["free", "premium"] as const;
export type SubscriptionTier = (typeof subscriptionTiers)[number];

export const premiumSources = ["stripe", "bra"] as const;
export type PremiumSource = (typeof premiumSources)[number];

export const professionalSubscriptions = pgTable("professional_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  tier: text("tier").default("free").notNull(),
  premiumSource: text("premium_source"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  monthlyPullLimit: integer("monthly_pull_limit").default(5),
  pullsUsedThisMonth: integer("pulls_used_this_month").default(0),
  periodStart: timestamp("period_start").defaultNow(),
  periodEnd: timestamp("period_end"),
  status: text("status").default("active"),
  braSignedAt: timestamp("bra_signed_at"),
  braExpiresAt: timestamp("bra_expires_at"),
  braSignatureDataUrl: text("bra_signature_data_url"),
  braSignedName: text("bra_signed_name"),
  brokerageName: text("brokerage_name"),
  brokerageCity: text("brokerage_city"),
  brokerageProvince: text("brokerage_province"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const brandingAssets = pgTable("branding_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  logoUrl: text("logo_url"),
  companyName: text("company_name"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  disclaimerText: text("disclaimer_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketExpertApplications = pgTable("market_expert_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  marketRegion: text("market_region").notNull(),
  marketCity: text("market_city"),
  packageType: text("package_type").default("featured_expert"),
  includeMeetupHost: boolean("include_meetup_host").default(false),
  monthlyFee: real("monthly_fee").default(1000),
  referralFeePercent: real("referral_fee_percent").default(20),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("pending"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformAnalytics = pgTable("platform_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  region: text("region"),
  city: text("city"),
  analysisCount: integer("analysis_count").default(0),
  uniqueUsers: integer("unique_users").default(0),
  leadsCaptured: integer("leads_captured").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations for new tables
export const professionalSubscriptionsRelations = relations(professionalSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [professionalSubscriptions.userId],
    references: [users.id],
  }),
}));

export const brandingAssetsRelations = relations(brandingAssets, ({ one }) => ({
  user: one(users, {
    fields: [brandingAssets.userId],
    references: [users.id],
  }),
}));

export const marketExpertApplicationsRelations = relations(marketExpertApplications, ({ one }) => ({
  user: one(users, {
    fields: [marketExpertApplications.userId],
    references: [users.id],
  }),
}));

// Insert schemas for new tables
export const insertProfessionalSubscriptionSchema = createInsertSchema(professionalSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrandingAssetsSchema = createInsertSchema(brandingAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketExpertApplicationSchema = createInsertSchema(marketExpertApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export const insertVerificationTokenSchema = createInsertSchema(verificationTokens).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
});

// Types for new tables
export type InsertProfessionalSubscription = z.infer<typeof insertProfessionalSubscriptionSchema>;
export type ProfessionalSubscription = typeof professionalSubscriptions.$inferSelect;

export type InsertBrandingAssets = z.infer<typeof insertBrandingAssetsSchema>;
export type BrandingAssets = typeof brandingAssets.$inferSelect;

export type InsertMarketExpertApplication = z.infer<typeof insertMarketExpertApplicationSchema>;
export type MarketExpertApplication = typeof marketExpertApplications.$inferSelect;

// ============================================
// A/B/C EXPERIMENT ASSIGNMENTS
// ============================================

export const experimentVariants = ["A", "B", "C"] as const;
export type ExperimentVariant = (typeof experimentVariants)[number];

export const experimentAssignments = pgTable("experiment_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: varchar("visitor_id").notNull(),
  userId: varchar("user_id"),
  experimentKey: text("experiment_key").notNull(),
  variant: text("variant").notNull(),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExperimentAssignmentSchema = createInsertSchema(experimentAssignments).omit({
  id: true,
  createdAt: true,
});

export type InsertExperimentAssignment = z.infer<typeof insertExperimentAssignmentSchema>;
export type ExperimentAssignment = typeof experimentAssignments.$inferSelect;

export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;
export type VerificationToken = typeof verificationTokens.$inferSelect;

export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;

// ============================================
// GOOGLE OAUTH TOKENS (For user-owned exports)
// ============================================

export const googleOAuthTokens = pgTable("google_oauth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  googleEmail: text("google_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const googleOAuthTokensRelations = relations(googleOAuthTokens, ({ one }) => ({
  user: one(users, {
    fields: [googleOAuthTokens.userId],
    references: [users.id],
  }),
}));

export const insertGoogleOAuthTokenSchema = createInsertSchema(googleOAuthTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGoogleOAuthToken = z.infer<typeof insertGoogleOAuthTokenSchema>;
export type GoogleOAuthToken = typeof googleOAuthTokens.$inferSelect;

// ============================================
// RENOQUOTE CALCULATOR SCHEMA
// ============================================

export const renoQuotePersonas = ["homeowner", "investor", "multiplex"] as const;
export type RenoQuotePersona = (typeof renoQuotePersonas)[number];

export const renoQuotePropertyTypes = [
  "condo", "detached", "semi", "townhouse", "duplex", "triplex", "fourplex", "multifamily"
] as const;
export type RenoQuotePropertyType = (typeof renoQuotePropertyTypes)[number];

export const renoQuoteProjectIntents = [
  "cosmetic", "moderate", "full_gut", "add_unit", "legalize_unit", 
  "add_bathroom", "add_kitchen", "underpinning", "extension"
] as const;
export type RenoQuoteProjectIntent = (typeof renoQuoteProjectIntents)[number];

export const renoQuoteQualityLevels = ["basic", "mid", "high"] as const;
export type RenoQuoteQualityLevel = (typeof renoQuoteQualityLevels)[number];

export const renoQuoteComplexityLevels = ["easy", "standard", "complex"] as const;
export type RenoQuoteComplexityLevel = (typeof renoQuoteComplexityLevels)[number];

export const renoQuoteLineItemSchema = z.object({
  id: z.string(),
  itemType: z.string(),
  label: z.string(),
  quantity: z.number().min(0),
  unit: z.enum(["sqft", "linear_ft", "each", "room"]),
  qualityLevel: z.enum(renoQuoteQualityLevels),
  complexity: z.enum(renoQuoteComplexityLevels),
  isDiy: z.boolean().default(false),
  baseUnitCost: z.number().optional(),
});

export type RenoQuoteLineItem = z.infer<typeof renoQuoteLineItemSchema>;

export const renoQuoteAssumptionsSchema = z.object({
  contingencyPercent: z.number().min(0).max(50).default(15),
  overheadProfitPercent: z.number().min(0).max(50).default(15),
  laborMaterialSplit: z.object({
    labor: z.number().default(55),
    material: z.number().default(45),
  }),
  isRushTimeline: z.boolean().default(false),
  regionalMultiplier: z.number().default(1),
});

export type RenoQuoteAssumptions = z.infer<typeof renoQuoteAssumptionsSchema>;

export const renoQuotePricingResultSchema = z.object({
  totalLow: z.number(),
  totalBase: z.number(),
  totalHigh: z.number(),
  costPerSqft: z.object({
    low: z.number().nullable(),
    base: z.number().nullable(),
    high: z.number().nullable(),
  }),
  timelineWeeks: z.object({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  lineItemBreakdown: z.array(z.object({
    id: z.string(),
    label: z.string(),
    quantity: z.number(),
    unit: z.string(),
    unitCostLow: z.number(),
    unitCostBase: z.number(),
    unitCostHigh: z.number(),
    subtotalLow: z.number(),
    subtotalBase: z.number(),
    subtotalHigh: z.number(),
  })),
  contingencyAmount: z.object({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  overheadAmount: z.object({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  topCostDrivers: z.array(z.object({
    label: z.string(),
    percentage: z.number(),
    amount: z.number(),
  })),
});

export type RenoQuotePricingResult = z.infer<typeof renoQuotePricingResultSchema>;

export const renoQuotes = pgTable("reno_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  
  persona: text("persona").notNull(),
  
  address: text("address"),
  city: text("city"),
  region: text("region"),
  country: text("country").default("canada"),
  postalCode: text("postal_code"),
  
  propertyType: text("property_type"),
  existingSqft: real("existing_sqft"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  basementType: text("basement_type"),
  basementHeight: real("basement_height"),
  projectIntents: text("project_intents").array(),
  
  lineItemsJson: jsonb("line_items_json").notNull(),
  assumptionsJson: jsonb("assumptions_json").notNull(),
  pricingResultJson: jsonb("pricing_result_json"),
  
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  leadPhone: text("lead_phone"),
  leadConsent: boolean("lead_consent").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const renoQuotesRelations = relations(renoQuotes, ({ one }) => ({
  lead: one(leads, {
    fields: [renoQuotes.leadId],
    references: [leads.id],
  }),
}));

export const insertRenoQuoteSchema = createInsertSchema(renoQuotes).omit({
  id: true,
  createdAt: true,
});

export type InsertRenoQuote = z.infer<typeof insertRenoQuoteSchema>;
export type RenoQuote = typeof renoQuotes.$inferSelect;

// ============================================
// BUYBOX MANDATE SYSTEM
// ============================================

export const buyBoxMandateStatuses = [
  "new",
  "contacted", 
  "showing_searching",
  "offer_submitted",
  "under_contract",
  "closed",
  "not_proceeding"
] as const;
export type BuyBoxMandateStatus = (typeof buyBoxMandateStatuses)[number];

export const buyBoxBuildingTypes = [
  "detached",
  "semi",
  "townhouse", 
  "condo",
  "multiplex",
  "land",
  "commercial",
  "other"
] as const;
export type BuyBoxBuildingType = (typeof buyBoxBuildingTypes)[number];

export const buyBoxOccupancyTypes = [
  "vacant",
  "tenanted",
  "owner_occupied"
] as const;
export type BuyBoxOccupancyType = (typeof buyBoxOccupancyTypes)[number];

// BuyBox Agreement (e-signed buyer representation)
export const buyBoxAgreements = pgTable("buybox_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agreementVersion: varchar("agreement_version").notNull().default("1.0"),
  agreementHtml: text("agreement_html").notNull(),
  signedName: text("signed_name").notNull(),
  signatureDataUrl: text("signature_data_url").notNull(),
  termStartDate: timestamp("term_start_date").notNull(),
  termEndDate: timestamp("term_end_date").notNull(),
  holdoverDays: integer("holdover_days").default(60),
  commissionPercent: real("commission_percent").default(2.5),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at").notNull(),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buyBoxAgreementsRelations = relations(buyBoxAgreements, ({ one, many }) => ({
  user: one(users, {
    fields: [buyBoxAgreements.userId],
    references: [users.id],
  }),
  mandates: many(buyBoxMandates),
}));

// BuyBox Mandate (the property search criteria)
export const buyBoxMandates = pgTable("buybox_mandates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agreementId: varchar("agreement_id").references(() => buyBoxAgreements.id).notNull(),
  status: text("status").default("new").notNull(),
  
  // Polygon data
  polygonGeoJson: jsonb("polygon_geo_json").notNull(),
  centroidLat: real("centroid_lat"),
  centroidLng: real("centroid_lng"),
  areaName: text("area_name"),
  
  // Optional mandate details
  targetPrice: integer("target_price"),
  maxPrice: integer("max_price"),
  lotFrontage: real("lot_frontage"),
  lotFrontageUnit: text("lot_frontage_unit").default("ft"),
  lotDepth: real("lot_depth"),
  lotDepthUnit: text("lot_depth_unit").default("ft"),
  totalLotArea: real("total_lot_area"),
  totalLotAreaUnit: text("total_lot_area_unit").default("sqft"),
  zoningPlanningStatus: text("zoning_planning_status"),
  buildingType: text("building_type"),
  occupancy: text("occupancy"),
  targetClosingDate: timestamp("target_closing_date"),
  possessionDate: timestamp("possession_date"),
  offerConditions: text("offer_conditions").array(),
  additionalNotes: text("additional_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const buyBoxMandatesRelations = relations(buyBoxMandates, ({ one, many }) => ({
  user: one(users, {
    fields: [buyBoxMandates.userId],
    references: [users.id],
  }),
  agreement: one(buyBoxAgreements, {
    fields: [buyBoxMandates.agreementId],
    references: [buyBoxAgreements.id],
  }),
  responses: many(buyBoxResponses),
}));

// Realtor responses to mandates
export const buyBoxResponses = pgTable("buybox_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mandateId: varchar("mandate_id").references(() => buyBoxMandates.id).notNull(),
  realtorId: varchar("realtor_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  propertyAddress: text("property_address"),
  propertyLink: text("property_link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buyBoxResponsesRelations = relations(buyBoxResponses, ({ one }) => ({
  mandate: one(buyBoxMandates, {
    fields: [buyBoxResponses.mandateId],
    references: [buyBoxMandates.id],
  }),
  realtor: one(users, {
    fields: [buyBoxResponses.realtorId],
    references: [users.id],
  }),
}));

// BuyBox notifications
export const buyBoxNotifications = pgTable("buybox_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  mandateId: varchar("mandate_id").references(() => buyBoxMandates.id),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buyBoxNotificationsRelations = relations(buyBoxNotifications, ({ one }) => ({
  user: one(users, {
    fields: [buyBoxNotifications.userId],
    references: [users.id],
  }),
  mandate: one(buyBoxMandates, {
    fields: [buyBoxNotifications.mandateId],
    references: [buyBoxMandates.id],
  }),
}));

// Admin config for BuyBox defaults
export const buyBoxConfig = pgTable("buybox_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertBuyBoxAgreementSchema = createInsertSchema(buyBoxAgreements).omit({
  id: true,
  createdAt: true,
});

export const insertBuyBoxMandateSchema = createInsertSchema(buyBoxMandates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuyBoxResponseSchema = createInsertSchema(buyBoxResponses).omit({
  id: true,
  createdAt: true,
});

export const insertBuyBoxNotificationSchema = createInsertSchema(buyBoxNotifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertBuyBoxAgreement = z.infer<typeof insertBuyBoxAgreementSchema>;
export type BuyBoxAgreement = typeof buyBoxAgreements.$inferSelect;

export type InsertBuyBoxMandate = z.infer<typeof insertBuyBoxMandateSchema>;
export type BuyBoxMandate = typeof buyBoxMandates.$inferSelect;

export type InsertBuyBoxResponse = z.infer<typeof insertBuyBoxResponseSchema>;
export type BuyBoxResponse = typeof buyBoxResponses.$inferSelect;

export type InsertBuyBoxNotification = z.infer<typeof insertBuyBoxNotificationSchema>;
export type BuyBoxNotification = typeof buyBoxNotifications.$inferSelect;

// Validation schemas for BuyBox forms
export const buyBoxMandateFormSchema = z.object({
  polygonGeoJson: z.any(),
  areaName: z.string().optional(),
  targetPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  lotFrontage: z.number().min(0).optional(),
  lotFrontageUnit: z.enum(["ft", "m"]).default("ft"),
  lotDepth: z.number().min(0).optional(),
  lotDepthUnit: z.enum(["ft", "m"]).default("ft"),
  totalLotArea: z.number().min(0).optional(),
  totalLotAreaUnit: z.enum(["sqft", "sqm", "acres"]).default("sqft"),
  zoningPlanningStatus: z.string().optional(),
  buildingType: z.enum(buyBoxBuildingTypes).optional(),
  occupancy: z.enum(buyBoxOccupancyTypes).optional(),
  targetClosingDate: z.string().optional(),
  possessionDate: z.string().optional(),
  offerConditions: z.array(z.string()).optional(),
  additionalNotes: z.string().optional(),
});

export type BuyBoxMandateFormData = z.infer<typeof buyBoxMandateFormSchema>;

export const buyBoxAgreementFormSchema = z.object({
  termEndDate: z.string(),
  holdoverDays: z.number().min(0).max(180).default(60),
  commissionPercent: z.number().min(0).max(10).default(2.5),
  signedName: z.string().min(1, "Legal name is required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  agreedToTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

export type BuyBoxAgreementFormData = z.infer<typeof buyBoxAgreementFormSchema>;

// ============================================
// CO-INVESTING SCHEMAS
// ============================================

export const coInvestSkillsList = [
  "contractor",
  "property_manager", 
  "realtor",
  "mortgage_broker",
  "accountant",
  "designer",
  "project_manager",
  "analyst",
  "legal",
  "insurance",
  "handyman",
  "marketing",
  "other"
] as const;

export type CoInvestSkill = (typeof coInvestSkillsList)[number];

export const coInvestInvestorTypes = ["owner_occupier", "investor", "builder", "agent", "other"] as const;
export const coInvestTimeHorizons = ["0_3m", "3_6m", "6_12m", "12m_plus"] as const;
export const coInvestRiskTolerances = ["low", "medium", "high"] as const;
export const coInvestContactPreferences = ["in_app", "email"] as const;

export const coInvestGroupStatuses = ["forming", "under_contract", "closed", "paused"] as const;
export const coInvestOwnershipStructures = ["tic", "joint_tenancy"] as const;
export const coInvestJurisdictions = ["ON", "BC", "AB", "QC", "NS", "NB", "MB", "SK", "PE", "NL", "YT", "NT", "NU", "US", "other"] as const;
export const coInvestPropertyTypes = ["single_family", "condo", "duplex", "triplex", "fourplex", "small_multifamily_5_19", "20_plus", "land_development", "mixed_use", "other"] as const;
export const coInvestStrategies = ["buy_hold", "brrr", "flip", "airbnb", "student", "other"] as const;
export const coInvestVisibilities = ["public", "members_only", "unlisted"] as const;
export const coInvestMembershipStatuses = ["requested", "approved", "rejected", "left"] as const;
export const coInvestMemberRoles = ["owner", "member"] as const;
export const coInvestChecklistTiers = ["simple_coownership", "borderline", "likely_complex"] as const;

// BRA (Buyer Representation Agreement) status types
export const braStatusTypes = ["not_started", "pending", "signed", "declined"] as const;
export const coinvestAckStatusTypes = ["not_started", "signed"] as const;
export const complianceEventTypes = ["gate_shown", "bra_started", "bra_signed", "ack_signed", "access_denied", "jurisdiction_changed"] as const;

// Extended user profile for co-investing
export const coInvestUserProfiles = pgTable("coinvest_user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  displayName: text("display_name"),
  location: text("location"),
  city: text("city"),
  region: text("region"),
  country: text("country").default("canada"),
  investorType: text("investor_type"),
  skills: text("skills").array(),
  certifications: text("certifications").array(),
  capitalMinCad: real("capital_min_cad"),
  capitalMaxCad: real("capital_max_cad"),
  timeHorizon: text("time_horizon"),
  riskTolerance: text("risk_tolerance"),
  contactPreference: text("contact_preference").default("in_app"),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at"),
  
  // BRA (Buyer Representation Agreement) fields for Ontario
  braStatus: text("bra_status").default("not_started"),
  braSignedAt: timestamp("bra_signed_at"),
  braDocumentId: varchar("bra_document_id"),
  braJurisdiction: varchar("bra_jurisdiction"),
  
  // Co-Invest Acknowledgement fields
  coinvestAckStatus: text("coinvest_ack_status").default("not_started"),
  coinvestAckSignedAt: timestamp("coinvest_ack_signed_at"),
  coinvestAckVersion: varchar("coinvest_ack_version"),
  coinvestAckSignedName: text("coinvest_ack_signed_name"),
  coinvestAckSignatureDataUrl: text("coinvest_ack_signature_data_url"),
  
  // Representation details
  representationBrokerage: text("representation_brokerage").default("Valery Real Estate Inc."),
  representationAgent: text("representation_agent").default("Daniel Foch"),
  
  // User's selected jurisdiction (for gating)
  selectedJurisdiction: varchar("selected_jurisdiction"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Compliance audit log for Co-Investing
export const coInvestComplianceLogs = pgTable("coinvest_compliance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coInvestComplianceLogsRelations = relations(coInvestComplianceLogs, ({ one }) => ({
  user: one(users, {
    fields: [coInvestComplianceLogs.userId],
    references: [users.id],
  }),
}));

// Co-invest groups (opportunities)
export const coInvestGroups = pgTable("coinvest_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("forming").notNull(),
  ownershipStructure: text("ownership_structure").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  propertyAddress: text("property_address"),
  propertyCity: text("property_city"),
  propertyRegion: text("property_region"),
  propertyCountry: text("property_country").default("canada"),
  propertyType: text("property_type"),
  unitsCount: integer("units_count"),
  targetStrategy: text("target_strategy"),
  targetCloseDate: timestamp("target_close_date"),
  capitalTargetCad: real("capital_target_cad"),
  minCommitmentCad: real("min_commitment_cad"),
  targetGroupSize: integer("target_group_size"),
  skillsNeeded: text("skills_needed").array(),
  visibility: text("visibility").default("public").notNull(),
  requiresAccredited: boolean("requires_accredited").default(false),
  checklistResultId: varchar("checklist_result_id"),
  analysisId: varchar("analysis_id").references(() => analyses.id),
  analysisSnapshot: jsonb("analysis_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Group memberships
export const coInvestMemberships = pgTable("coinvest_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => coInvestGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").default("member").notNull(),
  pledgedCapitalCad: real("pledged_capital_cad"),
  skillsOffered: text("skills_offered").array(),
  note: text("note"),
  status: text("status").default("requested").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Checklist results (complexity scoring)
export const coInvestChecklistResults = pgTable("coinvest_checklist_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => coInvestGroups.id),
  userId: varchar("user_id").references(() => users.id),
  inputs: jsonb("inputs").notNull(),
  score: integer("score").notNull(),
  tier: text("tier").notNull(),
  flags: text("flags").array(),
  recommendations: text("recommendations").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group messages (chat-lite)
export const coInvestMessages = pgTable("coinvest_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => coInvestGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const coInvestUserProfilesRelations = relations(coInvestUserProfiles, ({ one }) => ({
  user: one(users, {
    fields: [coInvestUserProfiles.userId],
    references: [users.id],
  }),
}));

export const coInvestGroupsRelations = relations(coInvestGroups, ({ one, many }) => ({
  owner: one(users, {
    fields: [coInvestGroups.ownerUserId],
    references: [users.id],
  }),
  analysis: one(analyses, {
    fields: [coInvestGroups.analysisId],
    references: [analyses.id],
  }),
  memberships: many(coInvestMemberships),
  messages: many(coInvestMessages),
  checklistResult: one(coInvestChecklistResults, {
    fields: [coInvestGroups.checklistResultId],
    references: [coInvestChecklistResults.id],
  }),
}));

export const coInvestMembershipsRelations = relations(coInvestMemberships, ({ one }) => ({
  group: one(coInvestGroups, {
    fields: [coInvestMemberships.groupId],
    references: [coInvestGroups.id],
  }),
  user: one(users, {
    fields: [coInvestMemberships.userId],
    references: [users.id],
  }),
}));

export const coInvestChecklistResultsRelations = relations(coInvestChecklistResults, ({ one }) => ({
  group: one(coInvestGroups, {
    fields: [coInvestChecklistResults.groupId],
    references: [coInvestGroups.id],
  }),
  user: one(users, {
    fields: [coInvestChecklistResults.userId],
    references: [users.id],
  }),
}));

export const coInvestMessagesRelations = relations(coInvestMessages, ({ one }) => ({
  group: one(coInvestGroups, {
    fields: [coInvestMessages.groupId],
    references: [coInvestGroups.id],
  }),
  user: one(users, {
    fields: [coInvestMessages.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCoInvestUserProfileSchema = createInsertSchema(coInvestUserProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoInvestGroupSchema = createInsertSchema(coInvestGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoInvestMembershipSchema = createInsertSchema(coInvestMemberships).omit({
  id: true,
  createdAt: true,
});

export const insertCoInvestChecklistResultSchema = createInsertSchema(coInvestChecklistResults).omit({
  id: true,
  createdAt: true,
});

export const insertCoInvestMessageSchema = createInsertSchema(coInvestMessages).omit({
  id: true,
  createdAt: true,
});

export const insertCoInvestComplianceLogSchema = createInsertSchema(coInvestComplianceLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertCoInvestUserProfile = z.infer<typeof insertCoInvestUserProfileSchema>;
export type CoInvestUserProfile = typeof coInvestUserProfiles.$inferSelect;

export type InsertCoInvestComplianceLog = z.infer<typeof insertCoInvestComplianceLogSchema>;
export type CoInvestComplianceLog = typeof coInvestComplianceLogs.$inferSelect;

export type BraStatus = (typeof braStatusTypes)[number];
export type CoinvestAckStatus = (typeof coinvestAckStatusTypes)[number];
export type ComplianceEventType = (typeof complianceEventTypes)[number];

export type InsertCoInvestGroup = z.infer<typeof insertCoInvestGroupSchema>;
export type CoInvestGroup = typeof coInvestGroups.$inferSelect;

export type InsertCoInvestMembership = z.infer<typeof insertCoInvestMembershipSchema>;
export type CoInvestMembership = typeof coInvestMemberships.$inferSelect;

export type InsertCoInvestChecklistResult = z.infer<typeof insertCoInvestChecklistResultSchema>;
export type CoInvestChecklistResult = typeof coInvestChecklistResults.$inferSelect;

export type InsertCoInvestMessage = z.infer<typeof insertCoInvestMessageSchema>;
export type CoInvestMessage = typeof coInvestMessages.$inferSelect;

// Checklist input validation
export const coInvestChecklistInputSchema = z.object({
  numberOfProperties: z.number().min(1).default(1),
  propertyType: z.string().optional(),
  unitsCount: z.number().min(0).default(0),
  groupSize: z.number().min(1).default(2),
  marketingToPublic: z.boolean().default(false),
  passiveInvestors: z.boolean().default(false),
  profitSharingPromised: z.boolean().default(false),
  managerCentralized: z.boolean().default(false),
  multiplePropertiesOrPortfolioPlan: z.boolean().default(false),
  relianceOnSponsorEfforts: z.boolean().default(false),
  sophisticatedStructure: z.boolean().default(false),
  renovationDevelopmentIntensity: z.enum(["light", "moderate", "heavy"]).default("light"),
});

export type CoInvestChecklistInput = z.infer<typeof coInvestChecklistInputSchema>;

// Group creation wizard form schema
export const coInvestGroupFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  ownershipStructure: z.enum(["tic", "joint_tenancy"]),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  visibility: z.enum(["public", "members_only", "unlisted"]).default("public"),
  propertyAddress: z.string().optional(),
  propertyCity: z.string().optional(),
  propertyRegion: z.string().optional(),
  propertyCountry: z.string().default("canada"),
  propertyType: z.string().optional(),
  unitsCount: z.number().min(0).optional(),
  targetStrategy: z.string().optional(),
  targetCloseDate: z.string().optional(),
  capitalTargetCad: z.number().min(0).optional(),
  minCommitmentCad: z.number().min(0).optional(),
  targetGroupSize: z.number().min(2).max(50).optional(),
  skillsNeeded: z.array(z.string()).optional(),
  requiresAccredited: z.boolean().default(false),
});

export type CoInvestGroupFormData = z.infer<typeof coInvestGroupFormSchema>;

// True Cost of Homeownership tables
export const trueCostInquiries = pgTable("true_cost_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  homeValue: integer("home_value").notNull(),
  city: text("city").notNull(),
  homeType: text("home_type").notNull(),
  buyerType: text("buyer_type").notNull(),
  isNewConstruction: boolean("is_new_construction").default(false),
  squareFootage: integer("square_footage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trueCostInquiriesRelations = relations(trueCostInquiries, ({ one }) => ({
  user: one(users, {
    fields: [trueCostInquiries.userId],
    references: [users.id],
  }),
}));

export const trueCostBreakdowns = pgTable("true_cost_breakdowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inquiryId: varchar("inquiry_id").references(() => trueCostInquiries.id).notNull(),
  breakdownJson: jsonb("breakdown_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trueCostBreakdownsRelations = relations(trueCostBreakdowns, ({ one }) => ({
  inquiry: one(trueCostInquiries, {
    fields: [trueCostBreakdowns.inquiryId],
    references: [trueCostInquiries.id],
  }),
}));

export const insertTrueCostInquirySchema = createInsertSchema(trueCostInquiries).omit({
  id: true,
  createdAt: true,
});

export type InsertTrueCostInquiry = z.infer<typeof insertTrueCostInquirySchema>;
export type TrueCostInquiry = typeof trueCostInquiries.$inferSelect;
export type TrueCostBreakdown = typeof trueCostBreakdowns.$inferSelect;

// Will It Plex - Capstone Projects
export const capstoneProjects = pgTable("capstone_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title"),
  strategy: text("strategy"), // "buy_and_hold" or "multiplex"
  currentStep: integer("current_step").default(1),
  status: text("status").default("draft"), // "draft", "in_progress", "completed"
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const capstoneProjectsRelations = relations(capstoneProjects, ({ one, many }) => ({
  user: one(users, {
    fields: [capstoneProjects.userId],
    references: [users.id],
  }),
  property: one(capstoneProperties),
  costModel: one(capstoneCostModels),
  proforma: one(capstoneProformas),
}));

export const capstoneProperties = pgTable("capstone_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => capstoneProjects.id).notNull(),
  sourceUrl: text("source_url"),
  listingId: text("listing_id"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  price: integer("price"),
  annualTaxes: integer("annual_taxes"),
  lotFrontage: real("lot_frontage"),
  lotDepth: real("lot_depth"),
  lotArea: real("lot_area"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  squareFootage: integer("square_footage"),
  propertyType: text("property_type"),
  buildingType: text("building_type"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const capstonePropertiesRelations = relations(capstoneProperties, ({ one }) => ({
  project: one(capstoneProjects, {
    fields: [capstoneProperties.projectId],
    references: [capstoneProjects.id],
  }),
}));

export const capstoneCostModels = pgTable("capstone_cost_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => capstoneProjects.id).notNull(),
  // Buy & Hold inputs
  monthlyRent: integer("monthly_rent"),
  downPaymentPercent: real("down_payment_percent"),
  interestRate: real("interest_rate"),
  amortizationYears: integer("amortization_years"),
  // Multiplex inputs
  zoningCode: text("zoning_code"),
  lotCoverageRatio: real("lot_coverage_ratio"),
  maxStories: integer("max_stories"),
  maxUnits: integer("max_units"),
  hasGardenSuite: boolean("has_garden_suite").default(false),
  constructionCostPerSqft: integer("construction_cost_per_sqft"),
  // MLI Select points
  mliAccessibilityPoints: integer("mli_accessibility_points").default(0),
  mliAffordabilityPoints: integer("mli_affordability_points").default(0),
  mliEnergyPoints: integer("mli_energy_points").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const capstoneCostModelsRelations = relations(capstoneCostModels, ({ one }) => ({
  project: one(capstoneProjects, {
    fields: [capstoneCostModels.projectId],
    references: [capstoneProjects.id],
  }),
}));

export const capstoneProformas = pgTable("capstone_proformas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => capstoneProjects.id).notNull(),
  // Calculated metrics
  buildableGfa: real("buildable_gfa"),
  totalConstructionCost: integer("total_construction_cost"),
  totalProjectCost: integer("total_project_cost"),
  noi: integer("noi"),
  dscr: real("dscr"),
  capRate: real("cap_rate"),
  cashOnCashReturn: real("cash_on_cash_return"),
  yieldOnCost: real("yield_on_cost"),
  // Full results JSON
  resultsJson: jsonb("results_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const capstoneProformasRelations = relations(capstoneProformas, ({ one }) => ({
  project: one(capstoneProjects, {
    fields: [capstoneProformas.projectId],
    references: [capstoneProjects.id],
  }),
}));

// Insert schemas
export const insertCapstoneProjectSchema = createInsertSchema(capstoneProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCapstonePropertySchema = createInsertSchema(capstoneProperties).omit({
  id: true,
  createdAt: true,
});

export const insertCapstoneCostModelSchema = createInsertSchema(capstoneCostModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCapstoneProformaSchema = createInsertSchema(capstoneProformas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertCapstoneProject = z.infer<typeof insertCapstoneProjectSchema>;
export type CapstoneProject = typeof capstoneProjects.$inferSelect;
export type InsertCapstoneProperty = z.infer<typeof insertCapstonePropertySchema>;
export type CapstoneProperty = typeof capstoneProperties.$inferSelect;
export type InsertCapstoneCostModel = z.infer<typeof insertCapstoneCostModelSchema>;
export type CapstoneCostModel = typeof capstoneCostModels.$inferSelect;
export type InsertCapstoneProforma = z.infer<typeof insertCapstoneProformaSchema>;
export type CapstoneProforma = typeof capstoneProformas.$inferSelect;

// ============================================
// Rent Pulse — aggregated median rents per city
// ============================================
export const rentPulse = pgTable("rent_pulse", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  province: text("province").notNull(),
  bedrooms: text("bedrooms").notNull(),
  medianRent: integer("median_rent").notNull(),
  averageRent: integer("average_rent"),
  sampleSize: integer("sample_size").notNull(),
  minRent: integer("min_rent"),
  maxRent: integer("max_rent"),
  scrapedAt: timestamp("scraped_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// Rent Listings — individual scraped listings
// ============================================
export const rentListings = pgTable("rent_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id"),
  city: text("city").notNull(),
  province: text("province").notNull(),
  address: text("address"),
  bedrooms: text("bedrooms").notNull(),
  bathrooms: text("bathrooms"),
  rent: integer("rent").notNull(),
  squareFootage: integer("square_footage"),
  lat: real("lat"),
  lng: real("lng"),
  sourceUrl: text("source_url"),
  sourcePlatform: text("source_platform"),
  listingDate: timestamp("listing_date"),
  scrapedAt: timestamp("scraped_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRentPulseSchema = createInsertSchema(rentPulse).omit({
  id: true,
  createdAt: true,
});

export const insertRentListingSchema = createInsertSchema(rentListings).omit({
  id: true,
  createdAt: true,
});

export type InsertRentPulse = z.infer<typeof insertRentPulseSchema>;
export type RentPulse = typeof rentPulse.$inferSelect;
export type InsertRentListing = z.infer<typeof insertRentListingSchema>;
export type RentListing = typeof rentListings.$inferSelect;

// ============================================
// REALTOR PARTNER NETWORK
// ============================================

export const realtorMarketClaims = pgTable("realtor_market_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  partnerId: varchar("partner_id").references(() => industryPartners.id),
  marketCity: text("market_city").notNull(),
  marketRegion: text("market_region").notNull(),
  status: text("status").default("active").notNull(),
  referralFeePercent: real("referral_fee_percent").default(25).notNull(),
  referralAgreementSignedAt: timestamp("referral_agreement_signed_at"),
  referralAgreementSignature: text("referral_agreement_signature"),
  referralAgreementSignedName: text("referral_agreement_signed_name"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  monthlyFee: real("monthly_fee").default(49.99),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const realtorLeadNotifications = pgTable("realtor_lead_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  realtorClaimId: varchar("realtor_claim_id").references(() => realtorMarketClaims.id).notNull(),
  realtorUserId: varchar("realtor_user_id").references(() => users.id).notNull(),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  analysisId: varchar("analysis_id").references(() => analyses.id),
  dealAddress: text("deal_address"),
  dealCity: text("deal_city"),
  dealRegion: text("deal_region"),
  dealStrategy: text("deal_strategy"),
  status: text("status").default("new").notNull(),
  notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  viewedAt: timestamp("viewed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const realtorIntroductions = pgTable("realtor_introductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").references(() => realtorLeadNotifications.id).notNull(),
  realtorUserId: varchar("realtor_user_id").references(() => users.id).notNull(),
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  realtorName: text("realtor_name").notNull(),
  realtorEmail: text("realtor_email").notNull(),
  realtorPhone: text("realtor_phone"),
  realtorCompany: text("realtor_company"),
  introEmailSubject: text("intro_email_subject").notNull(),
  introEmailHtml: text("intro_email_html").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const realtorMarketClaimsRelations = relations(realtorMarketClaims, ({ one, many }) => ({
  user: one(users, { fields: [realtorMarketClaims.userId], references: [users.id] }),
  partner: one(industryPartners, { fields: [realtorMarketClaims.partnerId], references: [industryPartners.id] }),
  notifications: many(realtorLeadNotifications),
}));

export const realtorLeadNotificationsRelations = relations(realtorLeadNotifications, ({ one }) => ({
  claim: one(realtorMarketClaims, { fields: [realtorLeadNotifications.realtorClaimId], references: [realtorMarketClaims.id] }),
  lead: one(leads, { fields: [realtorLeadNotifications.leadId], references: [leads.id] }),
  realtorUser: one(users, { fields: [realtorLeadNotifications.realtorUserId], references: [users.id] }),
}));

export const realtorIntroductionsRelations = relations(realtorIntroductions, ({ one }) => ({
  notification: one(realtorLeadNotifications, { fields: [realtorIntroductions.notificationId], references: [realtorLeadNotifications.id] }),
  realtorUser: one(users, { fields: [realtorIntroductions.realtorUserId], references: [users.id] }),
}));

export const insertRealtorMarketClaimSchema = createInsertSchema(realtorMarketClaims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRealtorLeadNotificationSchema = createInsertSchema(realtorLeadNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertRealtorIntroductionSchema = createInsertSchema(realtorIntroductions).omit({
  id: true,
  createdAt: true,
});

export type InsertRealtorMarketClaim = z.infer<typeof insertRealtorMarketClaimSchema>;
export type RealtorMarketClaim = typeof realtorMarketClaims.$inferSelect;
export type InsertRealtorLeadNotification = z.infer<typeof insertRealtorLeadNotificationSchema>;
export type RealtorLeadNotification = typeof realtorLeadNotifications.$inferSelect;
export type InsertRealtorIntroduction = z.infer<typeof insertRealtorIntroductionSchema>;
export type RealtorIntroduction = typeof realtorIntroductions.$inferSelect;

// ============================================
// COMMUNITY UNDERWRITING TABLES
// ============================================

export const underwritingNotes = pgTable("underwriting_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingMlsNumber: text("listing_mls_number").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  unitCount: integer("unit_count"),
  rentsJson: jsonb("rents_json"),
  vacancy: real("vacancy"),
  expenseRatio: real("expense_ratio"),
  noteText: text("note_text"),
  score: integer("score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const listingComments = pgTable("listing_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingMlsNumber: text("listing_mls_number").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  score: integer("score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  value: integer("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserTarget: uniqueIndex("votes_user_target_idx").on(table.userId, table.targetType, table.targetId),
}));

export const contributionEvents = pgTable("contribution_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  targetType: text("target_type"),
  targetId: varchar("target_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const listingAnalysisAggregates = pgTable("listing_analysis_aggregates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingMlsNumber: text("listing_mls_number").notNull().unique(),
  communityCapRate: real("community_cap_rate"),
  rentsUsedJson: jsonb("rents_used_json"),
  analysisCount: integer("analysis_count").default(0),
  commentCount: integer("comment_count").default(0),
  lastAnalysisAt: timestamp("last_analysis_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const underwritingNotesRelations = relations(underwritingNotes, ({ one }) => ({
  user: one(users, { fields: [underwritingNotes.userId], references: [users.id] }),
}));

export const listingCommentsRelations = relations(listingComments, ({ one }) => ({
  user: one(users, { fields: [listingComments.userId], references: [users.id] }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

export const contributionEventsRelations = relations(contributionEvents, ({ one }) => ({
  user: one(users, { fields: [contributionEvents.userId], references: [users.id] }),
}));

export const insertUnderwritingNoteSchema = createInsertSchema(underwritingNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  score: true,
});

export const insertListingCommentSchema = createInsertSchema(listingComments).omit({
  id: true,
  createdAt: true,
  score: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertContributionEventSchema = createInsertSchema(contributionEvents).omit({
  id: true,
  createdAt: true,
});

export const insertListingAnalysisAggregateSchema = createInsertSchema(listingAnalysisAggregates).omit({
  id: true,
  updatedAt: true,
});

export type InsertUnderwritingNote = z.infer<typeof insertUnderwritingNoteSchema>;
export type UnderwritingNote = typeof underwritingNotes.$inferSelect;

export type InsertListingComment = z.infer<typeof insertListingCommentSchema>;
export type ListingComment = typeof listingComments.$inferSelect;

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

export type InsertContributionEvent = z.infer<typeof insertContributionEventSchema>;
export type ContributionEvent = typeof contributionEvents.$inferSelect;

export type InsertListingAnalysisAggregate = z.infer<typeof insertListingAnalysisAggregateSchema>;
export type ListingAnalysisAggregate = typeof listingAnalysisAggregates.$inferSelect;

export const marketSnapshots = pgTable("market_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  province: text("province").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  dealCount: integer("deal_count").default(0).notNull(),
  avgCapRate: real("avg_cap_rate"),
  avgCashOnCash: real("avg_cash_on_cash"),
  avgDscr: real("avg_dscr"),
  avgPurchasePrice: real("avg_purchase_price"),
  avgRentPerUnit: real("avg_rent_per_unit"),
  medianCapRate: real("median_cap_rate"),
  medianPurchasePrice: real("median_purchase_price"),
  avgVacancyRate: real("avg_vacancy_rate"),
  cmhcOneBed: real("cmhc_one_bed"),
  cmhcTwoBed: real("cmhc_two_bed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  sql`CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_city_month_idx ON market_snapshots(city, province, month)`
]);

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;

export const ddfListingSnapshots = pgTable("ddf_listing_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingKey: varchar("listing_key").notNull(),
  mlsNumber: varchar("mls_number"),
  city: text("city"),
  province: text("province"),
  postalCode: varchar("postal_code"),
  listPrice: real("list_price"),
  bedroomsTotal: integer("bedrooms_total"),
  bathroomsTotal: integer("bathrooms_total"),
  numberOfUnits: integer("number_of_units"),
  livingArea: real("living_area"),
  yearBuilt: integer("year_built"),
  propertySubType: text("property_sub_type"),
  structureType: text("structure_type"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  totalActualRent: real("total_actual_rent"),
  taxAnnualAmount: real("tax_annual_amount"),
  associationFee: real("association_fee"),
  estimatedMonthlyRent: real("estimated_monthly_rent"),
  grossYield: real("gross_yield"),
  estimatedExpenses: real("estimated_expenses"),
  estimatedNoi: real("estimated_noi"),
  netYield: real("net_yield"),
  daysOnMarket: integer("days_on_market"),
  rentSource: text("rent_source"),
  rawJson: jsonb("raw_json"),
  snapshotMonth: varchar("snapshot_month", { length: 7 }).notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
}, () => [
  sql`CREATE INDEX IF NOT EXISTS ddf_snapshots_city_month_idx ON ddf_listing_snapshots(city, snapshot_month)`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS ddf_snapshots_listing_month_idx ON ddf_listing_snapshots(listing_key, snapshot_month)`,
]);

export const insertDdfListingSnapshotSchema = createInsertSchema(ddfListingSnapshots).omit({
  id: true,
  capturedAt: true,
});
export type InsertDdfListingSnapshot = z.infer<typeof insertDdfListingSnapshotSchema>;
export type DdfListingSnapshot = typeof ddfListingSnapshots.$inferSelect;

export const cityYieldHistory = pgTable("city_yield_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  province: text("province").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  listingCount: integer("listing_count").default(0).notNull(),
  avgGrossYield: real("avg_gross_yield"),
  medianGrossYield: real("median_gross_yield"),
  avgNetYield: real("avg_net_yield"),
  avgListPrice: real("avg_list_price"),
  medianListPrice: real("median_list_price"),
  avgRentPerUnit: real("avg_rent_per_unit"),
  avgDaysOnMarket: real("avg_days_on_market"),
  avgPricePerSqft: real("avg_price_per_sqft"),
  inventoryCount: integer("inventory_count").default(0),
  avgBedsPerListing: real("avg_beds_per_listing"),
  yieldTrend: real("yield_trend"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, () => [
  sql`CREATE UNIQUE INDEX IF NOT EXISTS city_yield_history_city_month_idx ON city_yield_history(city, province, month)`,
]);

export const insertCityYieldHistorySchema = createInsertSchema(cityYieldHistory).omit({
  id: true,
  computedAt: true,
});
export type InsertCityYieldHistory = z.infer<typeof insertCityYieldHistorySchema>;
export type CityYieldHistory = typeof cityYieldHistory.$inferSelect;

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  authorId: varchar("author_id").references(() => users.id),
  authorName: text("author_name").notNull().default("Realist Team"),
  category: text("category").notNull().default("market-analysis"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("draft"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  readTimeMinutes: integer("read_time_minutes"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

export const guides = pgTable("guides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  icon: text("icon").default("BookOpen"),
  category: text("category").notNull().default("getting-started"),
  difficulty: text("difficulty").notNull().default("beginner"),
  authorName: text("author_name").notNull().default("Realist Team"),
  status: text("status").notNull().default("draft"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  readTimeMinutes: integer("read_time_minutes"),
  sortOrder: integer("sort_order").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGuideSchema = createInsertSchema(guides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type Guide = typeof guides.$inferSelect;

export const mortgageRates = pgTable("mortgage_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rateType: text("rate_type").notNull(),
  term: text("term").notNull(),
  rate: real("rate").notNull(),
  provider: text("provider").notNull(),
  source: text("source").notNull(),
  category: text("category").notNull().default("posted"),
  province: text("province"),
  isInsured: boolean("is_insured").default(false),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, () => [
  sql`CREATE UNIQUE INDEX IF NOT EXISTS mortgage_rates_type_term_provider_idx ON mortgage_rates(rate_type, term, provider, category)`,
]);

export const mortgageRateHistory = pgTable("mortgage_rate_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rateType: text("rate_type").notNull(),
  term: text("term").notNull(),
  rate: real("rate").notNull(),
  provider: text("provider").notNull(),
  source: text("source").notNull(),
  category: text("category").notNull().default("posted"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertMortgageRateSchema = createInsertSchema(mortgageRates).omit({
  id: true,
  createdAt: true,
});
export type InsertMortgageRate = z.infer<typeof insertMortgageRateSchema>;
export type MortgageRate = typeof mortgageRates.$inferSelect;
export type MortgageRateHistory = typeof mortgageRateHistory.$inferSelect;

export const rateForecasts = pgTable("rate_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastType: text("forecast_type").notNull().default("ca10y_simple"),
  termMonths: integer("term_months").notNull().default(300),
  pathJson: text("path_json").notNull(),
  assumptionsJson: text("assumptions_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRateForecastSchema = createInsertSchema(rateForecasts).omit({
  id: true,
  createdAt: true,
});
export type InsertRateForecast = z.infer<typeof insertRateForecastSchema>;
export type RateForecast = typeof rateForecasts.$inferSelect;

export const indigenousLayers = pgTable("indigenous_layers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  layerName: text("layer_name").notNull(),
  layerGroup: text("layer_group").notNull().default("historic_treaty"),
  jurisdiction: text("jurisdiction").default("federal"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  sourceDatasetId: text("source_dataset_id"),
  licence: text("licence"),
  updateFrequency: text("update_frequency"),
  active: boolean("active").default(true).notNull(),
  featureCount: integer("feature_count").default(0),
  lastCheckedAt: timestamp("last_checked_at"),
  lastImportedAt: timestamp("last_imported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIndigenousLayerSchema = createInsertSchema(indigenousLayers).omit({
  id: true,
  createdAt: true,
});
export type InsertIndigenousLayer = z.infer<typeof insertIndigenousLayerSchema>;
export type IndigenousLayer = typeof indigenousLayers.$inferSelect;

export const indigenousFeatures = pgTable("indigenous_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id").notNull(),
  featureExternalId: text("feature_external_id"),
  featureName: text("feature_name"),
  nationName: text("nation_name"),
  treatyName: text("treaty_name"),
  agreementName: text("agreement_name"),
  claimName: text("claim_name"),
  province: text("province"),
  category: text("category"),
  status: text("status"),
  metadataJson: text("metadata_json"),
  bbox: text("bbox"),
  geojson: jsonb("geojson"),
  centroidLat: real("centroid_lat"),
  centroidLng: real("centroid_lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIndigenousFeatureSchema = createInsertSchema(indigenousFeatures).omit({
  id: true,
  createdAt: true,
});
export type InsertIndigenousFeature = z.infer<typeof insertIndigenousFeatureSchema>;
export type IndigenousFeature = typeof indigenousFeatures.$inferSelect;

export const watchOverlays = pgTable("watch_overlays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  overlayName: text("overlay_name").notNull(),
  overlayGroup: text("overlay_group").notNull().default("high_sensitivity"),
  jurisdiction: text("jurisdiction").default("provincial"),
  nationName: text("nation_name"),
  legalContextType: text("legal_context_type"),
  sourceSummary: text("source_summary"),
  sourceUrl: text("source_url"),
  sourceDate: text("source_date"),
  geometryMethod: text("geometry_method"),
  geometryConfidence: text("geometry_confidence"),
  authorityLevel: text("authority_level"),
  disclaimerText: text("disclaimer_text"),
  statusLabel: text("status_label"),
  active: boolean("active").default(true).notNull(),
  metadataJson: text("metadata_json"),
  createdBy: text("created_by"),
  digitizationNotes: text("digitization_notes"),
  reviewedBy: text("reviewed_by"),
  reviewStatus: text("review_status"),
  geojson: jsonb("geojson"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchOverlaySchema = createInsertSchema(watchOverlays).omit({
  id: true,
  createdAt: true,
});
export type InsertWatchOverlay = z.infer<typeof insertWatchOverlaySchema>;
export type WatchOverlay = typeof watchOverlays.$inferSelect;

export const screenings = pgTable("screenings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  searchedAddress: text("searched_address"),
  normalizedAddress: text("normalized_address"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  screeningMethod: text("screening_method").notNull().default("point_plus_buffer"),
  bufferMeters: integer("buffer_meters").default(0),
  resultStatus: text("result_status").notNull(),
  completenessStatus: text("completeness_status").default("basic"),
  summaryJson: text("summary_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScreeningSchema = createInsertSchema(screenings).omit({
  id: true,
  createdAt: true,
});
export type InsertScreening = z.infer<typeof insertScreeningSchema>;
export type Screening = typeof screenings.$inferSelect;

export const screeningHits = pgTable("screening_hits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningId: varchar("screening_id").notNull(),
  featureId: varchar("feature_id").notNull(),
  hitType: text("hit_type").notNull(),
  distanceMeters: real("distance_meters"),
  overlapArea: real("overlap_area"),
  notes: text("notes"),
});

export const insertScreeningHitSchema = createInsertSchema(screeningHits).omit({
  id: true,
});
export type InsertScreeningHit = z.infer<typeof insertScreeningHitSchema>;
export type ScreeningHit = typeof screeningHits.$inferSelect;

export const distressSnapshots = pgTable("distress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: varchar("month", { length: 7 }).notNull(),
  province: text("province").notNull(),
  city: text("city"),
  totalListings: integer("total_listings").default(0).notNull(),
  foreclosurePosCount: integer("foreclosure_pos_count").default(0).notNull(),
  motivatedCount: integer("motivated_count").default(0).notNull(),
  vtbCount: integer("vtb_count").default(0).notNull(),
  avgDistressScore: real("avg_distress_score"),
  maxDistressScore: real("max_distress_score"),
  avgListPrice: real("avg_list_price"),
  medianListPrice: real("median_list_price"),
  highConfidenceCount: integer("high_confidence_count").default(0).notNull(),
  mediumConfidenceCount: integer("medium_confidence_count").default(0).notNull(),
  lowConfidenceCount: integer("low_confidence_count").default(0).notNull(),
  avgDaysOnMarket: real("avg_days_on_market"),
  propertyTypesJson: jsonb("property_types_json"),
  topCitiesJson: jsonb("top_cities_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  sql`CREATE UNIQUE INDEX IF NOT EXISTS distress_snapshots_month_prov_city_idx ON distress_snapshots(month, province, city)`
]);

export const insertDistressSnapshotSchema = createInsertSchema(distressSnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertDistressSnapshot = z.infer<typeof insertDistressSnapshotSchema>;
export type DistressSnapshot = typeof distressSnapshots.$inferSelect;

export const geographies = pgTable("geographies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  city: text("city"),
  province: text("province"),
  geometry: jsonb("geometry"),
  centroidLat: real("centroid_lat"),
  centroidLng: real("centroid_lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGeographySchema = createInsertSchema(geographies).omit({
  id: true,
  createdAt: true,
});
export type InsertGeography = z.infer<typeof insertGeographySchema>;
export type Geography = typeof geographies.$inferSelect;

export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  geographyId: varchar("geography_id").references(() => geographies.id).notNull(),
  metricType: text("metric_type").notNull(),
  value: real("value").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  sql`CREATE INDEX IF NOT EXISTS metrics_geo_date_idx ON metrics(geography_id, date)`,
  sql`CREATE INDEX IF NOT EXISTS metrics_type_idx ON metrics(metric_type)`
]);

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true,
});
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metrics.$inferSelect;

export const areaScores = pgTable("area_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  geographyId: varchar("geography_id").references(() => geographies.id).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  investorScore: real("investor_score"),
  livabilityScore: real("livability_score"),
  growthScore: real("growth_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("area_scores_geo_date_idx").on(table.geographyId, table.date),
]);

export const insertAreaScoreSchema = createInsertSchema(areaScores).omit({
  id: true,
  createdAt: true,
});
export type InsertAreaScore = z.infer<typeof insertAreaScoreSchema>;
export type AreaScore = typeof areaScores.$inferSelect;

export const courseModules = pgTable("course_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCourseModuleSchema = createInsertSchema(courseModules).omit({
  id: true,
  createdAt: true,
});
export type InsertCourseModule = z.infer<typeof insertCourseModuleSchema>;
export type CourseModule = typeof courseModules.$inferSelect;

export const courseLessons = pgTable("course_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => courseModules.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  videoDuration: text("video_duration"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCourseLessonSchema = createInsertSchema(courseLessons).omit({
  id: true,
  createdAt: true,
});
export type InsertCourseLesson = z.infer<typeof insertCourseLessonSchema>;
export type CourseLesson = typeof courseLessons.$inferSelect;

export const courseEnrollments = pgTable("course_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").notNull().default("multiplex_masterclass"),
  stripeSessionId: varchar("stripe_session_id"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollments).omit({
  id: true,
  enrolledAt: true,
});
export type InsertCourseEnrollment = z.infer<typeof insertCourseEnrollmentSchema>;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;

export const courseProgress = pgTable("course_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  lessonId: varchar("lesson_id").references(() => courseLessons.id).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const insertCourseProgressSchema = createInsertSchema(courseProgress).omit({
  id: true,
  completedAt: true,
});
export type InsertCourseProgress = z.infer<typeof insertCourseProgressSchema>;
export type CourseProgress = typeof courseProgress.$inferSelect;

export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  title: text("title").notNull(),
  geographyIds: text("geography_ids").array(),
  metricTypes: text("metric_types").array(),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  configJson: jsonb("config_json"),
  shareToken: varchar("share_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
});
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;
