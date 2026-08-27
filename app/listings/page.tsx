import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";
import { ListingsExplorer } from "@/components/listings/ListingsExplorer";

export const metadata: Metadata = {
  title: "Real Estate Listings Across Canada, Pre-Underwritten",
  description:
    "Every MLS® listing scored before you book a showing: rent estimate, gross and net yield, and monthly cash flow at 20% down — powered by the REALTOR.ca DDF® and Realist's national rent database.",
  alternates: { canonical: "/listings" },
};

export default function ListingsPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Listings", path: "/listings" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Canada-wide · updated continuously
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Listings, pre-underwritten.
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
            Every active MLS® listing in the feed gets the same treatment: a
            rent estimate from our national rent database, gross and net yield,
            and estimated monthly cash flow at 20% down. The numbers an
            investor runs before booking a showing — already run.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ListingsExplorer />
      </section>
    </>
  );
}
