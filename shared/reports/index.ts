/**
 * shared/reports/index.ts — the config-report content directory.
 *
 * TO PUBLISH A RICH REPORT: create a `<slug>.ts` file in this folder exporting
 * a typed `ReportContent` object (see reportContent.ts for the schema and
 * interprovincial-migration-config.ts for a full worked example), then add it
 * to the `configReports` array below. That is the ENTIRE flow — no React, no
 * route wiring, no bespoke shared/reportsRegistry.ts entry:
 *
 *   - `getConfigReport(slug)` powers the client route + server SEO lookup.
 *   - `configReportRegistryEntries` is spread into shared/reportsRegistry.ts so
 *     every hub (InsightsHub / ReportsHub / MarketReport) and the sitemap pick
 *     the report up automatically, newest-first.
 *
 * Every report is validated at module load; a malformed report throws with a
 * precise error list instead of silently rendering broken.
 */
import {
  assertValidReportContent,
  reportContentsToRegistryEntries,
  type ReportContent,
} from "../reportContent";
import type { ReportRegistryEntry } from "../reportsRegistry";
import { canadaCpiMay2026ConfigReport } from "./canada-cpi-may-2026-config";
import { interprovincialMigrationConfigReport } from "./interprovincial-migration-config";
import { rbcHomebuyerTiming2026ConfigReport } from "./rbc-homebuyer-timing-2026-config";
import { teranetQ12026OntarioBuyerResetConfigReport } from "./teranet-q1-2026-ontario-buyer-reset-config";

/**
 * Every config report. Add new report objects here (imported from their own
 * file). Order does not matter — everything downstream sorts by publishDate.
 */
export const configReports: ReportContent[] = [
  rbcHomebuyerTiming2026ConfigReport,
  teranetQ12026OntarioBuyerResetConfigReport,
  canadaCpiMay2026ConfigReport,
  interprovincialMigrationConfigReport,
].map(assertValidReportContent);

/** Fail fast on duplicate slugs (a copy-paste hazard for a content agent). */
(function assertUniqueSlugs() {
  const seen = new Set<string>();
  for (const report of configReports) {
    if (seen.has(report.slug)) {
      throw new Error(`Duplicate config report slug: "${report.slug}"`);
    }
    seen.add(report.slug);
  }
})();

const bySlug = new Map(configReports.map((report) => [report.slug, report]));

/** Look up a config report by slug (client route + server SEO both use this). */
export function getConfigReport(slug: string | undefined): ReportContent | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}

/** All config-report slugs. */
export function configReportSlugs(): string[] {
  return configReports.map((report) => report.slug);
}

/**
 * Registry entries for every config report, newest-first. Spread this into
 * shared/reportsRegistry.ts (see the `...configReportRegistryEntries` line
 * there) so config reports live in the same registry as code reports.
 */
export const configReportRegistryEntries: ReportRegistryEntry[] =
  reportContentsToRegistryEntries(configReports);
