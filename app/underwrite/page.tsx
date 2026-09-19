import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { UnderwriteAnything } from "@/components/underwrite/UnderwriteAnything";
import { getLearnedDefaults } from "@/lib/analyses/learn";
import { memoWriterConfigured } from "@/lib/ai/dealMemoWriter";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Rental property calculator for Canadian investors — underwrite any deal",
  description:
    "Underwrite any rental property in Canada in under a minute: cash flow, cap rate, cash-on-cash, debt coverage and IRR with Canadian mortgage math — and the offer price that makes the deal work.",
  alternates: { canonical: "/underwrite" },
};

export default async function UnderwritePage() {
  const learned = await getLearnedDefaults(null, null);
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Underwrite", path: "/underwrite" },
          ]),
        )}
      />
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-brand">Underwrite</p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Any deal, underwritten in a <em>minute</em>.
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
            Off-market, a wholesaler&rsquo;s email, a house you drove past. Four facts in, and you get cash flow, cap rate,
            cash-on-cash, debt coverage and IRR — with Canadian mortgage math — plus the offer price that makes the deal work.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Suspense fallback={<div className="mx-auto h-80 max-w-2xl rounded-lg border border-hairline bg-surface" aria-hidden="true" />}>
          <UnderwriteAnything learned={learned} aiAvailable={memoWriterConfigured()} />
        </Suspense>
      </div>
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          {[
            ["It's a listing?", "Every listing on Realist opens already underwritten — rent from comps, the tax bill from the listing.", "/listings", "Browse listings →"],
            ["It's a Toronto lot?", "The multiplex underwriter reads the zoning, sizes the building and runs the CMHC MLI Select proforma.", "/multiplex", "Underwrite a multiplex →"],
            ["Numbers work?", "Book the one showing that matters, or make an offer with our team and get cash back at closing.", "/work-with-us", "How it works →"],
          ].map(([title, body, href, cta]) => (
            <div key={title}>
              <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
              <Link href={href} className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand-deep">
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
