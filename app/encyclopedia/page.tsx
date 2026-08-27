import type { Metadata } from "next";
import Link from "next/link";
import { encyclopediaGuides, encyclopediaManifest } from "@/lib/encyclopedia";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Real Estate Investing Encyclopedia — Every Term, Canadian Context",
  description:
    "149 plain-English guides to Canadian real estate investing: cap rates, MLI Select, BRRRR, power of sale, land transfer tax, zoning, and more — each with formulas, examples, and common mistakes.",
  alternates: { canonical: "/encyclopedia" },
};

export default function EncyclopediaPage() {
  const categories = encyclopediaManifest.categories;
  const byCategory = new Map<string, typeof encyclopediaGuides>();
  for (const guide of encyclopediaGuides) {
    const list = byCategory.get(guide.category) ?? [];
    list.push(guide);
    byCategory.set(guide.category, list);
  }

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Encyclopedia", path: "/encyclopedia" },
          ]),
        )}
      />
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            {encyclopediaGuides.length} guides
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            The Canadian real estate investing encyclopedia
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Every term you&rsquo;ll hear on the podcast, defined the way an underwriter
            uses it — with the formula, a worked example, and the mistake everyone
            makes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {categories.map((category) => {
          const guides = byCategory.get(category) ?? [];
          if (guides.length === 0) return null;
          return (
            <div key={category} className="mb-10">
              <h2 className="font-display text-xl font-semibold">{category}</h2>
              <div className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {guides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/encyclopedia/${guide.slug}`}
                    className="truncate py-1 text-sm text-ink-soft hover:text-brand"
                  >
                    {guide.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
