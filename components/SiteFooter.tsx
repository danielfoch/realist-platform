import Link from "next/link";
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
    heading: "Tools",
    links: [
      { href: "/listings", label: "Listings & cap rates" },
      { href: "/multiplex", label: "Multiplex underwriter" },
      { href: "/deals", label: "Motivated deals" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/podcast", label: "Podcast" },
      { href: "/research", label: "Research" },
      { href: "/encyclopedia", label: "Encyclopedia" },
      { href: STATS_BASE_URL, label: "Market stats", external: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/community", label: "Community & events" },
      { href: "/work-with-us", label: "Work with us" },
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
    <footer className="mt-20 border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
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
                        className="text-sm text-ink-soft hover:text-brand"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-sm text-ink-soft hover:text-brand">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-hairline pt-6 text-xs leading-relaxed text-ink-faint">
          <p>
            © {new Date().getFullYear()} Realist. Tools and data are provided for
            information only and are not investment, legal, or tax advice.
          </p>
          <p className="mt-2">
            Listing content is provided under license by the Canadian Real Estate
            Association (CREA). The trademarks REALTOR®, REALTORS® and the REALTOR®
            logo are controlled by CREA and identify real estate professionals who
            are members of CREA. The trademarks MLS®, Multiple Listing Service® and
            the associated logos identify professional services rendered by REALTOR®
            members of CREA.
          </p>
        </div>
      </div>
    </footer>
  );
}
