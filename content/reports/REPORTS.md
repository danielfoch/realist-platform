# Publishing a rich report — no React

Config-driven reports let you publish a full realist.ca report — hero stat,
interactive charts, static figures, stat grids, callouts, narrative, sources,
CTA — by committing **one TypeScript content file**. No new React components, no
route wiring.

They render at **`/research/:slug`** through a single server component,
`components/research/ReportRenderer.tsx`, with interactive `recharts` charts
(the one client island, `components/research/ReportCharts.tsx`), and register
through this directory's `index.ts`, which the `/research` hub, static params,
and sitemap all read.

## The one-file flow

1. **Create** `content/reports/<your-slug>-config.ts` exporting a typed
   `ReportContent` object. Copy `interprovincial-migration-config.ts` as a
   template (or `osfi-dsb-june-2026-config.ts` for an image-led report).
2. **Register** it: import your object into `content/reports/index.ts` and add
   it to the `configReports` array.
3. That's it. The report is now:
   - live at `/research/<your-slug>`,
   - listed on the `/research` hub (newest-first),
   - fully crawlable (all prose, stats, figures, and chart data tables are
     server-rendered HTML — only the interactive plot hydrates),
   - emitting `Report` + `Organization` + `BreadcrumbList` JSON-LD.

Every report is validated at module load. A malformed report throws with a
precise, itemized error list instead of rendering broken.

## The content schema (`lib/research/reportContent.ts`)

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

  Colors default to the design-token palette (`--color-brand`, `--color-signal`,
  …); set `series.color` to a `var(--color-…)` token to override — never a raw
  hex. Axes, tooltips, and the server data table all format via the same
  `formatValue` helper, so numbers never disagree.
- **`image`** — a static chart or figure (e.g. a regulator's own chart package):
  `{ type, src, alt, title?, caption?, width?, height? }`. Put the file under
  `public/reports/<slug>/` and use a site-relative `src`. Write `alt` like a
  sentence — it is the crawler's figure text. Include `width`/`height`
  (intrinsic pixels) so the layout doesn't shift.
- **`statGrid`** — `{ type, heading?, stats: { label, value, detail?, trend? }[] }`.
  `trend` is `"up" | "down" | "flat"` for the colored direction glyph.
- **`callout`** — `{ type, tone?, heading?, body }`. `tone` is
  `"info" | "warning" | "success"`.

### Chart types supported

`line`, `bar`, `area`, and `composed` (mix bar/line/area series in one chart via
per-series `type`).

## Worked examples

- `interprovincial-migration-config.ts` — a data-led report (genuine Fraser
  Institute 1995-2024 series) with recharts blocks. Renders at
  `/research/interprovincial-migration-fraser-1995-2024`.
- `osfi-dsb-june-2026-config.ts` — an image-led report built around OSFI's own
  chart package, with the hedged-claims callout pattern. Renders at
  `/research/osfi-dsb-june-2026`.

## What this reuses vs. adds

- **Reuses:** the design tokens in `app/globals.css`, `lib/seo/jsonld.ts`
  (`articleNode` + `breadcrumbNode`), and the `/research` pages.
- **Adds:** the `lib/research/reportContent.ts` schema + validators +
  formatters, this content dir, and the `ReportRenderer` / `ReportCharts`
  components.
