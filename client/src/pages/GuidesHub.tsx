import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { BookOpen, Calculator, Handshake, Clock, ArrowRight, Layers, Landmark, Search } from "lucide-react";
import { encyclopediaGuides, encyclopediaManifest, searchEncyclopediaGuides } from "@shared/encyclopedia";
import type { Guide } from "@shared/schema";

const featuredGuides = [
  {
    slug: "capital-stack-canada",
    title: "The Capital Stack in Canadian Real Estate",
    excerpt:
      "Senior debt, mezzanine, preferred equity, LP equity, and GP promote — explained for Canadian investors with an interactive capital stack builder and worked $10M example.",
    category: "Advanced",
    difficulty: "advanced" as const,
    readTime: "18 min read",
    icon: Layers,
    accent: "from-blue-500/15 to-purple-500/15",
  },
  {
    slug: "a-vs-b-vs-c-lenders-canada",
    title: "A Lenders vs B Lenders vs C Lenders in Canada",
    excerpt:
      "Compare Canadian prime banks, alt-A trusts, and private MICs side-by-side with a live cost calculator and a 4-question tier-finder quiz.",
    category: "Intermediate",
    difficulty: "intermediate" as const,
    readTime: "15 min read",
    icon: Landmark,
    accent: "from-emerald-500/15 to-amber-500/15",
  },
];

const categories = [
  { value: "all", label: "All" },
  { value: "getting-started", label: "Getting Started" },
  { value: "strategy", label: "Strategy" },
  { value: "analysis", label: "Analysis" },
  { value: "advanced", label: "Advanced" },
];

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

const toolGuides = [
  {
    title: "How to Analyze a Deal",
    description: "Step-by-step walkthrough of using our Deal Analyzer to evaluate properties.",
    icon: Calculator,
    href: "/tools/analyzer",
  },
  {
    title: "Co-Investing Best Practices",
    description: "How to structure partnerships and pool capital effectively.",
    icon: Handshake,
    href: "/tools/coinvest/checklist",
  },
];

export default function GuidesHub() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [encyclopediaQuery, setEncyclopediaQuery] = useState("");
  const [encyclopediaCategory, setEncyclopediaCategory] = useState("all");

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides/published"],
  });

  const encyclopediaCategories = ["all", ...encyclopediaManifest.categories];
  const filteredGuides = selectedCategory === "all"
    ? guides
    : guides.filter((g) => g.category === selectedCategory);
  const encyclopediaResults = searchEncyclopediaGuides(encyclopediaQuery, encyclopediaCategory);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Guides & Encyclopedia"
        description="Educational guides plus a searchable real estate investor encyclopedia with definitions, formulas, examples, and underwriting specs."
        canonicalUrl="/insights/guides"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-guides-title">Guides & Encyclopedia</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Educational content, underwriting definitions, formulas, and calculator specs for Canadian real estate investors.
          </p>
        </div>

        <section className="mb-12" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-2xl font-bold mb-6" data-testid="text-featured-guides-title">
            Featured Guides
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {featuredGuides.map((g) => (
              <Link key={g.slug} href={`/insights/guides/${g.slug}`}>
                <Card
                  className={`h-full hover-elevate cursor-pointer transition-all bg-gradient-to-br ${g.accent}`}
                  data-testid={`card-featured-${g.slug}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="secondary" className={difficultyColors[g.difficulty] || ""}>
                        {g.category}
                      </Badge>
                      <Badge variant="outline">Interactive</Badge>
                      <Badge variant="outline">Canadian</Badge>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-background/70 flex items-center justify-center shrink-0">
                        <g.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl" data-testid={`text-featured-title-${g.slug}`}>
                          {g.title}
                        </CardTitle>
                        <CardDescription className="text-sm mt-2">{g.excerpt}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{g.readTime}</span>
                      </div>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        Read guide <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-2 mb-8 flex-wrap" data-testid="filter-categories">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
              data-testid={`filter-category-${cat.value}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-full">
                <CardHeader>
                  <Skeleton className="h-40 w-full rounded-md mb-4" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGuides.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredGuides.map((guide) => (
              <Link key={guide.id} href={`/insights/guides/${guide.slug}`}>
                <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-guide-${guide.id}`}>
                  {guide.coverImage && (
                    <div className="aspect-video overflow-hidden rounded-t-md">
                      <img
                        src={guide.coverImage}
                        alt={guide.title}
                        className="w-full h-full object-cover"
                        data-testid={`img-guide-cover-${guide.id}`}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={difficultyColors[guide.difficulty] || ""}
                        data-testid={`badge-difficulty-${guide.id}`}
                      >
                        {guide.difficulty.charAt(0).toUpperCase() + guide.difficulty.slice(1)}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-category-${guide.id}`}>
                        {guide.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg" data-testid={`text-guide-title-${guide.id}`}>{guide.title}</CardTitle>
                    <CardDescription className="text-sm" data-testid={`text-guide-excerpt-${guide.id}`}>{guide.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span data-testid={`text-guide-readtime-${guide.id}`}>
                          {guide.readTimeMinutes ? `${guide.readTimeMinutes} min read` : "Quick read"}
                        </span>
                      </div>
                      <span data-testid={`text-guide-author-${guide.id}`}>{guide.authorName}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-16">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-guides">
              {selectedCategory === "all"
                ? "No guides published yet. Check back soon!"
                : "No guides found in this category."}
            </p>
          </div>
        )}

        <div className="border-t border-border pt-12">
          <h2 className="text-2xl font-bold mb-6" data-testid="text-tool-guides-title">Tool Guides</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {toolGuides.map((guide, index) => (
              <Link key={index} href={guide.href}>
                <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-tool-guide-${index}`}>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <guide.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{guide.title}</CardTitle>
                    <CardDescription className="text-sm">{guide.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full gap-2">
                      Open Tool
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <section className="border-t border-border pt-12 mt-12" aria-labelledby="encyclopedia-heading">
          <div className="mb-8">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h2 id="encyclopedia-heading" className="text-2xl font-bold">Investor Encyclopedia</h2>
              <Badge variant="outline">{encyclopediaGuides.length} terms</Badge>
            </div>
            <p className="text-muted-foreground max-w-3xl">
              Search plain-English definitions, formulas, examples, caveats, and calculator specs without leaving the guides library.
            </p>
          </div>

          <div className="mb-8 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={encyclopediaQuery}
                onChange={(event) => setEncyclopediaQuery(event.target.value)}
                placeholder="Search by term, formula, tag, category, keyword, or related term"
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="input-encyclopedia-search"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {encyclopediaCategories.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={encyclopediaCategory === item ? "default" : "outline"}
                  onClick={() => setEncyclopediaCategory(item)}
                  data-testid={`filter-encyclopedia-${item.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item === "all" ? "All" : item}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {encyclopediaResults.length} of {encyclopediaGuides.length} terms
            </p>
          </div>

          {encyclopediaResults.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No encyclopedia entries found.</p>
              <p className="text-sm text-muted-foreground">Try a broader term like financing, rent, tax, or cap rate.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {encyclopediaResults.map((guide) => (
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
                      <CardDescription className="text-sm">{guide.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
        </section>
      </main>
    </div>
  );
}
