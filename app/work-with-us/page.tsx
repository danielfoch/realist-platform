import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { Suspense } from "react";
import { OfferLeadForm } from "@/components/leads/OfferLeadForm";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";
import { ASSUMED_COMMISSION_RATE, CASHBACK_ESTIMATE_NOTE, CASHBACK_LABEL, CASHBACK_PARTNER, CASHBACK_PROVINCE, CASHBACK_SERVICE_TEXT, REFERRAL_BROKERAGE, cashbackOn } from "@/lib/offer";

export const metadata: Metadata = {
  title: `Buy with cash back — keep ${CASHBACK_LABEL} of the buyer's agent commission`,
  description:
    `Underwrite it on Realist, see it once, and keep ${CASHBACK_LABEL} of the buyer's agent commission at closing. How the ${CASHBACK_PROVINCE.name} cash-back offer works, who it's for, and the honest fine print.`,
  alternates: { canonical: "/work-with-us" },
};

const STEPS = [
  {
    title: "Review it from your desk",
    body: "Every listing on Realist opens already underwritten. Change the numbers, read the deal memo, solve for the price that works. Most properties never earn a showing — that's the point. You stop touring and start deciding.",
  },
  {
    title: "One showing, the one that matters",
    body: `When a deal survives your numbers, a RECO-licensed REALTOR® from ${CASHBACK_PARTNER.name}, our cash-back partner, walks it with you — once — to verify what a listing can't tell you: the condition, the units, the street. They arrive with your numbers and your list of things to check. Then they write and negotiate the offer like any full-service agent, because they are one.`,
  },
  {
    title: `Keep ${CASHBACK_LABEL} of the commission`,
    body: `You did the searching and the screening, so you shouldn't pay for it twice. When the deal closes, ${CASHBACK_LABEL} of the buyer's agent commission is yours, paid at closing. Nothing is owed unless you buy.`,
  },
] as const;

const WHO_ITS_FOR = [
  {
    title: "First-property investors",
    body: "You've listened to enough episodes to know the math. The cash back softens closing costs exactly when cash is tightest.",
  },
  {
    title: "Portfolio builders",
    body: "On your third or fourth door the cash back compounds — the same team, the same underwriting standards, every acquisition.",
  },
  {
    title: "Multiplex buyers",
    body: "You underwrote the site on Realist. Our partner team has walked that exact playbook — offers structured around the development math.",
  },
  {
    title: "Out-of-province buyers",
    body: `Buying where the numbers work rather than where you live? Cash back is an ${CASHBACK_PROVINCE.name} offer today; anywhere else in Canada we introduce you to an investor-focused agent who actually knows that market.`,
  },
] as const;

const FAQ = [
  {
    q: "How is the cash back actually paid?",
    a: `At closing, by ${CASHBACK_PARTNER.name}, the brokerage handling your purchase. It is not a cheque in the mail months later, and it is not conditional on writing a review. The amount depends on the commission the listing offers and on your written agreement with ${CASHBACK_PARTNER.name}.`,
  },
  {
    q: "Is this available everywhere in Canada?",
    a: `Not yet. Cash back is available on ${CASHBACK_PROVINCE.name} purchases, where our partner ${CASHBACK_PARTNER.name} is licensed. Commission rebates are regulated province by province, so everywhere else we introduce you to an investor-focused agent in that market and promise no figure. Send the request either way — a person reads it and tells you which applies before you sign anything.`,
  },
  {
    q: "Does using the offer cost me more?",
    a: `No. The buyer's agent commission is customarily paid out of the transaction the same way it would be with any agent. The difference is that ${CASHBACK_LABEL} of it comes back to you.`,
  },
  {
    q: "Do I have to buy a property I found on Realist?",
    a: "No — if you found the property elsewhere and still want the cash back, reach out. The tools just make it more likely your numbers are right.",
  },
  {
    q: "Who am I actually working with?",
    a: `In ${CASHBACK_PROVINCE.name}, RECO-licensed REALTORS® at ${CASHBACK_PARTNER.name}, our cash-back partner — and only if you tick the box that lets us pass them your details. Realist is not a brokerage: it introduces you and stays in the loop, and your agency relationship, and all brokerage services, are with them, in writing. Introductions to other professionals and other markets may earn ${REFERRAL_BROKERAGE} a referral fee, which is disclosed to you before you sign anything.`,
  },
  {
    q: "Is this advice?",
    a: "No. Realist's tools and this page are information, not legal, tax, or investment advice. Your lawyer and accountant stay on the team — cash back doesn't replace either of them.",
  },
] as const;

export default function WorkWithUsPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Work with us", path: "/work-with-us" },
          ]),
        )}
      />

      {/* Hero */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-signal">
              The offer that pays for the platform
            </p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Underwrite it here. See it once.
              <span className="text-signal"> Keep {CASHBACK_LABEL} of the commission.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              The tools are free because the business isn&rsquo;t subscriptions —
              it&rsquo;s deals. Buy in {CASHBACK_PROVINCE.name} through {CASHBACK_PARTNER.name}, our cash-back partner, and
              you keep {CASHBACK_LABEL} of the buyer&rsquo;s agent commission, paid at closing. {CASHBACK_SERVICE_TEXT}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#lead-form"
                className="rounded-md bg-signal px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110"
              >
                Tell us what you&rsquo;re buying
              </a>
              <Link
                href="/listings"
                className="rounded-md border border-hairline-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Start with the listings
              </Link>
            </div>
          </div>

          {/* Worked example */}
          <div className="rounded-xl border border-signal/30 bg-signal-wash/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-signal">
              What that looks like
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-signal/20 pb-3">
                <dt className="text-ink-soft">Purchase price</dt>
                <dd className="tnum font-semibold">$1,000,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-signal/20 pb-3">
                <dt className="text-ink-soft">Buyer&rsquo;s agent commission at {ASSUMED_COMMISSION_RATE * 100}%</dt>
                <dd className="tnum font-semibold">${(1_000_000 * ASSUMED_COMMISSION_RATE).toLocaleString("en-CA")}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-ink">Yours at closing</dt>
                <dd className="tnum font-display text-2xl font-semibold text-signal">
                  ~${cashbackOn(1_000_000).toLocaleString("en-CA")}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              {CASHBACK_ESTIMATE_NOTE} Cashback offered in partnership with{" "}
              <a href={CASHBACK_PARTNER.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {CASHBACK_PARTNER.name}
              </a>
              , on {CASHBACK_PROVINCE.name} purchases.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Buying an investment property is a numbers decision. So do the numbers first, and see only
          the one that passes.
        </p>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-hairline bg-surface p-6">
              <span className="tnum font-display text-3xl font-semibold text-signal">
                {index + 1}
              </span>
              <h3 className="font-display mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section className="border-y border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Who it&rsquo;s for
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {WHO_ITS_FOR.map((item) => (
              <div key={item.title} className="rounded-xl border border-hairline bg-paper p-6">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          The honest FAQ
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Cash-back offers attract fine print. Here&rsquo;s ours, in plain
          English.
        </p>
        <div className="mt-8 divide-y divide-hairline border-t border-hairline">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="shrink-0 text-brand transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Lead form */}
      <section id="lead-form" className="scroll-mt-20 border-t border-hairline border-y-0 bg-raised">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-signal">
              Start the conversation
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Tell us what you&rsquo;re buying.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              A human reads every one of these — usually within a business day.
              In {CASHBACK_PROVINCE.name} we connect you with {CASHBACK_PARTNER.name} for the showing and the cash
              back; anywhere else, with an investor-focused agent in that market.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              No obligation, no spam. Talking to us doesn&rsquo;t create an
              agency relationship — that happens with the partner brokerage,
              in writing.
            </p>
          </div>
          <div className="rounded-xl border border-paper/15 bg-paper p-6 text-ink">
            <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
              <OfferLeadForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Fine print */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs leading-relaxed text-ink-faint">
          Realist is not a brokerage. Cashback is offered in partnership with {CASHBACK_PARTNER.name} on{" "}
          {CASHBACK_PROVINCE.name} purchases; brokerage services are provided by {CASHBACK_PARTNER.name}&rsquo;s RECO-licensed
          REALTORS®, and the cash back is paid at closing under your written agreement with them.{" "}
          {CASHBACK_ESTIMATE_NOTE} Introductions made through Realist may earn {REFERRAL_BROKERAGE} a referral fee,
          disclosed in writing. Nothing on this page is legal, tax, or investment advice.
        </p>
      </section>
    </>
  );
}
