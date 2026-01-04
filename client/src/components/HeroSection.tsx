import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, MapPin, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onAnalyzeClick: () => void;
}

const mediaLogos = [
  { name: "Reuters", url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/" },
  { name: "The Wall Street Journal", url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da" },
  { name: "Investing.com", url: "https://ca.investing.com/members/contributors/245556786" },
  { name: "Bloomberg", url: null },
  { name: "The Globe and Mail", url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/" },
  { name: "CBC", url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728" },
  { name: "Financial Post", url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market" },
  { name: "Toronto Star", url: "https://www.thestar.com/real-estate/more-than-25-ontario-housing-developers-saw-projects-go-bust-this-year-a-higher-number/article_054d5bb4-60b5-11ef-abf2-6772c8215759.html" },
  { name: "BNN Bloomberg", url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/" },
  { name: "CTV", url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-" },
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
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-4">
              {mediaLogos.map((media) => {
                const content = (
                  <span 
                    className={`text-sm md:text-base font-semibold text-muted-foreground transition-colors ${media.url ? 'hover:text-foreground' : ''}`}
                    data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {media.name}
                  </span>
                );
                
                return media.url ? (
                  <a 
                    key={media.name}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover-elevate px-3 py-2 rounded-md"
                  >
                    {content}
                  </a>
                ) : (
                  <span key={media.name} className="px-3 py-2">
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
