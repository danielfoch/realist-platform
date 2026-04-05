// Database schema for Realist partner tables
// Add this to your Drizzle schema file

import { pgTable, serial, text, timestamp, boolean, integer, real, jsonb, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const realtors = pgTable('realtors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  brokerage: text('brokerage').notNull(),
  marketsServed: jsonb('markets_served').notNull().default([]),
  assetTypes: jsonb('asset_types').notNull().default([]),
  dealTypes: jsonb('deal_types').notNull().default([]),
  avgDealSize: text('avg_deal_size'),
  referralAgreement: boolean('referral_agreement').default(false),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const lenders = pgTable('lenders', {
  id: serial('id').primaryKey(),
  contactName: text('contact_name').notNull(),
  companyName: text('company_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  lendingTypes: jsonb('lending_types').notNull().default([]),
  targetMarkets: jsonb('target_markets').notNull().default([]),
  loanSizeMin: integer('loan_size_min').notNull(),
  loanSizeMax: integer('loan_size_max').notNull(),
  preferredDscrMin: real('preferred_dscr_min'),
  preferredLtvMax: real('preferred_ltv_max'),
  turnaroundTime: text('turnaround_time').notNull(),
  referralAgreement: boolean('referral_agreement').default(false),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const dealLeads = pgTable('deal_leads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  propertyAddress: text('property_address'),
  city: text('city'),
  province: text('province'),
  purchasePrice: integer('purchase_price'),
  financingNotes: text('financing_notes'),
  investorGoals: text('investor_goals'),
  status: text('status').default('new'),
  matchedRealtorId: integer('matched_realtor_id').references(() => realtors.id),
  matchedLenderId: integer('matched_lender_id').references(() => lenders.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Blog Posts Table
export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(), // markdown
  featuredImage: text('featured_image'),
  author: text('author').default('Realist Team'),
  status: text('status').default('draft'), // draft, published, archived
  category: text('category'), // Market Update, Analysis, News, Tutorial
  tags: text('tags').array(), // Array of tags for SEO
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  canonicalUrl: text('canonical_url'),
  viewCount: integer('view_count').default(0),
  featured: boolean('featured').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Guides Table
export const guides = pgTable('guides', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(), // markdown
  featuredImage: text('featured_image'),
  author: text('author').default('Realist Team'),
  status: text('status').default('draft'), // draft, published, archived
  category: text('category').notNull(), // Analysis, Markets, Tax & Legal, Financing
  difficulty: text('difficulty'), // beginner, intermediate, advanced
  estimatedReadTime: integer('estimated_read_time_minutes'), // minutes
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  canonicalUrl: text('canonical_url'),
  viewCount: integer('view_count').default(0),
  featured: boolean('featured').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for validation
export const insertBlogPostSchema = createInsertSchema(blogPosts);
export const insertGuideSchema = createInsertSchema(guides);

// TypeScript types
export type Realtor = typeof realtors.$inferSelect;
export type NewRealtor = typeof realtors.$inferInsert;
export type Lender = typeof lenders.$inferSelect;
export type NewLender = typeof lenders.$inferInsert;
export type DealLead = typeof dealLeads.$inferSelect;
export type NewDealLead = typeof dealLeads.$inferInsert;
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type Guide = typeof guides.$inferSelect;
export type NewGuide = typeof guides.$inferInsert;