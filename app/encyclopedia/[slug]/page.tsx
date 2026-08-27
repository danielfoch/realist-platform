import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  encyclopediaGuides,
  getEncyclopediaGuide,
} from "@/lib/encyclopedia";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";
import { SITE_BASE_URL } from "@/lib/brand";

export function generateStaticParams() {
  return encyclopediaGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/encyclopedia/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getEncyclopediaGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: `${guide.title} — Canadian Real Estate Definition & Examples`,
    description: guide.summary,
    keywords: guide.searchKeywords?.join(", "),
    alternates: { canonical: `/encyclopedia/${guide.slug}` },
  };
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-xl font-semibold">{heading}</h2>
      <div className="mt-2 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default async function GuidePage({ params }: PageProps<"/encyclopedia/[slug]">) {
  const { slug } = await params;
  const guide = getEncyclopediaGuide(slug);
  if (!guide) notFound();

  const related = (guide.relatedTerms ?? [])
    .map((term) =>
      encyclopediaGuides.find(
        (candidate) => candidate.title.toLowerCase() === term.toLowerCase(),
      ),
    )
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .slice(0, 6);

  const jsonLd = jsonLdDocument(
    {
      "@type": "DefinedTerm",
      "@id": `${SITE_BASE_URL}/encyclopedia/${guide.slug}#term`,
      name: guide.title,
      description: guide.definition,
      url: `${SITE_BASE_URL}/encyclopedia/${guide.slug}`,
      inDefinedTermSet: `${SITE_BASE_URL}/encyclopedia`,
    },
    breadcrumbNode([
      { name: "Home", path: "/" },
      { name: "Encyclopedia", path: "/encyclopedia" },
      { name: guide.title, path: `/encyclopedia/${guide.slug}` },
    ]),
  );

  return (
    <>
      <JsonLd json={jsonLd} />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav className="text-xs text-ink-faint" aria-label="Breadcrumb">
          <Link href="/encyclopedia" className="hover:text-brand">
            ← Encyclopedia
          </Link>
          <span className="mx-2">·</span>
          <span>{guide.category}</span>
        </nav>
        <h1 className="font-display mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {guide.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{guide.definition}</p>

        <Section heading="Why it matters">{guide.whyItMatters}</Section>

        {guide.formula && (
          <Section heading="Formula">
            <code className="tnum block rounded-lg border border-hairline bg-surface px-4 py-3 text-sm">
              {guide.formula}
            </code>
          </Section>
        )}

        {guide.example && <Section heading="Worked example">{guide.example}</Section>}

        {guide.investorInterpretation && (
          <Section heading="How investors read it">{guide.investorInterpretation}</Section>
        )}

        {guide.commonMistakes && guide.commonMistakes.length > 0 && (
          <Section heading="Common mistakes">
            <ul className="space-y-1.5">
              {guide.commonMistakes.map((mistake) => (
                <li key={mistake}>· {mistake}</li>
              ))}
            </ul>
          </Section>
        )}

        {guide.sourceCaveatNotes && (
          <p className="mt-7 rounded-lg bg-signal-wash/60 px-4 py-3 text-sm text-ink-soft">
            {guide.sourceCaveatNotes}
          </p>
        )}

        {related.length > 0 && (
          <section className="mt-8 border-t border-hairline pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Related terms
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/encyclopedia/${item.slug}`}
                  className="rounded-full border border-hairline bg-surface px-3 py-1 text-sm text-ink-soft hover:border-brand hover:text-brand"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </section>
        )}

        <aside className="mt-10 rounded-xl border border-brand/40 bg-brand-wash/50 p-5">
          <p className="font-display text-lg font-semibold">
            See it in a real deal.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Every listing on Realist comes pre-underwritten, and the Toronto multiplex
            underwriter shows the full math on any site.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/listings"
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Browse listings
            </Link>
            <Link
              href="/multiplex"
              className="rounded-md border border-brand/40 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-wash"
            >
              Underwrite a site
            </Link>
          </div>
        </aside>
      </article>
    </>
  );
}
