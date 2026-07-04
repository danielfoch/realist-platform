import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowUpDown, Shield, Trophy } from "lucide-react";
import { LeaderboardEligibilityNotice } from "@/components/LeaderboardEligibilityNotice";
import { HowScoringWorks } from "@/components/HowScoringWorks";

interface FullLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalDealsAnalyzed: number;
  monthlyDealsAnalyzed: number;
  leaderboardScore: number;
  avgAnalysisConfidenceScore: number | null;
  eligibleAnalysisCount: number;
  excludedAnalysisCount: number;
  oracleScore: number | null;
  oracleMedianError: number | null;
  oracleEligibleCount: number;
  userUnderwrittenAvgYield: number | null;
  autoUnderwrittenAvgYield: number | null;
  userVsAutoYieldDelta: number | null;
  provisional: boolean;
}

interface FullLeaderboardResponse {
  entries: FullLeaderboardEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

function formatPercent(value: number | null | undefined, multiplier = 1) {
  if (value == null) return "-";
  return `${(value * multiplier).toFixed(1)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toFixed(1);
}

export default function FullLeaderboard() {
  const [period, setPeriod] = useState("all-time");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [strategy, setStrategy] = useState("");
  const [sort, setSort] = useState("score");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      period,
      page: String(page),
      pageSize: String(pageSize),
      sort,
      direction,
    });
    if (province) params.set("province", province);
    if (city) params.set("city", city);
    if (strategy) params.set("strategy", strategy);
    return `/api/leaderboard/full?${params.toString()}`;
  }, [period, page, sort, direction, province, city, strategy]);

  const { data, isLoading } = useQuery<FullLeaderboardResponse>({ queryKey: [query] });
  const entries = data?.entries || [];

  const changeSort = (nextSort: string) => {
    if (sort === nextSort) {
      setDirection(direction === "desc" ? "asc" : "desc");
    } else {
      setSort(nextSort);
      setDirection("desc");
    }
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-full-leaderboard">
      <Navigation />
      <SEO title="Full Leaderboard - Realist" description="Detailed Realist analyst leaderboard with deal counts, confidence scoring, and market oracle KPIs." canonicalUrl="/community/leaderboard/full" />
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/community/leaderboard">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Top 10
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Full Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Detailed confidence-weighted rankings and market oracle KPIs.</p>
            <HowScoringWorks className="-ml-2 mt-1" />
          </div>
          <Badge variant="outline" className="gap-2">
            <Shield className="h-3.5 w-3.5" />
            Click-through analyses are downweighted
          </Badge>
        </div>

        <LeaderboardEligibilityNotice className="mb-6" />

        <Card className="mb-6">
          <CardContent className="p-4 grid gap-3 md:grid-cols-5">
            <Select value={period} onValueChange={(value) => { setPeriod(value); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All Time</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
              </SelectContent>
            </Select>
            <Input value={province} onChange={(event) => { setProvince(event.target.value); setPage(1); }} placeholder="Province" />
            <Input value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} placeholder="City" />
            <Input value={strategy} onChange={(event) => { setStrategy(event.target.value); setPage(1); }} placeholder="Strategy" />
            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="name">User</SelectItem>
                <SelectItem value="totalDealsAnalyzed">Total Deals</SelectItem>
                <SelectItem value="monthlyDealsAnalyzed">Monthly Deals</SelectItem>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
                <SelectItem value="yield">Yield</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              All Analysts
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <table className="w-full min-w-[1100px] text-sm" data-testid="table-full-leaderboard">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    {[
                      ["Rank", "rank"],
                      ["User", "name"],
                      ["Total Deals", "totalDealsAnalyzed"],
                      ["Monthly", "monthlyDealsAnalyzed"],
                      ["Score", "score"],
                      ["Confidence", "confidence"],
                      ["Eligible", "eligible"],
                      ["Excluded", "excluded"],
                      ["Oracle", "oracle"],
                      ["Median Error", "oracle"],
                      ["Auto Yield", "yield"],
                      ["User Yield", "yield"],
                      ["Delta", "yield"],
                    ].map(([label, key]) => (
                      <th key={`${label}-${key}`} className="py-2 pr-3 text-left font-medium">
                        <button className="inline-flex items-center gap-1" onClick={() => changeSort(key)}>
                          {label}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.userId} className="border-b border-border/60" data-testid={`row-full-leaderboard-${entry.rank}`}>
                      <td className="py-2 pr-3 font-mono">#{entry.rank}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{entry.name}</div>
                        {entry.provisional && <Badge variant="outline" className="mt-1 text-[10px]">Provisional</Badge>}
                      </td>
                      <td className="py-2 pr-3 font-mono">{entry.totalDealsAnalyzed}</td>
                      <td className="py-2 pr-3 font-mono">{entry.monthlyDealsAnalyzed}</td>
                      <td className="py-2 pr-3 font-mono">{formatScore(entry.leaderboardScore)}</td>
                      <td className="py-2 pr-3 font-mono">{formatPercent(entry.avgAnalysisConfidenceScore, 100)}</td>
                      <td className="py-2 pr-3 font-mono">{entry.eligibleAnalysisCount}</td>
                      <td className="py-2 pr-3 font-mono">{entry.excludedAnalysisCount}</td>
                      <td className="py-2 pr-3 font-mono">{formatScore(entry.oracleScore)}</td>
                      <td className="py-2 pr-3 font-mono">{formatPercent(entry.oracleMedianError, 100)}</td>
                      <td className="py-2 pr-3 font-mono">{formatPercent(entry.autoUnderwrittenAvgYield)}</td>
                      <td className="py-2 pr-3 font-mono">{formatPercent(entry.userUnderwrittenAvgYield)}</td>
                      <td className="py-2 pr-3 font-mono">{formatPercent(entry.userVsAutoYieldDelta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data ? `${data.totalCount} users · page ${data.page} of ${Math.max(data.totalPages, 1)}` : ""}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={!data || page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
