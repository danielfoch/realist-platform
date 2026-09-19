import Link from "next/link";
import { BrandMark } from "@/components/SiteNav";
import {
  PODCAST_APPLE_URL,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
  STATS_BASE_URL,
} from "@/lib/brand";

const FOOTER_COLS: Array<{
  heading: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}> = [
  {
    heading: "Find & underwrite",
    links: [
      { href: "/listings", label: "Listings, pre-underwritten" },
      { href: "/deals", label: "Motivated sellers" },
      { href: "/underwrite", label: "Underwrite any deal" },
      { href: "/multiplex", label: "Multiplex underwriter" },
    ],
  },
  {
    heading: "Team & community",
    links: [
      { href: "/team", label: "Power team" },
      { href: "/work-with-us", label: "Buy with cash back" },
      { href: "/community", label: "Meetups" },
      { href: "/community/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/podcast", label: "Podcast" },
      { href: "/research", label: "Research" },
      { href: "/encyclopedia", label: "Encyclopedia" },
      { href: STATS_BASE_URL, label: "Market stats", external: true },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Listen",
    links: [
      { href: PODCAST_APPLE_URL, label: "Apple Podcasts", external: true },
      { href: PODCAST_SPOTIFY_URL, label: "Spotify", external: true },
      { href: PODCAST_YOUTUBE_URL, label: "YouTube", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-hairline">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-hairline pb-8">
          <Link href="/" aria-label="Realist home">
            <BrandMark />
          </Link>
          <p className="text-[13px] text-ink-faint">More homes. More possibility.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 py-10 sm:grid-cols-4">
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h3 className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
                {col.heading}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-ink-soft hover:text-brand"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-[13px] text-ink-soft hover:text-brand">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-hairline pt-6 text-[11px] leading-relaxed text-ink-faint">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Realist.ca · Made for the Canadian real estate investor.</span>
            <span className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </span>
          </div>
          <p className="mt-4 max-w-4xl">
            Tools and data are provided for information only and are not investment, legal, or tax
            advice. Listing content is provided under license by the Canadian Real Estate Association
            (CREA). The trademarks REALTOR®, REALTORS® and the REALTOR® logo are controlled by CREA
            and identify real estate professionals who are members of CREA. The trademarks MLS®,
            Multiple Listing Service® and the associated logos identify professional services rendered
            by REALTOR® members of CREA.
          </p>
        </div>
      </div>
    </footer>
  );
}
