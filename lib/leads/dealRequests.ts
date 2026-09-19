import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leads, type LeadKind } from "@/lib/db/schema";
import { dealKeyFor } from "@/lib/analyses/dealKey";

/** The requests that move a deal from the desk to the door. */
export const DEAL_REQUEST_KINDS = ["showing", "offer", "financing"] as const satisfies readonly LeadKind[];
export type DealRequestKind = (typeof DEAL_REQUEST_KINDS)[number];

/** What this member has already asked for, per deal — so a deal can show where it stands. */
export async function requestsByDeal(userId: string): Promise<Map<string, DealRequestKind[]>> {
  const rows = await getDb()
    .select({ kind: leads.kind, property: leads.property })
    .from(leads)
    .where(and(eq(leads.userId, userId), inArray(leads.kind, [...DEAL_REQUEST_KINDS])))
    .orderBy(desc(leads.createdAt))
    .limit(500);
  const byDeal = new Map<string, DealRequestKind[]>();
  for (const row of rows) {
    const key = dealKeyFor({ mlsNumber: row.property?.mlsNumber, address: row.property?.address });
    if (!key) continue;
    const kinds = byDeal.get(key) ?? [];
    if (!kinds.includes(row.kind as DealRequestKind)) kinds.push(row.kind as DealRequestKind);
    byDeal.set(key, kinds);
  }
  return byDeal;
}
