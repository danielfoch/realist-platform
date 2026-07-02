import { Link, useLocation } from "wouter";

interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Find deals",
    links: [
      { label: "Yield Map", href: "/tools/cap-rates" },
      { label: "Motivated Deals", href: "/tools/motivated-deals" },
      { label: "Watchlist & Alerts", href: "/watchlist" },
      { label: "BuyBox", href: "/tools/buybox" },
      { label: "Co-Investing", href: "/tools/coinvest" },
    ],
  },
  {
    title: "Analyze",
    links: [
      { label: "Deal Analyzer", href: "/tools/analyzer" },
      { label: "AI Multiplex Underwriter", href: "/tools/multiplex-underwriter" },
      { label: "Rent vs Buy", href: "/tools/rent-vs-buy" },
      { label: "True Cost of Ownership", href: "/tools/true-cost" },
      { label: "All tools", href: "/tools" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Market Intelligence", href: "/insights" },
      { label: "Reports", href: "/reports" },
      { label: "Markets", href: "/markets" },
      { label: "Strategies", href: "/investing" },
      { label: "Podcast", href: "/insights/podcast" },
      { label: "Guides & Encyclopedia", href: "/insights/guides" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Community Hub", href: "/community" },
      { label: "Find an Expert", href: "/experts" },
      { label: "Events", href: "/community/events" },
      { label: "Meetups", href: "/meetups" },
      { label: "Leaderboard", href: "/community/leaderboard" },
      { label: "Skool community", href: "https://www.skool.com/realist", external: true },
    ],
  },
  {
    title: "Professionals & Company",
    links: [
      { label: "Work with Realist", href: "/work-with-realist" },
      { label: "Power Team", href: "/power-team" },
      { label: "Join as a Realtor", href: "/join/realtors" },
      { label: "Mortgage Brokers", href: "/join/mortgage-brokers" },
      { label: "Lenders", href: "/join/lenders" },
      { label: "Become an Expert", href: "/join/experts" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/about/contact" },
      { label: "Premium", href: "/premium" },
    ],
  },
];

// Routes that own their whole viewport (full-screen map, share views, auth,
// embeds, admin, standalone marketing funnels) opt out of the global footer.
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
  if (EXCLUDED_PREFIXES.some((p) => location === p || location.startsWith(`${p}/`) || (p.endsWith("/") && location.startsWith(p)))) {
    return null;
  }

  return (
    <footer className="border-t border-border/50 bg-background" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold mb-3">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">R</span>
            </div>
            <span>
              Realist.ca powered by{" "}
              <a
                href="https://valery.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
                data-testid="link-valery"
              >
                Valery.ca
              </a>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="https://thecanadianrealestateinvestor.substack.com/feed" className="hover:text-foreground transition-colors">RSS</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
