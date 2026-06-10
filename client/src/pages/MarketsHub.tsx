import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROGRAMMATIC_MARKETS } from "@shared/programmaticSeo";

export default function MarketsHub() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Markets"
        description="Programmatic market landing pages for Canadian real estate investors covering major cities and related investing workflows."
        canonicalUrl="/markets"
      />
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Canadian Real Estate Markets</h1>
        <p className="text-lg text-muted-foreground max-w-3xl mb-10">
          Crawlable market pages designed to connect research, strategy, and underwriting around the cities Realist prioritizes first.
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PROGRAMMATIC_MARKETS.map((market) => (
            <Link key={market.slug} href={`/markets/${market.slug}`}>
              <Card className="h-full hover-elevate cursor-pointer">
                <CardHeader>
                  <CardTitle>{market.city}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{market.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
