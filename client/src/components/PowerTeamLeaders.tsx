/**
 * Power Team leaders — per-trade contributor leaderboard (30-day window).
 * Renders GET /api/leaderboard/by-trade as trade tabs. Shows nothing until
 * there are notes to rank, so it's safe to mount before the program has volume.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Trophy } from "lucide-react";
import { verificationBadge, type VerificationStatus } from "@shared/professionalProfiles";

type Leader = {
  userId: string;
  name: string;
  notes: number;
  endorsements: number;
  score: number;
  verificationStatus: VerificationStatus | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  architecture: "Architects",
  urban_planning: "Planners",
  construction: "Builders",
  mortgage: "Mortgage pros",
  realtor: "Realtors",
  property_management: "Property managers",
  appraisal: "Appraisers",
  inspection: "Inspectors",
  legal: "Lawyers",
  accounting_tax: "Accountants",
  investor: "Investors",
  other: "Other trades",
};

const label = (cat: string) => CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ");

export function PowerTeamLeaders() {
  const { data } = useQuery<{ windowDays: number; byTrade: Record<string, Leader[]> }>({
    queryKey: ["/api/leaderboard/by-trade"],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const trades = useMemo(() => Object.keys(data?.byTrade ?? {}).sort((a, b) => label(a).localeCompare(label(b))), [data]);
  const [active, setActive] = useState<string | null>(null);
  const current = active && data?.byTrade[active] ? active : trades[0];

  if (!data || !trades.length) return null;
  const leaders = current ? data.byTrade[current] : [];

  return (
    <section className="mt-16">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Power Team leaders</h2>
        <span className="text-sm text-muted-foreground">last {data.windowDays} days</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {trades.map((t) => (
          <Button key={t} size="sm" variant={current === t ? "default" : "outline"} onClick={() => setActive(t)}>
            {label(t)}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {leaders.map((l, i) => {
            const badge = l.verificationStatus ? verificationBadge(l.verificationStatus) : null;
            return (
              <div key={l.userId} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center font-semibold text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.name}</span>
                    {badge?.tone === "green" && (
                      <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.notes} note{l.notes === 1 ? "" : "s"} · {l.endorsements} endorsement{l.endorsements === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
