import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leadDeliveries, leads, type Lead, type LeadDelivery } from "@/lib/db/schema";

/** What the operator page shows: is the pipe flowing, and what came through it. */

export interface OutboxHealthRow {
  destination: string;
  status: string;
  count: number;
  oldestPendingMinutes: number | null;
}

export async function getOutboxHealth(): Promise<OutboxHealthRow[]> {
  const result = await getDb().execute(sql`
    SELECT destination, status, count(*)::int AS count,
      CASE WHEN status = 'pending'
        THEN round(extract(epoch FROM ((now() AT TIME ZONE 'utc') - min(created_at))) / 60)::int END AS oldest_pending_minutes
    FROM lead_deliveries GROUP BY destination, status ORDER BY destination, status
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    destination: String(row.destination),
    status: String(row.status),
    count: Number(row.count),
    oldestPendingMinutes: row.oldest_pending_minutes == null ? null : Number(row.oldest_pending_minutes),
  }));
}

export interface LeadWithDeliveries {
  lead: Lead;
  deliveries: LeadDelivery[];
}

export async function getRecentLeads(limit = 100): Promise<LeadWithDeliveries[]> {
  const db = getDb();
  const recent = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
  if (recent.length === 0) return [];
  const ids = recent.map((lead) => lead.id);
  const deliveries = await db
    .select()
    .from(leadDeliveries)
    .where(sql`${leadDeliveries.leadId} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  return recent.map((lead) => ({ lead, deliveries: deliveries.filter((delivery) => delivery.leadId === lead.id) }));
}
