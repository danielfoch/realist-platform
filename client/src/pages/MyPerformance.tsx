import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, Trophy, Target, Zap,
  BarChart3, ArrowRight, Crown, Shield, Search,
  Minus, Award, Star, Calculator, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface PerformanceData {
  user: {
    deals_analyzed: number;
    avg_cap_rate: number | null;
    avg_cash_on_cash: number | null;
    avg_irr: number | null;
    rank_weekly: number | null;
    rank_all_time: number | null;
    total_weekly_users: number;
    total_all_time_users: number;
  };
  platform: {
    avg_cap_rate: number | null;
    avg_cash_on_cash: number | null;
    avg_irr: number | null;
    total_deals_analyzed: number;
  };
  leaderboard: {
    weekly_top_3: { rank: number; name: string; dealCount: number; avgCapRate: number | null }[];
    all_time_top_3: { rank: number; name: string; dealCount: number; avgCapRate: number | null }[];
  };
  gamification: {
    current_badge: { threshold: number; name: string } | null;
    next_badge: { threshold: number; name: string } | null;
    deals_to_next: number;
    progress_percent: number;
  };
  trend: {
    user_monthly: { month: string; avgCapRate: number | null; dealCount: number }[];
    platform_monthly: { month: string; avgCapRate: number | null }[];
  };
}

function DeltaBadge({ userVal, platformVal }: { userVal: number | null; platformVal: number | null }) {
  if (userVal == null || platformVal == null) return null;
  const delta = userVal - platformVal;
  const isPositive = delta > 0;
  const isNeutral = Math.abs(delta) < 0.05;

  if (isNeutral) {
    return (
      <Badge variant="outline" className="text-[10px] gap-0.5" data-testid="badge-delta-neutral">
        <Minus className="h-3 w-3" /> Even
      </Badge>
    );
  }

  return (
    <Badge
      variant={isPositive ? "default" : "secondary"}
      className={`text-[10px] gap-0.5 ${isPositive ? "bg-green-600 hover:bg-green-700" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}
      data-testid={`badge-delta-${isPositive ? "positive" : "negative"}`}
    >
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{delta.toFixed(1)}%
    </Badge>
  );
}

function MetricCard({
  label, userVal, platformVal, suffix, icon: Icon,
}: {
  label: string;
  userVal: number | null;
  platformVal: number | null;
  suffix: string;
  icon: any;
}) {
  return (
    <Card data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{label}</span>
          </div>
          <DeltaBadge userVal={userVal} platformVal={platformVal} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">You</p>
            <p className="text-2xl font-bold" data-testid={`text-user-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {userVal != null ? `${userVal.toFixed(1)}${suffix}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Platform Avg</p>
            <p className="text-2xl font-bold text-muted-foreground" data-testid={`text-platform-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {platformVal != null ? `${platformVal.toFixed(1)}${suffix}` : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getBadgeIcon(name: string) {
  switch (name) {
    case "Analyst": return Search;
    case "Power User": return Zap;
    case "Deal Hunter": return Target;
    case "Veteran": return Shield;
    case "Legend": return Crown;
    default: return Award;
  }
}

function getRankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function MyPerformance() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source")) {
      setSource(params.get("source"));
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      const returnPath = `/my-performance${source ? `?source=${source}` : ""}`;
      setLocation(`/login?returnUrl=${encodeURIComponent(returnPath)}`);
    }
  }, [user, authLoading, setLocation, source]);

  const { data: perfData, isLoading, isError, error, refetch } = useQuery<PerformanceData>({
    queryKey: ["/api/user-performance"],
    enabled: !!user,
    retry: 1,
  });

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trendData = perfData?.trend?.user_monthly?.map(um => {
    const pm = perfData.trend.platform_monthly.find(p => p.month === um.month);
    return {
      month: um.month,
      yourCapRate: um.avgCapRate,
      platformCapRate: pm?.avgCapRate || null,
      deals: um.dealCount,
    };
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Performance | Realist.ca"
        description="See how your deal analysis skills compare to the platform average."
      />
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              How You Compare
            </h1>
            <p className="text-muted-foreground mt-1">
              Your analysis performance vs. the Realist community
            </p>
          </div>
          {perfData?.gamification?.current_badge && (
            <Badge variant="secondary" className="text-sm gap-1.5 px-3 py-1.5" data-testid="badge-current-tier">
              {(() => {
                const BadgeIcon = getBadgeIcon(perfData.gamification.current_badge.name);
                return <BadgeIcon className="h-4 w-4" />;
              })()}
              {perfData.gamification.current_badge.name}
            </Badge>
          )}
        </div>

        {isError ? (
          <Card className="max-w-md mx-auto mt-12" data-testid="card-error">
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {(error as any)?.message === "Not authenticated"
                  ? "Your session has expired. Please log in again."
                  : "We couldn't load your performance data. Please try again."}
              </p>
              {(error as any)?.message === "Not authenticated" ? (
                <Button onClick={() => setLocation("/login?returnUrl=%2Fmy-performance")} data-testid="button-login-retry">
                  Log In Again
                </Button>
              ) : (
                <Button onClick={() => refetch()} data-testid="button-retry">
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </div>
        ) : perfData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-deals-analyzed">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <Calculator className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Deals Analyzed</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">You</p>
                      <p className="text-2xl font-bold" data-testid="text-user-deals">
                        {perfData.user.deals_analyzed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Platform Total</p>
                      <p className="text-2xl font-bold text-muted-foreground" data-testid="text-platform-deals">
                        {perfData.platform.total_deals_analyzed}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <MetricCard
                label="Avg Cap Rate"
                userVal={perfData.user.avg_cap_rate}
                platformVal={perfData.platform.avg_cap_rate}
                suffix="%"
                icon={TrendingUp}
              />
              <MetricCard
                label="Avg Cash-on-Cash"
                userVal={perfData.user.avg_cash_on_cash}
                platformVal={perfData.platform.avg_cash_on_cash}
                suffix="%"
                icon={BarChart3}
              />
              <MetricCard
                label="Avg IRR"
                userVal={perfData.user.avg_irr}
                platformVal={perfData.platform.avg_irr}
                suffix="%"
                icon={Target}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-ranking">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Your Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">This Week</p>
                      <p className="text-3xl font-bold" data-testid="text-weekly-rank">
                        {perfData.user.rank_weekly
                          ? `#${perfData.user.rank_weekly}`
                          : "—"}
                      </p>
                      {perfData.user.rank_weekly && perfData.user.total_weekly_users > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          of {perfData.user.total_weekly_users} analysts
                        </p>
                      )}
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">All-Time</p>
                      <p className="text-3xl font-bold" data-testid="text-alltime-rank">
                        {perfData.user.rank_all_time
                          ? `#${perfData.user.rank_all_time}`
                          : "—"}
                      </p>
                      {perfData.user.rank_all_time && perfData.user.total_all_time_users > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          of {perfData.user.total_all_time_users} analysts
                        </p>
                      )}
                    </div>
                  </div>

                  {perfData.user.rank_weekly && perfData.user.rank_weekly > 3 && (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Analyze more deals this week to climb from <span className="font-bold">#{perfData.user.rank_weekly}</span> into the Top 3
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-gamification">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500" />
                    Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {perfData.gamification.next_badge ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {perfData.gamification.current_badge && (
                              <Badge variant="outline" className="text-xs">
                                {perfData.gamification.current_badge.name}
                              </Badge>
                            )}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              {perfData.gamification.next_badge.name}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {perfData.gamification.progress_percent}%
                          </span>
                        </div>
                        <Progress
                          value={perfData.gamification.progress_percent}
                          className="h-2.5"
                          data-testid="progress-badge"
                        />
                      </div>
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          Analyze <span className="font-bold">{perfData.gamification.deals_to_next} more deals</span> to earn the <span className="font-bold">{perfData.gamification.next_badge.name}</span> badge
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <Crown className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-lg">Legend Status</p>
                      <p className="text-sm text-muted-foreground">You've reached the highest tier</p>
                    </div>
                  )}

                  {perfData.user.deals_analyzed === 0 && (
                    <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30">
                      <p className="text-sm text-orange-800 dark:text-orange-300">
                        You haven't analyzed any deals yet. Start now to climb the ranks!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {trendData.length > 1 && (
              <Card data-testid="card-trend-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cap Rate Over Time
                  </CardTitle>
                  <CardDescription>Your average cap rate vs platform (last 6 months)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="month"
                          className="text-xs"
                          tickFormatter={(v: string) => {
                            const [y, m] = v.split("-");
                            return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]} '${y.slice(2)}`;
                          }}
                        />
                        <YAxis className="text-xs" tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${value?.toFixed(1)}%`,
                            name === "yourCapRate" ? "Your Avg" : "Platform Avg",
                          ]}
                          labelFormatter={(label: string) => {
                            const [y, m] = label.split("-");
                            return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]} ${y}`;
                          }}
                        />
                        <Legend
                          formatter={(value: string) =>
                            value === "yourCapRate" ? "Your Avg Cap Rate" : "Platform Avg"
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="yourCapRate"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="platformCapRate"
                          stroke="#9ca3af"
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-weekly-leaderboard">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Top 3 This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  {perfData.leaderboard.weekly_top_3.length > 0 ? (
                    <div className="space-y-2">
                      {perfData.leaderboard.weekly_top_3.map((entry) => (
                        <div
                          key={entry.rank}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                          data-testid={`card-weekly-rank-${entry.rank}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg font-bold min-w-[28px]">
                              {getRankMedal(entry.rank)}
                            </span>
                            <div>
                              <p className="text-sm font-medium">{entry.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {entry.dealCount} deals
                                {entry.avgCapRate != null && ` · ${entry.avgCapRate.toFixed(1)}% avg cap`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No activity this week yet. Be the first!
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-alltime-leaderboard">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Top 3 All-Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {perfData.leaderboard.all_time_top_3.length > 0 ? (
                    <div className="space-y-2">
                      {perfData.leaderboard.all_time_top_3.map((entry) => (
                        <div
                          key={entry.rank}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                          data-testid={`card-alltime-rank-${entry.rank}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg font-bold min-w-[28px]">
                              {getRankMedal(entry.rank)}
                            </span>
                            <div>
                              <p className="text-sm font-medium">{entry.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {entry.dealCount} deals
                                {entry.avgCapRate != null && ` · ${entry.avgCapRate.toFixed(1)}% avg cap`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No analysts yet. Start analyzing to claim the top spot!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10" data-testid="card-cta">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">
                    {perfData.user.deals_analyzed === 0
                      ? "Start Your Journey"
                      : perfData.user.rank_weekly && perfData.user.rank_weekly <= 3
                        ? "Keep Your Lead"
                        : "Climb the Ranks"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {perfData.user.deals_analyzed === 0
                      ? "Analyze your first deal to start building your track record."
                      : perfData.gamification.next_badge
                        ? `${perfData.gamification.deals_to_next} more deals to ${perfData.gamification.next_badge.name} status.`
                        : "Keep analyzing to maintain your Legend status."}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="shrink-0"
                  onClick={() => setLocation("/tools/analyzer")}
                  data-testid="button-analyze-more"
                >
                  <Calculator className="h-5 w-5 mr-2" />
                  Analyze More Deals
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-16">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Performance Data</h2>
            <p className="text-muted-foreground mb-6">Start analyzing deals to see your performance metrics.</p>
            <Button onClick={() => setLocation("/tools/analyzer")} data-testid="button-start-analyzing">
              <Calculator className="h-4 w-4 mr-2" />
              Analyze Your First Deal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
