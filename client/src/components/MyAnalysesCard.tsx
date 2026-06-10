/**
 * "Your Recent Analyses" — the logged-in user's property_analyses rows with
 * the per-user integrations attached to each row:
 *   - Export to Sheets (per-user Google OAuth; 409 → connect-Google hop)
 *   - Pitch Deck (print-first investor deck at /analyses/:id/deck)
 *   - Share ("Challenge my underwriting" account-gated link)
 *
 * Rendered on My Performance, which is also the OAuth callback landing page
 * (?google=connected|error).
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { SiGoogle } from "react-icons/si";
import { FileSpreadsheet, Link2, Loader2, Presentation, Share2, Unlink } from "lucide-react";

interface MyAnalysis {
  id: string;
  address: string;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  listingPrice: number | null;
  calculatedMetrics: Record<string, unknown> | null;
  createdAt: string;
}

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

async function redirectToGoogleConnect(): Promise<boolean> {
  const res = await fetch("/api/integrations/google/auth-url", { credentials: "include" });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.url) {
    window.location.href = data.url;
    return true;
  }
  return false;
}

export function MyAnalysesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // OAuth callback landing: surface the result once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");
    if (!googleStatus) return;
    if (googleStatus === "connected") {
      toast({ title: "Google connected", description: "Sheets exports now land in your own Google Drive." });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
    } else if (googleStatus === "error") {
      toast({ title: "Google connection failed", description: "Please try connecting again.", variant: "destructive" });
    }
    params.delete("google");
    params.delete("reason");
    const search = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [toast, queryClient]);

  const { data: status } = useQuery<GoogleStatus>({
    queryKey: ["/api/integrations/google/status"],
  });

  const { data: analysesPayload, isLoading } = useQuery<{ success: boolean; data: MyAnalysis[] }>({
    queryKey: ["/api/my/analyses"],
  });
  const analyses = analysesPayload?.data ?? [];

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/integrations/google"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Google account disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect Google account", variant: "destructive" });
    },
  });

  const handleConnect = async () => {
    if (!(await redirectToGoogleConnect())) {
      toast({ title: "Failed to start Google authorization", variant: "destructive" });
    }
  };

  const handleExportSheets = async (analysis: MyAnalysis) => {
    setExportingId(analysis.id);
    try {
      const res = await fetch(`/api/integrations/google/export/${analysis.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourcePage: "/my-performance" }),
      });
      const data = await res.json();

      // Not connected (or connection expired): run the auth-url hop.
      if (res.status === 409 && data.code === "GOOGLE_NOT_CONNECTED") {
        toast({ title: "Connect Google", description: "Connect your Google account, then export again." });
        if (await redirectToGoogleConnect()) return;
        throw new Error("Could not start Google authorization");
      }
      if (!res.ok || !data.url) {
        throw new Error(data.message || data.error || `Export failed (${res.status})`);
      }

      track({ event: "analyzer_exported", format: "sheets" });
      window.open(data.url, "_blank");
      toast({ title: "Spreadsheet created", description: "The analysis was exported to your Google Drive." });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export to Google Sheets.",
        variant: "destructive",
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleShare = async (analysis: MyAnalysis) => {
    setSharingId(analysis.id);
    try {
      const res = await fetch(`/api/my/analyses/${analysis.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source: "my_performance" }),
      });
      const data = await res.json();
      if (!res.ok || !data.shareUrl) {
        throw new Error(data.error || `Share failed (${res.status})`);
      }
      const absoluteUrl = `${window.location.origin}${data.shareUrl}`;
      await navigator.clipboard?.writeText(absoluteUrl);
      track({ event: "deal_shared", analysis_id: analysis.id });
      toast({ title: "Share link copied", description: absoluteUrl });
    } catch (error) {
      toast({
        title: "Share failed",
        description: error instanceof Error ? error.message : "Could not create the share link.",
        variant: "destructive",
      });
    } finally {
      setSharingId(null);
    }
  };

  return (
    <Card data-testid="card-my-analyses">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Your Recent Analyses
            </CardTitle>
            <CardDescription>
              Export to your own Google Drive, build a pitch deck, or share an underwriting challenge.
            </CardDescription>
          </div>
          {status?.configured && (
            status.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <SiGoogle className="h-3 w-3" />
                  {status.email || "Google connected"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-google"
                >
                  {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={handleConnect} data-testid="button-connect-google">
                <Link2 className="h-4 w-4" />
                Connect Google
              </Button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No saved analyses yet — analyze a listing to build your underwriting memory.
          </p>
        ) : (
          <div className="space-y-2">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                data-testid={`row-analysis-${analysis.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate max-w-[280px]">{analysis.address}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[analysis.propertyType, [analysis.city, analysis.province].filter(Boolean).join(", "), formatPrice(analysis.listingPrice)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleExportSheets(analysis)}
                    disabled={exportingId === analysis.id}
                    data-testid={`button-export-sheets-${analysis.id}`}
                  >
                    {exportingId === analysis.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Export to Sheets
                  </Button>
                  <Link href={`/analyses/${analysis.id}/deck`}>
                    <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-pitch-deck-${analysis.id}`}>
                      <Presentation className="h-4 w-4" />
                      Pitch Deck
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleShare(analysis)}
                    disabled={sharingId === analysis.id}
                    data-testid={`button-share-${analysis.id}`}
                  >
                    {sharingId === analysis.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    Share
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
