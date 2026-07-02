import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { ExternalLink, Mic, TrendingUp, Home, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function NickHill() {
  const links = [
    { label: "The Canadian Real Estate Investor Podcast", href: "https://realist.ca/insights/podcast", icon: Mic, sub: "Co-host — weekly episodes on investing strategy" },
    { label: "Financing & DSCR Tools", href: "https://realist.ca/tools/mortgage", icon: DollarSign, sub: "Model mortgage stress tests and CMHC MLI Select" },
    { label: "Deal Analyzer", href: "https://realist.ca/tools/analyzer", icon: TrendingUp, sub: "Analyze a deal live on realist.ca" },
    { label: "Events", href: "https://realist.ca/community/events", icon: Home, sub: "Upcoming investor events with Nick" },
  ];

  return (
    <>
      <SEO
        title="Nick Hill — Realist.ca"
        description="Nick Hill is a real estate investor, operator, and mortgage expert. Co-host of The Canadian Real Estate Investor Podcast."
      />
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

          {/* Profile card */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-8">
            <div className="h-1.5 bg-primary w-full" />
            <div className="p-8 sm:p-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-primary">N</span>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1" style={{ fontFamily: "var(--font-mono)" }}>Realist.ca</div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-1">Nick Hill</h1>
                  <p className="text-sm text-muted-foreground">Real estate investor · Operator · Mortgage & brokerage expert</p>
                </div>
              </div>

              <p className="text-sm text-foreground leading-relaxed mb-3">
                Nick Hill is a Canadian real estate investor, operator, and mortgage expert. He co-hosts <span className="font-medium">The Canadian Real Estate Investor Podcast</span> and is a co-founder of Realist.ca — Canada's institutional-grade deal analysis platform for real estate investors.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Nick specializes in the financing side of the equation: DSCR underwriting, CMHC MLI Select, portfolio structuring, and building the brokerage relationships that turn good deals into great ones.
              </p>

              {/* Expertise tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {["DSCR underwriting", "CMHC MLI Select", "Portfolio structuring", "Mortgage brokerage", "Multiplex investing"].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground border border-border">{tag}</span>
                ))}
              </div>

              {/* Links */}
              <div className="space-y-3">
                {links.map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group no-underline">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <l.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{l.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{l.sub}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Platform CTA */}
          <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2" style={{ fontFamily: "var(--font-mono)" }}>All-in-one AI realtor for investors</div>
            <p className="text-sm text-muted-foreground mb-4">Browse listings, assess site feasibility, analyze deals, and underwrite financing — all in one place.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="https://realist.ca/tools/analyzer" className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors no-underline">
                Analyze a deal →
              </a>
              <Link href="/notebook" className="px-5 py-2.5 bg-card border border-border text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors no-underline">
                Open Field Notebook
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            <Link href="/" className="text-primary hover:underline">← Back to Realist.ca</Link>
          </p>
        </div>
      </div>
    </>
  );
}
