import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { JoinForm } from "@/components/community/JoinForm";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Work with us — get 50% of our commission back",
  description:
    "Find a property on Realist, buy it with our partner team, and get half our commission back at closing. How the cash-back offer works, who it's for, and the honest fine print.",
  alternates: { canonical: "/work-with-us" },
};

const STEPS = [
  {
    title: "Find it on Realist",
    body: "Use the tools the way you already do: screen pre-underwritten listings, run a multiplex site, or chase a motivated-seller deal. When a property clears your numbers, you're ready.",
  },
  {
    title: "Buy it with our team",
    body: "Tell us what you're circling and we introduce you to our partner team. They handle the offer, the negotiation, and the closing like any full-service agent — because they are one.",
  },
  {
    title: "Get 50% back at closing",
    body: "When the deal closes, half of our side's commission is rebated to you — typically applied as a credit on closing. No punch cards, no points, real money on your statement.",
  },
] as const;

const WHO_ITS_FOR = [
  {
    title: "First-property investors",
    body: "You've listened to enough episodes to know the math. The rebate softens closing costs exactly when cash is tightest.",
  },
  {
    title: "Portfolio builders",
    body: "On your third or fourth door the rebate compounds — the same team, the same underwriting standards, every acquisition.",
  },
  {
    title: "Multiplex buyers",
    body: "You underwrote the site on Realist. Our partner team has walked that exact playbook — offers structured around the development math.",
  },
  {
    title: "Out-of-province buyers",
    body: "Buying where the numbers work rather than where you live? We route you to a partner who actually knows that market.",
  },
] as const;

const FAQ = [
  {
    q: "How is the rebate actually paid?",
    a: "At closing, through the brokerage handling your purchase — typically as a credit on your statement of adjustments. It is not a cheque in the mail months later, and it is not conditional on writing a review.",
  },
  {
    q: "Is this available everywhere in Canada?",
    a: "Almost, but not universally. Commission rebates and referral arrangements are regulated provincially, and the mechanics differ by province. Where a rebate can't be paid the way we describe, we'll tell you before you sign anything — not after.",
  },
  {
    q: "Does using the offer cost me more?",
    a: "No. Buyer-side commission is customarily paid out of the transaction the same way it would be with any agent. The difference is that half of our share comes back to you instead of staying with us.",
  },
  {
    q: "Do I have to buy a property I found on Realist?",
    a: "That's the flagship funnel, but no — if you found the property elsewhere and still want our partner team (and the rebate), reach out. The tools just make it more likely your numbers are right.",
  },
  {
    q: "Who am I actually working with?",
    a: "Licensed agents at partner brokerages, including Konfidis. Realist introduces you and stays in the loop; your agency relationship, and all brokerage services, are with the partner brokerage.",
  },
  {
    q: "Is this advice?",
    a: "No. Realist's tools and this page are information, not legal, tax, or investment advice. Your lawyer and accountant stay on the team — the rebate doesn't replace either of them.",
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
              Find it on Realist. Buy it with our team.
              <span className="text-signal"> Get half our commission back.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              The tools are free because the business isn&rsquo;t subscriptions —
              it&rsquo;s deals. When you buy with our partner team, we rebate 50%
              of our commission to you at closing. You keep more cash; we keep
              building tools.
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
                <dd className="tnum font-semibold">$800,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-signal/20 pb-3">
                <dt className="text-ink-soft">Buyer-side commission at 2.5%</dt>
                <dd className="tnum font-semibold">$20,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-ink">Your rebate at closing</dt>
                <dd className="tnum font-display text-2xl font-semibold text-signal">
                  ~$10,000
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Illustration only. Commission rates vary by listing, and rebate
              mechanics vary by province — your numbers get confirmed in
              writing before you offer.
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
          Three steps, and two of them are things you were doing anyway.
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
          English, above the fold.
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
      <section id="lead-form" className="scroll-mt-20 border-t border-hairline bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-signal">
              Start the conversation
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Tell us what you&rsquo;re buying.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-paper/70">
              A human reads every one of these — usually within a business day.
              We&rsquo;ll confirm the rebate works in your province, introduce
              you to the right partner agent, and get out of the way.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-paper/50">
              No obligation, no spam. Talking to us doesn&rsquo;t create an
              agency relationship — that happens with the partner brokerage,
              in writing.
            </p>
          </div>
          <div className="rounded-xl border border-paper/15 bg-paper p-6 text-ink">
            <JoinForm
              source="work_with_us"
              variant="full"
              accent="signal"
              submitLabel="Send it — let's talk"
              successMessage="Got it. A human will be in touch within a business day."
            />
          </div>
        </div>
      </section>

      {/* Fine print */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs leading-relaxed text-ink-faint">
          Brokerage services are provided through partner brokerages, including
          Konfidis. The commission rebate is available where referral
          arrangements and commission rebates are permitted by provincial
          regulation, and is paid at closing through the brokerage handling the
          transaction. Nothing on this page is legal, tax, or investment
          advice.
        </p>
      </section>
    </>
  );
}
