/**
 * ReportRenderer — renders a config ReportContent object (data + narrative, no
 * bespoke code) into a rich report page: hero, interactive recharts per
 * ChartBlock, stat grids, callouts, narrative prose, sources, and the shared
 * end-of-report CTA. Matches the design system of the bespoke reports
 * (CpiInflationReport, InterprovincialMigration...): max-w-6xl container, Card
 * wrappers, muted-foreground captions, Badge chrome.
 *
 * This is the ONE component every config report renders through. A new report
 * is a content file, not new React.
 */
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Info, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportEndCta } from "@/components/ReportEndCta";
import {
  reportRoute,
  type CalloutBlock,
  type ReportContent,
  type ReportSection,
  type StatGridBlock,
  type StatItem,
} from "@shared/reportContent";
import { ReportChart } from "./ReportChart";
import { renderMarkdownish } from "./renderMarkdownish";

const BASE_URL = "https://realist.ca";

function formatPublishDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildStructuredData(report: ReportContent) {
  const url = `${BASE_URL}${reportRoute(report.slug)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Report",
        "@id": `${url}#report`,
        headline: report.title,
        description: report.metaDescription || report.dek,
        url,
        datePublished: `${report.publishDate}T00:00:00Z`,
        author: {
          "@type": "Person",
          "@id": report.author.personId,
          name: report.author.name,
          ...(report.author.url ? { url: report.author.url } : {}),
        },
        publisher: { "@id": `${BASE_URL}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: report.tags.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Reports", item: `${BASE_URL}/reports` },
          { "@type": "ListItem", position: 3, name: report.title, item: url },
        ],
      },
    ],
  };
}

const TREND_ICON: Record<NonNullable<StatItem["trend"]>, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};
const TREND_CLASS: Record<NonNullable<StatItem["trend"]>, string> = {
  up: "text-emerald-500",
  down: "text-red-500",
  flat: "text-muted-foreground",
};

function StatGrid({ block }: { block: StatGridBlock }) {
  return (
    <section className="my-10" data-testid="report-stat-grid">
      {block.heading && <h2 className="text-2xl font-bold mb-4">{block.heading}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {block.stats.map((stat, i) => {
          const Icon = stat.trend ? TREND_ICON[stat.trend] : null;
          return (
            <Card key={i} data-testid={`stat-card-${i}`}>
              <CardContent className="p-5">
                <div className="text-xs uppercase text-muted-foreground tracking-wide">{stat.label}</div>
                <div className="text-3xl font-bold mt-2 flex items-center gap-1.5">
                  {Icon && <Icon className={`h-5 w-5 ${TREND_CLASS[stat.trend!]}`} />}
                  {stat.value}
                </div>
                {stat.detail && <div className="text-xs text-muted-foreground mt-1">{stat.detail}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

const CALLOUT_STYLE: Record<NonNullable<CalloutBlock["tone"]>, { border: string; icon: typeof Info; iconClass: string }> = {
  info: { border: "border-primary/30 bg-primary/5", icon: Info, iconClass: "text-primary" },
  warning: { border: "border-amber-500/30 bg-amber-500/5", icon: AlertTriangle, iconClass: "text-amber-500" },
  success: { border: "border-emerald-500/30 bg-emerald-500/5", icon: CheckCircle2, iconClass: "text-emerald-500" },
};

function Callout({ block }: { block: CalloutBlock }) {
  const style = CALLOUT_STYLE[block.tone ?? "info"];
  const Icon = style.icon;
  return (
    <section className={`my-8 rounded-xl border p-5 md:p-6 ${style.border}`} data-testid="report-callout">
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconClass}`} />
        <div>
          {block.heading && <h3 className="font-semibold text-foreground mb-1">{block.heading}</h3>}
          <div className="text-sm leading-6 text-muted-foreground [&_strong]:text-foreground">
            {renderMarkdownish(block.body)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({ section }: { section: ReportSection }) {
  switch (section.type) {
    case "narrative":
      return (
        <section className="my-8" id={section.id} data-testid="report-narrative">
          {section.heading && <h2 className="text-2xl md:text-3xl font-bold mb-2">{section.heading}</h2>}
          <div>{renderMarkdownish(section.body)}</div>
        </section>
      );
    case "chart":
      return (
        <section className="my-10" id={section.id} data-testid="report-chart-section">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportChart block={section} />
              {section.caption && (
                <p className="mt-3 text-xs text-muted-foreground leading-5">{section.caption}</p>
              )}
            </CardContent>
          </Card>
        </section>
      );
    case "statGrid":
      return <div id={section.id}><StatGrid block={section} /></div>;
    case "callout":
      return <div id={section.id}><Callout block={section} /></div>;
    default:
      return null;
  }
}

export function ReportRenderer({ report }: { report: ReportContent }) {
  const canonicalPath = reportRoute(report.slug);
  return (
    <div className="min-h-screen bg-background" data-testid={`config-report-${report.slug}`}>
      <SEO
        title={report.metaTitle || report.title}
        description={report.metaDescription || report.dek}
        canonicalUrl={canonicalPath}
        ogImage={report.ogImage}
        ogType="article"
        keywords={report.tags.join(", ")}
        structuredData={buildStructuredData(report)}
      />
      <Navigation />

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="link-back-reports"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Reports
        </Link>

        {/* Hero */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="secondary">Report</Badge>
            <Badge variant="outline" className="capitalize">{report.kind}</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="report-title">
            {report.title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl leading-8">{report.dek}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{report.author.name}</span>
            <span aria-hidden>·</span>
            <span>{formatPublishDate(report.publishDate)}</span>
          </div>
        </header>

        {report.heroStat && (
          <Card className="mb-10 border-primary/20 bg-primary/[0.03]">
            <CardContent className="p-6">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">{report.heroStat.label}</div>
              <div className="text-4xl md:text-5xl font-bold mt-2 text-primary">{report.heroStat.value}</div>
              {report.heroStat.detail && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{report.heroStat.detail}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Body sections */}
        <div className="max-w-3xl xl:max-w-none">
          {report.sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </div>

        {/* Sources */}
        {report.sources.length > 0 && (
          <section className="mt-12 pt-8 border-t" data-testid="report-sources">
            <h2 className="text-xl font-bold mb-4">Sources</h2>
            <ul className="space-y-2">
              {report.sources.map((src, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-primary/40 underline-offset-2 hover:text-foreground"
                  >
                    {src.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {src.publisher && <span className="ml-1 text-muted-foreground/80">— {src.publisher}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <section className="mt-12" data-testid="report-cta">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-6 md:p-8 text-center space-y-3">
            <h2 className="text-xl font-bold">{report.cta.headline}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{report.cta.body}</p>
          </div>
          <ReportEndCta sourcePage={canonicalPath} />
        </section>
      </main>
    </div>
  );
}
