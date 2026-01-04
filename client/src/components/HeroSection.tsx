import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, MapPin, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onAnalyzeClick: () => void;
}

function ReutersLogo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8" cy="12" r="2"/>
        <circle cx="16" cy="12" r="2"/>
        <circle cx="12" cy="8" r="2"/>
        <circle cx="12" cy="16" r="2"/>
      </svg>
      <span className="font-bold tracking-wide">REUTERS</span>
    </div>
  );
}

function WSJLogo({ className }: { className?: string }) {
  return (
    <span className={`font-serif font-bold tracking-tight ${className}`} style={{ fontFamily: "'Times New Roman', serif" }}>
      THE WALL STREET JOURNAL.
    </span>
  );
}

function InvestingLogo({ className }: { className?: string }) {
  return <span className={`font-bold ${className}`}>Investing.com</span>;
}

function BloombergLogo({ className }: { className?: string }) {
  return <span className={`font-bold ${className}`}>Bloomberg</span>;
}

function GlobeMailLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold ${className}`} style={{ fontFamily: "'Times New Roman', serif" }}>
      THE GLOBE AND MAIL
    </span>
  );
}

function CBCLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"/>
      <circle cx="50" cy="50" r="15"/>
      <path d="M50 5 L50 35 M50 65 L50 95 M5 50 L35 50 M65 50 L95 50" stroke="currentColor" strokeWidth="8"/>
    </svg>
  );
}

function FinancialPostLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold uppercase tracking-wide ${className}`}>
      FINANCIAL POST
    </span>
  );
}

function TorontoStarLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold uppercase tracking-widest ${className}`}>
      TORONTO STAR
    </span>
  );
}

function BNNBloombergLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold ${className}`}>
      BNN Bloomberg
    </span>
  );
}

function CTVLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold tracking-wide ${className}`}>
      CTV
    </span>
  );
}

const mediaLogos = [
  { name: "Reuters", Logo: ReutersLogo, url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/", iconSize: "text-xs" },
  { name: "WSJ", Logo: WSJLogo, url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da", iconSize: "text-xs" },
  { name: "Investing.com", Logo: InvestingLogo, url: "https://ca.investing.com/members/contributors/245556786", iconSize: "text-sm" },
  { name: "Bloomberg", Logo: BloombergLogo, url: null, iconSize: "text-sm" },
  { name: "Globe and Mail", Logo: GlobeMailLogo, url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/", iconSize: "text-xs" },
  { name: "CBC", Logo: CBCLogo, url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728", iconSize: "h-8 w-8" },
  { name: "Financial Post", Logo: FinancialPostLogo, url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market", iconSize: "text-xs" },
  { name: "Toronto Star", Logo: TorontoStarLogo, url: "https://www.thestar.com/real-estate/more-than-25-ontario-housing-developers-saw-projects-go-bust-this-year-a-higher-number/article_054d5bb4-60b5-11ef-abf2-6772c8215759.html", iconSize: "text-xs" },
  { name: "BNN Bloomberg", Logo: BNNBloombergLogo, url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/", iconSize: "text-sm" },
  { name: "CTV", Logo: CTVLogo, url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-", iconSize: "text-lg" },
];

export function HeroSection({ onAnalyzeClick }: HeroSectionProps) {
  const stats = [
    { icon: Users, value: "11,000+", label: "members" },
    { icon: MapPin, value: "26", label: "cities" },
    { icon: TrendingUp, value: "$2.6B", label: "in deals analyzed" },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
              data-testid="text-hero-headline"
            >
              Canada's Most Researched{" "}
              <span className="text-gradient">Real Estate Program</span>
            </h1>
            <p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
              data-testid="text-hero-subhead"
            >
              A data-driven curriculum brought to you by Canada's #1 real estate podcast
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
            <Button 
              size="lg" 
              className="gap-2 px-8 py-6 text-lg"
              onClick={onAnalyzeClick}
              data-testid="button-analyze-deal"
            >
              Analyze a Deal
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              className="gap-2 px-8 py-6 text-lg"
              data-testid="button-join-community"
            >
              <Users className="h-5 w-5" />
              Join the Community
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="gap-2 px-8 py-6 text-lg"
              data-testid="button-hero-book-call"
            >
              <Play className="h-5 w-5" />
              Book a Free Consult Call
            </Button>
          </div>

          <div className="pt-8 border-t border-border/50">
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3"
                  data-testid={`stat-${stat.label.replace(/\s+/g, "-")}`}
                >
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-bold text-lg md:text-xl font-mono">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 space-y-4">
            <p className="text-sm text-muted-foreground">Realist in the media</p>
            <h3 className="text-2xl font-bold text-gradient" data-testid="text-as-seen-on">As seen on:</h3>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 pt-4">
              {mediaLogos.map((media) => {
                const content = (
                  <media.Logo 
                    className={`${media.iconSize} text-muted-foreground transition-colors ${media.url ? 'group-hover:text-foreground' : ''}`}
                  />
                );
                
                return media.url ? (
                  <a 
                    key={media.name}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group hover-elevate px-3 py-2 rounded-md flex items-center"
                    data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                    title={media.name}
                  >
                    {content}
                  </a>
                ) : (
                  <span 
                    key={media.name} 
                    className="px-3 py-2 flex items-center"
                    data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                    title={media.name}
                  >
                    {content}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
