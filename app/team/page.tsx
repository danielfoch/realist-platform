import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { LeadForm } from "@/components/leads/LeadForm";
import { TeamRequestForm } from "@/components/team/TeamRequestForm";
import { breadcrumbNode, faqNode, jsonLdDocument } from "@/lib/seo/jsonld";
import { POWER_TEAM_ROLES } from "@/lib/team/roles";

export const metadata: Metadata = {
  title: "Build your real estate power team — vetted introductions across Canada",
  description:
    "The nine people around every good real estate deal — investor realtor, mortgage broker, lawyer, inspector, insurer, accountant, property manager, contractor, architect — and introductions to ones who work with investors, in your market.",
  alternates: { canonical: "/team" },
};

const FAQ = [
  {
    q: "What does an introduction cost me?",
    a: "Nothing. Realtors and mortgage brokers in the network pay Realist a referral fee when a deal closes or funds — that's how the tools stay free, and you'll see it disclosed in writing before you sign anything with them. Lawyers, inspectors, accountants, property managers, contractors and architects pay us nothing at all; they're here because investors in the community vouch for them.",
  },
  {
    q: "Who actually gets my details?",
    a: "A person on our team reads your request first. Within about two hours of Toronto we work realtor requests ourselves through Valery Real Estate; elsewhere we introduce you to the partner for that market. Your details go to the people you asked to meet and nobody else.",
  },
  {
    q: "Do I have to use who you introduce?",
    a: "No. An introduction is a phone call, not a contract. If they're not the right fit, tell us and we'll try again.",
  },
  {
    q: "I already have a realtor.",
    a: "Keep them. Tick only the people you're missing — most investors come to us for the mortgage broker who understands rental income, or the lawyer who has closed a multiplex before.",
  },
];

export default function TeamPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Power team", path: "/team" },
          ]),
          faqNode(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-brand">Power team</p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Nobody closes a good deal <em>alone</em>.
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
            Nine people stand between a deal that pencils and a deal that closes. Tell us your market and who
            you&rsquo;re missing, and we&rsquo;ll introduce you to people who work with investors every week —
            usually within a business day.
          </p>
          <a
            href="#request"
            className="mt-6 inline-block rounded-[3px] bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Get introduced
          </a>
        </div>
      </section>

      {/* The nine, in the order a deal needs them */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          The nine, in the order a deal <em>needs</em> them
        </h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {POWER_TEAM_ROLES.map((role, index) => (
            <li key={role.key} className="bg-surface p-5">
              <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
                {String(index + 1).padStart(2, "0")} · {role.when}
              </p>
              <h3 className="font-display mt-2 text-lg font-semibold tracking-tight">{role.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{role.does}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Request */}
      <section id="request" className="scroll-mt-20 border-y border-hairline bg-raised">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Who are you <em>missing</em>?
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              Pick the roles, tell us the market. A person reads every request and makes the introductions by
              email, so you can take the conversation from there.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              <li>· No cost to you, no obligation to hire anyone.</li>
              <li>· People who work with investors, not first-time buyers.</li>
              <li>· Your details go only to the people you ask to meet.</li>
            </ul>
            <p className="mt-5 text-sm text-ink-soft">
              Keeping track of your team?{" "}
              <Link href="/account" className="font-medium text-brand hover:text-brand-deep">
                Your account has a checklist →
              </Link>
            </p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-6">
            <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
              <TeamRequestForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Straight answers */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Straight answers</h2>
        <div className="mt-6 divide-y divide-hairline border-y border-hairline">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
                {item.q}
                <span className="shrink-0 text-brand transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* The professional lane */}
      <section id="pros" className="band-night scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">For professionals</p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              You work with investors. They&rsquo;re <em>here</em>.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              Members arrive having already run the numbers. Realtors and mortgage brokers join on a referral
              agreement — a fee only when a deal closes or funds. Everyone else joins free: your knowledge is
              what makes the network worth asking.
            </p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-6">
            <LeadForm
              kind="pro_application"
              ask={["name", "phone", "city", "province", "roles", "company", "licence", "message"]}
              messagePlaceholder="Markets you cover, the kind of investor work you do most…"
              marketingLabel="Email me network updates. Unsubscribe any time."
              submitLabel="Apply to join"
              successMessage="Thanks — we'll be in touch to talk through how the network works."
            />
          </div>
        </div>
      </section>
    </>
  );
}
