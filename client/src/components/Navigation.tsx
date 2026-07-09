import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Menu, X, User, LogOut, Briefcase, Building, ChevronDown,
  Calculator, MapPin, Users, Handshake, Calendar, Radio,
  FileText, TrendingUp, BarChart3, Shield, Gavel,
  Map, DollarSign, Layers, Building2, Inbox, Sparkles,
  KeyRound, FolderOpen, Gauge, Newspaper, Globe2, Bell, PhoneCall, PenLine,
  Youtube, MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/NotificationBell";
import { track } from "@/lib/analytics";
import { authPath } from "@/lib/authReturn";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.webp";

interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  external?: boolean;
  badge?: string;
}

interface NavCategory {
  label: string;
  /**
   * Hub page for this category. Wired in two places: the mobile section
   * header is a link to it, and on desktop the hub appears as a browsable
   * dropdown item (first "…Hub"/"All Tools" row) since a Radix
   * DropdownMenuTrigger can't be both a link and a menu toggle.
   */
  href?: string;
  items: NavItem[];
}

// Investor-first navigation with a visible professional lane. One name per
// concept ("Yield Map" everywhere). Hub pages lead each dropdown so every
// category has a browsable index.
const navCategories: NavCategory[] = [
  {
    label: "Find Deals",
    href: "/tools",
    items: [
      { href: "/tools/cap-rates", label: "Yield Map", description: "Browse listings by cap rate and rental yield", icon: <Map className="h-4 w-4" /> },
      { href: "/tools/motivated-deals", label: "Motivated Deals", description: "Motivated sellers, power of sale, VTB finder", icon: <Gavel className="h-4 w-4" /> },
      { href: "/tools/buybox", label: "BuyBox Builder", description: "Define and share your investment criteria", icon: <MapPin className="h-4 w-4" /> },
      { href: "/tools/coinvest", label: "Co-Invest", description: "Find investment partners", icon: <Handshake className="h-4 w-4" /> },
      { href: "/tools/land-claim-screener", label: "Land Claim Screener", description: "Treaty area screening for any property", icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    label: "Analyze",
    href: "/tools",
    items: [
      { href: "/tools", label: "All Tools", description: "Browse every calculator", icon: <FolderOpen className="h-4 w-4" /> },
      { href: "/tools/analyzer", label: "Deal Analyzer", description: "Full underwriting — buy & hold, BRRR, multiplex, flip", icon: <Calculator className="h-4 w-4" /> },
      { href: "/tools/financing-readiness", label: "Financing Readiness", description: "Your stress-tested max purchase price in 30 seconds", icon: <Gauge className="h-4 w-4" />, badge: "New" },
      { href: "/tools/multiplex-underwriter", label: "Multiplex Underwriter", description: "Address-first AI underwrite with zoning and risk flags", icon: <Sparkles className="h-4 w-4" />, badge: "AI" },
      { href: "/tools/multiplex-feasibility", label: "Multiplex Feasibility", description: "Screen any property for development potential", icon: <Building2 className="h-4 w-4" /> },
      { href: "/tools/will-it-plex", label: "Will It Plex?", description: "Full multiplex financial pro forma", icon: <Layers className="h-4 w-4" /> },
      { href: "/tools/true-cost", label: "True Cost", description: "Complete cost breakdown for Ontario buyers", icon: <DollarSign className="h-4 w-4" /> },
      { href: "/tools/rent-vs-buy", label: "Rent vs. Buy", description: "Compare renting vs. owning over time", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/tools/deal-desk", label: "Deal Desk", description: "Submit a deal for our team to review with you", icon: <Inbox className="h-4 w-4" /> },
    ],
  },
  {
    label: "Market Intel",
    href: "/insights",
    items: [
      { href: "/insights", label: "Market Intelligence Hub", description: "All research, dashboards, and analysis in one place", icon: <Gauge className="h-4 w-4" /> },
      { href: "/insights/market-report", label: "Market Reports", description: "Monthly yield, rates, motivated-seller, and research coverage", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/reports", label: "Research Reports", description: "Deep-dive reports and interactive dashboards", icon: <Newspaper className="h-4 w-4" /> },
      { href: "/markets", label: "Markets", description: "City-level prices, yields, and policy", icon: <Globe2 className="h-4 w-4" /> },
      { href: "/investing", label: "Strategies", description: "Investing strategy playbooks — BRRRR, house hack, multiplex, and more", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "/insights/podcast", label: "Podcast", description: "Real estate investor conversations", icon: <Radio className="h-4 w-4" /> },
      { href: "/insights/videos", label: "Videos", description: "Daniel Foch's latest YouTube videos", icon: <Youtube className="h-4 w-4" /> },
      { href: "/insights/blog", label: "Blog", description: "Essays and research notes from the Realist team", icon: <PenLine className="h-4 w-4" /> },
      { href: "/insights/guides", label: "Guides & Encyclopedia", description: "How-to guides, definitions, formulas, and underwriting specs", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "Community",
    href: "/community",
    items: [
      { href: "/community", label: "Community Hub", description: "Everything happening across the Realist community", icon: <Users className="h-4 w-4" /> },
      { href: "/community/questions", label: "Property Questions", description: "Open deal questions routed to expert categories", icon: <MessageSquare className="h-4 w-4" /> },
      { href: "/deal-room", label: "Live Deal Room", description: "Free live deal review — Mondays 11:30am ET", icon: <Radio className="h-4 w-4" /> },
      { href: "/experts", label: "Find an Expert", description: "Vetted market experts and building pros", icon: <Briefcase className="h-4 w-4" /> },
      { href: "/community/events", label: "Events", description: "Workshops and investor meetups", icon: <Calendar className="h-4 w-4" /> },
      { href: "/meetups", label: "Meetups", description: "Local investor meetups with native RSVP", icon: <MapPin className="h-4 w-4" /> },
      { href: "/community/leaderboard", label: "Leaderboard", description: "Top deal analysts in the community", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "https://www.skool.com/realist", label: "Online Community", description: "1,200+ members on Skool", icon: <Users className="h-4 w-4" />, external: true },
    ],
  },
  {
    label: "For Professionals",
    items: [
      { href: "/power-team", label: "Power Team", description: "Join the professional network behind Realist deals", icon: <Briefcase className="h-4 w-4" /> },
      { href: "/about/local-experts", label: "Local Experts", description: "Claim a market as an investor referral partner or meetup host", icon: <MapPin className="h-4 w-4" /> },
      { href: "/join/realtors", label: "Realtors", description: "Get matched with investors analyzing deals in your market", icon: <Building className="h-4 w-4" /> },
      { href: "/join/mortgage-brokers", label: "Mortgage Brokers", description: "Fund deals sourced and underwritten on Realist", icon: <DollarSign className="h-4 w-4" /> },
      { href: "/join/lenders", label: "Lenders", description: "Reach investors at the moment they need financing", icon: <Handshake className="h-4 w-4" /> },
      { href: "/join/experts", label: "Become an Expert", description: "Share your market knowledge with Realist investors", icon: <Users className="h-4 w-4" /> },
      { href: "/partner", label: "Partner Portal", description: "Manage your leads, markets, and referrals", icon: <Gauge className="h-4 w-4" /> },
    ],
  },
];

// Hub-page hrefs highlight only on exact match — otherwise "All Tools"
// (/tools) would light up the Analyze category on every /tools/* route.
const HUB_HREFS = new Set(["/tools", "/insights", "/community", "/reports", "/markets"]);

const eventAdminEmails = new Set([
  "jonathan@realist.ca",
  "danielfoch@gmail.com",
  "na4hill@gmail.com",
]);

function isActiveHref(location: string, href: string): boolean {
  const path = href.split("?")[0];
  if (HUB_HREFS.has(path)) return location === path;
  return location === path || location.startsWith(`${path}/`);
}

function NavItemRow({ item }: { item: NavItem }) {
  const content = (
    <DropdownMenuItem className="cursor-pointer py-2.5">
      <div className="flex items-start gap-3 w-full">
        <div className="text-muted-foreground mt-0.5 shrink-0">{item.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{item.label}</span>
            {item.badge && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary leading-none">
                {item.badge}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">{item.description}</p>
          )}
        </div>
      </div>
    </DropdownMenuItem>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return <Link href={item.href}>{content}</Link>;
}

export function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const canAccessEventsAdmin = user?.email ? eventAdminEmails.has(user.email.toLowerCase()) : false;

  const isActiveCategory = (category: NavCategory) =>
    category.items.some(item => !item.external && isActiveHref(location, item.href));

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 glass">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src={logoImage}
              alt="Realist Logo"
              className="h-10 w-10 object-contain dark:invert"
              data-testid="img-logo"
            />
            <span className="font-bold text-xl tracking-tight" data-testid="text-logo">Realist</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {navCategories.map((category) => (
              <DropdownMenu key={category.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isActiveCategory(category) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1 text-sm h-9"
                    data-testid={`nav-${category.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {category.label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {category.items.map((item) => (
                    <NavItemRow key={item.href} item={item} />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>

          {/* Right side: primary CTA + auth */}
          <div className="flex items-center gap-2">
            {/* Primary CTAs — always visible on desktop. Book a Call is the
                revenue CTA and holds the filled treatment. */}
            <div className="hidden md:flex items-center gap-1.5">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 px-4 gap-1.5"
                data-testid="button-nav-analyze"
                onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "nav" })}
              >
                <Link href="/tools/analyzer">
                  <Calculator className="h-3.5 w-3.5" />
                  Analyze a Deal
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="h-9 px-4 gap-1.5"
                data-testid="button-nav-book-call"
                onClick={() => track({ event: "cta_clicked", cta: "book_call", location: "nav" })}
              >
                <Link href="/book-a-call">
                  <PhoneCall className="h-3.5 w-3.5" />
                  Book a Call
                </Link>
              </Button>
            </div>

            {/* Notification inbox bell — one instance serves desktop and
                mobile (it sits outside the hidden md:flex blocks). Only
                rendered when authenticated so the inbox query never fires
                for anonymous visitors. */}
            {!isLoading && isAuthenticated && <NotificationBell />}

            {/* Auth */}
            {!isLoading && (
              <div className="hidden md:flex items-center gap-1">
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="button-user-menu">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {user?.firstName?.[0] || user?.email?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link href="/dashboard">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-dashboard">
                          <Gauge className="mr-2 h-4 w-4" />
                          Dashboard
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/tools/investor-os">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-my-deals">
                          <FolderOpen className="mr-2 h-4 w-4" />
                          My Deals
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/watchlist">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-my-watchlist">
                          <Bell className="mr-2 h-4 w-4" />
                          Watchlist & Alerts
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/my-performance">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-my-performance">
                          <TrendingUp className="mr-2 h-4 w-4" />
                          My Performance
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/account/api-keys">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-api-keys">
                          <KeyRound className="mr-2 h-4 w-4" />
                          API Keys & Claude
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/account/notifications">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-notifications">
                          <Bell className="mr-2 h-4 w-4" />
                          Email Preferences
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <Link href="/investor">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-investor-portal">
                          <Building className="mr-2 h-4 w-4" />
                          Investor Portal
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/partner">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-partner-portal">
                          <Briefcase className="mr-2 h-4 w-4" />
                          Partner Portal
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/partner/network">
                        <DropdownMenuItem className="cursor-pointer" data-testid="link-realtor-network">
                          <Users className="mr-2 h-4 w-4" />
                          Realtor Network
                        </DropdownMenuItem>
                      </Link>
                      {canAccessEventsAdmin && (
                        <Link href="/admin/events">
                          <DropdownMenuItem className="cursor-pointer" data-testid="link-events-admin">
                            <Calendar className="mr-2 h-4 w-4" />
                            Events Admin
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive"
                        onClick={() => logout()}
                        data-testid="button-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => window.location.href = authPath("/login")}
                      data-testid="button-sign-in"
                    >
                      <User className="mr-1.5 h-4 w-4" />
                      Sign In
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-9"
                      data-testid="button-nav-signup"
                      onClick={() => track({ event: "cta_clicked", cta: "create_account", location: "nav" })}
                    >
                      <Link href="/create-account">Create free account</Link>
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 glass max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-5">
            {/* Primary CTAs on mobile — Book a Call first (revenue CTA) */}
            <Button asChild className="w-full gap-2" data-testid="button-mobile-book-call">
              <Link href="/book-a-call" onClick={closeMobile}>
                <PhoneCall className="h-4 w-4" />
                Book a Call
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2" data-testid="button-mobile-analyze">
              <Link href="/tools/analyzer" onClick={closeMobile}>
                <Calculator className="h-4 w-4" />
                Analyze a Deal
              </Link>
            </Button>

            {navCategories.map((category) => (
              <div key={category.label} className="space-y-1">
                {category.href ? (
                  <Link
                    href={category.href}
                    onClick={closeMobile}
                    className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 hover:text-foreground"
                    data-testid={`link-mobile-category-${category.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {category.label}
                  </Link>
                ) : (
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                    {category.label}
                  </div>
                )}
                {category.items.map((item) =>
                  item.external ? (
                    <Button
                      key={item.href}
                      asChild
                      variant="ghost"
                      className="w-full justify-start gap-3 h-9 text-sm"
                      data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={closeMobile}>
                        {item.icon}
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={item.href}
                      asChild
                      variant={isActiveHref(location, item.href) ? "secondary" : "ghost"}
                      className="w-full justify-start gap-3 h-9 text-sm"
                      data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.href} onClick={closeMobile}>
                        {item.icon}
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </Button>
                  )
                )}
              </div>
            ))}

            <div className="border-t border-border/50 pt-4">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-dashboard">
                    <Link href="/dashboard" onClick={closeMobile}>
                      <Gauge className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-my-deals">
                    <Link href="/tools/investor-os" onClick={closeMobile}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      My Deals
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-my-watchlist">
                    <Link href="/watchlist" onClick={closeMobile}>
                      <Bell className="mr-2 h-4 w-4" />
                      Watchlist & Alerts
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-my-performance">
                    <Link href="/my-performance" onClick={closeMobile}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      My Performance
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-api-keys">
                    <Link href="/account/api-keys" onClick={closeMobile}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      API Keys & Claude
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-notifications">
                    <Link href="/account/notifications" onClick={closeMobile}>
                      <Bell className="mr-2 h-4 w-4" />
                      Email Preferences
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-investor">
                    <Link href="/investor" onClick={closeMobile}>
                      <Building className="mr-2 h-4 w-4" />
                      Investor Portal
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-partner">
                    <Link href="/partner" onClick={closeMobile}>
                      <Briefcase className="mr-2 h-4 w-4" />
                      Partner Portal
                    </Link>
                  </Button>
                  {canAccessEventsAdmin && (
                    <Button asChild variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-events-admin">
                      <Link href="/admin/events" onClick={closeMobile}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Events Admin
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm text-destructive"
                    onClick={() => { logout(); closeMobile(); }}
                    data-testid="button-mobile-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-9 text-sm"
                    onClick={() => { window.location.href = authPath("/login"); closeMobile(); }}
                    data-testid="button-mobile-sign-in"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                  <Button asChild className="w-full h-9 text-sm" data-testid="button-mobile-signup">
                    <Link href="/create-account" onClick={closeMobile}>Create free account</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
