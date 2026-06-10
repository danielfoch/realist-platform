import { Link, useParams } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProgrammaticStrategy } from "@shared/programmaticSeo";

export default function ProgrammaticStrategyPage() {
  const params = useParams<{ strategy: string }>();
  const strategy = getProgrammaticStrategy(params.strategy);

  if (!strategy) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-12">
          <h1 className="text-3xl font-bold mb-4">Strategy Page Not Found</h1>
          <p className="text-muted-foreground mb-6">This strategy page has not been generated yet.</p>
          <Link href="/reports"><Button>Browse Reports</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={strategy.title}
        description={strategy.description}
        canonicalUrl={`/investing/${strategy.slug}`}
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
                { "@type": "ListItem", position: 2, name: "Investing", item: "https://realist.ca/investing" },
                { "@type": "ListItem", position: 3, name: strategy.title, item: `https://realist.ca/investing/${strategy.slug}` },
              ],
            },
          ],
        }}
      />
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-12 space-y-10">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-3">Strategy Page</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{strategy.title}</h1>
          <p className="text-lg text-muted-foreground">{strategy.intro}</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {strategy.bullets.map((bullet) => (
            <Card key={bullet}>
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{bullet}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Relevant Markets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategy.relatedMarkets.map((market) => (
                <Link key={market} href={`/markets/${market}`} className="block text-sm text-primary hover:underline">
                  {market.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Related Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/reports" className="block text-sm text-primary hover:underline">Browse reports</Link>
              <Link href="/tools/analyzer" className="block text-sm text-primary hover:underline">Use the deal analyzer</Link>
              <Link href="/tools/multiplex-feasibility" className="block text-sm text-primary hover:underline">Open multiplex feasibility</Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
