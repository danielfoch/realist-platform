/**
 * reportContent.ts — the typed, React-free schema for CONFIG-DRIVEN reports.
 *
 * The problem this solves: today every realist.ca report is bespoke React
 * (client/src/pages/CpiInflationReport.tsx, InterprovincialMigration...tsx,
 * ...). A new report means new components, a new route, and a
 * shared/reportsRegistry.ts entry. That does not scale and is unsafe for a
 * content agent to extend.
 *
 * A config report is instead pure DATA + NARRATIVE: one committed TS object
 * describing sections (narrative, charts, stat grids, callouts), sources, and a
 * CTA. It renders through a single client component
 * (client/src/components/reports/ReportRenderer.tsx) with interactive recharts,
 * and it registers into the SAME shared/reportsRegistry.ts that every hub +
 * sitemap already reads — via `reportContentToRegistryEntry` below.
 *
 * This module is intentionally free of any React / DOM imports so it can be
 * consumed by the client renderer, the server SEO/crawler layer, the sitemap
 * builder, and the unit tests alike.
 */

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

import type { ReportKind } from "./reportsRegistry";

export type { ReportKind };

/** How a numeric value / axis is formatted when rendered or described. */
export type ValueFormat = "currency" | "percent" | "number";

/** Supported recharts chart types for a ChartBlock. */
export type ChartType = "line" | "bar" | "area" | "composed";

/**
 * One plotted series inside a chart. `key` maps to a field on every row in
 * `ChartBlock.data`. `color` is optional — when omitted the renderer assigns a
 * palette color (hsl(var(--chart-N))) by index.
 */
export interface ChartSeries {
  key: string;
  label: string;
  /** Any CSS color string, e.g. "hsl(var(--chart-1))" or "#0f766e". */
  color?: string;
  /**
   * For a "composed" chart, whether this series draws as a bar, line, or area.
   * Ignored for single-type charts (they follow the block `chartType`).
   */
  type?: "line" | "bar" | "area";
}

/** A row of chart data: an x label plus one numeric value per series key. */
export type ChartDatum = Record<string, number | string>;

// ---------------------------------------------------------------------------
// Section blocks
// ---------------------------------------------------------------------------

/**
 * Narrative prose. `body` is a lightweight markdown-ish string: paragraphs are
 * separated by blank lines, `## ` starts a subheading, `- ` starts a bullet,
 * and `**bold**` / `[label](href)` inline spans are supported by the renderer.
 * No raw HTML — the renderer escapes everything.
 */
export interface NarrativeSection {
  type: "narrative";
  /** Optional H2 heading rendered above the prose. */
  heading?: string;
  /** Stable id for in-page anchors / crawler headings. */
  id?: string;
  body: string;
}

/** An interactive recharts block. */
export interface ChartBlock {
  type: "chart";
  chartType: ChartType;
  title: string;
  /** Optional caption rendered under the chart. */
  caption?: string;
  id?: string;
  /** The x-axis label rendered under the chart / used in the table fallback. */
  data: ChartDatum[];
  series: ChartSeries[];
  /** Field on each datum used for the x-axis (categorical or time). */
  xKey: string;
  /** Optional axis title for the y-axis. */
  yAxisLabel?: string;
  /** Optional axis title for the x-axis. */
  xAxisLabel?: string;
  /** How y values / tooltips are formatted. Defaults to "number". */
  format?: ValueFormat;
  /**
   * Optional horizontal reference line (e.g. a target or national average),
   * drawn across the plot and described in the crawler table.
   */
  referenceLine?: { value: number; label: string };
}

/** A single stat inside a StatGridBlock. */
export interface StatItem {
  label: string;
  value: string;
  /** Optional sub-line, e.g. "vs. 2.1% last month". */
  detail?: string;
  /** Optional direction hint for styling: "up" | "down" | "flat". */
  trend?: "up" | "down" | "flat";
}

/** A responsive grid of headline stats. */
export interface StatGridBlock {
  type: "statGrid";
  heading?: string;
  id?: string;
  stats: StatItem[];
}

/** A highlighted callout / key-takeaway box. */
export interface CalloutBlock {
  type: "callout";
  /** Visual tone. Defaults to "info". */
  tone?: "info" | "warning" | "success";
  heading?: string;
  id?: string;
  body: string;
}

export type ReportSection =
  | NarrativeSection
  | ChartBlock
  | StatGridBlock
  | CalloutBlock;

// ---------------------------------------------------------------------------
// Sources / author / CTA / hero
// ---------------------------------------------------------------------------

export interface Source {
  label: string;
  url: string;
  /** Optional publisher / table reference, e.g. "StatCan Table 18-10-0004". */
  publisher?: string;
}

export interface ReportAuthor {
  name: string;
  /**
   * schema.org Person @id. Defaults to the site-wide Daniel Foch Person node so
   * config reports share author identity with the rest of realist.ca.
   */
  personId: string;
  /** Public profile / bio URL. */
  url?: string;
}

export interface ReportCta {
  /** Where the primary button points, e.g. "/tools/analyzer". */
  toolUrl: string;
  headline: string;
  body: string;
}

export interface ReportHeroStat {
  label: string;
  value: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// The report content object
// ---------------------------------------------------------------------------

export interface ReportContent {
  slug: string;
  title: string;
  /** The one-line standfirst / subtitle under the H1. */
  dek: string;
  author: ReportAuthor;
  /** ISO publish date (YYYY-MM-DD). */
  publishDate: string;
  kind: ReportKind;
  tags: string[];
  /** Optional big hero number at the top of the report. */
  heroStat?: ReportHeroStat;
  sections: ReportSection[];
  sources: Source[];
  cta: ReportCta;
  /** Optional social/OG image path or URL. */
  ogImage?: string;
  /** Optional SEO overrides; fall back to title/dek when omitted. */
  metaTitle?: string;
  metaDescription?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** The site-wide Daniel Foch Person @id (see client SEO personSchema). */
export const DANIEL_FOCH_PERSON_ID = "https://realist.ca/#danielfoch";

/** The default author for config reports. */
export const DEFAULT_AUTHOR: ReportAuthor = {
  name: "Daniel Foch",
  personId: DANIEL_FOCH_PERSON_ID,
  url: "https://realist.ca/danielfoch",
};

/** Route prefix for config reports. Kept in one place. */
export const CONFIG_REPORT_ROUTE_PREFIX = "/insights/reports";

/** Build the canonical client route for a config report. */
export function reportRoute(slug: string): string {
  return `${CONFIG_REPORT_ROUTE_PREFIX}/${slug}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KINDS: ReportKind[] = ["macro", "market", "research"];
const VALID_CHART_TYPES: ChartType[] = ["line", "bar", "area", "composed"];
const VALID_FORMATS: ValueFormat[] = ["currency", "percent", "number"];

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time);
}

function validateChartBlock(block: ChartBlock, path: string, errors: string[]): void {
  if (!VALID_CHART_TYPES.includes(block.chartType)) {
    errors.push(`${path}: unknown chartType "${block.chartType}"`);
  }
  if (!block.title?.trim()) errors.push(`${path}: chart missing title`);
  if (!Array.isArray(block.series) || block.series.length === 0) {
    errors.push(`${path}: chart needs at least one series`);
  }
  if (!Array.isArray(block.data) || block.data.length === 0) {
    errors.push(`${path}: chart needs at least one data row`);
    return;
  }
  if (!block.xKey?.trim()) {
    errors.push(`${path}: chart missing xKey`);
  }
  if (block.format && !VALID_FORMATS.includes(block.format)) {
    errors.push(`${path}: unknown format "${block.format}"`);
  }
  const seriesKeys = new Set<string>();
  for (const [i, s] of block.series.entries()) {
    if (!s.key?.trim()) errors.push(`${path}.series[${i}]: missing key`);
    if (!s.label?.trim()) errors.push(`${path}.series[${i}]: missing label`);
    if (seriesKeys.has(s.key)) errors.push(`${path}.series[${i}]: duplicate key "${s.key}"`);
    seriesKeys.add(s.key);
  }
  // Every series key must resolve to a numeric value on every row, and every
  // row must carry the xKey. This is what makes the crawler table + tooltips
  // safe.
  block.data.forEach((row, ri) => {
    if (block.xKey && !(block.xKey in row)) {
      errors.push(`${path}.data[${ri}]: missing xKey "${block.xKey}"`);
    }
    for (const s of block.series) {
      if (!(s.key in row)) {
        errors.push(`${path}.data[${ri}]: missing series value "${s.key}"`);
      } else if (typeof row[s.key] !== "number" || Number.isNaN(row[s.key] as number)) {
        errors.push(`${path}.data[${ri}].${s.key}: must be a finite number`);
      }
    }
  });
}

function validateSection(section: ReportSection, path: string, errors: string[]): void {
  switch (section.type) {
    case "narrative":
      if (!section.body?.trim()) errors.push(`${path}: narrative missing body`);
      break;
    case "chart":
      validateChartBlock(section, path, errors);
      break;
    case "statGrid":
      if (!Array.isArray(section.stats) || section.stats.length === 0) {
        errors.push(`${path}: statGrid needs at least one stat`);
      } else {
        section.stats.forEach((stat, si) => {
          if (!stat.label?.trim()) errors.push(`${path}.stats[${si}]: missing label`);
          if (!stat.value?.trim()) errors.push(`${path}.stats[${si}]: missing value`);
        });
      }
      break;
    case "callout":
      if (!section.body?.trim()) errors.push(`${path}: callout missing body`);
      break;
    default:
      errors.push(`${path}: unknown section type "${(section as { type: string }).type}"`);
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a report content object. Returns every problem found (not just the
 * first) so a content agent gets one actionable list. Used by the content dir
 * index and by the test suite.
 */
export function validateReportContent(report: ReportContent): ValidationResult {
  const errors: string[] = [];

  if (!report.slug?.trim()) {
    errors.push("slug: required");
  } else if (!SLUG_RE.test(report.slug)) {
    errors.push(`slug: "${report.slug}" must be lowercase kebab-case`);
  }
  if (!report.title?.trim()) errors.push("title: required");
  if (!report.dek?.trim()) errors.push("dek: required");
  if (!report.publishDate?.trim() || !isIsoDate(report.publishDate)) {
    errors.push(`publishDate: "${report.publishDate}" must be a valid ISO date (YYYY-MM-DD)`);
  }
  if (!VALID_KINDS.includes(report.kind)) {
    errors.push(`kind: "${report.kind}" must be one of ${VALID_KINDS.join(", ")}`);
  }
  if (!Array.isArray(report.tags) || report.tags.length === 0) {
    errors.push("tags: at least one tag required");
  }

  if (!report.author?.name?.trim()) errors.push("author.name: required");
  if (!report.author?.personId?.trim()) errors.push("author.personId: required");

  if (!Array.isArray(report.sections) || report.sections.length === 0) {
    errors.push("sections: at least one section required");
  } else {
    report.sections.forEach((section, i) => validateSection(section, `sections[${i}]`, errors));
  }

  if (!Array.isArray(report.sources)) {
    errors.push("sources: must be an array");
  } else {
    report.sources.forEach((src, i) => {
      if (!src.label?.trim()) errors.push(`sources[${i}].label: required`);
      if (!src.url?.trim()) errors.push(`sources[${i}].url: required`);
    });
  }

  if (!report.cta?.toolUrl?.trim()) errors.push("cta.toolUrl: required");
  if (!report.cta?.headline?.trim()) errors.push("cta.headline: required");
  if (!report.cta?.body?.trim()) errors.push("cta.body: required");

  return { valid: errors.length === 0, errors };
}

/** Throwing variant — used at module load to fail fast on a malformed report. */
export function assertValidReportContent(report: ReportContent): ReportContent {
  const result = validateReportContent(report);
  if (!result.valid) {
    throw new Error(
      `Invalid report content "${report.slug || "(no slug)"}":\n - ${result.errors.join("\n - ")}`,
    );
  }
  return report;
}

// ---------------------------------------------------------------------------
// Value / axis formatting (shared by charts, tooltips, and the crawler table)
// ---------------------------------------------------------------------------

/**
 * Format a numeric value according to a ValueFormat. Kept pure and shared so
 * the interactive recharts tooltips and the server-rendered accessible table
 * describe numbers identically.
 */
export function formatValue(value: number, format: ValueFormat = "number"): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
      }).format(value);
    case "percent":
      // Values are expressed in percent points already (2.4 -> "2.4%").
      return `${value > 0 ? "" : ""}${value.toLocaleString("en-CA", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })}%`;
    case "number":
    default:
      return value.toLocaleString("en-CA", { maximumFractionDigits: 2 });
  }
}

/** Compact axis-tick formatter (e.g. 12,500 -> "12.5k", 2.4 -> "2.4%"). */
export function formatAxisTick(value: number, format: ValueFormat = "number"): string {
  if (!Number.isFinite(value)) return "";
  if (format === "percent") return `${value}%`;
  const abs = Math.abs(value);
  if (format === "currency") {
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
    return `$${value}`;
  }
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

/** The default chart palette, mapped to the app's --chart-N CSS variables. */
export const CHART_PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/** Resolve a series color: explicit color wins, else a palette color by index. */
export function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

/**
 * Shape a ChartBlock into rows of `{ x, values: [{label, formatted}] }` for the
 * accessible crawler table fallback. Pure and deterministic so the server SEO
 * layer and tests can rely on it.
 */
export function chartToTableRows(block: ChartBlock): Array<{
  x: string;
  cells: Array<{ label: string; raw: number | string; formatted: string }>;
}> {
  return block.data.map((row) => ({
    x: String(row[block.xKey] ?? ""),
    cells: block.series.map((s) => {
      const raw = row[s.key];
      return {
        label: s.label,
        raw,
        formatted: typeof raw === "number" ? formatValue(raw, block.format) : String(raw ?? "—"),
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// Registry mapping — the bridge into shared/reportsRegistry.ts
// ---------------------------------------------------------------------------

import type { ReportRegistryEntry } from "./reportsRegistry";

/**
 * Map a ReportContent object to a reportsRegistry entry. This is what lets a new
 * config report auto-appear in every hub + sitemap: the content dir's index
 * spreads these into the registry (or, if you prefer an explicit registry, you
 * copy one line). `db` is intentionally omitted — config reports are NOT served
 * from the blog-posts db, so buildPagesSitemap emits them like any code report.
 */
export function reportContentToRegistryEntry(report: ReportContent): ReportRegistryEntry {
  return {
    slug: report.slug,
    route: reportRoute(report.slug),
    title: report.title,
    description: report.metaDescription || report.dek,
    date: report.publishDate,
    tags: report.tags,
    kind: report.kind,
    // Config reports are sitemapped by buildReportsSitemap, so buildPagesSitemap
    // skips them (same pattern as db-backed reports) to avoid duplicate URLs.
    config: true,
  };
}

/** Map many reports at once, newest-first (matches registry ordering). */
export function reportContentsToRegistryEntries(reports: ReportContent[]): ReportRegistryEntry[] {
  return reports
    .map(reportContentToRegistryEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
}
