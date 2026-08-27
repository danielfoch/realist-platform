import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UnderwriterTool } from "@/components/multiplex/UnderwriterTool";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Toronto Multiplex Underwriter — Zoning, Massing & CMHC Proforma in Seconds",
  description:
    "Type a Toronto address and get a development-grade screen: as-of-right units under the new multiplex by-laws, buildable envelope, unit configurations, massing concepts, and a full CMHC MLI Select proforma. Free.",
  alternates: { canonical: "/multiplex" },
};

const STEPS = [
  {
    title: "Resolve the site",
    body: "Geocode, zoning polygon, ward boundary, heritage register, and TRCA screens — with By-law 654-2025 sixplex wards verified from boundary data, not guessed.",
  },
  {
    title: "Size the envelope",
    body: "Setbacks, 35% coverage, height limits, and practical haircuts produce the buildable box — then unit configurations are packed family-first into the GFA.",
  },
  {
    title: "Run both exits",
    body: "Each configuration is underwritten to a condo exit and an MLI Select rental hold — cost stack, DSCR-sized CMHC loan, residual land value, and a recommended path.",
  },
];

export default function MultiplexPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Multiplex Underwriter", path: "/multiplex" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Toronto · free while in beta
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Underwrite a multiplex site in the time it takes to read the listing.
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Toronto legalized fourplexes citywide and sixplexes in a growing set of
            wards. This tool turns an address and lot dimensions into a
            development-grade screen: what you can build, what it costs, what it
            rents for, and how CMHC financing carries it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense>
          <UnderwriterTool />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">How the screen works</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-hairline bg-surface p-5">
              <span className="tnum font-display text-3xl font-semibold text-brand">
                {index + 1}
              </span>
              <h3 className="font-display mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-ink-faint">
          Every number is an estimate with its source and verification status attached,
          and the narrative is barred from inventing figures. It screens sites — it
          doesn&rsquo;t replace your planner, architect, or lender.{" "}
          <Link href="/encyclopedia" className="text-brand hover:underline">
            Learn the concepts in the encyclopedia →
          </Link>
        </p>
      </section>
    </>
  );
}
