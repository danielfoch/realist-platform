import { Link, useParams } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProgrammaticMarket } from "@shared/programmaticSeo";

export default function ProgrammaticMarketPage() {
  const params = useParams<{ city: string }>();
  const market = getProgrammaticMarket(params.city);

  if (!market) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-12">
          <h1 className="text-3xl font-bold mb-4">Market Page Not Found</h1>
          <p className="text-muted-foreground mb-6">This market page has not been generated yet.</p>
          <Link href="/reports"><Button>Browse Reports</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={market.title}
        description={market.description}
        canonicalUrl={`/markets/${market.slug}`}
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
                { "@type": "ListItem", position: 2, name: "Markets", item: "https://realist.ca/markets" },
                { "@type": "ListItem", position: 3, name: market.city, item: `https://realist.ca/markets/${market.slug}` },
              ],
            },
          ],
        }}
      />
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-12 space-y-10">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-3">Market Page</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{market.title}</h1>
          <p className="text-lg text-muted-foreground">{market.intro}</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {market.highlights.map((highlight) => (
            <Card key={highlight}>
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{highlight}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Related Strategies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {market.relatedStrategies.map((strategy) => (
                <Link key={strategy} href={`/investing/${strategy}`} className="block text-sm text-primary hover:underline">
                  {strategy.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/reports" className="block text-sm text-primary hover:underline">Browse reports</Link>
              <Link href="/tools/analyzer" className="block text-sm text-primary hover:underline">Run the deal analyzer</Link>
              <Link href="/tools/cap-rates" className="block text-sm text-primary hover:underline">Explore cap rates</Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
