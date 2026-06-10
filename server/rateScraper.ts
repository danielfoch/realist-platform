import { db } from "./db";
import { mortgageRates, mortgageRateHistory } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface RateEntry {
  rateType: string;
  term: string;
  rate: number;
  provider: string;
  source: string;
  category: string;
  isInsured?: boolean;
}

const MIN_REASONABLE_RATE = 0.1;
const MAX_REASONABLE_RATE = 15;

function isReasonableRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= MIN_REASONABLE_RATE && rate <= MAX_REASONABLE_RATE;
}

function sanitizeRates(rates: RateEntry[]): RateEntry[] {
  return rates.filter((entry) => isReasonableRate(entry.rate));
}

const BOC_SERIES = {
  V80691311: { label: "Prime Rate", rateType: "variable", term: "prime", category: "posted" },
  V80691335: { label: "5-Year Conventional Mortgage", rateType: "fixed", term: "5-year", category: "posted" },
  V39079: { label: "Overnight Rate", rateType: "variable", term: "overnight", category: "policy" },
  V39078: { label: "Bank Rate", rateType: "variable", term: "bank-rate", category: "policy" },
};

async function fetchBankOfCanadaRates(): Promise<RateEntry[]> {
  const rates: RateEntry[] = [];

  for (const [seriesId, config] of Object.entries(BOC_SERIES)) {
    try {
      const url = `https://www.bankofcanada.ca/valet/observations/${seriesId}/json?recent=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Realist.ca Rate Monitor" },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const obs = data.observations?.[0];
      if (!obs) continue;

      const value = obs[seriesId]?.v;
      if (value) {
        const rate = parseFloat(value);
        if (!isReasonableRate(rate)) continue;
        rates.push({
          rateType: config.rateType,
          term: config.term,
          rate,
          provider: "Bank of Canada",
          source: "bankofcanada.ca",
          category: config.category,
        });
      }
    } catch (error) {
      console.error(`[rate-scraper] Failed to fetch BoC series ${seriesId}:`, error);
    }
  }

  console.log(`[rate-scraper] Fetched ${rates.length} Bank of Canada rates`);
  return rates;
}

async function fetchBestBrokerRates(): Promise<RateEntry[]> {
  const rates: RateEntry[] = [];

  try {
    const response = await fetch("https://wowa.ca/best-mortgage-rates", {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.log("[rate-scraper] wowa.ca returned:", response.status);
      return getDefaultBestRates();
    }

    const html = await response.text();

    const metaMatch = html.match(/best mortgage rates.*?(\d+\.\d+)%.*?(\d+\.\d+)%.*?(\d+\.\d+)%/i);
    if (metaMatch) {
      const [, fiveFixed, threeFixed, fiveVariable] = metaMatch;
      const metaRates = [
        { rateType: "fixed", term: "5-year", rate: parseFloat(fiveFixed), provider: "Best Available", source: "wowa.ca", category: "best", isInsured: true },
        { rateType: "fixed", term: "3-year", rate: parseFloat(threeFixed), provider: "Best Available", source: "wowa.ca", category: "best", isInsured: true },
        { rateType: "variable", term: "5-year", rate: parseFloat(fiveVariable), provider: "Best Available", source: "wowa.ca", category: "best", isInsured: true },
      ] satisfies RateEntry[];
      const saneMetaRates = sanitizeRates(metaRates);
      if (saneMetaRates.length === metaRates.length) {
        rates.push(...saneMetaRates);
        console.log(`[rate-scraper] Parsed ${rates.length} rates from wowa.ca meta`);
        return rates;
      }
      console.warn("[rate-scraper] Ignoring invalid wowa.ca meta rates", metaRates);
    }

    const ratePatterns = [
      { regex: /5[- ]year\s+fixed[^]*?(\d+\.\d+)/i, term: "5-year", type: "fixed" },
      { regex: /3[- ]year\s+fixed[^]*?(\d+\.\d+)/i, term: "3-year", type: "fixed" },
      { regex: /5[- ]year\s+variable[^]*?(\d+\.\d+)/i, term: "5-year", type: "variable" },
      { regex: /2[- ]year\s+fixed[^]*?(\d+\.\d+)/i, term: "2-year", type: "fixed" },
      { regex: /1[- ]year\s+fixed[^]*?(\d+\.\d+)/i, term: "1-year", type: "fixed" },
    ];

    for (const p of ratePatterns) {
      const match = html.match(p.regex);
      if (match) {
        const rate = parseFloat(match[1]);
        if (rate > 0 && rate < 15) {
          rates.push({
            rateType: p.type,
            term: p.term,
            rate,
            provider: "Best Available",
            source: "wowa.ca",
            category: "best",
            isInsured: true,
          });
        }
      }
    }

    if (rates.length > 0) {
      const saneRates = sanitizeRates(rates);
      if (saneRates.length > 0) {
        console.log(`[rate-scraper] Parsed ${saneRates.length} rates from wowa.ca HTML`);
        return saneRates;
      }
    }
  } catch (error) {
    console.error("[rate-scraper] wowa.ca scrape failed:", error);
  }

  return getDefaultBestRates();
}

function getDefaultBestRates(): RateEntry[] {
  return [
    { rateType: "fixed", term: "1-year", rate: 5.59, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
    { rateType: "fixed", term: "2-year", rate: 4.29, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
    { rateType: "fixed", term: "3-year", rate: 3.89, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
    { rateType: "fixed", term: "5-year", rate: 3.84, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
    { rateType: "variable", term: "3-year", rate: 3.95, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
    { rateType: "variable", term: "5-year", rate: 3.70, provider: "Best Available", source: "market-estimate", category: "best", isInsured: true },
  ];
}

function getBigBankPostedRates(): RateEntry[] {
  return [
    { rateType: "fixed", term: "1-year", rate: 6.79, provider: "Major Banks (Avg)", source: "bank-posted", category: "big-bank", isInsured: false },
    { rateType: "fixed", term: "2-year", rate: 5.99, provider: "Major Banks (Avg)", source: "bank-posted", category: "big-bank", isInsured: false },
    { rateType: "fixed", term: "3-year", rate: 5.49, provider: "Major Banks (Avg)", source: "bank-posted", category: "big-bank", isInsured: false },
    { rateType: "fixed", term: "5-year", rate: 4.99, provider: "Major Banks (Avg)", source: "bank-posted", category: "big-bank", isInsured: false },
    { rateType: "variable", term: "5-year", rate: 5.30, provider: "Major Banks (Avg)", source: "bank-posted", category: "big-bank", isInsured: false },
  ];
}

async function upsertRate(entry: RateEntry): Promise<void> {
  if (!isReasonableRate(entry.rate)) {
    throw new Error(`Refusing to store unreasonable mortgage rate: ${entry.rate}`);
  }
  const existing = await db.select().from(mortgageRates)
    .where(and(
      eq(mortgageRates.rateType, entry.rateType),
      eq(mortgageRates.term, entry.term),
      eq(mortgageRates.provider, entry.provider),
      eq(mortgageRates.category, entry.category),
    ))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    await db.update(mortgageRates)
      .set({ rate: entry.rate, source: entry.source, lastUpdated: now, isInsured: entry.isInsured ?? false })
      .where(eq(mortgageRates.id, existing[0].id));
  } else {
    await db.insert(mortgageRates).values({
      rateType: entry.rateType,
      term: entry.term,
      rate: entry.rate,
      provider: entry.provider,
      source: entry.source,
      category: entry.category,
      isInsured: entry.isInsured ?? false,
      lastUpdated: now,
    });
  }

  await db.insert(mortgageRateHistory).values({
    rateType: entry.rateType,
    term: entry.term,
    rate: entry.rate,
    provider: entry.provider,
    source: entry.source,
    category: entry.category,
    recordedAt: now,
  });
}

export async function runRateScrape(): Promise<{ updated: number; sources: string[]; errors: string[] }> {
  const results = { updated: 0, sources: [] as string[], errors: [] as string[] };

  const [bocRates, bestRates] = await Promise.all([
    fetchBankOfCanadaRates(),
    fetchBestBrokerRates(),
  ]);

  const bigBankRates = getBigBankPostedRates();

  const allRates = [...bocRates, ...bestRates, ...bigBankRates];

  if (bocRates.length > 0) results.sources.push("Bank of Canada");
  if (bestRates.length > 0) {
    const src = bestRates[0]?.source || "broker";
    results.sources.push(src);
  }
  results.sources.push("bank-posted");

  for (const entry of allRates) {
    try {
      await upsertRate(entry);
      results.updated++;
    } catch (error: any) {
      results.errors.push(`${entry.provider} ${entry.term} ${entry.rateType}: ${error.message}`);
    }
  }

  console.log(`[rate-scraper] Scrape complete: ${results.updated} rates updated from ${results.sources.join(", ")}`);
  return results;
}

export async function getAllCurrentRates(): Promise<any[]> {
  const rows = await db.select().from(mortgageRates).orderBy(mortgageRates.category, mortgageRates.rateType, mortgageRates.term);
  return rows.filter((row) => isReasonableRate(row.rate));
}

export async function getRateHistory(rateType?: string, term?: string): Promise<any[]> {
  const conditions = [];
  if (rateType) conditions.push(eq(mortgageRateHistory.rateType, rateType));
  if (term) conditions.push(eq(mortgageRateHistory.term, term));
  const rows = await db.select().from(mortgageRateHistory)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(mortgageRateHistory.recordedAt);
  return rows.filter((row) => isReasonableRate(row.rate));
}
