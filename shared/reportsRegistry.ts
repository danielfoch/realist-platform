/**
 * Reports registry — the single source of truth for every routed report page.
 *
 * Hubs (InsightsHub, ReportsHub, MarketReport), server/sitemap.ts, and any
 * "latest release" slot all derive from this array. Publishing a new report
 * means: add the component + route, then add ONE entry here — every surface
 * picks it up automatically.
 *
 * Keep `route` in sync with client/src/App.tsx. Dates are ISO (YYYY-MM-DD)
 * publish dates and drive newest-first ordering everywhere.
 */

import { configReportRegistryEntries } from "./reports";

export type ReportKind = "macro" | "market" | "research";

/**
 * Config reports (data + narrative content files under shared/reports/, rendered
 * by client/src/components/reports/ReportRenderer.tsx) register here too, so
 * every hub + sitemap treats them exactly like code reports. They are appended
 * via `configReportRegistryEntries` at the bottom of `reportsRegistry`.
 */

export interface ReportRegistryEntry {
  slug: string;
  /** Client route as registered in App.tsx (or matched by /reports/:slug). */
  route: string;
  title: string;
  description: string;
  /** ISO publish date (YYYY-MM-DD). Drives newest-first sorting. */
  date: string;
  tags: string[];
  kind: ReportKind;
  /**
   * True when the body is served from the blog-posts db through ReportPage
   * (/reports/:slug). These URLs are already emitted by buildReportsSitemap,
   * so buildPagesSitemap skips them to avoid duplicate sitemap entries.
   */
  db?: boolean;
  /**
   * True for config-driven reports (shared/reports/, rendered by
   * ReportRenderer at /insights/reports/:slug). Like `db`, these are emitted by
   * buildReportsSitemap, so buildPagesSitemap skips them to avoid duplicates.
   */
  config?: boolean;
}

export const reportsRegistry: ReportRegistryEntry[] = [
  {
    slug: "canada-interprovincial-migration-2026",
    route: "/insights/canada-interprovincial-migration-2026",
    title: "Interprovincial Migration: Alberta Wins, Ontario Loses",
    description:
      "Fraser Institute's 1995/96-2024/25 migration study turned into an investor-facing report with interactive charts, age-group breakdowns, and housing implications.",
    date: "2026-06-12",
    tags: ["migration", "alberta", "ontario", "demographics"],
    kind: "research",
  },
  {
    slug: "realbench-ai-realtor-benchmark",
    route: "/reports/realbench-ai-realtor-benchmark",
    title: "RealBench: AI Benchmark for Realtors",
    description:
      "Frontier AI models scored on the work agents actually do — offers, showings, CRM, email, property research, marketing, and valuation.",
    date: "2026-06-10",
    tags: ["ai", "realtors", "benchmark"],
    kind: "research",
  },
  {
    slug: "statcan-labour-force-survey-may-2026",
    route: "/insights/statcan-labour-force-survey-may-2026",
    title: "Labour Force Survey — May 2026",
    description:
      "Jobs jump 88,000 and unemployment falls to 6.6% as full-time work rebounds. What the latest StatCan jobs print means for buyers, sellers, investors, renewers and Realtors.",
    date: "2026-06-05",
    tags: ["labour", "statcan", "jobs"],
    kind: "macro",
  },
  {
    slug: "canada-immigration-dashboard-2026",
    route: "/reports/canada-immigration-dashboard-2026",
    title: "Canada Immigration Dashboard 2026",
    description:
      "Interactive IRCC dashboard for temporary resident approvals, permanent resident admissions, and asylum claimant movement.",
    date: "2026-06-05",
    tags: ["immigration", "ircc", "demographics"],
    kind: "macro",
  },
  {
    slug: "housing-correction-locked-out-2026",
    route: "/insights/housing-correction-locked-out-2026",
    title: "A 20% Housing Drop — Still Locked Out",
    description:
      "Prices are down ~20% from peak (30%+ in some cities), yet 55% of Canadians want them lower still. Why affordability is barely improved, and what it means for buyers, sellers and investors.",
    date: "2026-06-02",
    tags: ["housing", "affordability", "prices"],
    kind: "macro",
  },
  {
    slug: "equifax-consumer-credit-trends-q1-2026",
    route: "/reports/equifax-consumer-credit-trends-q1-2026",
    title: "Equifax Consumer Credit Trends Q1 2026",
    description:
      "Ontario and BC mortgage holders are driving consumer-credit stress as insolvencies rise and renewal pressure persists.",
    date: "2026-06-02",
    tags: ["credit", "equifax", "mortgages"],
    kind: "macro",
    db: true,
  },
  {
    slug: "statcan-gdp-q1-2026",
    route: "/insights/statcan-gdp-q1-2026",
    title: "GDP Q1 2026 — Economy Stalls",
    description:
      "Real GDP flatlines at 0.0% and the per-capita recession deepens. Residential investment is the biggest drag, with resale activity down 9.9%. All six StatCan charts recreated.",
    date: "2026-05-29",
    tags: ["gdp", "statcan", "economy"],
    kind: "macro",
  },
  {
    slug: "bank-of-canada-financial-stability-report-2026",
    route: "/reports/bank-of-canada-financial-stability-report-2026",
    title: "Bank of Canada Financial Stability Report 2026",
    description:
      "Bank of Canada read-through on mortgage arrears, renewal shock, Toronto stress pockets, valuations, and funding-market risk.",
    date: "2026-05-27",
    tags: ["bank-of-canada", "financial-stability", "mortgages"],
    kind: "macro",
    db: true,
  },
  {
    slug: "monthly-market-report-may-2026",
    route: "/insights/monthly-market-report-may-2026",
    title: "Monthly Market Report — May 2026",
    description:
      "A 30-45 minute investor webinar deck covering labour, CPI, the oil shock, the Bank of Canada outlook, CMHC mortgage stress, supply, demographics, distress and the cycle playbook.",
    date: "2026-05-25",
    tags: ["monthly-report", "slide-deck"],
    kind: "macro",
  },
  {
    slug: "labour-mortgage-stress-april-2026",
    route: "/insights/labour-mortgage-stress-april-2026",
    title: "Labour + Mortgage Arrears Watch — April 2026",
    description:
      "Compares StatCan's April jobs report with February payroll and vacancy data, then links unemployment to mortgage arrears risk using CBA context.",
    date: "2026-05-08",
    tags: ["labour", "arrears", "mortgages"],
    kind: "macro",
  },
  {
    slug: "statcan-labour-force-survey-april-2026",
    route: "/insights/statcan-labour-force-survey-april-2026",
    title: "Labour Force Survey — April 2026",
    description:
      "Unemployment ticks to 6.9% as Quebec sheds 43,000 jobs. What the latest StatCan jobs print means for buyers, sellers, investors, renewers and Realtors.",
    date: "2026-05-08",
    tags: ["labour", "statcan", "jobs"],
    kind: "macro",
  },
  {
    slug: "precon-vs-resale-1990s",
    route: "/insights/precon-vs-resale-1990s",
    title: "Pre-Con vs Resale: The 1990s Correction",
    description:
      "Reconstructed 1985-2000 GTA condo PSF — pre-con vs resale, premium spread, and what it suggests for today. Private client report; access by share link.",
    date: "2026-04-30",
    tags: ["precon", "resale", "gta", "private"],
    kind: "research",
  },
  {
    slug: "bank-of-canada-april-2026",
    route: "/insights/bank-of-canada-april-2026",
    title: "Bank of Canada — April 2026 Monetary Policy Report",
    description:
      "Inflation risk is back, but housing remains weak. What the latest Monetary Policy Report means for buyers, sellers, investors, renewers, and Realtors.",
    date: "2026-04-29",
    tags: ["bank-of-canada", "rates", "monetary-policy"],
    kind: "macro",
  },
  {
    slug: "spring-economic-update-2026",
    route: "/insights/spring-economic-update-2026",
    title: "Spring Economic Update 2026",
    description:
      "What Ottawa's spring fiscal update says about Canadian real estate — affordability, starts, inflation, rates, and the deficit through an investor lens.",
    date: "2026-04-29",
    tags: ["fiscal", "ottawa", "budget"],
    kind: "macro",
  },
  {
    slug: "the-spread-that-ate-the-economy",
    route: "/insights/the-spread-that-ate-the-economy",
    title: "The Spread That Ate the Economy",
    description:
      "Interactive research on Canadian mortgage vs business credit spreads, yield compression, entrepreneurship, and productivity.",
    date: "2026-04-24",
    tags: ["credit-spreads", "productivity", "interactive"],
    kind: "research",
  },
  {
    slug: "cmhc-land-use-regulations-housing-canada-2026",
    route: "/reports/cmhc-land-use-regulations-housing-canada-2026",
    title: "CMHC Land Use Regulations Report",
    description:
      "What CMHC's 2026 research says about zoning, approval rules, house prices, and housing supply growth in Canada.",
    date: "2026-04-23",
    tags: ["cmhc", "zoning", "supply"],
    kind: "research",
    db: true,
  },
  {
    slug: "cpi-march-2026",
    route: "/insights/cpi-march-2026",
    title: "CPI Report — March 2026",
    description:
      "Statistics Canada's latest inflation release with provincial breakdown and investor interpretation.",
    date: "2026-04-22",
    tags: ["cpi", "inflation", "statcan"],
    kind: "macro",
  },
  {
    slug: "gta-precon-pricing",
    route: "/insights/gta-precon-pricing",
    title: "GTA Pre-Construction Pricing Movement",
    description:
      "Floorplan-level cuts vs raises across 1,000+ active GTA pre-con units. Builder pricing power, rebate benchmark, resale implications.",
    date: "2026-04-21",
    tags: ["precon", "gta", "pricing"],
    kind: "market",
  },
  {
    slug: "new-construction-canada",
    route: "/insights/new-construction-canada",
    title: "Canada New Construction Market",
    description:
      "Live snapshot of active new construction listings across Canada. Pricing, regions, property types, pre-con signals.",
    date: "2026-04-20",
    tags: ["new-construction", "crea-ddf", "live"],
    kind: "market",
  },
  {
    slug: "cmhc-2025-annual-report-housing-market",
    route: "/reports/cmhc-2025-annual-report-housing-market",
    title: "CMHC 2025 Annual Report",
    description:
      "Housing starts, rental vacancy, mortgage insurance, multi-unit financing, and federal supply programs through a market lens.",
    date: "2026-04-17",
    tags: ["cmhc", "housing-starts", "vacancy"],
    kind: "macro",
    db: true,
  },
  {
    slug: "building-permits",
    route: "/insights/building-permits",
    title: "Canadian Building Permits — February 2026",
    description:
      "Total permits fell 8.4% to $12.1B. Non-residential down 24%, residential up 1.7%. What it means for the housing pipeline.",
    date: "2026-04-13",
    tags: ["building-permits", "statcan", "supply"],
    kind: "macro",
  },
  {
    slug: "bank-of-canada-consumers-path-mortgage-delinquency-2026",
    route: "/reports/bank-of-canada-consumers-path-mortgage-delinquency-2026",
    title: "Mortgage Delinquency Early Warning Signals",
    description:
      "Bank of Canada research shows credit-card utilization and arrears often rise one to two years before mortgage delinquency.",
    date: "2026-02-26",
    tags: ["bank-of-canada", "delinquency", "credit"],
    kind: "macro",
    db: true,
  },
  {
    slug: "productivity-gap",
    route: "/insights/productivity-gap",
    title: "Canada-US Productivity Gap",
    description:
      "Top 10% of earners account for 75% of the GDP gap. Implications for Canadian real estate investors.",
    date: "2024-12-01",
    tags: ["productivity", "gdp", "canada-us"],
    kind: "research",
  },
  // Config reports (shared/reports/) — data + narrative content files rendered
  // by ReportRenderer at /insights/reports/:slug. Appended here so InsightsHub,
  // ReportsHub, MarketReport, and the sitemap pick them up automatically.
  ...configReportRegistryEntries,
];

/** All registry entries sorted newest-first. */
export function sortedReports(entries: ReportRegistryEntry[] = reportsRegistry): ReportRegistryEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

/** Newest entry overall, or newest of a given kind. */
export function latestReport(kind?: ReportKind): ReportRegistryEntry {
  const pool = kind ? reportsRegistry.filter((entry) => entry.kind === kind) : reportsRegistry;
  return sortedReports(pool)[0];
}

/** Human-readable date label, e.g. "Jun 12, 2026". */
export function reportDateLabel(entry: ReportRegistryEntry): string {
  const [year, month, day] = entry.date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
