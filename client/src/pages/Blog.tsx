import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Calendar, Clock, FileText, TrendingUp, Landmark, Building2 } from "lucide-react";
import { format } from "date-fns";

interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  thumbnail?: string;
  author?: string;
}

interface RSSFeedResponse {
  status: string;
  feed: {
    url: string;
    title: string;
    link: string;
    author: string;
    description: string;
    image: string;
  };
  items: SubstackPost[];
}

function extractImageFromContent(content: string): string | null {
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

function estimateReadTime(content: string): number {
  const text = stripHtml(content);
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

interface DeepResearchReport {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  iconBg: string;
}

const deepResearchReports: DeepResearchReport[] = [
  {
    href: "/insights/spring-economic-update-2026",
    title: "Spring Economic Update 2026",
    description:
      "What Ottawa's spring fiscal update says about Canadian real estate — housing affordability, starts, inflation, rates, and the deficit through an investor lens.",
    badge: "Apr 2026",
    icon: <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    href: "/insights/the-spread-that-ate-the-economy",
    title: "The Spread That Ate the Economy",
    description:
      "How widening credit spreads are quietly reshaping Canadian real estate cap rates, mortgage pricing, and deal viability.",
    badge: "Research",
    icon: <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
    iconBg: "bg-rose-100 dark:bg-rose-900/30",
  },
  {
    href: "/reports/cmhc-land-use-regulations-housing-canada-2026",
    title: "CMHC Land Use Regulations & Housing Canada 2026",
    description:
      "Deep dive into how municipal land-use rules constrain Canadian housing supply — and what investors need to know.",
    badge: "Research",
    icon: <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
  },
];

export default function Blog() {
  const { data: rssData, isLoading: rssLoading } = useQuery<RSSFeedResponse>({
    queryKey: ["/api/blog/posts"],
    staleTime: 1000 * 60 * 30,
  });

  const substackPosts = rssData?.items || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Blog - Market Analysis & Investment Tips"
        description="Expert insights on Canadian real estate investing from Daniel Foch and the Realist.ca team. Toronto market analysis, BRRR strategies, multiplex investing tips, and wealth-building advice for Canadian investors."
        keywords="canadian real estate blog, toronto real estate news, real estate investing tips canada, daniel foch blog, housing market analysis canada, BRRR strategy guide, rental property investing"
        canonicalUrl="/insights/blog"
      />
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-blog-title">
            Blog & Research
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-blog-subtitle">
            Substack posts from The Canadian Real Estate Investor team, plus original deep research reports from Realist.ca.
          </p>
        </div>

        <section className="mb-16" data-testid="section-deep-research">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <h2 className="text-2xl font-bold" data-testid="text-deep-research-heading">
              Realist Deep Research Reports
            </h2>
            <Link href="/insights/market-report">
              <Button variant="outline" size="sm" data-testid="button-view-monthly-archive">
                <FileText className="mr-2 h-4 w-4" />
                Monthly Market Report Archive
              </Button>
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deepResearchReports.map((report) => (
              <Link
                key={report.href}
                href={report.href}
                className="block group"
                data-testid={`link-research-report-${report.href.split("/").pop()}`}
              >
                <Card className="h-full hover-elevate transition-all duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report.iconBg}`}>
                        {report.icon}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {report.badge}
                      </Badge>
                    </div>
                    <h3
                      className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors"
                      data-testid={`text-research-title-${report.href.split("/").pop()}`}
                    >
                      {report.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {report.description}
                    </p>
                    <span className="text-sm text-primary font-medium">Read report →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section data-testid="section-substack">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <h2 className="text-2xl font-bold" data-testid="text-substack-heading">
              Latest Substack Posts
            </h2>
            <a
              href="https://padder.substack.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" data-testid="button-subscribe-substack">
                Subscribe on Substack
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          {rssLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!rssLoading && substackPosts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground" data-testid="text-no-substack-posts">
                Unable to load Substack posts.
              </p>
              <a
                href="https://padder.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3"
              >
                <Button data-testid="button-view-substack">
                  View on Substack
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          )}

          {!rssLoading && substackPosts.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {substackPosts.map((post, index) => {
                const thumbnail = post.thumbnail || extractImageFromContent(post.content);
                const description = stripHtml(post.description || post.content).substring(0, 150);
                const readTime = estimateReadTime(post.content);
                const pubDate = new Date(post.pubDate);

                return (
                  <a
                    key={post.link}
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                    data-testid={`link-substack-post-${index}`}
                  >
                    <Card className="h-full hover-elevate transition-all duration-200">
                      {thumbnail && (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            data-testid={`img-substack-post-${index}`}
                          />
                        </div>
                      )}
                      {!thumbnail && (
                        <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary/30">R</span>
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <h3
                          className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors"
                          data-testid={`text-substack-post-title-${index}`}
                        >
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(pubDate, "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {readTime} min read
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p
                          className="text-sm text-muted-foreground line-clamp-3"
                          data-testid={`text-substack-post-desc-${index}`}
                        >
                          {description}...
                        </p>
                      </CardContent>
                    </Card>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
