import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, real } from "drizzle-orm/pg-core";
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
  countryMode: text("country_mode").notNull(),
  strategyType: text("strategy_type").notNull(),
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
  name: text("name").notNull(),
  address: text("address"),
  countryMode: text("country_mode").notNull(),
  strategyType: text("strategy_type").notNull(),
  inputsJson: jsonb("inputs_json").notNull(),
  resultsJson: jsonb("results_json").notNull(),
  sessionId: varchar("session_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const podcastQuestions = pgTable("podcast_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  question: text("question").notNull(),
  answered: boolean("answered").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
