import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award, BarChart3, Calendar, MapPin, MessageSquare, ThumbsUp,
  TrendingUp, UserRound, ArrowRight,
} from "lucide-react";

interface PublicProfileData {
  userId: string;
  name: string;
  role: string;
  profileImageUrl: string | null;
  memberSince: string | null;
  badge: { id: string; name: string; threshold: number } | null;
  stats: {
    dealCount: number;
    avgCapRate: number | null;
    lastActiveAt: string | null;
    commentCount: number;
    helpfulCount: number;
  };
  markets: Array<{ city: string; analyses: number }>;
}

const ROLE_LABELS: Record<string, string> = {
  investor: "Investor",
  realtor: "Realtor",
  partner: "Professional",
  mortgage_broker: "Mortgage Broker",
  lender: "Lender",
  contractor: "Contractor",
  inspector: "Inspector",
  architect: "Architect",
  planner: "Planner",
};

function StatTile({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold font-mono">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicProfile() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const { data: profile, isLoading, error } = useQuery<PublicProfileData>({
    queryKey: [`/api/profiles/${userId}`],
    enabled: Boolean(userId),
    retry: false,
  });

  const isProfessional = profile && profile.role !== "investor";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={profile ? `${profile.name} - Realist` : "Profile - Realist"}
        description={profile ? `${profile.name}'s contributions on Realist: ${profile.stats.dealCount} deals analyzed.` : "Realist community member profile."}
        canonicalUrl={`/u/${userId}`}
        noIndex
      />
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        ) : error || !profile ? (
          <div className="text-center py-20 space-y-4">
            <UserRound className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h1 className="text-2xl font-bold">Profile not found</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              This member hasn't shared any public activity yet, or the profile doesn't exist.
            </p>
            <Link href="/community/leaderboard">
              <Button variant="outline" className="gap-2">
                Browse the leaderboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={profile.profileImageUrl || undefined} alt={profile.name} />
                <AvatarFallback className="text-xl">
                  {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-profile-name">{profile.name}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{ROLE_LABELS[profile.role] || profile.role}</Badge>
                  {profile.badge && (
                    <Badge className="gap-1">
                      <Award className="h-3 w-3" />
                      {profile.badge.name}
                    </Badge>
                  )}
                  {profile.memberSince && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Member since {new Date(profile.memberSince).toLocaleDateString("en-CA", { year: "numeric", month: "long" })}
                    </span>
                  )}
                </div>
                {profile.markets.length > 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Active in {profile.markets.map((m) => m.city).join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={BarChart3} label="Deals analyzed" value={String(profile.stats.dealCount)} />
              <StatTile
                icon={TrendingUp}
                label="Avg cap rate"
                value={profile.stats.avgCapRate != null ? `${profile.stats.avgCapRate.toFixed(1)}%` : "—"}
              />
              <StatTile icon={MessageSquare} label="Community comments" value={String(profile.stats.commentCount)} />
              <StatTile icon={ThumbsUp} label="Helpful votes" value={String(profile.stats.helpfulCount)} />
            </div>

            {isProfessional && (
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold">Work with {profile.name.split(" ")[0]}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Request an introduction through the Realist team — we'll connect you directly.
                    </p>
                  </div>
                  <Link href={`/about/contact?about=${encodeURIComponent(`Intro request: ${profile.name}`)}`}>
                    <Button className="gap-2 shrink-0" data-testid="button-request-intro">
                      Request intro
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Profiles show public contributions only — analyses shared with the community and public comments.
              Nothing private is displayed.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
