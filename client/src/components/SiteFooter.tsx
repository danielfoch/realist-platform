import { Link, useLocation } from "wouter";
import { ArrowUpRight, Headphones } from "lucide-react";
import { PODCAST_NAME } from "@shared/brand";

const FOOTER_GROUPS = [
  {
    title: "Invest",
    links: [
      { label: "Browse deals", href: "/deals" },
      { label: "Analyze a property", href: "/tools/analyzer" },
      { label: "Toronto multiplex", href: "/tools/multiplex-underwriter" },
      { label: "Motivated deals", href: "/deals?deals=power_of_sale,motivated,vtb&distressOnly=1" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Podcast", href: "/insights/podcast" },
      { label: "Research", href: "/insights" },
      { label: "Market reports", href: "/reports" },
      { label: "Investor encyclopedia", href: "/insights/encyclopedia" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Local meetups", href: "/meetups" },
      { label: "Live Deal Room", href: "/deal-room" },
      { label: "Work with Realist", href: "/work-with-realist" },
      { label: "Contact", href: "/about/contact" },
    ],
  },
] as const;

const EXCLUDED_PREFIXES = [
  "/tools/cap-rates",
  "/login",
  "/signup",
  "/get-started",
  "/create-account",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/verify-phone",
  "/admin",
  "/embed",
  "/underwriting/",
  "/analyses/",
  "/masterclass",
  "/course",
];

export function SiteFooter() {
  const [location] = useLocation();
  if (EXCLUDED_PREFIXES.some((prefix) => location === prefix || location.startsWith(prefix))) {
    return null;
  }

  return (
    <footer className="border-t border-border/60 bg-[#0b1220] text-white" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1.8fr]">
          <div className="max-w-sm">
            <Link href="/" className="text-2xl font-bold tracking-tight">Realist.ca</Link>
            <p className="mt-4 leading-7 text-slate-400">
              Institutional-grade tools for regular Canadian real estate investors.
            </p>
            <Link
              href="/insights/podcast"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <Headphones className="h-4 w-4 text-red-300" />
              {PODCAST_NAME}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-bold">{group.title}</p>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Realist Inc. Canadian real estate intelligence.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a
              href="https://thecanadianrealestateinvestor.substack.com/feed"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              RSS <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
