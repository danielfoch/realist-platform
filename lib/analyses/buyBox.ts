import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealAnalyses, leads, type User } from "@/lib/db/schema";
import { searchByYield } from "@/lib/ddf/yieldSearch";
import type { ListingSearchResult } from "@/components/listings/listingDisplay";
import { captureLead } from "@/lib/leads/capture";
import { describeBuyBox, fitsBuyBox, learnBuyBox, type BuyBox } from "./thesis";

/** A member's buy box, learned from every call they've made. Null until there's a pattern. */
export async function getBuyBox(userId: string): Promise<BuyBox | null> {
  const rows = await getDb()
    .select()
    .from(dealAnalyses)
    .where(and(eq(dealAnalyses.actorKey, `user:${userId}`), eq(dealAnalyses.eligible, true), isNotNull(dealAnalyses.verdict)))
    .orderBy(desc(dealAnalyses.updatedAt))
    .limit(400);
  return learnBuyBox(
    rows.map((row) => ({
      verdict: row.verdict,
      city: row.city,
      province: row.province,
      price: row.price,
      units: row.units,
      capRate: row.capRate,
      monthlyCashFlow: row.monthlyCashFlow,
      downPaymentPercent: typeof row.inputs?.downPaymentPercent === "number" ? row.inputs.downPaymentPercent : null,
      source: row.source,
    })),
  );
}

/** Active listings inside the box that the member hasn't looked at yet, best yield first. */
export async function dealsForBox(userId: string, box: BuyBox, limit = 6): Promise<ListingSearchResult[]> {
  if (box.markets.length === 0) return [];
  const seen = await getDb()
    .select({ mls: dealAnalyses.mlsNumber })
    .from(dealAnalyses)
    .where(and(eq(dealAnalyses.actorKey, `user:${userId}`), isNotNull(dealAnalyses.mlsNumber)))
    .limit(1000);
  const { listings } = await searchByYield({
    cities: box.markets.map((market) => market.city),
    minPrice: Math.round(box.priceLow * 0.85),
    maxPrice: Math.round(box.priceHigh * 1.15),
    minUnits: box.unitsLow > 1 ? box.unitsLow : undefined,
    maxUnits: Math.max(box.unitsHigh, box.unitsLow),
    minYield: box.minCapRate == null ? undefined : Math.max(0, box.minCapRate - 0.5),
    excludeMls: seen.map((row) => row.mls).filter((mls): mls is string => Boolean(mls)),
    page: 1,
    pageSize: limit * 2,
  });
  return listings
    .filter((listing) => fitsBuyBox(box, { city: listing.address.city, price: listing.listPrice, units: listing.numberOfUnitsTotal ?? null, netYield: listing.underwrite?.netYield ?? null }))
    .slice(0, limit);
}

/**
 * Tell the CRM what this member buys — once it's known, and again only when it
 * changes. It's the first thing a realtor wants before calling someone, and the
 * member never had to fill in a form to say it.
 */
export async function announceBuyBox(user: User, box: BuyBox): Promise<string | null> {
  const sentence = describeBuyBox(box, "agent");
  const [last] = await getDb()
    .select({ context: leads.context })
    .from(leads)
    .where(and(eq(leads.email, user.email), eq(leads.kind, "buy_box")))
    .orderBy(desc(leads.createdAt))
    .limit(1);
  if (last?.context?.buyBox === sentence) return null;
  const { lead, duplicate } = await captureLead({
    kind: "buy_box",
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: box.markets[0]?.city ?? user.city,
    province: box.markets[0]?.province ?? user.province,
    userId: user.id,
    consentMarketing: user.consentMarketing,
    context: { buyBox: sentence, calls: box.calls, markets: box.markets.map((market) => market.city) },
  });
  return duplicate ? null : lead.id;
}
