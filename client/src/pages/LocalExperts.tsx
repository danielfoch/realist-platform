import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { marketExperts, type MarketExpert } from "@/lib/marketExperts";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Handshake, Inbox, MapPin, Users } from "lucide-react";
import { Link } from "wouter";

const operatingLoop = [
  {
    icon: BarChart3,
    title: "Investor demand",
    body: "Investors underwrite real properties on Realist. When a deal is in your market, the lead arrives with the address, strategy, rent assumptions, and full underwriting context.",
  },
  {
    icon: Inbox,
    title: "CRM follow-up",
    body: "Claimed leads land in the Realist partner CRM, backed by GHL workflows today and designed to move into Homie-managed follow-up as the agent desk matures.",
  },
  {
    icon: CalendarDays,
    title: "Local presence",
    body: "Market experts can host local meetups, appear on market pages, and become the first named person investors see when they need local help.",
  },
];

const requirements = [
  "Licensed realtor, broker, or trusted market operator in the claimed city.",
  "Willing to sign the referral agreement before claiming investor leads.",
  "Fast follow-up and clean status reporting through the partner CRM.",
  "Comfortable being framed publicly as a local expert or meetup host for investors.",
];

function ExpertCard({ expert }: { expert: MarketExpert }) {
  return (
    <Card data-testid={`card-local-expert-${expert.provinceCode}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {expert.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold">{expert.name}</h3>
            <p className="text-sm text-muted-foreground">{expert.title}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {expert.city}, {expert.province}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{expert.bio}</p>
      </CardContent>
    </Card>
  );
}

export default function LocalExperts() {
  const experts = Object.values(marketExperts);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Local Real Estate Investor Experts and Meetup Hosts | Realist.ca"
        description="Claim your Canadian real estate investor market on Realist.ca. Local experts and meetup hosts get investor referrals with underwriting context, CRM follow-up, and event visibility."
        canonicalUrl="/about/local-experts"
        keywords="real estate investor referrals, local real estate expert, canadian real estate meetup host, realtor investor leads, Realist local experts"
      />
      <Navigation />

      <main>
        <section className="border-b bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-14 md:py-18">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Handshake className="h-3 w-3" />
              Local Expert Network
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold max-w-3xl" data-testid="text-local-experts-title">
              Claim your market for investor referrals.
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mt-5 leading-relaxed">
              Realist is building the local layer for The Canadian Real Estate Investor Podcast:
              market experts and meetup hosts who can work investor leads, host local rooms, and keep deal outcomes clean in the CRM.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/partner/onboarding?type=realtor">
                <Button size="lg" data-testid="button-claim-local-market">
                  Claim your market
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/join/realtors">
                <Button size="lg" variant="outline" data-testid="button-read-referral-network">
                  How referrals work
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 md:px-6 py-12">
          <div className="grid md:grid-cols-3 gap-5">
            {operatingLoop.map((item) => (
              <div key={item.title} className="space-y-3" data-testid={`section-loop-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <item.icon className="h-6 w-6 text-primary" />
                <h2 className="font-semibold text-lg">{item.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-12">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
              <div>
                <h2 className="text-2xl font-bold mb-3">What local experts get</h2>
                <p className="text-muted-foreground leading-relaxed">
                  This is not a paid directory. It is a deal-through referral network: free to join,
                  paid only when referred investor deals close, with status reporting required to keep receiving leads.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "Investor leads with underwriting attached",
                  "Market visibility from podcast and event demand",
                  "Included partner CRM for lead management",
                  "Future Homie workflows for follow-up and status capture",
                ].map((item) => (
                  <div key={item} className="flex gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 md:px-6 py-12">
          <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold">Current market experts</h2>
              <p className="text-muted-foreground mt-1">
                These are the visible starting points. City-level hosts will be added as claims are accepted.
              </p>
            </div>
            <Link href="/community/events">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                View events
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {experts.map((expert) => (
              <ExpertCard key={expert.provinceCode} expert={expert} />
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
          <div className="rounded-lg border p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-4">Who should claim a market?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {requirements.map((item) => (
                <div key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link href="/partner/onboarding?type=realtor">
                <Button data-testid="button-local-expert-footer-cta">
                  Start the claim
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
