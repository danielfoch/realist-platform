import { Navigation } from "@/components/Navigation";
import { SEO, personSchema, organizationSchema } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Podcast, 
  Building2, 
  TrendingUp, 
  Users, 
  Mic2, 
  Youtube, 
  Instagram,
  Calendar,
  Download,
  MessageSquare,
  FileText,
  Handshake,
  CheckCircle2
} from "lucide-react";
import { SiX, SiTiktok } from "react-icons/si";
import { Link } from "wouter";
import nickImage from "@assets/ChatGPT_Image_Jan_6,_2026,_02_50_25_PM_1767729122931.png";
import jonathanImage from "@assets/ChatGPT_Image_Jan_6,_2026,_03_03_15_PM_1767729800256.png";
import danielImage from "@assets/ChatGPT_Image_Jan_6,_2026,_03_03_13_PM_1767729810400.png";

const proofChips = [
  { label: "Canada's #1 real estate podcast", icon: Podcast },
  { label: "11,000+ in-person community members", icon: Users },
  { label: "1,200+ on Skool", icon: MessageSquare },
  { label: "6,000,000+ advertiser impressions delivered", icon: TrendingUp },
];

const reachStats = [
  { platform: "Podcast", value: "120k", subtext: "/month", note: "Canada's #1 real estate podcast", icon: Mic2 },
  { platform: "YouTube", value: "22k", subtext: "", icon: Youtube },
  { platform: "Instagram", value: "50k", subtext: "", icon: Instagram },
  { platform: "X", value: "50k", subtext: "", icon: SiX },
  { platform: "TikTok", value: "40k", subtext: "", icon: SiTiktok },
];

const teamMembers = [
  {
    name: "Daniel Foch",
    role: "Chief Real Estate Officer",
    image: danielImage,
    initials: "DF",
    credentials: [
      "Real estate broker & analyst",
      "Chief Real Estate Officer at Valery.ca",
      "Host of Canada's #1 real estate podcast",
      "Expert in multiplex investing & underwriting",
    ],
    link: { label: "Valery.ca", url: "https://valery.ca" },
    calendarLink: "#dan-calendar",
  },
  {
    name: "Nick Hill",
    role: "Mortgage & Finance Expert",
    image: nickImage,
    initials: "NH",
    credentials: [
      "Co-host of Canada's #1 real estate podcast",
      "Mortgage & finance expert at BLD Financial",
      "Creative financing strategies specialist",
      "CMHC programs & investment structuring",
    ],
    link: { label: "BLD Financial", url: "https://bldfinancial.com" },
    calendarLink: "#nick-calendar",
  },
  {
    name: "Jonathan Woo",
    role: "CEO",
    image: jonathanImage,
    initials: "JW",
    credentials: [
      "Market Strategy & Planning at Instacart",
      "Strategic Ops at Super.com (Snapcommerce)",
      "Senior Business Analyst at Capital One",
      "CPA Canada (CFE), CFA Level 1, Ivey HBA",
    ],
    link: { label: "LinkedIn", url: "#jonathan-linkedin" },
    description: "Jonathan leads product, systems, automation, and execution across Realist — turning ideas into shipping software.",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Sophisticated Analysis",
    description: "Institutional-style models: cap rate, IRR, cash-on-cash, DSCR, sensitivity tables, and more.",
  },
  {
    icon: Building2,
    title: "Multi-Strategy Support",
    description: "Buy & hold, BRRR, flips, Airbnb, multiplex — with strategy-specific logic built in.",
  },
  {
    icon: Users,
    title: "Expert Insights + Community",
    description: "Built alongside Canada's largest investor community with real-world feedback.",
  },
];

const podcastAdvertisers = [
  { name: "BMO ETFs", logo: null },
  { name: "Troybilt", logo: null },
  { name: "Sherwin Williams", logo: null },
  { name: "Rentals.ca", logo: null },
  { name: "Liv.Rent", logo: null },
  { name: "Tencent", logo: null },
  { name: "Muskoka Roasteries", logo: null },
  { name: "Airbnb", logo: null },
  { name: "EQ Bank", logo: null },
  { name: "Blossom Social", logo: null },
];

const eventSponsors = [
  { name: "CMHC", logo: null },
  { name: "Foremost Financial", logo: null },
  { name: "Dorr Capital", logo: null },
  { name: "Peakhill Financial", logo: null },
  { name: "BLD Financial", logo: null },
  { name: "University of Toronto", logo: null },
  { name: "ReHousing", logo: null },
  { name: "Mddl", logo: null },
  { name: "Valery Real Estate", logo: null },
];

const socialCollabExamples = ["Alliance REIT", "Liv.Rent", "Chexy"];
const researchClients = ["Capital Developments", "Metropia", "Stafford Homes", "Fitzrovia"];

function LogoPlaceholder({ name }: { name: string }) {
  return (
    <div className="px-4 py-2 bg-muted/50 rounded-md border border-border/50 text-xs text-muted-foreground font-medium whitespace-nowrap">
      {name}
    </div>
  );
}

export default function About() {
  const aboutSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, personSchema]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="About Realist.ca - Daniel Foch & The Canadian Real Estate Investor Podcast Team"
        description="Meet the team behind Canada's #1 real estate investor community. Daniel Foch, Nick Hill, and Jonathan Woo lead Realist.ca - home of the Canadian Real Estate Investor Podcast with 120k monthly listeners. Building wealth through real estate education."
        keywords="daniel foch, canadian real estate investor podcast, nick hill, real estate investing canada, toronto real estate expert, canadian housing market analyst, real estate community canada, multiplex investing expert"
        canonicalUrl="/about"
        structuredData={aboutSchema}
      />
      <Navigation />

      <main>
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center" data-testid="text-about-title">
              About Realist.ca
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8 text-center">
              We're building Canada's biggest and most active real estate investor community — 
              connecting thousands of investors across the country through education, events, and 
              data-driven tools that help Canadians build real wealth.
            </p>
            
            {/* Proof Points as Bullets */}
            <ul className="space-y-3 max-w-xl mx-auto text-muted-foreground">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span>
                  <a href="https://thecanadianinvestorpodcast.com/podcast/the-canadian-real-estate-investor" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Canada's #1 real estate podcast</a>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span>
                  <Link href="/events" className="text-primary hover:underline">11,000+ in-person community members</Link>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span>
                  <a href="https://www.skool.com/realist" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">1,200+ on Skool</a>
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Reach & Audience Section */}
        <section className="py-16 md:py-20 border-t border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Reach & Audience</h2>
            <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
              We help Canadian investors make smarter decisions — and we help partners reach an engaged audience. 
              With over 6,000,000 advertiser impressions delivered, we connect brands with Canada's most active investor community.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {reachStats.map((stat) => (
                <div key={stat.platform} className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold font-mono">
                    {stat.value}
                    <span className="text-lg text-muted-foreground">{stat.subtext}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.platform}</div>
                  {stat.note && (
                    <div className="text-xs text-muted-foreground mt-1">{stat.note}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="py-16 md:py-20 border-t border-border/50">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              A Community of Canadian Real Estate Investors
            </h2>
            <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
              We've built an <strong>11,000+ member in-person networking community</strong> on Meetup.com 
              and a <strong>1,200+ person community</strong> on Skool where investors share deals, 
              strategies, and support each other's growth.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              New? Start with the Deal Analyzer, then come meet the community.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/events">
                <Button variant="outline" data-testid="button-community-events">
                  <Calendar className="h-4 w-4 mr-2" />
                  See Upcoming Events
                </Button>
              </Link>
              <a href="https://www.skool.com/realist" target="_blank" rel="noopener noreferrer">
                <Button data-testid="button-community-skool">
                  <Users className="h-4 w-4 mr-2" />
                  Join Skool
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Meet the Team Section */}
        <section className="py-16 md:py-20 border-t border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Meet the Team</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {teamMembers.map((member) => (
                <Card key={member.name} data-testid={`card-team-${member.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="pt-8 pb-6">
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="w-28 h-28 mb-4">
                        {member.image ? (
                          <AvatarImage src={member.image} alt={member.name} />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-primary to-chart-4 text-white text-2xl font-bold">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-xl font-bold">{member.name}</h3>
                      <p className="text-muted-foreground text-sm mb-4">{member.role}</p>
                      
                      <ul className="text-left text-sm space-y-2 mb-4 w-full">
                        {member.credentials.map((cred, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{cred}</span>
                          </li>
                        ))}
                      </ul>

                      {member.description && (
                        <p className="text-sm text-muted-foreground mb-4 italic">
                          {member.description}
                        </p>
                      )}

                      <a
                        href={member.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        data-testid={`link-${member.link.label.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        {member.link.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Why Realist Section */}
        <section className="py-16 md:py-20 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Why Realist?</h2>
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

        {/* Work With Us - Companies & Brands */}
        <section className="py-16 md:py-20 border-t border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">If You're a Company or Brand</h2>
              <p className="text-muted-foreground">
                Partner with Realist to reach a highly engaged Canadian investor audience.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Podcast Partner */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mic2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Podcast Partner</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        6,000,000+ impressions delivered for advertisers. Download our Podcast Network Deck.
                      </p>
                      <a href="/assets/realist-podcast-network-deck.pdf" download>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download Deck
                        </Button>
                      </a>
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Past advertisers:</p>
                        <div className="flex flex-wrap gap-2">
                          {podcastAdvertisers.slice(0, 5).map((adv) => (
                            <LogoPlaceholder key={adv.name} name={adv.name} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sponsor an Event */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Sponsor an Event</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sponsor an in-person event or meetup stop across Canada.
                      </p>
                      <Link href="/contact?topic=event-sponsorship">
                        <Button variant="outline" size="sm">
                          Sponsor an Event
                        </Button>
                      </Link>
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Past sponsors:</p>
                        <div className="flex flex-wrap gap-2">
                          {eventSponsors.slice(0, 5).map((sp) => (
                            <LogoPlaceholder key={sp.name} name={sp.name} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media Collaborations */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Social Media Collaborations</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Co-create short-form + long-form content with our team. Past collaborations include {socialCollabExamples.join(", ")}.
                      </p>
                      <Link href="/contact?topic=social-collab">
                        <Button variant="outline" size="sm">
                          Collaborate With Us
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Research & Consulting */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Research & Consulting</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        We do research, underwriting frameworks, and market intelligence. Clients include {researchClients.join(", ")}.
                      </p>
                      <Link href="/contact?topic=research">
                        <Button variant="outline" size="sm">
                          Learn More
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Work With Us - Deals */}
        <section className="py-16 md:py-20 border-t border-border/50">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">If You Want to Do a Deal With Us</h2>
              <p className="text-muted-foreground">
                Brokerage, mortgage strategy, and investment partnership opportunities.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <a href="#dan-calendar">
                <Button variant="outline" className="w-full" data-testid="button-talk-dan">
                  <Building2 className="h-4 w-4 mr-2" />
                  Talk to Dan (Broker)
                </Button>
              </a>
              <a href="#nick-calendar">
                <Button variant="outline" className="w-full" data-testid="button-talk-nick">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Talk to Nick (Mortgage)
                </Button>
              </a>
              <Link href="/contact?topic=partnerships">
                <Button variant="outline" className="w-full" data-testid="button-explore-partnerships">
                  <Handshake className="h-4 w-4 mr-2" />
                  Explore Partnerships
                </Button>
              </Link>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Realist provides educational tools and introductions. Not legal, tax, or financial advice.
            </p>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 md:py-24 border-t border-border/50 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Analyze Your Next Deal?</h2>
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <Link href="/">
                <Button size="lg" data-testid="button-final-analyze">
                  Start Analyzing
                </Button>
              </Link>
              <a href="https://www.skool.com/realist" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" data-testid="button-final-community">
                  Join the Community
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Prefer a 1:1? <a href="#book-consult" className="text-primary hover:underline">Book a free consult call</a>.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
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
              <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
