import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * Realist CRM — the native, Elon-simple CRM for realist.ca.
 *
 * Three tables, one rule: every contact has exactly one next action.
 *
 * - crm_contacts: a person an owner (admin or realtor partner) is working.
 *   Contact stage tracks the RELATIONSHIP (lead → client → past client);
 *   transaction state lives on crm_deals, not the contact.
 * - crm_activities: append-only timeline (notes, calls, emails, stage changes).
 * - crm_deals: an active transaction file with checklist + key dates.
 *
 * Contacts may be linked to a realist.ca user (linkedUserId) so the owner can
 * see the investor's deal analyses next to the relationship — that's the
 * platform advantage no external CRM can have.
 */

export const CRM_CONTACT_STAGES = [
  "new",
  "contacted",
  "nurturing",
  "appointment",
  "client",
  "past_client",
  "lost",
] as const;
export type CrmContactStage = (typeof CRM_CONTACT_STAGES)[number];

export const CRM_CONTACT_TYPES = [
  "investor",
  "buyer",
  "seller",
  "renter",
  "realtor",
  "other",
] as const;
export type CrmContactType = (typeof CRM_CONTACT_TYPES)[number];

export const CRM_DEAL_STAGES = [
  "preparing",
  "offer",
  "conditional",
  "firm",
  "closed",
  "fell_through",
] as const;
export type CrmDealStage = (typeof CRM_DEAL_STAGES)[number];

export const CRM_ACTIVITY_KINDS = [
  "note",
  "call",
  "email",
  "sms",
  "meeting",
  "task",
  "stage_change",
  "system",
] as const;
export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number];

export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    linkedUserId: varchar("linked_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    contactType: varchar("contact_type", { length: 20 })
      .default("investor")
      .notNull(),
    stage: varchar("stage", { length: 20 }).default("new").notNull(),
    source: varchar("source", { length: 50 }),
    sourceDetail: text("source_detail"),
    tags: jsonb("tags").default([]).notNull(),
    targetMarket: text("target_market"),
    consentEmail: boolean("consent_email").default(false).notNull(),
    consentSms: boolean("consent_sms").default(false).notNull(),
    lastTouchAt: timestamp("last_touch_at"),
    data: jsonb("data").default({}).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_crm_contacts_owner_stage").on(table.ownerUserId, table.stage),
    index("idx_crm_contacts_linked_user").on(table.linkedUserId),
  ],
);

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contactId: varchar("contact_id")
      .references(() => crmContacts.id, { onDelete: "cascade" })
      .notNull(),
    dealId: varchar("deal_id"),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 20 }).default("note").notNull(),
    body: text("body"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_crm_activities_contact").on(table.contactId, table.createdAt),
  ],
);

export interface CrmChecklistItem {
  label: string;
  done: boolean;
  dueAt?: string | null;
}

/** Key dates a Canadian residential transaction actually turns on. */
export interface CrmKeyDates {
  offerDate?: string | null;
  financingConditionDate?: string | null;
  inspectionConditionDate?: string | null;
  depositDueDate?: string | null;
  closingDate?: string | null;
}

export const crmDeals = pgTable(
  "crm_deals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contactId: varchar("contact_id")
      .references(() => crmContacts.id, { onDelete: "cascade" })
      .notNull(),
    ownerUserId: varchar("owner_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    side: varchar("side", { length: 10 }).default("buy").notNull(),
    stage: varchar("stage", { length: 20 }).default("preparing").notNull(),
    propertyAddress: text("property_address"),
    listingMlsNumber: text("listing_mls_number"),
    // Soft link to property_analyses.id — the investor's underwriting on
    // this exact property. Kept as a plain column (no FK) to avoid a module
    // cycle with shared/schema.ts.
    analysisId: varchar("analysis_id"),
    price: real("price"),
    keyDates: jsonb("key_dates").default({}).notNull(),
    checklist: jsonb("checklist").default([]).notNull(),
    notes: text("notes"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_crm_deals_owner_stage").on(table.ownerUserId, table.stage),
    index("idx_crm_deals_contact").on(table.contactId),
  ],
);

export const insertCrmContactSchema = createInsertSchema(crmContacts)
  .omit({ id: true, ownerUserId: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1).max(200),
    email: z.string().email().nullish(),
    phone: z.string().max(30).nullish(),
    contactType: z.enum(CRM_CONTACT_TYPES).default("investor"),
    stage: z.enum(CRM_CONTACT_STAGES).default("new"),
  });

export const insertCrmDealSchema = createInsertSchema(crmDeals)
  .omit({ id: true, ownerUserId: true, createdAt: true, updatedAt: true, closedAt: true })
  .extend({
    title: z.string().min(1).max(300),
    side: z.enum(["buy", "sell", "lease"]).default("buy"),
    stage: z.enum(CRM_DEAL_STAGES).default("preparing"),
  });

export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
