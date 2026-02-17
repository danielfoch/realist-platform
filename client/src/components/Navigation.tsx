import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, X, User, LogOut, Briefcase, Building, ChevronDown, Calculator, MapPin, Users, Handshake, Calendar, Radio, BookOpen, FileText, Info, Mail, ShoppingBag, GraduationCap, DollarSign, TrendingUp, Crown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/Screenshot_2026-01-04_at_3.46.09_PM_1767559573207.png";

interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  external?: boolean;
}

interface NavCategory {
  label: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    label: "Tools",
    items: [
      { href: "/tools/analyzer", label: "Deal Analyzer", description: "Analyze any real estate deal", icon: <Calculator className="h-4 w-4" /> },
      { href: "/tools/cap-rates", label: "Cap Rates", description: "Browse properties by cap rate", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "/tools/true-cost", label: "True Cost", description: "Hidden costs of homeownership", icon: <DollarSign className="h-4 w-4" /> },
      { href: "/tools/buybox", label: "BuyBox", description: "Define your investment criteria", icon: <MapPin className="h-4 w-4" /> },
      { href: "/tools/coinvest", label: "Co-Invest", description: "Find investment partners", icon: <Handshake className="h-4 w-4" /> },
      { href: "/tools", label: "All Tools", description: "Browse all calculators", icon: <Calculator className="h-4 w-4" /> },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/community/events", label: "Events", description: "Workshops and meetups", icon: <Calendar className="h-4 w-4" /> },
      { href: "/community/network", label: "Grow Your Network", description: "Connect with investors", icon: <Users className="h-4 w-4" /> },
      { href: "/community/leaderboard", label: "Leaderboard", description: "Top deal analysts", icon: <TrendingUp className="h-4 w-4" /> },
      { href: "https://www.skool.com/realist", label: "Online Community", description: "Join on Skool", icon: <Users className="h-4 w-4" />, external: true },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/insights/podcast", label: "Podcast", description: "Real estate discussions", icon: <Radio className="h-4 w-4" /> },
      { href: "/insights/blog", label: "Blog", description: "Articles and research", icon: <BookOpen className="h-4 w-4" /> },
      { href: "/insights/guides", label: "Guides", description: "Educational resources", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "About",
    items: [
      { href: "/about", label: "About Realist", description: "Our mission", icon: <Info className="h-4 w-4" /> },
      { href: "/about/team", label: "Team", description: "Meet the founders", icon: <Users className="h-4 w-4" /> },
      { href: "/about/programs", label: "Coaching", description: "Mentorship programs", icon: <GraduationCap className="h-4 w-4" /> },
      { href: "https://shop.realist.ca", label: "Shop", description: "Realist merchandise", icon: <ShoppingBag className="h-4 w-4" />, external: true },
      { href: "/about/contact", label: "Contact", description: "Get in touch", icon: <Mail className="h-4 w-4" /> },
    ],
  },
];

export function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  const isActiveCategory = (category: NavCategory) => {
    return category.items.some(item => !item.external && location.startsWith(item.href.split("?")[0]));
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 glass">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img 
              src={logoImage} 
              alt="Realist Logo" 
              className="h-10 w-10 object-contain dark:invert"
              data-testid="img-logo"
            />
            <span className="font-bold text-xl tracking-tight" data-testid="text-logo">
              Realist
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navCategories.map((category) => (
              <DropdownMenu key={category.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isActiveCategory(category) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1"
                    data-testid={`nav-${category.label.toLowerCase()}`}
                  >
                    {category.label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {category.items.map((item) => (
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DropdownMenuItem className="cursor-pointer py-3">
                          <div className="flex items-start gap-3">
                            <div className="text-muted-foreground mt-0.5">{item.icon}</div>
                            <div>
                              <div className="font-medium">{item.label}</div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </a>
                    ) : (
                      <Link key={item.href} href={item.href}>
                        <DropdownMenuItem className="cursor-pointer py-3">
                          <div className="flex items-start gap-3">
                            <div className="text-muted-foreground mt-0.5">{item.icon}</div>
                            <div>
                              <div className="font-medium">{item.label}</div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </Link>
                    )
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <Link href="/tools/analyzer">
                <Button size="sm" data-testid="button-analyze-deal">
                  <Calculator className="h-4 w-4 mr-2" />
                  Analyze a Deal
                </Button>
              </Link>
            </div>

            {!isLoading && (
              <div className="hidden md:block">
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {user?.firstName?.[0] || user?.email?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>
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
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.href = "/login"}
                    data-testid="button-sign-in"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                )}
                <Link href="/premium">
                  <Button variant="default" size="sm" data-testid="button-nav-premium">
                    <Crown className="mr-2 h-4 w-4" />
                    Premium
                  </Button>
                </Link>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 glass max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            <Link href="/tools/analyzer" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full" data-testid="button-mobile-analyze">
                <Calculator className="h-4 w-4 mr-2" />
                Analyze a Deal
              </Button>
            </Link>

            {navCategories.map((category) => (
              <div key={category.label} className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  {category.label}
                </div>
                {category.items.map((item) => 
                  item.external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.icon}
                        {item.label}
                      </Button>
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant={location.startsWith(item.href.split("?")[0]) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                        data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {item.icon}
                        {item.label}
                      </Button>
                    </Link>
                  )
                )}
              </div>
            ))}

            <div className="border-t border-border/50 pt-4 mt-4">
              {isAuthenticated ? (
                <>
                  <Link href="/investor" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start" data-testid="link-mobile-investor">
                      <Building className="mr-2 h-4 w-4" />
                      Investor Portal
                    </Button>
                  </Link>
                  <Link href="/partner" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start" data-testid="link-mobile-partner">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Partner Portal
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive" 
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    data-testid="button-mobile-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => window.location.href = "/login"}
                  data-testid="button-mobile-sign-in"
                >
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
