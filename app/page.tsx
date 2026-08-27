import Link from "next/link";
import type { Metadata } from "next";
import { getPodcastEpisodes, stripShowNotes } from "@/lib/podcast/feed";
import { Terminal } from "@/components/home/Terminal";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, podcastSeriesNode } from "@/lib/seo/jsonld";
import { sortedConfigReports } from "@/content/reports";
import { formatPublishDate } from "@/lib/research/reportContent";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Realist — Canada's real estate deal terminal",
  description:
    "Browse motivated-seller deals on the map, underwrite a Toronto multiplex site in seconds, and see live rents across Canada — free tools from the hosts of Canada's #1 real estate podcast.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const episodes = await getPodcastEpisodes().catch(() => []);
  const latest = episodes[0] ?? null;
  const recent = episodes.slice(0, 5);
  const reports = sortedConfigReports.slice(0, 4);

  return (
    <>
      <JsonLd json={jsonLdDocument(podcastSeriesNode())} />

      {/* The product IS the page. */}
      <Terminal
        episode={
          latest
            ? {
                slug: latest.slug,
                title: latest.title,
                audioUrl: latest.audioUrl,
                imageUrl: latest.imageUrl,
              }
            : null
        }
      />

      {/* Below the fold: what this is, in one strip */}
      <section className="border-t border-hairline">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-baseline gap-x-8 gap-y-2 px-4 py-5">
          <h1 className="text-[15px] font-bold tracking-tight">
            Institutional-grade tools for regular investors.
          </h1>
          <p className="text-[13px] text-ink-faint">
            Free, from the hosts of The Canadian Real Estate Investor — paid for by
            deals, not subscriptions:{" "}
            <Link href="/work-with-us" className="text-brand hover:underline">
              buy through our team, get 50% of our commission back
            </Link>
            .
          </p>
        </div>
      </section>

      {/* The three tools, terminal-row style */}
      <section className="border-t border-hairline">
        <div className="mx-auto grid max-w-[1600px] gap-px overflow-hidden bg-hairline px-0 md:grid-cols-3">
          {[
            {
              href: "/multiplex",
              code: "UW",
              title: "Multiplex Underwriter",
              body: "Toronto address → zoning, envelope, unit configs, massing concepts, CMHC MLI Select proforma.",
            },
            {
              href: "/listings",
              code: "MLS",
              title: "Listings, pre-underwritten",
              body: "Every DDF listing scored with our rent database: est. rent, gross/net yield, monthly cash flow.",
            },
            {
              href: "/deals",
              code: "POS",
              title: "Motivated deals",
              body: "Power of sale, foreclosure, VTB — scored, filtered, with per-listing history kept forever.",
            },
          ].map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group bg-paper px-5 py-5 transition-colors hover:bg-surface"
            >
              <div className="flex items-center gap-2.5">
                <span className="tnum rounded bg-surface px-1.5 py-0.5 text-[11px] font-bold text-brand group-hover:bg-raised">
                  {tool.code}
                </span>
                <h2 className="text-[15px] font-bold tracking-tight text-ink">{tool.title}</h2>
                <span className="ml-auto text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand">
                  →
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{tool.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Crawlable latest content: episodes + research */}
      <section className="border-t border-hairline">
        <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-8 md:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                Latest episodes
              </h2>
              <Link href="/podcast" className="text-[12px] font-semibold text-brand hover:underline">
                All episodes
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-hairline">
              {recent.map((episode) => (
                <li key={episode.slug} className="py-2.5">
                  <Link
                    href={`/podcast/${episode.slug}`}
                    className="block text-[14px] font-semibold text-ink hover:text-brand"
                  >
                    {episode.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-faint">
                    {stripShowNotes(episode.description, 120)}
                  </p>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="py-2.5 text-[13px] text-ink-soft">
                  New episodes every Tuesday and Friday.
                </li>
              )}
            </ul>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                Latest research
              </h2>
              <Link href="/research" className="text-[12px] font-semibold text-brand hover:underline">
                All research
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-hairline">
              {reports.map((report) => (
                <li key={report.slug} className="py-2.5">
                  <Link
                    href={`/research/${report.slug}`}
                    className="block text-[14px] font-semibold text-ink hover:text-brand"
                  >
                    {report.title}
                  </Link>
                  <p className="tnum mt-0.5 text-[12px] text-ink-faint">
                    {formatPublishDate(report.publishDate)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
