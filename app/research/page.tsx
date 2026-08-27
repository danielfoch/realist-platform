import Link from "next/link";
import type { Metadata } from "next";
import { sortedConfigReports } from "@/content/reports";
import { formatPublishDate } from "@/lib/research/reportContent";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument, organizationNode } from "@/lib/seo/jsonld";
import { STATS_BASE_URL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Research — Canadian Real Estate Reports & Data",
  description:
    "Data-first research for Canadian real estate investors: macro, market, and housing-finance reports built on primary sources — StatCan, OSFI, Teranet, and more — plus live market dashboards at stats.realist.ca.",
  alternates: { canonical: "/research" },
};

export default function ResearchPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          organizationNode(),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Research", path: "/research" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Realist research
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Research
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Data-first research for Canadian real estate investors. Every report is
            built on primary sources — StatCan, OSFI, Teranet, CMHC — with the
            charts, the caveats, and the underwriting read-through.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Live dashboards */}
        <a
          href={STATS_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-brand/40 bg-brand-wash/40 p-6 transition-colors hover:bg-brand-wash/70"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Live market dashboards
          </p>
          <p className="font-display mt-2 text-2xl font-semibold leading-snug">
            stats.realist.ca ↗
          </p>
          <p className="mt-2 max-w-3xl text-sm text-ink-soft">
            Interactive Canadian housing data, updated as the source series land:
            prices, sales, inventory, rates, rents, and affordability — the live
            counterpart to the reports below.
          </p>
        </a>

        {/* Report index, newest first */}
        <div className="mt-10 divide-y divide-hairline border-t border-hairline">
          {sortedConfigReports.map((report) => (
            <article key={report.slug} className="flex flex-col gap-1 py-5">
              <div className="flex items-baseline justify-between gap-4">
                <Link
                  href={`/research/${report.slug}`}
                  className="font-display text-lg font-semibold leading-snug hover:text-brand"
                >
                  {report.title}
                </Link>
                <span className="tnum shrink-0 text-xs text-ink-faint">
                  {formatPublishDate(report.publishDate)}
                </span>
              </div>
              <p className="line-clamp-3 max-w-3xl text-sm text-ink-soft">{report.dek}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-brand/40 bg-brand-wash/50 px-2 py-0.5 text-[11px] font-medium capitalize text-brand">
                  {report.kind}
                </span>
                {report.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
