import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  BadgeCheck, ShieldCheck, MapPin, Megaphone, FileText, ClipboardCheck,
  ArrowRight, CheckCircle2, Mic, type LucideIcon,
} from "lucide-react";

interface AboutSection {
  icon: LucideIcon;
  heading: string;
  body: string;
  bullets: string[];
}

const SECTIONS: AboutSection[] = [
  {
    icon: BadgeCheck,
    heading: "What a Local Expert actually is",
    body:
      "A Local Expert isn't a call-centre lead-catcher or a stranger who bought your contact info. It's one real estate professional who has claimed responsibility for a single market — the person Realist trusts to handle an investor who's already done their homework. Some are investor-focused realtors; some are mortgage pros. What they share is a specialty: they underwrite cash flow, know the local rent comps, and have closed investor deals in their own backyard. And they run in the same orbit as the podcast — many host or co-host their city's Canadian Real Estate Investor meetup, accountable to a network that talks to 120,000+ investors every month.",
    bullets: [
      "One vetted professional per market — not a rotating pool or a lead auction",
      "Chosen for how they work with investors, not how many signs they have on lawns",
      "Part of the same community you already listen to and learn from",
      "Handles your deal directly — no bidding, no hand-offs, no mystery",
    ],
  },
  {
    icon: ShieldCheck,
    heading: "Chosen by the podcast, vetted by the community",
    body:
      "This network didn't come from a job board. Realist is built by the team behind The Canadian Real Estate Investor Podcast, Canada's #1 real estate podcast — roughly 120,000 downloads a month, 50,000 on Instagram, 22,000 on YouTube, 1,200+ inside the Skool community, and more than 11,000 investors who've shown up in person. Local Experts are drawn from that community: the meetup hosts, the repeat guests, the pros our members have already vouched for on the ground. Before an expert goes live, they tell us the exact city and real estate board they serve, prove their licence and brokerage, and sign a standard referral agreement that spells out how they're expected to behave. When Daniel Foch and the team put someone's name on a market, it's because they'd send their own audience to that person. That's the bar.",
    bullets: [
      "Warm-sourced by invitation from people the community already recommends",
      "Verified licence, brokerage, and board before they receive a single lead",
      "Bound by their provincial licence and real estate board, not just a handshake",
    ],
  },
  {
    icon: MapPin,
    heading: "One expert per market — so you get an owner, not a queue",
    body:
      "Every market has exactly one Local Expert. That exclusivity isn't scarcity marketing; it's accountability. When one person owns a market, there's no diffusion of responsibility — you always know who's handling you, and that expert knows their name is the only one on the door. It also means they're incentivised to genuinely know the place: the sub-markets, the rent reality, the zoning quirks, the deals that pencil and the ones that don't. Markets within about a two-hour drive of Toronto are worked directly by Valery Real Estate Inc., the team's own brokerage. Everywhere else, your claimed-market expert takes it — someone who's in that community, not commuting to it.",
    bullets: [
      "One name, one point of contact, full ownership of your experience",
      "No bidding wars over leads, no getting passed around",
      "In-house Toronto-area coverage; a dedicated local expert everywhere else",
    ],
  },
  {
    icon: Megaphone,
    heading: "They meet you where the community already is",
    body:
      "Local Experts don't just take referrals — many host or co-host the Canadian Real Estate Investor meetup in their city, promoted across the podcast network. So the person guiding your deal is often the same person standing at the front of the room every month, connecting investors, contractors, lenders, and property managers face to face. When you work with a Local Expert, you're plugging into a live local scene, not just booking a call with a stranger.",
    bullets: [
      "Many host or co-host their city's investor meetup",
      "Meetups are promoted through the podcast, YouTube, and newsletter",
      "Your deal contact is a real, visible fixture of the local community",
    ],
  },
  {
    icon: FileText,
    heading: "Your underwriting travels with you",
    body:
      "The best part of being routed through Realist: you never start from scratch. When you analyze a property on Realist — address, strategy, rents, projected cash flow — that full underwriting goes to your Local Expert the moment you decide to connect. They see the deal you actually ran, not a vague “buyer looking in the area.” The conversation starts at the numbers, so you skip the qualifying small talk and get straight to whether the deal holds. And none of this costs you anything as an investor: the expert program is free for professionals to join, and Realist is paid a referral fee by the expert only if a deal actually closes — never by you.",
    bullets: [
      "The expert sees your address, strategy, rents, and cash flow before the first call",
      "You're never cold-transferred — both sides walk in prepared",
      "Free to you, always — you're never charged for the introduction or the advice",
    ],
  },
  {
    icon: ClipboardCheck,
    heading: "Held accountable, not just introduced",
    body:
      "An introduction is worthless if it goes cold. Local Experts are required to keep every referred investor's status current in the Realist CRM (a dedicated partner CRM, Homie, is on the way). It's light-touch by design — a few updates, not a data-entry job — but it's a real condition: if an expert lets a referred investor's status sit stale for more than two weeks after we ask, Realist can pause routing new investors to them until they catch up. In plain terms, the people we send you to are on the hook for actually following through.",
    bullets: [
      "Experts must keep your status live in the system — silence has consequences",
      "Routing pauses for experts who let referred investors go stale",
      "A structure built so you're followed up with, not forgotten",
    ],
  },
];

export default function LocalExpertsAbout() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Meet the Realist Local Experts — One Vetted Investor Agent Per Market"
        description="When you underwrite a deal on Realist, you're introduced to a Local Expert: one vetted, investor-focused agent or mortgage pro per market, hand-picked and stood behind by the team at The Canadian Real Estate Investor Podcast."
        canonicalUrl="/local-experts/about"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16 max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4" data-testid="badge-about-hero">
            <Mic className="h-3 w-3 mr-1" />
            Realist Local Expert Network
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-about-headline">
            When you're ready to buy, you get one expert <br className="hidden md:block" />
            <span className="text-primary">who already knows your market.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A Realist Local Expert is a vetted, investor-focused agent or mortgage pro — one per
            market — hand-picked and stood behind by the team at The Canadian Real Estate Investor
            Podcast. Underwrite your deal on Realist, and when you decide to move, your numbers go
            straight to the person who lives and works that market, and who often hosts its investor
            meetup.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-6">
        {SECTIONS.map((section) => (
          <Card key={section.heading} data-testid={`card-about-${section.heading.slice(0, 12).toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="pt-6">
              <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
                <section.icon className="h-5 w-5 text-primary shrink-0" />
                {section.heading}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{section.body}</p>
              <ul className="space-y-2">
                {section.bullets.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold">Run your next deal on Realist — the right expert is already waiting.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Underwrite a property on Realist, and when you're ready to move, we'll hand your
              numbers to the one vetted expert who knows your market — with your deal already in
              hand. No cost to you, no cold leads, no guessing who's on the other end.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
              <Button size="lg" onClick={() => navigate("/tools/analyzer")} data-testid="button-about-analyze">
                Analyze a deal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/local-experts")} data-testid="button-about-claim">
                Are you your city's expert? Claim your market
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
