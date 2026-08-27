/**
 * lib/seo/redirects.ts — legacy URL mappings from the old realist.ca app.
 *
 * The old app served research content under /insights (hub) and
 * /insights/reports/:slug (config reports). The lean rebuild renders the same
 * reports at /research/:slug, and there are deliberately NO /insights routes —
 * these entries are meant to be spread into next.config's redirects() so the
 * old URLs 301 to their new homes. Not imported by app code.
 */

export interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

/** Old config-report slugs that ported 1:1 — same slug, new prefix. */
const PORTED_REPORT_SLUGS = [
  "canada-real-estate-search-questions-2026",
  "rbc-homebuyer-timing-2026",
  "teranet-q1-2026-ontario-buyer-reset",
  "canada-cpi-may-2026-rates-hold",
  "interprovincial-migration-fraser-1995-2024",
] as const;

export const LEGACY_REDIRECTS: RedirectEntry[] = [
  { source: "/insights", destination: "/research", permanent: true },
  { source: "/insights/reports", destination: "/research", permanent: true },
  ...PORTED_REPORT_SLUGS.map((slug) => ({
    source: `/insights/reports/${slug}`,
    destination: `/research/${slug}`,
    permanent: true,
  })),
];
