import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, MapPin, TrendingUp } from "lucide-react";
import reutersLogo from "@assets/image_1767559636706.png";
import wsjLogo from "@assets/image_1767558970172.png";
import bloombergLogo from "@assets/image_1767559733359.png";
import investingLogo from "@assets/image_1767559017226.png";
import cbcLogo from "@assets/image_1767559058457.png";
import hgtvLogo from "@assets/image_1767559257023.png";
import torontoStarLogo from "@assets/image_1767559616553.png";
import ctvLogo from "@assets/image_1767559371656.png";
import cp24Logo from "@assets/image_1767559398760.png";
import financialPostLogo from "@assets/image_1767559424338.png";
import bnnBloombergLogo from "@assets/image_1767559654950.png";
import globeMailLogo from "@assets/image_1767559703750.png";
import nationalPostLogo from "@assets/image_1767559826327.png";
import storeysLogo from "@assets/image_1767562262018.png";

interface HeroSectionProps {
  onAnalyzeClick: () => void;
}

type MediaLogo = {
  name: string;
  url: string | null;
  image?: string;
  Logo?: ({ className }: { className?: string }) => JSX.Element;
  height: string;
  noInvert?: boolean;
};

const mediaLogos: MediaLogo[] = [
  { name: "Reuters", image: reutersLogo, url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/", height: "h-5" },
  { name: "WSJ", image: wsjLogo, url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da", height: "h-8" },
  { name: "Investing.com", image: investingLogo, url: "https://ca.investing.com/members/contributors/245556786", height: "h-5" },
  { name: "Bloomberg", image: bloombergLogo, url: null, height: "h-5" },
  { name: "Globe and Mail", image: globeMailLogo, url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/", height: "h-6" },
  { name: "CBC", image: cbcLogo, url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728", height: "h-8" },
  { name: "Financial Post", image: financialPostLogo, url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market", height: "h-6", noInvert: true },
  { name: "Toronto Star", image: torontoStarLogo, url: "https://www.thestar.com/real-estate/more-than-25-ontario-housing-developers-saw-projects-go-bust-this-year-a-higher-number/article_054d5bb4-60b5-11ef-abf2-6772c8215759.html", height: "h-6" },
  { name: "BNN Bloomberg", image: bnnBloombergLogo, url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/", height: "h-6" },
  { name: "CTV", image: ctvLogo, url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-", height: "h-6", noInvert: true },
  { name: "HGTV", image: hgtvLogo, url: null, height: "h-6" },
  { name: "CP24", image: cp24Logo, url: null, height: "h-6" },
  { name: "National Post", image: nationalPostLogo, url: null, height: "h-6" },
  { name: "Storeys", image: storeysLogo, url: null, height: "h-6" },
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
            <a href="https://www.skool.com/realistgroup" target="_blank" rel="noopener noreferrer">
              <Button 
                variant="secondary" 
                size="lg" 
                className="gap-2 px-8 py-6 text-lg"
                data-testid="button-join-community"
              >
                <Users className="h-5 w-5" />
                Join the Community
              </Button>
            </a>
            <a href="https://calendly.com/danielfoch/consultation-realist-ca" target="_blank" rel="noopener noreferrer">
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2 px-8 py-6 text-lg"
                data-testid="button-hero-book-call"
              >
                <Play className="h-5 w-5" />
                Book a Free Consult Call
              </Button>
            </a>
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
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-7 gap-2 md:gap-4 pt-4 max-w-4xl mx-auto">
              {mediaLogos.map((media) => {
                const content = media.image ? (
                  <img 
                    src={media.image} 
                    alt={media.name}
                    className="h-4 md:h-5 w-auto max-w-full object-contain grayscale opacity-60 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                  />
                ) : media.Logo ? (
                  <media.Logo 
                    className="text-xs text-muted-foreground transition-colors group-hover:text-foreground"
                  />
                ) : null;
                
                return media.url ? (
                  <a 
                    key={media.name}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group hover-elevate px-2 py-2 rounded-md flex items-center justify-center"
                    data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                    title={media.name}
                  >
                    {content}
                  </a>
                ) : (
                  <span 
                    key={media.name} 
                    className="px-2 py-2 flex items-center justify-center"
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
