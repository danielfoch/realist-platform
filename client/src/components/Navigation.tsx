import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logoImage from "@assets/Screenshot_2026-01-04_at_3.46.09_PM_1767559573207.png";

export function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Analyzer", external: false },
    { href: "/events", label: "Events", external: false },
    { href: "/blog", label: "Blog", external: false },
    { href: "https://my-store-108d526.creator-spring.com", label: "Shop", external: true },
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
              <a href="https://calendly.com/danielfoch/consultation-realist-ca" target="_blank" rel="noopener noreferrer">
                <Button size="sm" data-testid="button-book-call">
                  Book a Free Consult Call
                </Button>
              </a>
            </div>

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
            <a href="https://calendly.com/danielfoch/consultation-realist-ca" target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full" data-testid="button-mobile-book-call">
                Book a Free Consult Call
              </Button>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
