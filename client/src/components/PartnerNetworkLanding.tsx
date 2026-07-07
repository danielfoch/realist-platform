import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, BarChart3, CheckCircle2, ArrowRight, Building2,
  MapPin, DollarSign, Mail, Kanban, PenTool, type LucideIcon,
} from "lucide-react";
import { formatReferralPayee, getReferralTerms, type NetworkPartnerType } from "@shared/partnerNetwork";

interface LandingCopy {
  badge: string;
  headline: string;
  headlineAccent: string;
  subhead: string;
  leadDescription: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
}

const COPY: Record<NetworkPartnerType, LandingCopy> = {
  realtor: {
    badge: "Realtor Partner Network",
    headline: "Join our realtor network.",
    headlineAccent: "Get more investor deals.",
    subhead:
      "Thousands of investors underwrite deals on Realist every week. When one analyzes a property in your market, we send the lead to you with the full analysis attached.",
    leadDescription: "Investor-ready buyer leads with complete underwriting: purchase price, rents, cash flow, and strategy.",
    seoTitle: "Join the Realist Realtor Network — Get More Investor Deals",
    seoDescription:
      "Free to join. Get investor buyer leads in your market with full underwriting attached, a free CRM, and email alerts. No monthly fees — 25% referral on closed deals only.",
    canonicalUrl: "/join/realtors",
  },
  mortgage_broker: {
    badge: "Mortgage Broker Network",
    headline: "Join our mortgage broker network.",
    headlineAccent: "Fund more investor deals.",
    subhead:
      "Investors on Realist model financing on real deals every day. When one needs a mortgage in your market, we send the lead to you — with the deal's full underwriting attached.",
    leadDescription: "Financing-ready leads: investors actively modelling down payments, rates, and DSCR on real properties.",
    seoTitle: "Join the Realist Mortgage Broker Network — Fund More Investor Deals",
    seoDescription:
      "Free to join. Get investor financing leads in your market with full deal underwriting, a free CRM, and email alerts. No monthly fees — 50% referral on funded deals only.",
    canonicalUrl: "/join/mortgage-brokers",
  },
};

export function PartnerNetworkLanding({ partnerType }: { partnerType: NetworkPartnerType }) {
  const [, navigate] = useLocation();
  const copy = COPY[partnerType];
  const terms = getReferralTerms(partnerType);
  const onboardingPath = `/partner/onboarding?type=${partnerType}`;
  const dealVerb = partnerType === "realtor" ? "closed" : "funded";

  const valueProps: { icon: LucideIcon; label: string; desc: string }[] = [
    { icon: Users, label: "High-Intent Local Leads", desc: copy.leadDescription },
    { icon: Kanban, label: "CRM Seat Included", desc: "Manage every referred lead in the Realist partner CRM, backed by GHL workflows today and designed for Homie-managed follow-up over time." },
    { icon: DollarSign, label: "No Monthly Fees", desc: `Pay nothing to join. A ${terms.feePercent}% referral fee applies only when a referred deal ${terms.successEvent}.` },
  ];

  const steps: { icon: LucideIcon; title: string; desc: string }[] = [
    {
      icon: MapPin,
      title: "Claim your market",
      desc: partnerType === "realtor"
        ? "Tell us the city you serve and your real estate board. You'll receive leads analyzing deals in that market."
        : "Tell us the market you serve. You'll receive financing leads from investors analyzing deals there.",
    },
    {
      icon: PenTool,
      title: "Sign the referral agreement online",
      desc: `One simple agreement: ${terms.feePercent}% of your compensation on ${dealVerb} referred deals, payable to ${formatReferralPayee(terms)}. No monthly fees, cancel anytime.`,
    },
    {
      icon: TrendingUp,
      title: "Get leads and close",
      desc: "New leads hit your inbox and your CRM. Claim a lead and we send a warm introduction email connecting you directly.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO title={copy.seoTitle} description={copy.seoDescription} canonicalUrl={copy.canonicalUrl} />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4" data-testid="badge-partner-hero">
              <Building2 className="h-3 w-3 mr-1" />
              {copy.badge}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-partner-headline">
              {copy.headline} <br className="hidden md:block" />
              <span className="text-primary">{copy.headlineAccent}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{copy.subhead}</p>
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
            <Button size="lg" onClick={() => navigate(onboardingPath)} data-testid="button-partner-cta-hero">
              Claim Your Market — Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              No monthly fees. {terms.feePercent}% referral only when a deal {terms.successEvent}.
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

        <Card className="mb-16">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Why these leads are different
            </h3>
            <ul className="space-y-3">
              {[
                "Every lead comes from an investor who just analyzed a real property on Realist. You see the address, strategy, and full underwriting before you reach out.",
                "Leads are routed by market, so you only get buyers in the city you serve.",
                `Your included CRM tracks every lead from introduction to ${dealVerb} deal, with one clear next step at every stage.`,
                "The operating layer is simple: GHL-backed CRM today, Homie workflows as the follow-up desk matures.",
                "Warm introductions: when you claim a lead, we email you both together so the conversation starts immediately.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="text-center pb-8">
          <h2 className="text-2xl font-bold mb-3">Ready to claim your market?</h2>
          <p className="text-muted-foreground mb-6 flex items-center justify-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            Setup takes about two minutes. Leads start flowing as soon as investors analyze deals in your market.
          </p>
          <Button size="lg" onClick={() => navigate(onboardingPath)} data-testid="button-partner-cta-footer">
            Join the Network
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
