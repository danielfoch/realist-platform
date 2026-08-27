import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { distressReports } from "@/lib/db/schema";
import { DealsExplorer } from "@/components/deals/DealsExplorer";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Power of Sale, Foreclosure & VTB Listings Across Canada",
  description:
    "A continuously updated database of motivated-seller listings: power of sale, foreclosure, court-ordered sales, and vendor take-back financing — scored, filtered, and refreshed from the MLS® twice daily.",
  alternates: { canonical: "/deals" },
};

async function getRecentReports() {
  try {
    const db = getDb();
    return await db
      .select({
        slug: distressReports.slug,
        month: distressReports.month,
        title: distressReports.title,
      })
      .from(distressReports)
      .orderBy(desc(distressReports.month))
      .limit(6);
  } catch {
    return [];
  }
}

export default async function DealsPage() {
  const reports = await getRecentReports();

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Motivated Deals", path: "/deals" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Refreshed from the MLS® twice daily
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Motivated sellers, found by reading every listing so you don&rsquo;t have to.
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            We scan listing remarks across Canada for power-of-sale, foreclosure,
            court-ordered sale, vendor take-back, and hard motivation language — then
            score each hit, suppress the false positives, and keep the history so you
            can see how long a seller has been motivated.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <DealsExplorer />
      </section>

      {reports.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="font-display text-2xl font-semibold">Monthly distress reports</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Province-by-province inventory, pricing, and trend — published at the start
            of every month.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Link
                key={report.slug}
                href={`/deals/report/${report.month}`}
                className="rounded-xl border border-hairline bg-surface p-4 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand"
              >
                {report.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="rounded-xl border border-hairline bg-surface p-6 text-sm leading-relaxed text-ink-faint">
          <h2 className="font-display text-lg font-semibold text-ink">How scoring works</h2>
          <p className="mt-2">
            Listings are matched against ~85 distress terms in English and French with
            negation guards (&ldquo;not a power of sale&rdquo; doesn&rsquo;t count) and
            province-specific legal language (power of sale in Ontario, court-ordered
            and conduct-of-sale in BC, judicial sale in Alberta, reprise de finance in
            Quebec). A precision gate keeps weak single-term matches out of the feed.
            Scores run 0–100 with a confidence tier; a &ldquo;price reduced&rdquo; alone
            never qualifies.
          </p>
        </div>
      </section>
    </>
  );
}
