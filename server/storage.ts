import { 
  leads, 
  properties, 
  analyses, 
  webhookLogs,
  dataCache,
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
}

export const storage = new DatabaseStorage();
