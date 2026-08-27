import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument, podcastSeriesNode } from "@/lib/seo/jsonld";
import {
  HOSTS,
  PODCAST_APPLE_URL,
  PODCAST_NAME,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: "About — the podcast behind the platform",
  description:
    "Realist is built by Daniel Foch and Nick Hill, hosts of The Canadian Real Estate Investor — Canada's #1 real estate podcast. The toolkit behind the show: pre-underwritten listings, the multiplex underwriter, and motivated-seller deals.",
  alternates: { canonical: "/about" },
};

const HOST_DETAILS: Record<
  (typeof HOSTS)[number]["slug"],
  { role: string; bio: string }
> = {
  "daniel-foch": {
    role: "Co-host · Broker & analyst",
    bio: "Daniel is a real estate broker and analyst who has spent his career underwriting Canadian property — and explaining, on the record, why the numbers do or don't work. His market analysis is regularly cited across Canadian financial media.",
  },
  "nick-hill": {
    role: "Co-host · Mortgage agent & investor",
    bio: "Nick is a mortgage agent and active investor who comes at every deal from the financing side — what lenders actually approve, what the debt really costs, and where investors get themselves stuck.",
  },
};

const LISTEN_LINKS = [
  { href: PODCAST_APPLE_URL, label: "Apple Podcasts" },
  { href: PODCAST_SPOTIFY_URL, label: "Spotify" },
  { href: PODCAST_YOUTUBE_URL, label: "YouTube" },
] as const;

const TOOLS = [
  {
    href: "/listings",
    title: "Pre-underwritten listings",
    body: "Every MLS® listing scored with cap rate, cash flow, and yield before you book a showing.",
  },
  {
    href: "/multiplex",
    title: "Multiplex Underwriter",
    body: "Type a Toronto address, get zoning permissions, a buildable envelope, and a CMHC proforma.",
  },
  {
    href: "/deals",
    title: "Motivated-seller deals",
    body: "Power-of-sale, foreclosure, and vendor take-back listings across Canada, continuously updated.",
  },
] as const;

/** Deterministic initials for the placeholder avatar ("Daniel Foch" → "DF"). */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AboutPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          podcastSeriesNode(),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        )}
      />

      {/* Hero */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            About Realist
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Canada&rsquo;s #1 real estate podcast, with the receipts to back it up.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Twice a week, {PODCAST_NAME} breaks down the Canadian market for
            hundreds of thousands of investors — rates, rents, policy, and the
            deals hiding in between. Realist is what happens when the hosts stop
            describing the underwriting and start shipping it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            {LISTEN_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-hairline-strong bg-surface px-4 py-2.5 text-ink transition-colors hover:border-brand hover:text-brand"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Hosts */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          The hosts
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Two practitioners who talk about the market for a living — and invest
          in it with their own money.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {HOSTS.map((host) => {
            const details = HOST_DETAILS[host.slug];
            return (
              <article
                key={host.slug}
                className="flex gap-5 rounded-xl border border-hairline bg-surface p-6"
              >
                {/*
                 * Placeholder avatar. When headshots land, drop them at
                 * public/hosts/<slug>.jpg (e.g. /hosts/daniel-foch.jpg) and
                 * swap this block for:
                 *   <img src={`/hosts/${host.slug}.jpg`} alt={host.name}
                 *        className="h-20 w-20 shrink-0 rounded-xl border border-hairline object-cover" />
                 */}
                <div
                  aria-hidden
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-wash"
                >
                  <span className="font-display text-2xl font-semibold text-brand-deep">
                    {initials(host.name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold">{host.name}</h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-brand">
                    {details.role}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{details.bio}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* What Realist is */}
      <section className="border-y border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            What Realist is
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
            The toolkit behind the show. Every framework we use on air —
            cap-rate screens, development feasibility, distress signals — runs
            here as software, free, on real Canadian listings. The platform is
            paid for by{" "}
            <Link href="/work-with-us" className="font-semibold text-brand hover:text-brand-deep">
              deals, not subscriptions
            </Link>
            , so the tools never end up behind a paywall.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex flex-col rounded-xl border border-hairline bg-paper p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="font-display text-lg font-semibold">{tool.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{tool.body}</p>
                <span className="mt-4 text-sm font-semibold text-brand group-hover:text-brand-deep">
                  Open the tool →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-2">
        <Link
          href="/community"
          className="group rounded-xl border border-hairline bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">In person</p>
          <h3 className="font-display mt-2 text-xl font-semibold">Meet the community</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Monthly investor meetups across Canada, and the flagship Toronto
            event on September 15.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">
            See upcoming events →
          </span>
        </Link>
        <Link
          href="/work-with-us"
          className="group rounded-xl border border-hairline bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-signal">The offer</p>
          <h3 className="font-display mt-2 text-xl font-semibold">
            Get 50% of our commission back
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Buy a property you found on Realist with our partner team and half
            our commission comes back to you at closing.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">
            How it works →
          </span>
        </Link>
      </section>
    </>
  );
}
