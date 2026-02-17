import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp, BarChart3, MapPin, DollarSign, Activity, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  profileImageUrl: string | null;
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

export default function Leaderboard() {
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: topCities, isLoading: isLoadingCities } = useQuery<CityEntry[]>({
    queryKey: ["/api/leaderboard/top-cities"],
  });

  const aggregates = leaderboardData?.aggregates;
  const analysts = leaderboardData?.analysts || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-leaderboard">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-leaderboard-title">
              Deal Analysis Insights
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Real-time aggregate metrics from deals analyzed on Realist.ca.
            See what investors are modeling and where they're looking.
          </p>
        </div>

        {isLoadingLeaderboard ? (
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
            <StatCard label="Avg Cap Rate" value={formatPercent(aggregates.avgCapRate)} icon={Target} />
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

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Top Analysts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingLeaderboard ? (
                <ListSkeleton />
              ) : analysts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-leaderboard-empty">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">No analysts yet</p>
                  <p className="text-sm">
                    Be the first to analyze a deal and claim the top spot.
                  </p>
                </div>
              ) : (
                <div className="space-y-1" data-testid="list-leaderboard">
                  {analysts.map((entry) => (
                    <div
                      key={entry.userId}
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
                        <p className="font-medium truncate text-sm" data-testid={`text-analyst-name-${entry.rank}`}>
                          {entry.name}
                        </p>
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                <div className="text-center py-12 text-muted-foreground" data-testid="text-cities-empty">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">No city data yet</p>
                  <p className="text-sm">
                    Import a listing or enter a city when analyzing a deal.
                  </p>
                </div>
              ) : (
                <div className="space-y-1" data-testid="list-top-cities">
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
        </div>
      </div>
    </div>
  );
}
