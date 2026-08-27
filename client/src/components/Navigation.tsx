import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  FolderOpen,
  Gauge,
  LogOut,
  Menu,
  Radio,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics";
import { authPath } from "@/lib/authReturn";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.webp";

const PRIMARY_LINKS = [
  {
    label: "Deals",
    href: "/deals",
    matches: ["/deals", "/tools/cap-rates", "/listings/", "/watchlist"],
  },
  {
    label: "Multiplex",
    href: "/multiplex",
    matches: ["/tools/multiplex", "/multiplex"],
  },
  {
    label: "Research",
    href: "/research",
    matches: ["/insights", "/reports", "/markets", "/investing"],
  },
  {
    label: "Community",
    href: "/community",
    matches: ["/meetups", "/community", "/deal-room", "/events/"],
  },
] as const;

const eventAdminEmails = new Set([
  "jonathan@realist.ca",
  "danielfoch@gmail.com",
  "na4hill@gmail.com",
]);

function pathMatches(location: string, matches: readonly string[]) {
  return matches.some((match) => location === match || location.startsWith(match));
}

export function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const canAccessEventsAdmin = user?.email ? eventAdminEmails.has(user.email.toLowerCase()) : false;

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl" aria-label="Primary navigation">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Realist home">
            <img src={logoImage} alt="" className="h-9 w-9 object-contain dark:invert" />
            <span className="text-xl font-bold tracking-tight">Realist</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {PRIMARY_LINKS.map((item) => {
              const active = pathMatches(location, item.matches);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden h-9 gap-1.5 md:inline-flex"
              onClick={() => track({ event: "cta_clicked", cta: "work_with_us", location: "nav", destination: "/work-with-realist" })}
            >
              <Link href="/work-with-realist">Work with us</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden h-9 gap-1.5 sm:inline-flex"
              onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "nav", destination: "/tools/analyzer" })}
            >
              <Link href="/tools/analyzer">
                <Search className="h-3.5 w-3.5" />
                Analyze a property
              </Link>
            </Button>

            {!isLoading && isAuthenticated && <NotificationBell />}

            {!isLoading && (
              <div className="hidden lg:block">
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-9 gap-2 rounded-full px-1.5 pr-2" data-testid="button-user-menu">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {user?.firstName?.[0] || user?.email?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <span className="block text-sm font-medium">
                          {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Your account"}
                        </span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link href="/dashboard">
                        <DropdownMenuItem className="cursor-pointer">
                          <Gauge className="mr-2 h-4 w-4" />
                          Dashboard
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/tools/investor-os">
                        <DropdownMenuItem className="cursor-pointer">
                          <FolderOpen className="mr-2 h-4 w-4" />
                          My deals
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/watchlist">
                        <DropdownMenuItem className="cursor-pointer">
                          <Bell className="mr-2 h-4 w-4" />
                          Watchlist &amp; alerts
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/account/notifications">
                        <DropdownMenuItem className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Preferences
                        </DropdownMenuItem>
                      </Link>
                      {canAccessEventsAdmin && (
                        <Link href="/admin/events">
                          <DropdownMenuItem className="cursor-pointer">
                            <Calendar className="mr-2 h-4 w-4" />
                            Events admin
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => logout()}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => { window.location.href = authPath("/login"); }}
                    data-testid="button-sign-in"
                  >
                    Sign in
                  </Button>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-border bg-background lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            {PRIMARY_LINKS.map((item) => {
              const active = pathMatches(location, item.matches);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold ${
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                  <span className="text-muted-foreground">→</span>
                </Link>
              );
            })}

            <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
              <Button asChild className="w-full gap-2">
                <Link href="/tools/analyzer" onClick={closeMobile}>
                  <Search className="h-4 w-4" />
                  Analyze a property
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/work-with-realist" onClick={closeMobile}>Work with us</Link>
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <Link href="/dashboard" onClick={closeMobile} className="flex items-center rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                    <Gauge className="mr-2 h-4 w-4" /> Dashboard
                  </Link>
                  <Link href="/tools/investor-os" onClick={closeMobile} className="flex items-center rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                    <FolderOpen className="mr-2 h-4 w-4" /> My deals
                  </Link>
                  <Link href="/watchlist" onClick={closeMobile} className="flex items-center rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                    <Bell className="mr-2 h-4 w-4" /> Watchlist &amp; alerts
                  </Link>
                  {canAccessEventsAdmin && (
                    <Link href="/admin/events" onClick={closeMobile} className="flex items-center rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                      <Calendar className="mr-2 h-4 w-4" /> Events admin
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={() => { logout(); closeMobile(); }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => { window.location.href = authPath("/login"); closeMobile(); }}
                  >
                    <User className="mr-2 h-4 w-4" /> Sign in
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/create-account" onClick={closeMobile}>Create free account</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>Built for Canadian investors</span>
              <span aria-hidden="true">·</span>
              <Radio className="h-3.5 w-3.5" />
              <span>New episodes Tue &amp; Fri</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
