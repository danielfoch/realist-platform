import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { useLocation } from "wouter";
import { Compass, HardHat, Scale, Landmark, Award, FileText, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react";

const ROLES = [
  { icon: Compass, label: "Architects" },
  { icon: Landmark, label: "Urban Planners" },
  { icon: TrendingUp, label: "Mortgage Pros" },
  { icon: Scale, label: "Lawyers" },
  { icon: HardHat, label: "Builders & Inspectors" },
];

export default function JoinExperts() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const primaryAction = () => {
    if (isAuthenticated) navigate("/partner");
    else window.location.href = authPath("/create-account");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Join the Realist Expert Network — Architects, Planners & RE Pros"
        description="Contribute professional field notes to real estate deals, build a public reputation, and get discovered by investors. Free to join for architects, planners, mortgage, legal and inspection pros."
        canonicalUrl="/join/experts"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
          <Badge variant="secondary" className="mb-4">Expert Network</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Show your expertise. <span className="text-primary">Get discovered.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Investors underwrite thousands of deals on Realist. Add your professional field notes — zoning, conversion
            feasibility, financing, legal, inspection — earn reputation as the community upvotes your insight, and rank
            on the expert leaderboard where investors find you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={primaryAction} data-testid="button-join-experts-cta">
              {isAuthenticated ? "Complete your expert profile" : "Create your free account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/experts")}>
              Browse the network
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {ROLES.map((r) => (
              <div key={r.label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <r.icon className="h-4 w-4 text-primary" />
                {r.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-4xl px-4 py-14 space-y-12">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: FileText, title: "Add field notes", desc: "Attach professional insight to any listing — the analysis that only your discipline can provide." },
            { icon: Award, title: "Earn reputation", desc: "The community upvotes useful notes. Points map to rank tiers from Contributor to Luminary." },
            { icon: TrendingUp, title: "Get found", desc: "Your public profile and leaderboard position put you in front of investors ready to transact." },
          ].map((item) => (
            <Card key={item.title}>
              <CardContent className="pt-6">
                <item.icon className="h-8 w-8 text-primary mb-3" />
                <p className="font-semibold mb-1">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-4">How it works</h2>
            <ol className="space-y-3">
              {[
                "Create a free Realist account (or sign in).",
                "Complete your expert profile in the partner portal — role, company, bio, service areas, headshot.",
                "Once approved, add field notes to deals and start earning reputation.",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{i + 1}</span>
                  <span className="text-muted-foreground pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <ul className="mt-5 space-y-2 border-t pt-5">
              <li className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Free to join — no fees.</li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />You control your public profile and what you contribute.</li>
            </ul>
            <Button className="mt-6" onClick={primaryAction} data-testid="button-join-experts-footer">
              {isAuthenticated ? "Complete your expert profile" : "Get started free"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
