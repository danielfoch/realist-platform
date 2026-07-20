import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic2, Download, Headphones, TrendingUp, Users, Radio } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Headphones,
    stat: "6M+",
    label: "Impressions delivered",
  },
  {
    icon: Users,
    stat: "Top 1%",
    label: "Canadian business podcast",
  },
  {
    icon: TrendingUp,
    stat: "Investor-first",
    label: "Audience of active buyers",
  },
  {
    icon: Radio,
    stat: "Multi-channel",
    label: "Audio, video & newsletter",
  },
];

export default function PodcastDeck() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Realist Podcast Network Media Deck"
        description="Partner with Canada's leading real estate investor podcast. 6M+ impressions, investor-first audience, and integrated audio, video, and newsletter placements."
        keywords="real estate podcast advertising, canadian real estate podcast, realist podcast network, media kit, sponsor deck"
        canonicalUrl="/about/podcast-deck"
      />
      <Navigation />

      <main className="flex-1">
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <Badge variant="secondary" className="mb-4">
              <Mic2 className="h-3 w-3 mr-1" />
              Advertise with us
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Realist Podcast Network
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Canada's leading real estate investing podcast for active buyers, multiplex investors, and financing nerds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/assets/tci-media-deck-2026.pdf"
                download
              >
                <Button size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download Media Deck
                </Button>
              </a>
              <a
                href="/assets/tci-media-deck-2026.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg">
                  View Deck in Browser
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {HIGHLIGHTS.map((item) => (
                <Card key={item.label}>
                  <CardContent className="pt-6 text-center">
                    <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold">{item.stat}</div>
                    <div className="text-sm text-muted-foreground">{item.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-[16/9] md:aspect-[16/10] bg-muted flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Mic2 className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">2026 Media Deck</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Audience breakdown, placement options, downloads, and past advertisers.
                  </p>
                  <a
                    href="/assets/tci-media-deck-2026.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button>
                      Open Full Deck
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Interested in sponsoring? Reach out to discuss integrated placements.
              </p>
              <a href="mailto:partnerships@realist.ca">
                <Button variant="outline">Email partnerships@realist.ca</Button>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
