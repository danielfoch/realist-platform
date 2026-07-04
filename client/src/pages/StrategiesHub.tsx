import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROGRAMMATIC_STRATEGIES } from "@shared/programmaticSeo";

export default function StrategiesHub() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Investing Strategies"
        description="How to invest in Canadian real estate: multiplex, BRRR, buy-and-hold, and distressed-deal strategies with the data and tools to underwrite each one."
        canonicalUrl="/investing"
      />
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Canadian Real Estate Investing Strategies</h1>
        <p className="text-lg text-muted-foreground max-w-3xl mb-10">
          Pick a strategy and get the playbook — what it is, where it works in Canada, and the tools to underwrite your first deal.
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PROGRAMMATIC_STRATEGIES.map((strategy) => (
            <Link key={strategy.slug} href={`/investing/${strategy.slug}`}>
              <Card className="h-full hover-elevate cursor-pointer">
                <CardHeader>
                  <CardTitle>{strategy.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
