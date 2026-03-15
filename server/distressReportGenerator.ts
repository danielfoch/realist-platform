import { db } from "./db";
import { distressSnapshots } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { storage } from "./storage";
import { searchDdfByRemarks, normalizeDdfToRepliersFormat, isDdfConfigured } from "./creaDdf";
import { scoreDistress } from "@shared/distressScoring";

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
    "receivership", "reprise de finance", "estate sale",
  ],
  motivated: [
    "motivated", "priced to sell", "must sell",
    "price reduced", "immediate possession",
    "fixer upper", "handyman special", "bring an offer",
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
  mlsNumber?: string;
  listPrice?: number;
  daysOnMarket?: number;
  address?: { city?: string; state?: string };
  type?: string;
  distress: {
    distressScore: number;
    confidence: string;
    categoriesTriggered: { foreclosure_pos: boolean; motivated: boolean; vtb: boolean; commercial: boolean };
  };
  rawRemarks: string;
}

async function scanProvinceDistress(provinceName: string): Promise<ScoredListing[]> {
  const allTerms = [
    ...SEARCH_TERMS_BY_CATEGORY.foreclosure_pos,
    ...SEARCH_TERMS_BY_CATEGORY.motivated,
    ...SEARCH_TERMS_BY_CATEGORY.vtb,
  ];
  const uniqueTerms = [...new Set(allTerms)];
  const allListings = new Map<string, any>();

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
        for (const raw of r.value.listings) {
          const key = raw.ListingKey || raw.ListingId || "";
          if (key && !allListings.has(key)) {
            allListings.set(key, raw);
          }
        }
      }
    }
    if (c + 2 < uniqueTerms.length) await new Promise(r => setTimeout(r, 500));
  }

  return Array.from(allListings.values()).map(raw => {
    const normalized = normalizeDdfToRepliersFormat(raw);
    const remarks = raw.PublicRemarks || "";
    const distress = scoreDistress(remarks, provinceName);
    return { ...normalized, distress, rawRemarks: remarks } as ScoredListing;
  }).filter(l => l.distress.distressScore >= 1);
}

function computeSnapshotData(listings: ScoredListing[], province: string, city?: string) {
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
  };
}

export async function captureDistressSnapshots(month: string): Promise<{ provinces: number; cities: number }> {
  if (!isDdfConfigured()) {
    console.log("[distress-report] DDF not configured, skipping snapshot capture");
    return { provinces: 0, cities: 0 };
  }

  let provincesProcessed = 0;
  let citiesProcessed = 0;

  for (const prov of PROVINCES_TO_SCAN) {
    try {
      console.log(`[distress-report] Scanning ${prov.code}...`);
      const listings = await scanProvinceDistress(prov.code);
      console.log(`[distress-report] ${prov.code}: ${listings.length} distress listings found`);

      const provData = computeSnapshotData(listings, prov.abbr);
      provData.month = month;

      await db.delete(distressSnapshots).where(
        and(eq(distressSnapshots.month, month), eq(distressSnapshots.province, prov.abbr), sql`city IS NULL`)
      );
      await db.insert(distressSnapshots).values(provData as any);
      provincesProcessed++;

      const topCities = (provData.topCitiesJson as any[]) || [];
      for (const tc of topCities.slice(0, 10)) {
        if (tc.count >= 3) {
          const cityData = computeSnapshotData(listings, prov.abbr, tc.name);
          cityData.month = month;
          cityData.city = tc.name;

          await db.delete(distressSnapshots).where(
            and(eq(distressSnapshots.month, month), eq(distressSnapshots.province, prov.abbr), eq(distressSnapshots.city!, tc.name))
          );
          await db.insert(distressSnapshots).values(cityData as any);
          citiesProcessed++;
        }
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`[distress-report] Error scanning ${prov.code}:`, err.message);
    }
  }

  console.log(`[distress-report] Snapshot complete: ${provincesProcessed} provinces, ${citiesProcessed} cities`);
  return { provinces: provincesProcessed, cities: citiesProcessed };
}

function generateDistressReportHtml(params: {
  monthName: string;
  year: number;
  month: string;
  national: any[];
  prevNational: any[];
}): string {
  const { monthName, year, month, national, prevNational } = params;
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
    <p>Realist.ca scanned active MLS listings across all Canadian provinces for distress-related language in ${monthName} ${year}. We identified <strong>${fmt(totalListings)}</strong> listings${trend(totalListings, prevTotal)} with distress signals, categorized by type and severity.</p>

    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Category</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Count</th>
          <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">% of Total</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Foreclosure / Power of Sale</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalForeclosure)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalForeclosure / totalListings * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Motivated Seller</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalMotivated)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalMotivated / totalListings * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Vendor Take-Back (VTB)</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(totalVtb)}</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${totalListings ? (totalVtb / totalListings * 100).toFixed(1) : 0}%</td></tr>
      </tbody>
    </table>

    <p><strong>${fmt(totalHigh)}</strong> listings were flagged with <strong>high confidence</strong> (score ≥ 40) and <strong>${fmt(totalMedium)}</strong> with medium confidence (score 15–39). These represent the strongest investment opportunities for distress-focused buyers.</p>
  `);

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
    <h2>Distress Deals by Province</h2>
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
        <p>${provName} leads the country with ${fmt(topProvince.totalListings)} distress-flagged listings. Here are the top cities by volume:</p>
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
      <li><strong>Foreclosure / Power of Sale</strong> — Listings identified as court-ordered, lender-directed, or estate-related sales. These typically offer the deepest discounts but may require as-is purchases.</li>
      <li><strong>Motivated Seller</strong> — Listings where the seller has signaled urgency through pricing language, condition disclosures, or explicit calls for offers. These can be negotiated aggressively.</li>
      <li><strong>Vendor Take-Back (VTB)</strong> — Listings where the seller offers financing. These are particularly valuable in high-rate environments as they can reduce reliance on institutional lending.</li>
    </ul>
  `);

  sections.push(`
    <h2>Methodology</h2>
    <p>Realist.ca's Distress Deals engine scans all active listings on the CREA DDF (Data Distribution Facility) for distress-related language in the public remarks field. Each listing is scored using a proprietary algorithm that weighs keyword matches, negation patterns, and provincial legal terminology. Listings are classified into three confidence tiers: <strong>High</strong> (score ≥ 40), <strong>Medium</strong> (15–39), and <strong>Low</strong> (1–14).</p>
    <p>Data is sourced from the Canadian Real Estate Association and refreshed monthly. Some listings may appear in multiple categories if they match keywords across different distress types.</p>
  `);

  sections.push(`
    <h2>Explore the Data</h2>
    <p>Want to see the actual listings? Visit the <a href="/tools/distress-deals">Distress Deals Browser</a> on Realist.ca to search, filter, and map distress listings in real time across all Canadian provinces.</p>
  `);

  return sections.join("\n");
}

export async function generateDistressReport(month: string): Promise<{ created: boolean; slug: string; message: string }> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthName = getMonthName(monthNum);

  const slug = slugify(`canada-distress-deals-report-${monthName}-${year}`);

  const existingPost = await storage.getBlogPostBySlug(slug);
  if (existingPost) {
    return { created: false, slug, message: `Distress report already exists for ${monthName} ${year}` };
  }

  const national = await db.select().from(distressSnapshots)
    .where(and(eq(distressSnapshots.month, month), sql`city IS NULL`));

  if (!national.length) {
    return { created: false, slug, message: `No snapshot data found for ${month}. Run captureDistressSnapshots first.` };
  }

  const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
  const prevYear = monthNum === 1 ? year - 1 : year;
  const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
  const prevNational = await db.select().from(distressSnapshots)
    .where(and(eq(distressSnapshots.month, prevMonth), sql`city IS NULL`));

  const totalListings = national.reduce((s, p) => s + (p.totalListings || 0), 0);
  const totalForeclosure = national.reduce((s, p) => s + (p.foreclosurePosCount || 0), 0);
  const totalVtb = national.reduce((s, p) => s + (p.vtbCount || 0), 0);

  const title = `Canada Distress Deals Report — ${monthName} ${year}`;
  const content = generateDistressReportHtml({
    monthName, year, month, national, prevNational,
  });

  const excerpt = `${monthName} ${year} Canadian distress deals report: ${fmt(totalListings)} active distress-flagged listings found nationwide. ${fmt(totalForeclosure)} foreclosure/POS, ${fmt(totalVtb)} VTB opportunities. Province-by-province breakdown with month-over-month trends.`;
  const wordCount = content.replace(/<[^>]*>/g, " ").split(/\s+/).length;
  const readTimeMinutes = Math.max(4, Math.ceil(wordCount / 200));

  const tags = ["Distress Deals", "Power of Sale", "Foreclosure", "Investment Report", monthName + " " + year, "VTB", "Motivated Seller"];

  await storage.createBlogPost({
    title,
    slug,
    excerpt,
    content,
    authorName: "Realist Research",
    category: "distress-report",
    tags,
    status: "published",
    metaTitle: `Canada Distress Deals Report ${monthName} ${year} — Foreclosure, POS & VTB | Realist.ca`,
    metaDescription: excerpt.substring(0, 160),
    readTimeMinutes,
    publishedAt: new Date(),
  });

  return { created: true, slug, message: `Published distress report for ${monthName} ${year}` };
}

export async function runMonthlyDistressReport(): Promise<{ action: string; details: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`;

  try {
    console.log(`[distress-report] Starting monthly snapshot capture for ${currentMonth}...`);
    const { provinces, cities } = await captureDistressSnapshots(currentMonth);

    if (provinces === 0) {
      return { action: "skipped", details: "No provinces scanned (DDF not configured)" };
    }

    console.log(`[distress-report] Generating blog report...`);
    const result = await generateDistressReport(currentMonth);

    if (result.created) {
      console.log(`[distress-report] Published: ${result.message}`);
      return { action: "published", details: `${result.message} (${provinces} provinces, ${cities} cities scanned)` };
    } else {
      return { action: "exists", details: result.message };
    }
  } catch (error: any) {
    console.error("[distress-report] Monthly report failed:", error);
    return { action: "failed", details: error.message };
  }
}
