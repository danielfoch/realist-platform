import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, CheckCircle2, ArrowRight, MapPin, DollarSign,
  Mic, Kanban, PenTool, Megaphone, CalendarDays, Handshake, type LucideIcon,
} from "lucide-react";
import { getReferralTerms } from "@shared/partnerNetwork";

const ONBOARDING_PATH = "/partner/onboarding?type=realtor";

/**
 * Invitation-framed landing page for meetup hosts and market experts joining
 * the referral network. General realtor recruiting lives at /join/realtors;
 * this page is the destination for podcast/meetup-host outreach.
 */
export default function LocalExperts() {
  const [, navigate] = useLocation();
  const terms = getReferralTerms("realtor");

  const valueProps: { icon: LucideIcon; label: string; desc: string }[] = [
    {
      icon: Users,
      label: "Investor Referrals In Your Market",
      desc: "Investors from the podcast, YouTube, and newsletter underwrite deals on Realist. When one is ready to transact in your market, the lead routes to you — full analysis attached.",
    },
    {
      icon: Mic,
      label: "The Local Meetup Stage",
      desc: "Host the Canadian Real Estate Investor meetup in your city, promoted through the podcast network. You are the face of the brand in your market.",
    },
    {
      icon: Kanban,
      label: "CRM Included — Homie Coming",
      desc: "Manage every referred lead in your free Realist CRM workspace today. Homie, our dedicated partner CRM, is on the way — your pipeline moves with you.",
    },
  ];

  const steps: { icon: LucideIcon; title: string; desc: string }[] = [
    {
      icon: MapPin,
      title: "Claim your market",
      desc: "One local expert per market. Tell us the city you serve and your real estate board, and investor leads in that market route to you.",
    },
    {
      icon: PenTool,
      title: "Sign the referral agreement online",
      desc: `Standard OREA Form 641-style terms: ${terms.feePercent}% of gross commission on closed referred deals, payable to ${terms.payeeCompany}. No monthly fees, cancel anytime.`,
    },
    {
      icon: TrendingUp,
      title: "Work the leads, host the meetup",
      desc: "Leads hit your inbox and CRM with a warm introduction. Keep deal statuses current — timely reporting is what keeps your market's lead flow on.",
    },
  ];

  const expectations = [
    "Respond to referred investors quickly — speed-to-lead is the whole game, and routing favours partners who answer.",
    "Keep lead and deal statuses current in your CRM. Reporting outcomes (including closings) is a condition of continued lead flow.",
    "Host or co-host the local Canadian Real Estate Investor meetup, with promotion from the podcast network.",
    "Act within the rules of your licensing body and board — you are the licensed professional of record on every deal.",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Realist Local Experts — Claim Your Market"
        description="By invitation from the Canadian Real Estate Investor Podcast: claim your market, host the local meetup, and receive investor referrals with full underwriting attached. Free to join — 25% referral on closed deals only."
        canonicalUrl="/local-experts"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4" data-testid="badge-local-expert-hero">
              <Mic className="h-3 w-3 mr-1" />
              Canadian Real Estate Investor Podcast — Local Expert Network
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-local-expert-headline">
              Be the investor expert <br className="hidden md:block" />
              <span className="text-primary">for your market.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Realist Local Experts are the meetup hosts and investor-focused realtors the
              Canadian Real Estate Investor Podcast trusts with its audience. One expert per
              market. Investor referrals, the local meetup stage, and the podcast network
              behind you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {valueProps.map((item) => (
              <Card key={item.label} className="text-center">
                <CardContent className="pt-6 pb-4">
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" onClick={() => navigate(ONBOARDING_PATH)} data-testid="button-local-expert-cta-hero">
              Claim Your Market — Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              No monthly fees. {terms.feePercent}% referral only when a referred deal {terms.successEvent}.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-10" data-testid="text-how-it-works">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {steps.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {i + 1}
                  </div>
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold mb-1">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Why these referrals are different
            </h3>
            <ul className="space-y-3">
              {[
                "Every referral comes from an investor who just underwrote a real property on Realist — you see the address, strategy, rents, and cash flow before you reach out.",
                "The audience already trusts the source: they found Realist through the podcast, YouTube, or the newsletter, and you are introduced as its local expert.",
                "Markets within about two hours of Toronto are worked by our own brokerage desk — everywhere else belongs to one claimed local expert. Your market is yours.",
                "Warm introductions only: when a lead routes to you, we email you both together so the conversation starts immediately.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-16">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              What we ask of a Local Expert
            </h3>
            <ul className="space-y-3">
              {expectations.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="text-center pb-8">
          <h2 className="text-2xl font-bold mb-3">Your market is open — for now.</h2>
          <p className="text-muted-foreground mb-6 flex items-center justify-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            One expert per market, first signed agreement holds it. Setup takes about two minutes.
          </p>
          <Button size="lg" onClick={() => navigate(ONBOARDING_PATH)} data-testid="button-local-expert-cta-footer">
            Claim Your Market
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
            <DollarSign className="h-3 w-3" />
            Free to join. {terms.feePercent}% referral on closed deals, payable to {terms.payeeCompany}.
          </p>
        </div>
      </div>
    </div>
  );
}
