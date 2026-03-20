import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp, BarChart3, MapPin, DollarSign, Activity, Target, Users, Star, Flame, Crown, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";

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

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold font-mono" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          </div>
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
      className={`flex items-center gap-3 p-3 rounded-md ${
        entry.rank <= 3 ? "bg-muted/50" : ""
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
          {entry.avgDscr != null && (
            <span className="text-xs text-muted-foreground">DSCR {formatDscr(entry.avgDscr)}</span>
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
      className={`flex items-center gap-3 p-3 rounded-md ${
        entry.rank <= 3 ? "bg-muted/50" : ""
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

export default function Leaderboard() {
  const { data: allTimeData, isLoading: isLoadingAllTime } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard?period=all-time"],
  });

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard?period=monthly"],
  });

  const { data: topCities, isLoading: isLoadingCities } = useQuery<CityEntry[]>({
    queryKey: ["/api/leaderboard/top-cities"],
  });

  const { data: allTimeContributions, isLoading: isLoadingAllTimeContrib } = useQuery<ContributionEntry[]>({
    queryKey: ["/api/leaderboard/contributions?period=all-time"],
  });

  const { data: monthlyContributions, isLoading: isLoadingMonthlyContrib } = useQuery<ContributionEntry[]>({
    queryKey: ["/api/leaderboard/contributions?period=monthly"],
  });

  const aggregates = allTimeData?.aggregates;
  const allTimeAnalysts = allTimeData?.analysts || [];
  const monthlyAnalysts = monthlyData?.analysts || [];

  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background" data-testid="page-leaderboard">
      <Navigation />
      <SEO
        title="Leaderboard - Deal Analysis Insights"
        description="Real-time leaderboard of top real estate analysts and community contributors on Realist.ca"
        canonicalUrl="/community/leaderboard"
      />
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-leaderboard-title">
              Deal Analysis Insights
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Real-time aggregate metrics from deals analyzed on Realist.ca.
            Climb the all-time ranks and compete for monthly titles.
          </p>
        </div>

        {(isLoadingAllTime) ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : aggregates && aggregates.totalDeals > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" data-testid="section-aggregates">
            <StatCard label="Total Deals" value={String(aggregates.totalDeals)} icon={BarChart3} />
            <StatCard label="Avg DSCR" value={formatDscr(aggregates.avgDscr)} icon={Activity} />
            <StatCard label="Avg Cash-on-Cash" value={formatPercent(aggregates.avgCashOnCash)} icon={DollarSign} />
            <StatCard label="Avg Yield" value={formatPercent(aggregates.avgCapRate)} icon={Target} />
          </div>
        ) : null}

        {aggregates?.avgOfferRatio != null && (
          <Card className="mb-8">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Offer-to-List Ratio</p>
                  <p className="text-lg font-semibold font-mono" data-testid="stat-offer-ratio">
                    {aggregates.avgOfferRatio}% of asking
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Investors are modeling deals at {aggregates.avgOfferRatio}% of listing price on average
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="deal-analysis" className="space-y-6">
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
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <div>
                      <CardTitle className="text-base">All-Time Leaders</CardTitle>
                      <CardDescription className="text-xs">Lifetime deal analysis rankings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingAllTime ? (
                    <ListSkeleton />
                  ) : allTimeAnalysts.length === 0 ? (
                    <EmptyState
                      icon={Trophy}
                      title="No analysts yet"
                      description="Be the first to analyze a deal and claim the top spot."
                      testId="text-alltime-empty"
                    />
                  ) : (
                    <div className="space-y-1" data-testid="list-alltime-analysts">
                      {allTimeAnalysts.map((entry) => (
                        <AnalystRow key={entry.userId} entry={entry} />
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
                      <CardTitle className="text-base">{currentMonth}</CardTitle>
                      <CardDescription className="text-xs">This month's top performers</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingMonthly ? (
                    <ListSkeleton />
                  ) : monthlyAnalysts.length === 0 ? (
                    <EmptyState
                      icon={Flame}
                      title="No activity this month"
                      description="Analyze a deal to lead this month's rankings."
                      testId="text-monthly-empty"
                    />
                  ) : (
                    <div className="space-y-1" data-testid="list-monthly-analysts">
                      {monthlyAnalysts.map((entry) => (
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
                        className={`flex items-center gap-3 p-3 rounded-md ${
                          city.rank <= 3 ? "bg-muted/50" : ""
                        }`}
                        data-testid={`row-city-${city.rank}`}
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
                      <CardTitle className="text-base">{currentMonth}</CardTitle>
                      <CardDescription className="text-xs">This month's most active contributors</CardDescription>
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
    </div>
  );
}
