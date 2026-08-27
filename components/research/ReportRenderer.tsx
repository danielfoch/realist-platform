/**
 * ReportRenderer — renders a config ReportContent object (data + narrative, no
 * bespoke code) into a rich report page: hero, stat grids, callouts, narrative
 * prose, figures, sources, and the end-of-report CTA.
 *
 * This is a SERVER component on purpose: every block except the interactive
 * recharts plot renders to static HTML, so the full report text, stat values,
 * figure alt text, and each chart's data table are in the document for SEO and
 * no-JS readers. The only client island is ReportCharts (recharts).
 *
 * This is the ONE component every config report renders through. A new report
 * is a content file, not new React.
 */
import Link from "next/link";
import Image from "next/image";
import {
  chartToTableRows,
  formatPublishDate,
  type CalloutBlock,
  type ChartBlock,
  type ImageBlock,
  type ReportContent,
  type ReportSection,
  type StatGridBlock,
  type StatItem,
} from "@/lib/research/reportContent";
import { ReportCharts } from "./ReportCharts";
import { renderMarkdownish } from "./renderMarkdownish";

const TREND_GLYPH: Record<NonNullable<StatItem["trend"]>, { glyph: string; className: string }> = {
  up: { glyph: "▲", className: "text-good" },
  down: { glyph: "▼", className: "text-bad" },
  flat: { glyph: "–", className: "text-ink-faint" },
};

function StatGrid({ block }: { block: StatGridBlock }) {
  return (
    <section className="my-10" id={block.id}>
      {block.heading && (
        <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight">{block.heading}</h2>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {block.stats.map((stat, i) => {
          const trend = stat.trend ? TREND_GLYPH[stat.trend] : null;
          return (
            <div key={i} className="rounded-xl border border-hairline bg-surface p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {stat.label}
              </div>
              <div className="tnum mt-2 flex items-baseline gap-1.5 text-2xl font-semibold sm:text-3xl">
                {trend && (
                  <span aria-hidden className={`text-sm ${trend.className}`}>
                    {trend.glyph}
                  </span>
                )}
                {stat.value}
              </div>
              {stat.detail && <div className="mt-1 text-xs text-ink-faint">{stat.detail}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CALLOUT_STYLE: Record<NonNullable<CalloutBlock["tone"]>, string> = {
  info: "border-brand/40 bg-brand-wash/40",
  warning: "border-signal/40 bg-signal-wash/50",
  success: "border-good/40 bg-good/5",
};

function Callout({ block }: { block: CalloutBlock }) {
  return (
    <section className={`my-8 rounded-xl border p-5 md:p-6 ${CALLOUT_STYLE[block.tone ?? "info"]}`} id={block.id}>
      {block.heading && (
        <h3 className="font-display mb-1 text-lg font-semibold text-ink">{block.heading}</h3>
      )}
      <div className="text-sm leading-6 text-ink-soft [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
        {renderMarkdownish(block.body)}
      </div>
    </section>
  );
}

function Figure({ block }: { block: ImageBlock }) {
  return (
    <figure className="my-10" id={block.id}>
      {block.title && (
        <h3 className="font-display mb-3 text-lg font-semibold">{block.title}</h3>
      )}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface p-2">
        {block.width && block.height ? (
          <Image
            src={block.src}
            alt={block.alt}
            width={block.width}
            height={block.height}
            className="h-auto w-full rounded-lg"
            sizes="(min-width: 768px) 720px, 100vw"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.src} alt={block.alt} loading="lazy" className="h-auto w-full rounded-lg" />
        )}
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-xs leading-5 text-ink-faint">{block.caption}</figcaption>
      )}
    </figure>
  );
}

/**
 * Server-rendered data table for a chart block — the crawler/no-JS fallback.
 * Collapsed behind <details> for humans; the numbers are still in the HTML.
 */
function ChartDataTable({ block }: { block: ChartBlock }) {
  const rows = chartToTableRows(block);
  return (
    <details className="mt-3 border-t border-hairline pt-2">
      <summary className="cursor-pointer text-xs font-medium text-ink-faint hover:text-brand">
        View data table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="tnum w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline text-ink-faint">
              <th className="py-1.5 pr-4 font-medium">{block.xAxisLabel || block.xKey}</th>
              {block.series.map((s) => (
                <th key={s.key} className="py-1.5 pr-4 font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-hairline/60">
                <td className="py-1.5 pr-4 text-ink-soft">{row.x}</td>
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="py-1.5 pr-4 text-ink">
                    {cell.formatted}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.referenceLine && (
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Reference line: {block.referenceLine.label} ({block.referenceLine.value}).
          </p>
        )}
      </div>
    </details>
  );
}

function Section({ section }: { section: ReportSection }) {
  switch (section.type) {
    case "narrative":
      return (
        <section className="my-8" id={section.id}>
          {section.heading && (
            <h2 className="font-display mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
              {section.heading}
            </h2>
          )}
          <div>{renderMarkdownish(section.body)}</div>
        </section>
      );
    case "chart":
      return (
        <section className="my-10" id={section.id}>
          <div className="rounded-xl border border-hairline bg-surface p-4 md:p-5">
            <h3 className="font-display text-base font-semibold">{section.title}</h3>
            <div className="mt-3">
              <ReportCharts block={section} />
            </div>
            {section.caption && (
              <p className="mt-3 text-xs leading-5 text-ink-faint">{section.caption}</p>
            )}
            <ChartDataTable block={section} />
          </div>
        </section>
      );
    case "image":
      return <Figure block={section} />;
    case "statGrid":
      return <StatGrid block={section} />;
    case "callout":
      return <Callout block={section} />;
    default:
      return null;
  }
}

export function ReportRenderer({ report }: { report: ReportContent }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav className="text-xs text-ink-faint" aria-label="Breadcrumb">
        <Link href="/research" className="hover:text-brand">
          ← All research
        </Link>
      </nav>

      {/* Hero */}
      <header className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          {report.kind} report · {formatPublishDate(report.publishDate)}
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {report.title}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-soft">{report.dek}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint">
          <span>{report.author.name}</span>
          {report.tags.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="flex flex-wrap gap-1.5">
                {report.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      </header>

      {report.heroStat && (
        <div className="mt-8 rounded-xl border border-brand/40 bg-brand-wash/40 p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
            {report.heroStat.label}
          </div>
          <div className="tnum font-display mt-2 text-4xl font-semibold text-brand-deep md:text-5xl">
            {report.heroStat.value}
          </div>
          {report.heroStat.detail && (
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{report.heroStat.detail}</p>
          )}
        </div>
      )}

      {/* Body sections */}
      <div className="mt-2">
        {report.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
      </div>

      {/* Sources */}
      {report.sources.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Sources</h2>
          <ul className="mt-3 space-y-2">
            {report.sources.map((src, i) => (
              <li key={i} className="text-sm text-ink-soft">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
                >
                  {src.label} ↗
                </a>
                {src.publisher && <span className="ml-1 text-ink-faint">— {src.publisher}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA */}
      <aside className="mt-10 rounded-xl border border-brand/40 bg-brand-wash/50 p-6">
        <p className="font-display text-lg font-semibold">{report.cta.headline}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">{report.cta.body}</p>
        <div className="mt-4">
          <Link
            href={report.cta.toolUrl}
            className="inline-block rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Run the numbers →
          </Link>
        </div>
      </aside>
    </article>
  );
}
