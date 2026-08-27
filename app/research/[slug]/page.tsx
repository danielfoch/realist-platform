import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getConfigReport, sortedConfigReports } from "@/content/reports";
import { ReportRenderer } from "@/components/research/ReportRenderer";
import { JsonLd } from "@/components/JsonLd";
import {
  articleNode,
  breadcrumbNode,
  jsonLdDocument,
  organizationNode,
} from "@/lib/seo/jsonld";

/** Config reports are committed content — prerender every slug. */
export function generateStaticParams() {
  return sortedConfigReports.map((report) => ({ slug: report.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/research/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const report = getConfigReport(slug);
  if (!report) return { title: "Report not found" };
  const description = report.metaDescription || report.dek;
  return {
    title: report.metaTitle || report.title,
    description,
    keywords: report.tags,
    alternates: { canonical: `/research/${slug}` },
    openGraph: {
      title: report.title,
      description,
      type: "article",
      publishedTime: `${report.publishDate}T00:00:00Z`,
      images: report.ogImage ? [{ url: report.ogImage }] : undefined,
    },
  };
}

export default async function ResearchReportPage({
  params,
}: PageProps<"/research/[slug]">) {
  const { slug } = await params;
  const report = getConfigReport(slug);
  if (!report) notFound();

  const jsonLd = jsonLdDocument(
    organizationNode(),
    articleNode({
      type: "Report",
      path: `/research/${report.slug}`,
      headline: report.title,
      description: report.metaDescription || report.dek,
      datePublished: report.publishDate,
      keywords: report.tags,
      image: report.ogImage,
    }),
    breadcrumbNode([
      { name: "Home", path: "/" },
      { name: "Research", path: "/research" },
      { name: report.title, path: `/research/${report.slug}` },
    ]),
  );

  return (
    <>
      <JsonLd json={jsonLd} />
      <ReportRenderer report={report} />
    </>
  );
}
