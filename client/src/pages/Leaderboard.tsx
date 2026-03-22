import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp, BarChart3, MapPin, DollarSign, Activity, Target, Users, Star, Flame, Crown, Calendar, Search, Zap, Shield, ChevronUp, ChevronDown, Minus, ArrowUpRight, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Link } from "wouter";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  profileImageUrl: string | null;
  role?: string;
  dealCount: number;
  avgDscr: number | null;
  avgCashOnCash: number | null;
  avgCapRate: number | null;
}

interface Aggregates {
  totalDeals: number;
  avgDscr: number | null;
  avgCashOnCash: number | null;
  avgCapRate: number | null;
  avgOfferRatio: number | null;
}

interface LeaderboardResponse {
  analysts: LeaderboardEntry[];
  aggregates: Aggregates;
}

interface CityEntry {
  rank: number;
  city: string;
  province: string | null;
  dealCount: number;
  avgCashOnCash: number | null;
  avgCapRate: number | null;
  avgDscr: number | null;
  avgPurchasePrice: number | null;
}

interface ContributionEntry {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
  role: string;
  profileImageUrl: string | null;
}

interface WeeklyStats {
  totalDeals: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  mostActiveCity: string | null;
  mostActiveCityDeals: number;
  period?: "weekly" | "all-time";
}

interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
}

interface UserStats {
  totalDeals: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  rank: number | null;
  rankChange: number | null;
  totalUsers: number;
  badges: BadgeInfo[];
  nextBadge: { id: string; name: string; description: string; threshold: number } | null;
  topCity: string | null;
  topCityDeals: number;
  firstAnalysis: string | null;
  lastAnalysis: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return null;
}

function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDscr(value: number | null): string {
  if (value == null) return "N/A";
  return value.toFixed(2) + "x";
}

function getBadgeIcon(icon: string) {
  switch (icon) {
    case "search": return <Search className="h-4 w-4" />;
    case "zap": return <Zap className="h-4 w-4" />;
    case "target": return <Target className="h-4 w-4" />;
    case "shield": return <Shield className="h-4 w-4" />;
    case "crown": return <Crown className="h-4 w-4" />;
    default: return <Star className="h-4 w-4" />;
  }
}

function getBadgeColor(id: string) {
  switch (id) {
    case "analyst": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "power-user": return "bg-purple-500/10 text-purple-500 border-purple-500/30";
    case "deal-hunter": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "veteran": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    case "legend": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function RoleBadge({ role }: { role: string }) {
  if (role === "realtor" || role === "partner") {
    return (
      <Badge variant="outline" className="text-xs" data-testid={`badge-role-${role}`}>
        Realtor
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs" data-testid={`badge-role-${role}`}>
      Investor
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon, trend }: { label: string; value: string; icon: typeof Activity; trend?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold font-mono" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          </div>
          {trend && (
            <span className="text-xs text-muted-foreground">{trend}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function AnalystRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
        entry.rank <= 3 ? "bg-muted/50" : "hover:bg-muted/30"
      }`}
      data-testid={`row-leaderboard-${entry.rank}`}
    >
      <div className="w-7 flex items-center justify-center shrink-0">
        {getRankIcon(entry.rank) || (
          <span className="text-sm font-medium text-muted-foreground">
            {entry.rank}
          </span>
        )}
      </div>

      <Avatar className="h-9 w-9 shrink-0">
        {entry.profileImageUrl && (
          <AvatarImage src={entry.profileImageUrl} alt={entry.name} />
        )}
        <AvatarFallback className="text-xs">{getInitials(entry.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate text-sm" data-testid={`text-analyst-name-${entry.rank}`}>
            {entry.name}
          </p>
          {entry.role && <RoleBadge role={entry.role} />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.avgCapRate != null && (
            <span className="text-xs text-muted-foreground">Yield {formatPercent(entry.avgCapRate)}</span>
          )}
          {entry.avgCashOnCash != null && (
            <span className="text-xs text-muted-foreground">CoC {formatPercent(entry.avgCashOnCash)}</span>
          )}
        </div>
      </div>

      <Badge variant="secondary" data-testid={`badge-deal-count-${entry.rank}`}>
        {entry.dealCount} {entry.dealCount === 1 ? "deal" : "deals"}
      </Badge>
    </div>
  );
}

function ContributorRow({ entry }: { entry: ContributionEntry }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
        entry.rank <= 3 ? "bg-muted/50" : "hover:bg-muted/30"
      }`}
      data-testid={`row-contribution-${entry.rank}`}
    >
      <div className="w-7 flex items-center justify-center shrink-0">
        {getRankIcon(entry.rank) || (
          <span className="text-sm font-medium text-muted-foreground">
            {entry.rank}
          </span>
        )}
      </div>

      <Avatar className="h-9 w-9 shrink-0">
        {entry.profileImageUrl && (
          <AvatarImage src={entry.profileImageUrl} alt={entry.name} />
        )}
        <AvatarFallback className="text-xs">{getInitials(entry.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate text-sm" data-testid={`text-contributor-name-${entry.rank}`}>
            {entry.name}
          </p>
          <RoleBadge role={entry.role} />
        </div>
      </div>

      <Badge variant="secondary" data-testid={`badge-points-${entry.rank}`}>
        {entry.totalPoints} {entry.totalPoints === 1 ? "pt" : "pts"}
      </Badge>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, testId }: { icon: typeof Trophy; title: string; description: string; testId: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground" data-testid={testId}>
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs">{description}</p>
    </div>
  );
}

function WeeklyStatsPanel({ stats, isLoading }: { stats?: WeeklyStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="panel-weekly-stats">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">
            {stats.period === "all-time" ? "Platform Stats (All-Time)" : "This Week's Activity"}
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-background/60" data-testid="weekly-total-deals">
            <p className="text-2xl font-bold font-mono">{stats.totalDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">Deals Analyzed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/60" data-testid="weekly-avg-cap">
            <p className="text-2xl font-bold font-mono">{formatPercent(stats.avgCapRate)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Cap Rate</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/60" data-testid="weekly-avg-coc">
            <p className="text-2xl font-bold font-mono">{formatPercent(stats.avgCashOnCash)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Cash-on-Cash</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background/60" data-testid="weekly-active-city">
            <p className="text-2xl font-bold font-mono truncate">{stats.mostActiveCity || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Most Active City</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserProfilePanel({ stats, isLoading }: { stats?: UserStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-32 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="border-dashed" data-testid="panel-user-stats-locked">
        <CardContent className="p-6 text-center">
          <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium mb-1">Sign in to see your stats</p>
          <p className="text-xs text-muted-foreground mb-4">Track your deals, earn badges, and climb the ranks.</p>
          <Link href="/auth">
            <Badge variant="default" className="cursor-pointer" data-testid="link-sign-in-stats">
              Sign In
            </Badge>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const allBadgeDefs = [
    { id: "analyst", name: "Analyst", description: "10 deals", icon: "search", threshold: 10 },
    { id: "power-user", name: "Power User", description: "50 deals", icon: "zap", threshold: 50 },
    { id: "deal-hunter", name: "Deal Hunter", description: "100 deals", icon: "target", threshold: 100 },
    { id: "veteran", name: "Veteran", description: "250 deals", icon: "shield", threshold: 250 },
    { id: "legend", name: "Legend", description: "500 deals", icon: "crown", threshold: 500 },
  ];

  const earnedIds = new Set(stats.badges.map(b => b.id));
  const progress = stats.nextBadge ? Math.min((stats.totalDeals / stats.nextBadge.threshold) * 100, 99) : 100;

  return (
    <Card data-testid="panel-user-stats">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Your Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted/50" data-testid="user-total-deals">
            <p className="text-2xl font-bold font-mono">{stats.totalDeals}</p>
            <p className="text-xs text-muted-foreground">Deals</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50" data-testid="user-avg-cap">
            <p className="text-2xl font-bold font-mono">{formatPercent(stats.avgCapRate)}</p>
            <p className="text-xs text-muted-foreground">Avg Cap</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50" data-testid="user-rank">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold font-mono">
                {stats.rank ? `#${stats.rank}` : "—"}
              </p>
              {stats.rankChange != null && stats.rankChange !== 0 && (
                <span className={`flex items-center text-xs ${stats.rankChange > 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="user-rank-change">
                  {stats.rankChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {Math.abs(stats.rankChange)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Rank</p>
          </div>
        </div>

        {stats.rankChange != null && stats.rankChange > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="notification-rank-up">
            <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-600 dark:text-green-400">
              You moved up {stats.rankChange} {stats.rankChange === 1 ? 'spot' : 'spots'} this week!
            </p>
          </div>
        )}

        {stats.rankChange != null && stats.rankChange < 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20" data-testid="notification-rank-down">
            <TrendingUp className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Analyze more deals to reclaim your ranking!
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium">Badges</p>
            <p className="text-xs text-muted-foreground">{stats.badges.length}/{allBadgeDefs.length}</p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="badges-container">
            {allBadgeDefs.map((def) => {
              const earned = earnedIds.has(def.id);
              return (
                <div
                  key={def.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all ${
                    earned ? getBadgeColor(def.id) : "bg-muted/30 text-muted-foreground/40 border-transparent"
                  }`}
                  title={earned ? `${def.name}: ${def.description}` : `${def.description} to unlock`}
                  data-testid={`badge-${def.id}`}
                >
                  {getBadgeIcon(def.icon)}
                  <span className="font-medium">{def.name}</span>
                  {!earned && <Lock className="h-3 w-3 ml-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {stats.nextBadge && (
          <div data-testid="badge-progress">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground">Next: {stats.nextBadge.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{stats.totalDeals}/{stats.nextBadge.threshold}</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {stats.topCity && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="user-top-city">
            <MapPin className="h-3.5 w-3.5" />
            <span>Most analyzed: <span className="font-medium text-foreground">{stats.topCity}</span> ({stats.topCityDeals} deals)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<string>("all-time");
  const [cityFilter, setCityFilter] = useState<string>("");

  const cityParam = cityFilter ? `&city=${encodeURIComponent(cityFilter)}` : "";
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useQuery<LeaderboardResponse>({
    queryKey: [`/api/leaderboard?period=${period}${cityParam}`],
  });

  const { data: weeklyLeaderboard, isLoading: isLoadingWeekly } = useQuery<LeaderboardResponse>({
    queryKey: [`/api/leaderboard?period=weekly${cityParam}`],
  });

  const { data: topCities, isLoading: isLoadingCities } = useQuery<CityEntry[]>({
    queryKey: ["/api/leaderboard/top-cities"],
  });

  const { data: weeklyStats, isLoading: isLoadingWeeklyStats } = useQuery<WeeklyStats>({
    queryKey: ["/api/weekly-stats"],
  });

  const { data: userStats, isLoading: isLoadingUserStats } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

  const { data: allTimeContributions, isLoading: isLoadingAllTimeContrib } = useQuery<ContributionEntry[]>({
    queryKey: ["/api/leaderboard/contributions?period=all-time"],
  });

  const { data: monthlyContributions, isLoading: isLoadingMonthlyContrib } = useQuery<ContributionEntry[]>({
    queryKey: ["/api/leaderboard/contributions?period=monthly"],
  });

  const aggregates = leaderboardData?.aggregates;
  const analysts = leaderboardData?.analysts || [];
  const weeklyAnalysts = weeklyLeaderboard?.analysts || [];

  const uniqueCities = topCities?.map(c => c.city).filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-leaderboard">
      <Navigation />
      <SEO
        title="Leaderboard - Deal Analysis Insights"
        description="Real-time leaderboard of top real estate analysts and community contributors on Realist.ca"
        canonicalUrl="/community/leaderboard"
      />
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-leaderboard-title">
              Leaderboard
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Track your progress, earn badges, and compete with the community.
            Every deal analyzed brings you closer to the top.
          </p>
        </div>

        <WeeklyStatsPanel stats={weeklyStats} isLoading={isLoadingWeeklyStats} />

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {(isLoadingLeaderboard) ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
                ))}
              </div>
            ) : aggregates && aggregates.totalDeals > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="section-aggregates">
                <StatCard label="Total Deals" value={String(aggregates.totalDeals)} icon={BarChart3} />
                <StatCard label="Avg DSCR" value={formatDscr(aggregates.avgDscr)} icon={Activity} />
                <StatCard label="Avg Cash-on-Cash" value={formatPercent(aggregates.avgCashOnCash)} icon={DollarSign} />
                <StatCard label="Avg Yield" value={formatPercent(aggregates.avgCapRate)} icon={Target} />
              </div>
            ) : null}

            <Tabs defaultValue="deal-analysis" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-leaderboard">
                <TabsTrigger value="deal-analysis" data-testid="tab-deal-analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Deal Analysis
                </TabsTrigger>
                <TabsTrigger value="community" data-testid="tab-community">
                  <Users className="h-4 w-4 mr-2" />
                  Community
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deal-analysis" className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[160px]" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-time">All Time</SelectItem>
                      <SelectItem value="monthly">This Month</SelectItem>
                      <SelectItem value="weekly">This Week</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={cityFilter} onValueChange={(val) => setCityFilter(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-city-filter">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-500" />
                        <div>
                          <CardTitle className="text-base">
                            {period === "weekly" ? "This Week" : period === "monthly" ? "This Month" : "All-Time Leaders"}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {cityFilter ? `Filtered to ${cityFilter}` : "Top deal analysts"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingLeaderboard ? (
                        <ListSkeleton />
                      ) : analysts.length === 0 ? (
                        <EmptyState
                          icon={Trophy}
                          title="No analysts yet"
                          description="Be the first to analyze a deal and claim the top spot."
                          testId="text-main-leaderboard-empty"
                        />
                      ) : (
                        <div className="space-y-1" data-testid="list-main-analysts">
                          {analysts.map((entry) => (
                            <AnalystRow key={entry.userId} entry={entry} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-orange-500/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        <div>
                          <CardTitle className="text-base">Hot This Week</CardTitle>
                          <CardDescription className="text-xs">
                            {cityFilter ? `Filtered to ${cityFilter}` : "Weekly top performers"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingWeekly ? (
                        <ListSkeleton />
                      ) : weeklyAnalysts.length === 0 ? (
                        <EmptyState
                          icon={Flame}
                          title="No activity this week"
                          description="Analyze a deal to lead this week's rankings."
                          testId="text-weekly-empty"
                        />
                      ) : (
                        <div className="space-y-1" data-testid="list-weekly-analysts">
                          {weeklyAnalysts.map((entry) => (
                            <AnalystRow key={entry.userId} entry={entry} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Top Cities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingCities ? (
                      <ListSkeleton />
                    ) : !topCities || topCities.length === 0 ? (
                      <EmptyState
                        icon={MapPin}
                        title="No city data yet"
                        description="Import a listing or enter a city when analyzing a deal."
                        testId="text-cities-empty"
                      />
                    ) : (
                      <div className="grid md:grid-cols-2 gap-x-6">
                        {topCities.map((city) => (
                          <div
                            key={`${city.city}-${city.province}`}
                            className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                              city.rank <= 3 ? "bg-muted/50" : ""
                            } ${cityFilter === city.city ? "ring-1 ring-primary" : ""}`}
                            data-testid={`row-city-${city.rank}`}
                            onClick={() => setCityFilter(cityFilter === city.city ? "" : city.city)}
                          >
                            <div className="w-7 flex items-center justify-center shrink-0">
                              {getRankIcon(city.rank) || (
                                <span className="text-sm font-medium text-muted-foreground">
                                  {city.rank}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm" data-testid={`text-city-name-${city.rank}`}>
                                {city.city}{city.province ? `, ${city.province}` : ""}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {city.avgCashOnCash != null && (
                                  <span className="text-xs text-muted-foreground">CoC {formatPercent(city.avgCashOnCash)}</span>
                                )}
                                {city.avgDscr != null && (
                                  <span className="text-xs text-muted-foreground">DSCR {formatDscr(city.avgDscr)}</span>
                                )}
                                {city.avgPurchasePrice != null && (
                                  <span className="text-xs text-muted-foreground">Avg {formatCurrency(city.avgPurchasePrice)}</span>
                                )}
                              </div>
                            </div>
                            <Badge variant="secondary" data-testid={`badge-city-deals-${city.rank}`}>
                              {city.dealCount} {city.dealCount === 1 ? "deal" : "deals"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="community" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-500" />
                        <div>
                          <CardTitle className="text-base">All-Time Contributors</CardTitle>
                          <CardDescription className="text-xs">Lifetime community contribution rankings</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAllTimeContrib ? (
                        <ListSkeleton />
                      ) : !allTimeContributions || allTimeContributions.length === 0 ? (
                        <EmptyState
                          icon={Users}
                          title="No contributions yet"
                          description="Submit notes, comments, or votes on listings to earn points."
                          testId="text-alltime-contributions-empty"
                        />
                      ) : (
                        <div className="space-y-1" data-testid="list-alltime-contributions">
                          {allTimeContributions.map((entry) => (
                            <ContributorRow key={entry.userId} entry={entry} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        <div>
                          <CardTitle className="text-base">This Month</CardTitle>
                          <CardDescription className="text-xs">Monthly community leaders</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMonthlyContrib ? (
                        <ListSkeleton />
                      ) : !monthlyContributions || monthlyContributions.length === 0 ? (
                        <EmptyState
                          icon={Flame}
                          title="No contributions this month"
                          description="Be the first to contribute this month and earn points."
                          testId="text-monthly-contributions-empty"
                        />
                      ) : (
                        <div className="space-y-1" data-testid="list-monthly-contributions">
                          {monthlyContributions.map((entry) => (
                            <ContributorRow key={entry.userId} entry={entry} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <UserProfilePanel stats={userStats} isLoading={isLoadingUserStats} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Badge System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Analyst", desc: "Analyze 10 deals", icon: "search", color: "text-blue-500" },
                    { name: "Power User", desc: "Analyze 50 deals", icon: "zap", color: "text-purple-500" },
                    { name: "Deal Hunter", desc: "Analyze 100 deals", icon: "target", color: "text-orange-500" },
                    { name: "Veteran", desc: "Analyze 250 deals", icon: "shield", color: "text-emerald-500" },
                    { name: "Legend", desc: "Analyze 500 deals", icon: "crown", color: "text-yellow-500" },
                  ].map((badge) => (
                    <div key={badge.name} className="flex items-center gap-3 text-sm" data-testid={`badge-info-${badge.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className={badge.color}>
                        {getBadgeIcon(badge.icon)}
                      </div>
                      <div>
                        <p className="font-medium">{badge.name}</p>
                        <p className="text-xs text-muted-foreground">{badge.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
