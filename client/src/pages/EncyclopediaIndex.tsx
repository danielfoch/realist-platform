import { useMemo, useState } from "react";
import { Link } from "wouter";
import { BookOpen, Calculator, Search } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  encyclopediaGuides,
  encyclopediaManifest,
  searchEncyclopediaGuides,
} from "@shared/encyclopedia";

export default function EncyclopediaIndex() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const results = useMemo(() => searchEncyclopediaGuides(query, category), [query, category]);
  const categories = ["all", ...encyclopediaManifest.categories];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Real Estate Investor Encyclopedia"
        description="Search plain-English Canadian real estate investing definitions, formulas, underwriting examples, and calculator specs."
        canonicalUrl="/insights/encyclopedia"
        keywords="Canadian real estate encyclopedia, real estate investing definitions, cap rate, DSCR, LTV, NOI"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Realist.ca Investor Encyclopedia",
          url: "https://realist.ca/insights/encyclopedia",
          numberOfItems: encyclopediaGuides.length,
        }}
      />
      <Navigation />

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <header className="mb-10">
          <Badge variant="secondary" className="mb-3">Investor Encyclopedia</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Real Estate Investor Encyclopedia</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Definitions, formulas, examples, caveats, and calculator specs for Canadian real estate underwriting.
          </p>
        </header>

        <section className="mb-8 space-y-4" aria-label="Search encyclopedia">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by term, formula, tag, category, keyword, or related term"
              className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="input-encyclopedia-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
                data-testid={`filter-encyclopedia-${item.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item === "all" ? "All" : item}
              </Button>
            ))}
          </div>
        </section>

        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {results.length} of {encyclopediaGuides.length} terms
          </p>
          <Link href="/insights/guides">
            <Button variant="ghost" size="sm">Existing Guides</Button>
          </Link>
        </div>

        {results.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No encyclopedia entries found.</p>
            <p className="text-sm text-muted-foreground">Try a broader term like financing, rent, tax, or cap rate.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {results.map((guide) => (
              <Link key={guide.slug} href={`/insights/encyclopedia/${guide.slug}`}>
                <Card className="h-full hover-elevate cursor-pointer transition-all">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{guide.category}</Badge>
                      {guide.toolSpecSlug && (
                        <Badge variant="outline" className="gap-1">
                          <Calculator className="h-3 w-3" />
                          Calculator spec
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{guide.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-4">{guide.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(guide.tags ?? []).slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag.replace(/-/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
