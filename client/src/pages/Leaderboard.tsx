import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, TrendingUp, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  profileImageUrl: string | null;
  dealCount: number;
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

function LeaderboardSkeleton() {
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
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-leaderboard">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-leaderboard-title">
              Top Deal Analysts
            </h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            The most active members analyzing real estate deals on Realist.ca.
            Run more deals through the analyzer to climb the ranks.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LeaderboardSkeleton />
            ) : !leaderboard || leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-leaderboard-empty">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">No analysts yet</p>
                <p className="text-sm">
                  Be the first to analyze a deal and claim the top spot.
                </p>
              </div>
            ) : (
              <div className="space-y-1" data-testid="list-leaderboard">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-4 p-3 rounded-md ${
                      entry.rank <= 3 ? "bg-muted/50" : ""
                    }`}
                    data-testid={`row-leaderboard-${entry.rank}`}
                  >
                    <div className="w-8 flex items-center justify-center shrink-0">
                      {getRankIcon(entry.rank) || (
                        <span className="text-sm font-medium text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    <Avatar className="h-10 w-10 shrink-0">
                      {entry.profileImageUrl && (
                        <AvatarImage src={entry.profileImageUrl} alt={entry.name} />
                      )}
                      <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium truncate"
                        data-testid={`text-analyst-name-${entry.rank}`}
                      >
                        {entry.name}
                      </p>
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
      </div>
    </div>
  );
}
