import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, Clock, BookOpen, ChevronRight } from "lucide-react";
import type { Guide } from "@shared/schema";

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractTableOfContents(html: string): TocItem[] {
  const items: TocItem[] = [];
  const regex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const existingId = match[2];
    const text = match[3].replace(/<[^>]+>/g, "").trim();
    const id = existingId || text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    items.push({ id, text, level });
  }
  return items;
}

function addIdsToHeadings(html: string): string {
  return html.replace(/<h([23])([^>]*)>(.*?)<\/h([23])>/gi, (fullMatch, level, attrs, content, closeLevel) => {
    const text = content.replace(/<[^>]+>/g, "").trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (attrs.includes('id="')) return fullMatch;
    return `<h${level} id="${id}"${attrs}>${content}</h${closeLevel}>`;
  });
}

export default function GuidePage() {
  const params = useParams<{ slug: string }>();

  const { data: guide, isLoading, error } = useQuery<Guide>({
    queryKey: ["/api/guides/by-slug", params.slug],
    queryFn: async () => {
      const res = await fetch(`/api/guides/by-slug/${params.slug}`);
      if (!res.ok) throw new Error("Guide not found");
      return res.json();
    },
    enabled: !!params.slug,
  });

  const { data: allGuides = [] } = useQuery<Guide[]>({
    queryKey: ["/api/guides/published"],
  });

  const { prevGuide, nextGuide } = useMemo(() => {
    if (!guide || allGuides.length === 0) return { prevGuide: null, nextGuide: null };
    const idx = allGuides.findIndex((g) => g.id === guide.id);
    return {
      prevGuide: idx > 0 ? allGuides[idx - 1] : null,
      nextGuide: idx < allGuides.length - 1 ? allGuides[idx + 1] : null,
    };
  }, [guide, allGuides]);

  const toc = useMemo(() => {
    if (!guide?.content) return [];
    return extractTableOfContents(guide.content);
  }, [guide?.content]);

  const processedContent = useMemo(() => {
    if (!guide?.content) return "";
    return addIdsToHeadings(guide.content);
  }, [guide?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full rounded-md mb-6" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-4xl text-center">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2" data-testid="text-guide-not-found">Guide Not Found</h1>
          <p className="text-muted-foreground mb-6">The guide you're looking for doesn't exist or has been removed.</p>
          <Link href="/insights/guides">
            <Button data-testid="link-back-to-guides">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Guides
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={guide.metaTitle || guide.title}
        description={guide.metaDescription || guide.excerpt}
        canonicalUrl={`/insights/guides/${guide.slug}`}
        ogImage={guide.coverImage || undefined}
        ogType="article"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/insights/guides">
          <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="link-back-to-guides">
            <ArrowLeft className="h-4 w-4" />
            Back to Guides
          </Button>
        </Link>

        {guide.coverImage && (
          <div className="aspect-video overflow-hidden rounded-md mb-8">
            <img
              src={guide.coverImage}
              alt={guide.title}
              className="w-full h-full object-cover"
              data-testid="img-guide-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge
            variant="secondary"
            className={difficultyColors[guide.difficulty] || ""}
            data-testid="badge-guide-difficulty"
          >
            {guide.difficulty.charAt(0).toUpperCase() + guide.difficulty.slice(1)}
          </Badge>
          <Badge variant="outline" data-testid="badge-guide-category">
            {guide.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
          {guide.readTimeMinutes && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span data-testid="text-guide-readtime">{guide.readTimeMinutes} min read</span>
            </div>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-guide-title">{guide.title}</h1>
        <p className="text-lg text-muted-foreground mb-8" data-testid="text-guide-author">
          By {guide.authorName}
          {guide.publishedAt && (
            <span className="ml-2">
              &middot; {new Date(guide.publishedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
        </p>

        {toc.length > 0 && (
          <Card className="mb-8" data-testid="card-table-of-contents">
            <CardHeader>
              <CardTitle className="text-lg">Table of Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <nav>
                <ul className="space-y-1">
                  {toc.map((item, idx) => (
                    <li key={idx} style={{ paddingLeft: item.level === 3 ? "1rem" : "0" }}>
                      <a
                        href={`#${item.id}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                        data-testid={`link-toc-${idx}`}
                      >
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </CardContent>
          </Card>
        )}

        <article
          className="prose prose-neutral dark:prose-invert max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: processedContent }}
          data-testid="article-guide-content"
        />

        {(prevGuide || nextGuide) && (
          <div className="border-t border-border pt-8 mt-8">
            <div className="grid md:grid-cols-2 gap-4">
              {prevGuide ? (
                <Link href={`/insights/guides/${prevGuide.slug}`}>
                  <Card className="hover-elevate cursor-pointer h-full" data-testid="card-prev-guide">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" />
                        Previous Guide
                      </CardDescription>
                      <CardTitle className="text-base">{prevGuide.title}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ) : (
                <div />
              )}
              {nextGuide && (
                <Link href={`/insights/guides/${nextGuide.slug}`}>
                  <Card className="hover-elevate cursor-pointer h-full" data-testid="card-next-guide">
                    <CardHeader>
                      <CardDescription className="flex items-center gap-1 justify-end">
                        Next Guide
                        <ArrowRight className="h-3 w-3" />
                      </CardDescription>
                      <CardTitle className="text-base text-right">{nextGuide.title}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
