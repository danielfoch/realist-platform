import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Award, ArrowRight } from "lucide-react";
import {
  EXPERT_CATEGORIES,
  EXPERT_CATEGORY_LABELS,
  type ExpertCategory,
} from "@shared/contributorReputation";

interface ExpertRow {
  userId: string;
  name: string;
  category: ExpertCategory;
  companyName: string | null;
  bio?: string | null;
  headshotUrl: string | null;
  serviceAreas?: string[];
  points: number;
  rank: { key: string; label: string };
}

export default function Experts() {
  const [category, setCategory] = useState<ExpertCategory | "all">("all");
  const [market, setMarket] = useState("");

  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (market.trim()) params.set("market", market.trim());
  const qs = params.toString();

  const { data: experts, isLoading } = useQuery<ExpertRow[]>({
    queryKey: [`/api/experts${qs ? `?${qs}` : ""}`],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Realist Expert Network — Architects, Planners & Real Estate Pros"
        description="Vetted architects, urban planners, mortgage brokers, lawyers and inspectors who contribute field notes to real estate deals on Realist. Ranked by community reputation."
        canonicalUrl="/experts"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
          <Badge variant="secondary" className="mb-4">Expert Network</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-experts-title">
            The experts behind the deals.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Architects, planners, mortgage brokers, lawyers and inspectors who add professional field notes to Realist
            deals — ranked by the value the community places on their insight.
          </p>
          <Button variant="outline" onClick={() => (window.location.href = "/join/experts")} data-testid="button-join-experts">
            Join the expert network
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="container mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={category === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategory("all")}
            data-testid="filter-category-all"
          >
            All
          </Badge>
          {EXPERT_CATEGORIES.filter((c) => c !== "other").map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c}`}
            >
              {EXPERT_CATEGORY_LABELS[c]}
            </Badge>
          ))}
          <Input
            className="ml-auto max-w-xs"
            placeholder="Filter by market…"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            data-testid="input-market-filter"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : !experts || experts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No experts{category !== "all" ? ` in ${EXPERT_CATEGORY_LABELS[category as ExpertCategory]}` : ""} yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {experts.map((expert, i) => (
              <Link key={expert.userId} href={`/experts/${expert.userId}`}>
                <Card className="cursor-pointer transition-colors hover:border-primary/60" data-testid={`card-expert-${expert.userId}`}>
                  <CardContent className="flex items-start gap-4 pt-5">
                    {i < 3 && (
                      <div className="flex flex-col items-center">
                        <Trophy className={`h-5 w-5 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-amber-700"}`} />
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      </div>
                    )}
                    <Avatar className="h-12 w-12">
                      {expert.headshotUrl && <AvatarImage src={expert.headshotUrl} alt={expert.name} />}
                      <AvatarFallback>{expert.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{expert.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{EXPERT_CATEGORY_LABELS[expert.category]}</Badge>
                      </div>
                      {expert.companyName && <p className="text-sm text-muted-foreground truncate">{expert.companyName}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <Award className="h-3.5 w-3.5" />
                          {expert.rank.label}
                        </span>
                        <span className="text-muted-foreground">{expert.points} pts</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
