import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, Podcast, Building2, TrendingUp } from "lucide-react";
import { Link } from "wouter";

const teamMembers = [
  {
    name: "Daniel Foch",
    role: "Chief Real Estate Officer",
    company: "Valery",
    companyUrl: "https://valery.ca",
    bio: "Daniel Foch is a real estate broker, analyst, and the Chief Real Estate Officer at Valery.ca. He is the host of Canada's #1 real estate podcast, helping investors across the country build wealth through strategic property investments. With deep expertise in market analysis and deal underwriting, Daniel has helped thousands of investors make informed decisions.",
    initials: "DF",
    gradient: "from-primary to-chart-4",
  },
  {
    name: "Nick Hill",
    role: "Mortgage & Finance Expert",
    company: "BLD Financial",
    companyUrl: "https://bldfinancial.com",
    bio: "Nick Hill is the co-host of Canada's #1 real estate podcast and a mortgage and finance expert at BLD Financial. His expertise in creative financing strategies, CMHC programs, and investment structuring helps investors maximize their returns and scale their portfolios efficiently.",
    initials: "NH",
    gradient: "from-accent to-chart-2",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Sophisticated Analysis",
    description: "Our deal analyzer uses institutional-grade financial models to calculate cap rates, IRR, cash-on-cash returns, and more.",
  },
  {
    icon: Building2,
    title: "Multi-Strategy Support",
    description: "Analyze deals for buy-and-hold, BRRR, flips, Airbnb, and multiplex investments with strategy-specific calculations.",
  },
  {
    icon: Podcast,
    title: "Expert Insights",
    description: "Backed by Canada's largest real estate investor community with 11,000+ members learning and growing together.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main>
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6" data-testid="text-about-title">
              About Realist.ca
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              We're building the most powerful real estate deal analyzer in the world. 
              Our mission is to help Canadian investors make smarter, data-driven decisions 
              and build real wealth through multiplex real estate.
            </p>
          </div>
        </section>

        <section className="py-16 md:py-24 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Meet the Team</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {teamMembers.map((member) => (
                <Card key={member.name} className="overflow-hidden" data-testid={`card-team-${member.name.toLowerCase().replace(" ", "-")}`}>
                  <CardContent className="pt-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <Avatar className="w-32 h-32">
                        <AvatarFallback className={`bg-gradient-to-br ${member.gradient} text-white text-3xl font-bold`}>
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-2xl font-bold">{member.name}</h3>
                        <p className="text-muted-foreground">{member.role}</p>
                      </div>
                      <a
                        href={member.companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        data-testid={`link-company-${member.company.toLowerCase().replace(" ", "-")}`}
                      >
                        {member.company}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <p className="text-muted-foreground leading-relaxed">
                        {member.bio}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-t border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Why Realist?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-t border-border/50">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Analyze Your Next Deal?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of Canadian investors using our tools to make smarter investment decisions.
            </p>
            <Link href="/">
              <Button size="lg" className="px-8" data-testid="button-about-cta">
                Start Analyzing
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span>Realist.ca</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/about" className="hover:text-foreground transition-colors">About</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
