import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator, TrendingDown, TrendingUp, Trophy, Target, Search,
  Bell, ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Eye,
  MessageSquare, Sparkles, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";

// Mirrors the DashboardGlance shape returned by GET /api/dashboard/glance
// (server/dashboardGlance.ts).
interface GlanceRecentAnalysis {
  id: string;
  address: string | null;
  city: string | null;
  province: string | null;
  strategyType: string;
  countryMode: string;
  capRate: number | null;
  createdAt: string;
  rerunUrl: string;
}
interface GlanceSavedSearchMatch {
  id: string;
  name: string;
  newMatchCount: number;
  sampleAddresses: string[];
  url: string;
}
interface GlancePriceChange {
  listingKey: string;
  address: string | null;
  city: string | null;
  previousPrice: number;
  currentPrice: number;
  direction: "drop" | "increase";
  changePercent: number;
  rerunUrl: string;
}
interface GlanceData {
  recentAnalyses: GlanceRecentAnalysis[];
  totalAnalyses: number;
  savedSearches: { total: number; withNewMatches: GlanceSavedSearchMatch[]; newMatchTotal: number };
  priceChanges: GlancePriceChange[];
  watchCount: number;
  leaderboard: {
    rank: number | null;
    previousRank: number | null;
    rankDelta: number | null;
    dealsThisMonth: number;
    totalRanked: number;
    monthLabel: string;
  };
  milestone: {
    totalDeals: number;
    currentBadge: { threshold: number; name: string; icon: string } | null;
    nextBadge: { threshold: number; name: string; icon: string } | null;
    dealsToNext: number;
    progressPercent: number;
  };
  fieldNotes: { noteCount: number; netScore: number };
  generatedAt: string;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function strategyLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shared shell for a card whose body is empty — teaches the next action. */
function EmptyState({ icon: Icon, children, cta }: {
  icon: React.ElementType;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center text-center py-6 px-2">
      <div className="p-2.5 rounded-full bg-muted mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-3 max-w-[240px]">{children}</p>
      {cta && (
        <Link href={cta.href}>
          <Button variant="outline" size="sm" className="gap-1.5">
            {cta.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default function DailyGlance() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Session-auth page: bounce anonymous visitors to login, returning here.
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(authPath("/login", "/dashboard"));
    }
  }, [authLoading, user, setLocation]);

  const { data, isLoading } = useQuery<GlanceData>({
    queryKey: ["/api/dashboard/glance"],
    enabled: !!user,
  });

  const greeting = user?.firstName ? `Welcome back, ${user.firstName}` : "Welcome back";

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </div>
    );
  }

  const lb = data?.leaderboard;
  const ms = data?.milestone;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Your Dashboard | Realist.ca"
        description="Your daily glance: recent analyses, new matches, price changes, leaderboard rank, and milestone progress."
      />
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">{greeting}</h1>
          <p className="text-muted-foreground mt-1">
            Here's what's changed since you were last here.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Recent analyses ─────────────────────────────────────────── */}
            <Card data-testid="card-recent-analyses">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="h-4 w-4 text-primary" />
                    Your recent analyses
                  </CardTitle>
                  {data && data.totalAnalyses > 0 && (
                    <Link href="/my-performance">
                      <Button variant="ghost" size="sm" className="text-xs h-7">View all</Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {data && data.recentAnalyses.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentAnalyses.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50"
                        data-testid={`row-recent-${a.id}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {a.address || [a.city, a.province].filter(Boolean).join(", ") || "Untitled analysis"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {[strategyLabel(a.strategyType),
                              a.capRate != null ? `${a.capRate}% cap` : null,
                              relativeDate(a.createdAt)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Link href={a.rerunUrl}>
                          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid={`button-rerun-${a.id}`}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Re-run
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Calculator} cta={{ href: "/tools/analyzer", label: "Analyze a deal" }}>
                    You haven't analyzed a deal yet. Run one to start your track record.
                  </EmptyState>
                )}
              </CardContent>
            </Card>

            {/* ── New matches from saved searches ─────────────────────────── */}
            <Card data-testid="card-saved-searches">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4 text-primary" />
                  New matches
                  {data && data.savedSearches.newMatchTotal > 0 && (
                    <Badge variant="default" className="ml-1">{data.savedSearches.newMatchTotal}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.savedSearches.total === 0 ? (
                  <EmptyState icon={Search} cta={{ href: "/tools/cap-rates", label: "Explore the map" }}>
                    Save a search on the cap-rate map to get alerted when new listings match.
                  </EmptyState>
                ) : data && data.savedSearches.withNewMatches.length > 0 ? (
                  <div className="space-y-2">
                    {data.savedSearches.withNewMatches.map((s) => (
                      <Link key={s.id} href={s.url}>
                        <div
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          data-testid={`row-search-${s.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {s.sampleAddresses.join(" · ") || "New listings match your criteria"}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {s.newMatchCount} new
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Bell} cta={{ href: "/watchlist", label: "Manage searches" }}>
                    {data ? `${data.savedSearches.total} saved ${data.savedSearches.total === 1 ? "search" : "searches"} watching — no new matches right now. We'll surface them here.` : ""}
                  </EmptyState>
                )}
              </CardContent>
            </Card>

            {/* ── Price changes on watched listings ───────────────────────── */}
            <Card data-testid="card-price-changes">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Price changes
                  {data && data.priceChanges.length > 0 && (
                    <Badge variant="default" className="ml-1">{data.priceChanges.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.watchCount === 0 ? (
                  <EmptyState icon={Eye} cta={{ href: "/tools/cap-rates", label: "Find listings" }}>
                    Watch a listing to be notified when its price moves.
                  </EmptyState>
                ) : data && data.priceChanges.length > 0 ? (
                  <div className="space-y-2">
                    {data.priceChanges.map((c) => (
                      <div
                        key={c.listingKey}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50"
                        data-testid={`row-price-${c.listingKey}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.address || [c.city].filter(Boolean).join(", ") || c.listingKey}
                          </p>
                          <p className="text-[11px] flex items-center gap-1">
                            <span className="text-muted-foreground line-through">{money(c.previousPrice)}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className={c.direction === "drop" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                              {money(c.currentPrice)}
                            </span>
                            <span className={`ml-0.5 ${c.direction === "drop" ? "text-emerald-600" : "text-red-600"}`}>
                              ({c.changePercent > 0 ? "+" : ""}{c.changePercent}%)
                            </span>
                          </p>
                        </div>
                        <Link href={c.rerunUrl}>
                          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid={`button-reanalyze-${c.listingKey}`}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Re-analyze
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Eye} cta={{ href: "/watchlist", label: "View watchlist" }}>
                    {data ? `Watching ${data.watchCount} ${data.watchCount === 1 ? "listing" : "listings"} — no material price moves yet.` : ""}
                  </EmptyState>
                )}
              </CardContent>
            </Card>

            {/* ── Leaderboard rank + delta ────────────────────────────────── */}
            <Card data-testid="card-leaderboard">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-primary" />
                  Your leaderboard rank
                </CardTitle>
                <CardDescription>{lb?.monthLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {lb && lb.rank != null ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold" data-testid="text-rank">#{lb.rank}</span>
                        <span className="text-sm text-muted-foreground">of {lb.totalRanked}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lb.dealsThisMonth} {lb.dealsThisMonth === 1 ? "deal" : "deals"} analyzed this month
                      </p>
                    </div>
                    <RankDelta delta={lb.rankDelta} />
                  </div>
                ) : (
                  <EmptyState icon={Trophy} cta={{ href: "/tools/analyzer", label: "Analyze a deal" }}>
                    Analyze a deal this month to join the leaderboard. #1 ships home a real prize.
                  </EmptyState>
                )}
                {lb && lb.rank != null && (
                  <Link href="/community/leaderboard">
                    <Button variant="ghost" size="sm" className="mt-3 text-xs h-7 gap-1 px-0 hover:bg-transparent">
                      See the full leaderboard <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* ── Milestone progress ──────────────────────────────────────── */}
            <Card data-testid="card-milestone">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" />
                  Milestone progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ms && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-2xl font-bold" data-testid="text-total-analyses">{ms.totalDeals}</span>
                        <span className="text-sm text-muted-foreground ml-1.5">analyzed</span>
                      </div>
                      {ms.currentBadge && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          {ms.currentBadge.name}
                        </Badge>
                      )}
                    </div>
                    <Progress value={ms.progressPercent} className="h-2.5" data-testid="progress-milestone" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {ms.nextBadge
                        ? <><span className="font-medium text-foreground">{ms.dealsToNext} more</span> to reach {ms.nextBadge.name}</>
                        : "You've earned every badge. Legend status."}
                    </p>
                    {ms.totalDeals === 0 && (
                      <Link href="/tools/analyzer">
                        <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                          <Calculator className="h-3.5 w-3.5" /> Analyze your first deal
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Field-note activity ─────────────────────────────────────── */}
            <Card data-testid="card-field-notes">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Your field notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.fieldNotes.noteCount > 0 ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold" data-testid="text-note-score">
                          {data.fieldNotes.netScore > 0 ? "+" : ""}{data.fieldNotes.netScore}
                        </span>
                        <span className="text-sm text-muted-foreground">net votes</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        across {data.fieldNotes.noteCount} {data.fieldNotes.noteCount === 1 ? "note" : "notes"} you've shared
                      </p>
                    </div>
                    {data.fieldNotes.netScore > 0 && (
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    )}
                  </div>
                ) : (
                  <EmptyState icon={MessageSquare} cta={{ href: "/tools/cap-rates", label: "Find a listing" }}>
                    Share a field note on a listing to build your reputation with the community.
                  </EmptyState>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null) {
    return <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> New</Badge>;
  }
  if (delta > 0) {
    return (
      <div className="flex items-center gap-1 text-emerald-600" data-testid="rank-delta">
        <ArrowUpRight className="h-4 w-4" />
        <span className="text-sm font-medium">+{delta} vs last month</span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-1 text-red-600" data-testid="rank-delta">
        <ArrowDownRight className="h-4 w-4" />
        <span className="text-sm font-medium">{delta} vs last month</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground" data-testid="rank-delta">
      <Minus className="h-4 w-4" />
      <span className="text-sm">No change</span>
    </div>
  );
}
