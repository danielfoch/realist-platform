import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { distressReports } from "@/lib/db/schema";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const revalidate = 86400;

async function getReport(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(distressReports)
      .where(eq(distressReports.month, month))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/deals/report/[month]">): Promise<Metadata> {
  const { month } = await params;
  const report = await getReport(month);
  if (!report) return { title: "Report not found" };
  return {
    title: report.title,
    description: `Canada-wide power of sale, foreclosure, and VTB market report for ${month}: inventory by province, pricing, confidence mix, and month-over-month trend.`,
    alternates: { canonical: `/deals/report/${month}` },
  };
}

export default async function DistressReportPage({
  params,
}: PageProps<"/deals/report/[month]">) {
  const { month } = await params;
  const report = await getReport(month);
  if (!report) notFound();

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Motivated Deals", path: "/deals" },
            { name: report.title, path: `/deals/report/${month}` },
          ]),
        )}
      />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav className="text-xs text-ink-faint" aria-label="Breadcrumb">
          <Link href="/deals" className="hover:text-brand">
            ← Motivated deals
          </Link>
        </nav>
        <h1 className="font-display mt-4 text-3xl font-semibold leading-tight tracking-tight">
          {report.title}
        </h1>
        <div
          className="prose-notes mt-6 text-[15px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-hairline [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-hairline [&_th]:bg-surface [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left"
          dangerouslySetInnerHTML={{ __html: report.html }}
        />
      </article>
    </>
  );
}
