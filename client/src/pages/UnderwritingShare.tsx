/**
 * Account-gated underwriting share view — /underwriting/:token.
 *
 * Anonymous visitors see a TEASER (address, city, verdict, sharer name) plus
 * a create-account / sign-in wall. Full metrics, assumptions, and notes
 * require an authenticated session; the server records acceptance on the
 * first authenticated non-owner view and logs a share_accepted event.
 *
 * Ported from the idx app's UnderwritingSharePage, adapted to wouter, shadcn,
 * the live session auth, and the gate requirement.
 */

import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { authPath } from "@/lib/authReturn";
import { Lock, LogIn, UserPlus } from "lucide-react";

interface ShareTeaser {
  address: string;
  city: string | null;
  province: string | null;
  verdict: string | null;
  sharedBy: string;
}

interface SharePayload {
  success: boolean;
  gated: boolean;
  isOwner?: boolean;
  cta?: string;
  analysis: ShareTeaser & {
    id?: string;
    propertyType?: string | null;
    listingPrice?: number | null;
    metrics?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
    notes?: string | null;
    summary?: string | null;
    analyzedAt?: string;
  };
}

const VERDICT_LABELS: Record<string, string> = {
  submit: "Strong — submit",
  negotiate: "Negotiate",
  watch: "Watch",
  pass: "Pass",
};

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000
      ? new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value)
      : new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getEntries(record?: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(record || {}).filter(([, value]) => value != null && value !== "").slice(0, 12);
}

export default function UnderwritingShare() {
  const { token = "" } = useParams<{ token: string }>();
  const returnPath = `/underwriting/${token}`;

  const { data: share, isLoading, isError } = useQuery<SharePayload>({
    queryKey: [`/api/underwriting-shares/${token}`],
    enabled: !!token,
    retry: 1,
  });

  const teaser = share?.analysis;
  const locationLine = teaser ? [teaser.city, teaser.province].filter(Boolean).join(", ") : "";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Shared Underwriting | Realist.ca"
        description="Review a shared property underwriting and challenge the assumptions on Realist.ca."
      />
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
          </div>
        ) : isError || !share || !teaser ? (
          <Card className="max-w-md mx-auto mt-12" data-testid="card-share-error">
            <CardContent className="p-6 text-center">
              <h1 className="text-lg font-semibold mb-2">Share unavailable</h1>
              <p className="text-sm text-muted-foreground mb-4">
                This underwriting share is no longer available.
              </p>
              <Link href="/tools/analyzer">
                <Button>Analyze a deal on Realist.ca</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Teaser header — visible to everyone */}
            <section data-testid="share-hero">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-2">
                Shared underwriting
              </p>
              <h1 className="text-3xl font-bold mb-1">{teaser.address}</h1>
              {locationLine && <p className="text-lg text-muted-foreground">{locationLine}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {teaser.verdict && (
                  <Badge variant="secondary" data-testid="badge-share-verdict">
                    {VERDICT_LABELS[teaser.verdict] || formatLabel(teaser.verdict)}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Shared by <span className="font-medium text-foreground">{teaser.sharedBy}</span>
                </span>
              </div>
            </section>

            {share.gated ? (
              /* Account wall — anonymous visitors stop here */
              <Card className="border-primary/30" data-testid="card-share-gate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="h-5 w-5 text-primary" />
                    Create a free account to see the full underwriting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {teaser.sharedBy} shared their full deal model — rent, expenses, financing,
                    cash flow, and every assumption behind the{" "}
                    {teaser.verdict ? `"${VERDICT_LABELS[teaser.verdict] || teaser.verdict}" verdict` : "verdict"}.
                    Sign in or create a free Realist account to review it and challenge the numbers.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href={authPath("/create-account", returnPath)}>
                      <Button className="w-full sm:w-auto gap-2" data-testid="button-share-create-account">
                        <UserPlus className="h-4 w-4" />
                        Create free account
                      </Button>
                    </Link>
                    <Link href={authPath("/login", returnPath)}>
                      <Button variant="outline" className="w-full sm:w-auto gap-2" data-testid="button-share-login">
                        <LogIn className="h-4 w-4" />
                        Sign in
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Full payload — authenticated viewers */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card data-testid="card-share-metrics">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Key metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getEntries(share.analysis.metrics).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No metrics were shared.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {getEntries(share.analysis.metrics).map(([key, value]) => (
                            <div key={key} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5">
                              <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
                              <span className="text-sm font-semibold">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-share-assumptions">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Assumptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getEntries(share.analysis.inputs).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No inputs were shared.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {getEntries(share.analysis.inputs).map(([key, value]) => (
                            <div key={key} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5">
                              <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
                              <span className="text-sm font-semibold">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {share.analysis.notes && (
                  <Card data-testid="card-share-notes">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Owner notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{share.analysis.notes}</p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10" data-testid="card-share-cta">
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">
                        {share.cta || "Challenge my underwriting."}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Think the rent, vacancy, or expenses are off? Run your own numbers and compare.
                      </p>
                    </div>
                    <Link href="/tools/analyzer">
                      <Button size="lg" className="shrink-0" data-testid="button-share-analyze">
                        Run your own analysis
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
