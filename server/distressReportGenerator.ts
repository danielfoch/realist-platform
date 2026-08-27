import { db } from "./db";
import { distressListingObservations, distressSnapshots, type InsertDistressListingObservation } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";
import { searchDdfByRemarks, normalizeDdfListing, isDdfConfigured } from "./creaDdf";
import { isQualifiedDistressResult, scoreDistress, type DistressResult } from "@shared/distressScoring";
import type { DistressPrimaryCategory } from "@shared/distressIntelligence";
import { getDistressMarketIntelligence } from "./distressIntelligence";

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario", BC: "British Columbia", QC: "Quebec", AB: "Alberta",
  MB: "Manitoba", SK: "Saskatchewan", NS: "Nova Scotia", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", PE: "Prince Edward Island",
};

const PROVINCES_TO_SCAN = [
  { code: "Ontario", abbr: "ON" },
  { code: "British Columbia", abbr: "BC" },
  { code: "Quebec", abbr: "QC" },
  { code: "Alberta", abbr: "AB" },
  { code: "Manitoba", abbr: "MB" },
  { code: "Saskatchewan", abbr: "SK" },
  { code: "Nova Scotia", abbr: "NS" },
  { code: "New Brunswick", abbr: "NB" },
  { code: "Newfoundland and Labrador", abbr: "NL" },
  { code: "Prince Edward Island", abbr: "PE" },
];

const SEARCH_TERMS_BY_CATEGORY: Record<string, string[]> = {
  foreclosure_pos: [
    "power of sale", "foreclosure", "bank owned",
    "court ordered sale", "judicial sale", "mortgagee sale",
    "receivership", "reprise de finance", "vente sous controle de justice",
  ],
  motivated: [
    "motivated seller", "priced to sell", "must sell",
    "urgent sale", "needs to sell", "bring an offer",
  ],
  vtb: [
    "vendor take back", "vtb", "seller financing",
    "owner financing", "vendor financing", "financement vendeur",
  ],
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-CA", { month: "long" });
}

export function distressReportSlugForMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must use YYYY-MM");
  const [year, monthNumber] = month.split("-");
  return slugify(`canada-distress-deals-report-${getMonthName(parseInt(monthNumber))}-${year}`);
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return "N/A";
  return n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return "$" + Math.round(n).toLocaleString("en-CA");
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface ScoredListing {
  listingKey: string;
  mlsNumber?: string;
  listPrice?: number;
  daysOnMarket?: number;
  address?: { city?: string; state?: string; zip?: string };
  type?: string;
  distress: DistressResult;
  matchedSearchTerms: string[];
}

interface ProvinceScanResult {
  listings: ScoredListing[];
  queriesAttempted: number;
  queriesSucceeded: number;
}

function primaryCategory(result: DistressResult): DistressPrimaryCategory {
  if (result.categoriesTriggered.foreclosure_pos) return "foreclosure_pos";
  if (result.categoriesTriggered.vtb) return "vtb";
  return "motivated";
}

async function scanProvinceDistress(provinceName: string): Promise<ProvinceScanResult> {
  const allTerms = [
    ...SEARCH_TERMS_BY_CATEGORY.foreclosure_pos,
    ...SEARCH_TERMS_BY_CATEGORY.motivated,
    ...SEARCH_TERMS_BY_CATEGORY.vtb,
  ];
  const uniqueTerms = [...new Set(allTerms)];
  const allListings = new Map<string, { raw: any; matchedSearchTerms: Set<string> }>();
  let queriesSucceeded = 0;

  for (let c = 0; c < uniqueTerms.length; c += 2) {
    const termChunk = uniqueTerms.slice(c, c + 2);
    const results = await Promise.allSettled(
      termChunk.map(term => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        return searchDdfByRemarks({
          searchTerms: [term],
          stateOrProvince: provinceName,
          top: 100,
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
      })
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        queriesSucceeded++;
        for (const raw of r.value.listings) {
          const key = raw.ListingKey || raw.ListingId || "";
          if (!key) continue;
          const existing = allListings.get(key);
          if (existing) existing.matchedSearchTerms.add(termChunk[i]);
          else allListings.set(key, { raw, matchedSearchTerms: new Set([termChunk[i]]) });
        }
      }
    }
    if (c + 2 < uniqueTerms.length) await new Promise(r => setTimeout(r, 500));
  }

  if (queriesSucceeded === 0) {
    throw new Error(`All ${uniqueTerms.length} DDF search queries failed for ${provinceName}`);
  }

  const listings = Array.from(allListings.entries()).map(([listingKey, entry]) => {
    const raw = entry.raw;
    const normalized = normalizeDdfListing(raw);
    const remarks = raw.PublicRemarks || "";
    const distress = scoreDistress(remarks, provinceName);
    return {
      ...normalized,
      listingKey,
      distress,
      matchedSearchTerms: [...entry.matchedSearchTerms].sort(),
    } as ScoredListing;
  }).filter(l => isQualifiedDistressResult(l.distress));

  return { listings, queriesAttempted: uniqueTerms.length, queriesSucceeded };
}

function computeSnapshotData(
  listings: ScoredListing[],
  province: string,
  scan: Pick<ProvinceScanResult, "queriesAttempted" | "queriesSucceeded">,
  city?: string,
) {
  const filtered = city
    ? listings.filter(l => {
        const listingCity = (l.address?.city || "").split("(")[0].trim();
        return listingCity.toLowerCase() === city.toLowerCase();
      })
    : listings;

  const prices = filtered.map(l => l.listPrice).filter((p): p is number => p != null && p > 0);
  const scores = filtered.map(l => l.distress.distressScore);
  const doms = filtered.map(l => l.daysOnMarket).filter((d): d is number => d != null && d >= 0);

  const propertyTypes: Record<string, number> = {};
  for (const l of filtered) {
    const t = l.type || "Unknown";
    propertyTypes[t] = (propertyTypes[t] || 0) + 1;
  }

  const cityMap: Record<string, number> = {};
  if (!city) {
    for (const l of filtered) {
      const c = (l.address?.city || "Unknown").split("(")[0].trim();
      cityMap[c] = (cityMap[c] || 0) + 1;
    }
  }

  const topCities = Object.entries(cityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  return {
    month: "",
    province,
    city: city || null,
    totalListings: filtered.length,
    foreclosurePosCount: filtered.filter(l => l.distress.categoriesTriggered.foreclosure_pos).length,
    motivatedCount: filtered.filter(l => l.distress.categoriesTriggered.motivated).length,
    vtbCount: filtered.filter(l => l.distress.categoriesTriggered.vtb).length,
    avgDistressScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    maxDistressScore: scores.length ? Math.max(...scores) : null,
    avgListPrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    medianListPrice: median(prices),
    highConfidenceCount: filtered.filter(l => l.distress.confidence === "high").length,
    mediumConfidenceCount: filtered.filter(l => l.distress.confidence === "medium").length,
    lowConfidenceCount: filtered.filter(l => l.distress.confidence === "low").length,
    avgDaysOnMarket: doms.length ? doms.reduce((a, b) => a + b, 0) / doms.length : null,
    propertyTypesJson: propertyTypes,
    topCitiesJson: topCities,
    queriesAttempted: scan.queriesAttempted,
    queriesSucceeded: scan.queriesSucceeded,
    methodologyVersion: "distress-v2",
    capturedAt: new Date(),
  };
}

export async function captureDistressSnapshots(month: string): Promise<{ provinces: number; cities: number; observations: number; failedProvinces: string[] }> {
  if (!isDdfConfigured()) {
    console.log("[distress-report] DDF not configured, skipping snapshot capture");
    return { provinces: 0, cities: 0, observations: 0, failedProvinces: PROVINCES_TO_SCAN.map((province) => province.abbr) };
  }

  let provincesProcessed = 0;
  let citiesProcessed = 0;
  let observationsProcessed = 0;
  const failedProvinces: string[] = [];

  for (const prov of PROVINCES_TO_SCAN) {
    try {
      console.log(`[distress-report] Scanning ${prov.code}...`);
      const scan = await scanProvinceDistress(prov.code);
      console.log(`[distress-report] ${prov.code}: ${scan.listings.length} flagged listings found (${scan.queriesSucceeded}/${scan.queriesAttempted} queries succeeded)`);

      const provData = computeSnapshotData(scan.listings, prov.abbr, scan);
      provData.month = month;
      const topCities = (provData.topCitiesJson as any[]) || [];
      const citySnapshots: Array<ReturnType<typeof computeSnapshotData>> = [];
      for (const tc of topCities) {
        if (tc.count >= 3) {
          const cityData = computeSnapshotData(scan.listings, prov.abbr, scan, tc.name);
          cityData.month = month;
          cityData.city = tc.name;
          citySnapshots.push(cityData);
        }
      }

      const capturedAt = new Date();
      const observations: InsertDistressListingObservation[] = scan.listings.map((listing) => ({
        snapshotMonth: month,
        listingKey: listing.listingKey,
        mlsNumber: listing.mlsNumber || null,
        province: prov.abbr,
        city: (listing.address?.city || "").split("(")[0].trim() || null,
        postalCode: listing.address?.zip || null,
        listPrice: listing.listPrice || null,
        daysOnMarket: listing.daysOnMarket ?? null,
        propertyType: listing.type || null,
        distressScore: listing.distress.distressScore,
        confidence: listing.distress.confidence,
        primaryCategory: primaryCategory(listing.distress),
        foreclosurePos: listing.distress.categoriesTriggered.foreclosure_pos,
        motivated: listing.distress.categoriesTriggered.motivated,
        vtb: listing.distress.categoriesTriggered.vtb,
        matchedTermsJson: listing.distress.matchedTerms,
        matchedSearchTermsJson: listing.matchedSearchTerms,
      }));

      await db.transaction(async (tx) => {
        // A rerun replaces only this month/province capture; older monthly
        // observations stay immutable for longitudinal cohort analysis.
        await tx.delete(distressListingObservations).where(and(
          eq(distressListingObservations.snapshotMonth, month),
          eq(distressListingObservations.province, prov.abbr),
        ));
        for (let i = 0; i < observations.length; i += 250) {
          await tx.insert(distressListingObservations).values(observations.slice(i, i + 250));
        }

        // Replace the province and its city rollups together so a failed rerun
        // cannot leave stale cities or aggregates from a different capture.
        await tx.delete(distressSnapshots).where(and(
          eq(distressSnapshots.month, month),
          eq(distressSnapshots.province, prov.abbr),
        ));
        await tx.insert(distressSnapshots).values([
          { ...provData, capturedAt },
          ...citySnapshots.map((row) => ({ ...row, capturedAt })),
        ] as any);
      });

      provincesProcessed++;
      citiesProcessed += citySnapshots.length;
      observationsProcessed += observations.length;
      if (scan.queriesSucceeded < scan.queriesAttempted) failedProvinces.push(prov.abbr);

      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      failedProvinces.push(prov.abbr);
      console.error(`[distress-report] Error scanning ${prov.code}:`, err.message);
    }
  }

  console.log(`[distress-report] Snapshot complete: ${provincesProcessed} provinces, ${citiesProcessed} cities, ${observationsProcessed} listing observations`);
  return { provinces: provincesProcessed, cities: citiesProcessed, observations: observationsProcessed, failedProvinces };
}

function generateDistressReportHtml(params: {
  monthName: string;
  year: number;
  month: string;
  national: any[];
  prevNational: any[];
  intelligence: Awaited<ReturnType<typeof getDistressMarketIntelligence>>;
}): string {
  const { monthName, year, national, prevNational, intelligence } = params;
  const sections: string[] = [];

  const totalListings = national.reduce((s, p) => s + (p.totalListings || 0), 0);
  const totalForeclosure = national.reduce((s, p) => s + (p.foreclosurePosCount || 0), 0);
  const totalMotivated = national.reduce((s, p) => s + (p.motivatedCount || 0), 0);
  const totalVtb = national.reduce((s, p) => s + (p.vtbCount || 0), 0);
  const totalHigh = national.reduce((s, p) => s + (p.highConfidenceCount || 0), 0);
  const totalMedium = national.reduce((s, p) => s + (p.mediumConfidenceCount || 0), 0);

  const prevTotal = prevNational.reduce((s, p) => s + (p.totalListings || 0), 0);
  const prevForeclosure = prevNational.reduce((s, p) => s + (p.foreclosurePosCount || 0), 0);

  function trend(curr: number, prev: number): string {
    if (!prev) return "";
    const diff = ((curr - prev) / prev) * 100;
    if (Math.abs(diff) < 1) return " (flat vs. last month)";
    return diff > 0 ? ` (<span style="color:#ef4444">↑ ${Math.abs(diff).toFixed(1)}%</span> vs. last month)` : ` (<span style="color:#22c55e">↓ ${Math.abs(diff).toFixed(1)}%</span> vs. last month)`;
  }

  sections.push(`
    <h2>National Summary — ${monthName} ${year}</h2>
    <p>Realist.ca scanned active MLS listings across all Canadian provinces for motivated-seller language in ${monthName} ${year}. We identified <strong>${fmt(totalListings)}</strong> listings${trend(totalListings, prevTotal)} with motivated-seller signals, categorized by type and severity.</p>

    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Category</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Triggered Listings</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Share of Unique Flagged*</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Foreclosure / Power of Sale</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalForeclosure)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalForeclosure / totalListings * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Motivated Seller</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalMotivated)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalMotivated / totalListings * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Vendor Take-Back (VTB)</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalVtb)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalVtb / totalListings * 100).toFixed(1) : 0}%</td></tr>
      </tbody>
    </table>
    <p style="font-size:0.9rem; color:#64748b;"><em>*Categories overlap. A listing can trigger more than one signal, so these percentages are not additive.</em></p>

    <p><strong>${fmt(totalHigh)}</strong> listings were flagged with <strong>high-confidence language combinations</strong> and <strong>${fmt(totalMedium)}</strong> with medium-confidence combinations. Confidence measures the strength of the listing-language signal—not deal quality, seller finances, legal status, or expected discount.</p>
  `);

  if (intelligence) {
    const cohort = intelligence.cohort;
    const persistence = cohort.persistenceRatePct == null ? "N/A" : `${cohort.persistenceRatePct.toFixed(1)}%`;
    const medianPriceChange = cohort.medianPriceChangePct == null
      ? "N/A"
      : `${cohort.medianPriceChangePct >= 0 ? "+" : ""}${cohort.medianPriceChangePct.toFixed(1)}%`;
    sections.push(`
      <h2>What Changed Since the Previous Capture</h2>
      <p>The durable listing-level dataset lets this report distinguish new signals from listings that persisted across monthly captures. Compared with ${getMonthName(parseInt(intelligence.previousMonth.slice(5, 7)))} ${intelligence.previousMonth.slice(0, 4)}:</p>
      <ul>
        <li><strong>${fmt(cohort.newlyFlagged)}</strong> listings were newly flagged versus the immediately previous capture.</li>
        <li><strong>${fmt(cohort.persistent)}</strong> remained flagged, a persistence rate of <strong>${persistence}</strong>.</li>
        <li><strong>${fmt(cohort.noLongerFlagged)}</strong> were no longer flagged. That can mean sold, expired, withdrawn, changed remarks, or query coverage changes; it does not prove a completed sale.</li>
        <li><strong>${fmt(cohort.priceReduced)}</strong> persistent listings had a lower asking price; the median asking-price change across comparable persistent listings was <strong>${medianPriceChange}</strong>.</li>
      </ul>
    `);
  }

  const provSorted = [...national].sort((a, b) => (b.totalListings || 0) - (a.totalListings || 0));
  const provRows = provSorted.map(p => {
    const provName = PROVINCE_NAMES[p.province] || p.province;
    const prevProv = prevNational.find(pp => pp.province === p.province);
    const prevCount = prevProv?.totalListings || 0;
    const pctChange = prevCount ? ((p.totalListings - prevCount) / prevCount * 100) : 0;
    const changeStr = prevCount
      ? (pctChange > 1 ? `<span style="color:#ef4444">↑ ${Math.abs(pctChange).toFixed(0)}%</span>`
        : pctChange < -1 ? `<span style="color:#22c55e">↓ ${Math.abs(pctChange).toFixed(0)}%</span>`
        : "—")
      : "New";
    return `<tr>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${provName}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(p.totalListings)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmt(p.foreclosurePosCount)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmt(p.motivatedCount)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmt(p.vtbCount)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmtDollar(p.avgListPrice)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${changeStr}</td>
    </tr>`;
  }).join("");

  sections.push(`
    <h2>Motivated Deals by Province</h2>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Province</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Total</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Foreclosure/POS</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Motivated</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">VTB</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Avg Price</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">M/M Change</th>
        </tr>
      </thead>
      <tbody>${provRows}</tbody>
    </table>
  `);

  const topProvince = provSorted[0];
  if (topProvince) {
    const topCities = (topProvince.topCitiesJson as any[]) || [];
    if (topCities.length > 0) {
      const provName = PROVINCE_NAMES[topProvince.province] || topProvince.province;
      const cityRows = topCities.slice(0, 15).map((c, i) =>
        `<tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${i + 1}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${c.name}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${c.count}</td>
        </tr>`
      ).join("");

      sections.push(`
        <h2>Top Cities in ${provName}</h2>
        <p>${provName} leads the country with ${fmt(topProvince.totalListings)} motivated-seller-flagged listings. Here are the top cities by volume:</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0; max-width:500px;">
          <thead>
            <tr style="background:#f1f5f9; text-align:left;">
              <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">#</th>
              <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">City</th>
              <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Listings</th>
            </tr>
          </thead>
          <tbody>${cityRows}</tbody>
        </table>
      `);
    }
  }

  sections.push(`
    <h2>Category Definitions</h2>
    <ul>
      <li><strong>Foreclosure / Power of Sale</strong> — Explicit lender-, receiver-, or court-directed terminology such as power of sale, mortgagee sale, foreclosure, receivership, or province-specific equivalents.</li>
      <li><strong>Motivated Seller</strong> — Urgency language such as must sell, motivated seller, urgent sale, or bring an offer. This is a marketing signal, not verification of financial hardship.</li>
      <li><strong>Vendor Take-Back (VTB)</strong> — Explicit seller- or vendor-financing language. Availability, amount, priority, rate, term, and legal structure still require confirmation.</li>
    </ul>
    <p>A listing can trigger more than one category. Category counts therefore overlap; they should not be added together to recreate the unique-listing total.</p>
  `);

  sections.push(`
    <h2>Methodology</h2>
    <p>Realist.ca queries active listing content distributed through the <a href="https://www.crea.ca/technology/realtor-ca-for-realtors/realtor-ca-tools/realtor-ca-ddf/" rel="nofollow">REALTOR.ca DDF®</a> and scores the <code>PublicRemarks</code> field using explicit phrases, negation handling, and province-specific legal terminology. Each unique listing is stored once per monthly capture with its score, triggered categories, matched terms, asking price, days on market, and location. Full remarks are not retained in the longitudinal table.</p>
    <p>This is a point-in-time search dataset, not a census of every financially stressed owner or every Canadian MLS® listing. DDF® participation and query results can change, public remarks may be incomplete, categories can overlap, and a phrase match does not establish legal status, seller motivation, market value, or an investment return. Always verify the listing, title, sale process, financing terms, condition, tenancy, and value with qualified local professionals.</p>
    ${intelligence ? `<p>Capture quality: <strong>${fmt(intelligence.coverage.queriesSucceeded)} of ${fmt(intelligence.coverage.queriesAttempted)}</strong> scheduled DDF® term queries succeeded across <strong>${fmt(intelligence.coverage.provincesCaptured)}</strong> provinces. Methodology version: <code>${intelligence.coverage.methodologyVersion}</code>.</p>` : ""}
  `);

  sections.push(`
    <h2>Explore the Data</h2>
    <p>Want to see the actual listings? Visit the <a href="/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1">Motivated Deals Browser</a> on Realist.ca to search, filter, and map motivated-seller listings in real time across all Canadian provinces.</p>
  `);

  return sections.join("\n");
}

export async function generateDistressReport(month: string): Promise<{ created: boolean; updated: boolean; slug: string; message: string }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must use YYYY-MM");
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthName = getMonthName(monthNum);

  const slug = distressReportSlugForMonth(month);

  const existingPost = await storage.getBlogPostBySlug(slug);

  const national = await db.select().from(distressSnapshots)
    .where(and(eq(distressSnapshots.month, month), sql`city IS NULL`));

  if (!national.length) {
    return { created: false, updated: false, slug, message: `No snapshot data found for ${month}. Run captureDistressSnapshots first.` };
  }

  const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
  const prevYear = monthNum === 1 ? year - 1 : year;
  const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
  const prevNational = await db.select().from(distressSnapshots)
    .where(and(eq(distressSnapshots.month, prevMonth), sql`city IS NULL`));

  const totalListings = national.reduce((s, p) => s + (p.totalListings || 0), 0);
  const totalForeclosure = national.reduce((s, p) => s + (p.foreclosurePosCount || 0), 0);
  const totalVtb = national.reduce((s, p) => s + (p.vtbCount || 0), 0);
  const intelligence = await getDistressMarketIntelligence({ month });

  const title = `Canada Motivated Deals Report — ${monthName} ${year}`;
  const content = generateDistressReportHtml({
    monthName, year, month, national, prevNational, intelligence,
  });

  const excerpt = `${monthName} ${year} Canadian motivated listing report: ${fmt(totalListings)} unique active listings flagged nationwide. ${fmt(totalForeclosure)} triggered foreclosure/POS language and ${fmt(totalVtb)} triggered VTB language, with province and cohort trends.`;
  const wordCount = content.replace(/<[^>]*>/g, " ").split(/\s+/).length;
  const readTimeMinutes = Math.max(4, Math.ceil(wordCount / 200));

  const tags = ["Motivated Deals", "Motivated Seller", "Power of Sale", "Foreclosure", "Investment Report", monthName + " " + year, "VTB"];

  const post = {
    title,
    slug,
    excerpt,
    content,
    authorName: "Realist Research",
    category: "distress-report",
    tags,
    status: "published",
    metaTitle: `Canada Motivated Listing Report ${monthName} ${year} — Power of Sale & VTB Signals | Realist.ca`,
    metaDescription: excerpt.substring(0, 160),
    readTimeMinutes,
    publishedAt: existingPost?.publishedAt || new Date(),
  };

  if (existingPost) {
    await storage.updateBlogPost(existingPost.id, post);
    return { created: false, updated: true, slug, message: `Updated motivated listing report for ${monthName} ${year}` };
  }

  await storage.createBlogPost(post);

  return { created: true, updated: false, slug, message: `Published motivated listing report for ${monthName} ${year}` };
}

export async function runMonthlyDistressReport(): Promise<{ action: string; details: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`;

  try {
    console.log(`[distress-report] Starting monthly snapshot capture for ${currentMonth}...`);
    const { provinces, cities, observations, failedProvinces } = await captureDistressSnapshots(currentMonth);

    if (provinces === 0) {
      return { action: "failed", details: "No province capture completed; DDF was unavailable or every scheduled search failed" };
    }

    if (failedProvinces.length > 0) {
      return {
        action: "partial",
        details: `Stored ${observations} observations from ${provinces} provinces; retry required for ${failedProvinces.join(", ")}`,
      };
    }

    console.log(`[distress-report] Generating blog report...`);
    const result = await generateDistressReport(currentMonth);

    if (result.created || result.updated) {
      console.log(`[distress-report] Published: ${result.message}`);
      return { action: result.updated ? "updated" : "published", details: `${result.message} (${provinces} provinces, ${cities} cities, ${observations} listing observations)` };
    } else {
      return { action: "exists", details: result.message };
    }
  } catch (error: any) {
    console.error("[distress-report] Monthly report failed:", error);
    return { action: "failed", details: error.message };
  }
}
