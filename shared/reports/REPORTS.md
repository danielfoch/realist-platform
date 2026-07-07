# Publishing a rich report — no React

Config-driven reports let you publish a full realist.ca report — hero stat,
interactive charts, stat grids, callouts, narrative, sources, CTA — by committing
**one TypeScript content file**. No new React components, no route wiring, no
hand-edited `shared/reportsRegistry.ts` entry.

They render at **`/insights/reports/:slug`** through a single component,
`client/src/components/reports/ReportRenderer.tsx`, with interactive `recharts`
charts, and auto-register into the same `shared/reportsRegistry.ts` that every
hub (InsightsHub / ReportsHub / MarketReport) and the sitemap already read.

## The one-file flow

1. **Create** `shared/reports/<your-slug>.ts` exporting a typed `ReportContent`
   object. Copy `interprovincial-migration-config.ts` as a template.
2. **Register** it: import your object into `shared/reports/index.ts` and add it
   to the `configReports` array.
3. That's it. The report is now:
   - live at `/insights/reports/<your-slug>`,
   - listed in every hub and the reports sitemap (newest-first),
   - crawlable (server renders an H1 + prose + chart data tables for no-JS/bots),
   - emitting `Report` + author `Person` + `BreadcrumbList` JSON-LD.

Every report is validated at module load. A malformed report throws with a
precise, itemized error list instead of rendering broken.

## The content schema (`shared/reportContent.ts`)

    interface ReportContent {
      slug: string;                 // lowercase kebab-case, unique
      title: string;
      dek: string;                  // one-line standfirst under the H1
      author: ReportAuthor;         // use DEFAULT_AUTHOR (Daniel Foch, #danielfoch)
      publishDate: string;          // ISO "YYYY-MM-DD" — drives newest-first order
      kind: "macro" | "market" | "research";
      tags: string[];
      heroStat?: { label; value; detail? };
      sections: ReportSection[];    // see below
      sources: { label; url; publisher? }[];
      cta: { toolUrl; headline; body };
      ogImage?; metaTitle?; metaDescription?;
    }

### Section blocks

- **`narrative`** — `{ type, heading?, body }`. `body` is lightweight markdown:
  blank-line paragraphs, `## subheading`, `- bullets`, `**bold**`,
  `[label](https://…)` links. No raw HTML (everything is escaped/safe).
- **`chart`** — an interactive recharts block:

      {
        type: "chart",
        chartType: "line" | "bar" | "area" | "composed",
        title, caption?,
        xKey,                       // field on each row for the x-axis
        series: { key, label, color?, type? }[],  // type only for "composed"
        data: Record<string, number|string>[],    // one row per x, numeric series
        yAxisLabel?, xAxisLabel?,
        format?: "currency" | "percent" | "number",
        referenceLine?: { value, label },
      }

  Colors default to the app palette (`--chart-1..5`); set `series.color` to
  override. Axes, tooltips, and the crawler table all format via the same
  `formatValue` helper, so numbers never disagree.
- **`statGrid`** — `{ type, heading?, stats: { label, value, detail?, trend? }[] }`.
  `trend` is `"up" | "down" | "flat"` for the colored arrow.
- **`callout`** — `{ type, tone?, heading?, body }`. `tone` is
  `"info" | "warning" | "success"`.

### Chart types supported

`line`, `bar`, `area`, and `composed` (mix bar/line/area series in one chart via
per-series `type`).

## Worked example

`interprovincial-migration-config.ts` reproduces the bespoke
`client/src/pages/InterprovincialMigrationCanada2026Report.tsx` (genuine Fraser
Institute 1995-2024 data) entirely as config — proof that a hand-coded report's
richness is expressible without React. It renders at
`/insights/reports/interprovincial-migration-fraser-1995-2024`.

## What this reuses vs. adds

- **Reuses:** `shared/reportsRegistry.ts` (auto-registered via
  `configReportRegistryEntries`), the `ReportEndCta` funnel, `SEO`/`Navigation`
  components, the server `seoMeta`/`seoRender`/`sitemap` SEO pipeline, and the
  `--chart-N` design tokens.
- **Adds:** the `shared/reportContent.ts` schema + validators + formatters, this
  content dir, and the `ReportRenderer` + block components.
