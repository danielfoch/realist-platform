import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { BookOpen, Calculator, Handshake, Clock, ArrowRight } from "lucide-react";
import type { Guide } from "@shared/schema";

const categories = [
  { value: "all", label: "All" },
  { value: "getting-started", label: "Getting Started" },
  { value: "strategy", label: "Strategy" },
  { value: "analysis", label: "Analysis" },
  { value: "advanced", label: "Advanced" },
];

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides/published"],
  });

  const filteredGuides = selectedCategory === "all"
    ? guides
    : guides.filter((g) => g.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Guides & Resources"
        description="Educational guides to help you become a better real estate investor. Learn strategies, analysis techniques, and best practices."
        canonicalUrl="/insights/guides"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-guides-title">Guides & Resources</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Educational content to help you become a better real estate investor.
          </p>
        </div>

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
      </main>
    </div>
  );
}
