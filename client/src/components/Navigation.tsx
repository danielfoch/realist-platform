import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, X, User, LogOut, Briefcase, Building, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CoachingWaitlistDialog } from "@/components/CoachingWaitlistDialog";
import logoImage from "@assets/Screenshot_2026-01-04_at_3.46.09_PM_1767559573207.png";

export function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  const navLinks = [
    { href: "/", label: "Analyzer", external: false },
    { href: "/buybox", label: "BuyBox", external: false },
    { href: "/coinvesting", label: "Co-Invest", external: false },
    { href: "/events", label: "Events", external: false },
    { href: "/podcast", label: "Podcast", external: false },
    { href: "/blog", label: "Blog", external: false },
    { href: "https://shop.realist.ca/", label: "Shop", external: true },
    { href: "/about", label: "About", external: false },
  ];

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
            {navLinks.map((link) => 
              link.external ? (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`link-nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </a>
              ) : (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={location === link.href ? "secondary" : "ghost"}
                    size="sm"
                    data-testid={`link-nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <CoachingWaitlistDialog 
                trigger={
                  <Button size="sm" data-testid="button-join-waitlist">
                    <Users className="h-4 w-4 mr-2" />
                    Join Coaching Waitlist
                  </Button>
                }
              />
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
        <div className="md:hidden border-t border-border/50 glass">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => 
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block"
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={location === link.href ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              )
            )}
            <CoachingWaitlistDialog 
              trigger={
                <Button className="w-full" data-testid="button-mobile-join-waitlist">
                  <Users className="h-4 w-4 mr-2" />
                  Join Coaching Waitlist
                </Button>
              }
            />
            <div className="border-t border-border/50 pt-2 mt-2">
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
