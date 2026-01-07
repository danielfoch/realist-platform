import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
    equity: z.number(),
    cashFlow: z.number(),
    propertyValue: z.number(),
    loanBalance: z.number(),
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
