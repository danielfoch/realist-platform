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
  BookOpen, FileText, TrendingUp, BarChart3, Shield, Gavel,
  Map, DollarSign, LineChart, AlertTriangle, Layers, Building2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.png";

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
  href?: string; // if set, clicking label navigates directly
  items: NavItem[];
}

// Investor-first navigation: product actions up front, content second
const navCategories: NavCategory[] = [
  {
    label: "Find Deals",
    items: [
      { href: "/tools/cap-rates", label: "Yield Map", description: "Browse listings by estimated gross yield", icon: <Map className="h-4 w-4" /> },
      { href: "/tools/distress-deals", label: "Distress Deals", description: "Power of sale, foreclosure, VTB finder", icon: <Gavel className="h-4 w-4" />, badge: "New" },
      { href: "/tools/buybox", label: "BuyBox Builder", description: "Define and share your investment criteria", icon: <MapPin className="h-4 w-4" /> },
      { href: "/tools/coinvest", label: "Co-Invest", description: "Find investment partners", icon: <Handshake className="h-4 w-4" /> },
      { href: "/tools/land-claim-screener", label: "Land Claim Screener", description: "Treaty area screening for any property", icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    label: "Deal Analyzer",
    href: "/tools/analyzer",
    items: [
      { href: "/tools/analyzer", label: "Deal Analyzer", description: "Full underwriting — buy & hold, BRRR, multiplex, flip", icon: <Calculator className="h-4 w-4" /> },
      { href: "/tools/multiplex-feasibility", label: "Multiplex Feasibility", description: "Screen any property for development potential", icon: <Building2 className="h-4 w-4" />, badge: "New" },
      { href: "/tools/will-it-plex", label: "Will It Plex?", description: "Full multiplex financial pro forma", icon: <Layers className="h-4 w-4" /> },
      { href: "/tools/true-cost", label: "True Cost", description: "Complete cost breakdown for Ontario buyers", icon: <DollarSign className="h-4 w-4" /> },
      { href: "/tools/rent-vs-buy", label: "Rent vs. Buy", description: "Compare renting vs. owning over time", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/tools", label: "All Tools", description: "Browse every calculator", icon: <Calculator className="h-4 w-4" /> },
    ],
  },
  {
    label: "Market Intel",
    items: [
      { href: "/insights/market-report", label: "Market Report", description: "Monthly yield and rent trends by city", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/insights/mortgage-rates", label: "Mortgage Rates", description: "Best current rates across Canada", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "/insights/cpi-march-2026", label: "CPI Report", description: "March 2026 — investor interpretation", icon: <LineChart className="h-4 w-4" /> },
      { href: "/insights/distress-report", label: "Distress Report", description: "Monthly foreclosure and POS snapshot", icon: <AlertTriangle className="h-4 w-4" /> },
      { href: "/insights/podcast", label: "Podcast", description: "Real estate investor conversations", icon: <Radio className="h-4 w-4" /> },
      { href: "/insights/blog", label: "Blog & Research", description: "Market analysis and strategy", icon: <BookOpen className="h-4 w-4" /> },
      { href: "/insights/guides", label: "Guides", description: "How-to guides and educational resources", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/community/events", label: "Events", description: "Workshops and investor meetups", icon: <Calendar className="h-4 w-4" /> },
      { href: "/community/network", label: "Grow Your Network", description: "Connect with other investors", icon: <Users className="h-4 w-4" /> },
      { href: "/community/leaderboard", label: "Leaderboard", description: "Top deal analysts in the community", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "https://www.skool.com/realist", label: "Online Community", description: "1,200+ members on Skool", icon: <Users className="h-4 w-4" />, external: true },
    ],
  },
];

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

  const isActiveCategory = (category: NavCategory) =>
    category.items.some(item => !item.external && location.startsWith(item.href.split("?")[0])) ||
    (category.href ? location.startsWith(category.href) : false);

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
            {/* Primary CTA — always visible on desktop */}
            <div className="hidden md:block">
              <Link href="/tools/analyzer">
                <Button
                  size="sm"
                  className="h-9 px-4 gap-1.5"
                  data-testid="button-nav-analyze"
                  onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "nav" })}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Analyze a Deal
                </Button>
              </Link>
            </div>

            {/* Auth */}
            {!isLoading && (
              <div className="hidden md:block">
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
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email}
                      </DropdownMenuLabel>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => window.location.href = "/login"}
                    data-testid="button-sign-in"
                  >
                    <User className="mr-1.5 h-4 w-4" />
                    Sign In
                  </Button>
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
            {/* Primary CTA on mobile */}
            <Link href="/tools/analyzer" onClick={closeMobile}>
              <Button className="w-full gap-2" data-testid="button-mobile-analyze">
                <Calculator className="h-4 w-4" />
                Analyze a Deal
              </Button>
            </Link>

            {navCategories.map((category) => (
              <div key={category.label} className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                  {category.label}
                </div>
                {category.items.map((item) =>
                  item.external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMobile}
                      className="block"
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-9 text-sm"
                        data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.icon}
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    </a>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={closeMobile}>
                      <Button
                        variant={location.startsWith(item.href.split("?")[0]) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3 h-9 text-sm"
                        data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.icon}
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    </Link>
                  )
                )}
              </div>
            ))}

            <div className="border-t border-border/50 pt-4">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <Link href="/investor" onClick={closeMobile}>
                    <Button variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-investor">
                      <Building className="mr-2 h-4 w-4" />
                      Investor Portal
                    </Button>
                  </Link>
                  <Link href="/partner" onClick={closeMobile}>
                    <Button variant="ghost" className="w-full justify-start h-9 text-sm" data-testid="link-mobile-partner">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Partner Portal
                    </Button>
                  </Link>
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
                    onClick={() => { window.location.href = "/login"; closeMobile(); }}
                    data-testid="button-mobile-sign-in"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Sign In
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
