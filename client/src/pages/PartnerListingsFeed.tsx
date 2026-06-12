import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { SignaturePad } from "@/components/SignaturePad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import { format } from "date-fns";
import { Globe, Building2, PenTool, RefreshCw, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import {
  REAL_ESTATE_BOARDS,
  buildIdxFeedAgreement,
  type ListingFeedType,
} from "@shared/partnerNetwork";
import type { PartnerListing, PartnerListingFeed } from "@shared/schema";

function feedStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="gap-1"><CheckCircle className="h-3 w-3" />Active</Badge>;
    case "awaiting_provisioning":
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Awaiting provisioning</Badge>;
    case "error":
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PartnerListingsFeed() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [feedType, setFeedType] = useState<ListingFeedType>("own_idx_site");
  const [idxSiteUrl, setIdxSiteUrl] = useState("");
  const [boardName, setBoardName] = useState("");
  const [signedName, setSignedName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  const { data, isLoading } = useQuery<{ feeds: PartnerListingFeed[]; listings: PartnerListing[] }>({
    queryKey: ["/api/partner-network/listing-feeds"],
    enabled: isAuthenticated,
  });
  const feeds = data?.feeds ?? [];
  const listings = data?.listings ?? [];

  const agreementPreview = useMemo(
    () =>
      buildIdxFeedAgreement({
        feedType,
        signedName: signedName.trim() || "[Your full legal name]",
        brokerageName: "",
        realEstateBoard: boardName || null,
        idxSiteUrl: feedType === "own_idx_site" ? idxSiteUrl.trim() || null : null,
        signedAtIso: new Date().toISOString(),
      }).text,
    [feedType, signedName, boardName, idxSiteUrl],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/partner-network/listing-feeds", {
        feedType,
        idxSiteUrl: feedType === "own_idx_site" ? idxSiteUrl.trim() : undefined,
        boardName: boardName || undefined,
        signedName: signedName.trim(),
        signatureDataUrl,
      });
      return res.json() as Promise<{ feed: PartnerListingFeed; sync: { imported: number } | null }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-network/listing-feeds"] });
      if (result.feed.feedType === "repliers_idx") {
        toast({
          title: "Feed request received",
          description: "We'll confirm licensing and any data costs with you before your feed goes live.",
        });
      } else {
        toast({
          title: "Feed connected",
          description:
            result.sync && result.sync.imported > 0
              ? `Imported ${result.sync.imported} listings from your site.`
              : "We couldn't find structured listings on that page yet — check the import status below.",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not set up feed", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (feedId: string) => {
      const res = await apiRequest("POST", `/api/partner-network/listing-feeds/${feedId}/sync`);
      return res.json() as Promise<{ imported: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-network/listing-feeds"] });
      toast({ title: "Sync complete", description: `${result.imported} listings imported.` });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (feedType === "own_idx_site" && !idxSiteUrl.trim()) {
      toast({ title: "URL required", description: "Enter your IDX listings page URL.", variant: "destructive" });
      return;
    }
    if (!signedName.trim()) {
      toast({ title: "Name required", description: "Enter your full legal name to sign.", variant: "destructive" });
      return;
    }
    if (!signatureDataUrl) {
      toast({ title: "Signature required", description: "Please draw your signature.", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-16">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">Sign in to manage your listings feed.</p>
            <Button onClick={() => (window.location.href = authPath("/login"))}>Sign In</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Your Listings on Realist - Partner Listing Feed"
        description="Connect your IDX listings feed and showcase your listings to Realist investors with full attribution."
        canonicalUrl="/partner/listings"
      />

      <main className="py-10">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-listings-feed-title">Your listings on Realist</h1>
            <p className="text-muted-foreground">
              Put your inventory in front of active investors. Every listing shows your name, contact info, and your
              listing brokerage — exactly as board rules require.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : feeds.length > 0 ? (
            <>
              {feeds.map((feed) => (
                <Card key={feed.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {feed.feedType === "own_idx_site" ? <Globe className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                        {feed.feedType === "own_idx_site" ? "Your IDX website" : "Licensed IDX/VOW feed (Repliers)"}
                      </CardTitle>
                      {feedStatusBadge(feed.status)}
                    </div>
                    <CardDescription>
                      {feed.feedType === "own_idx_site"
                        ? feed.idxSiteUrl
                        : feed.status === "awaiting_provisioning"
                          ? "We're confirming licensing and any data costs — you'll hear from us before anything is charged."
                          : feed.boardName || ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span>{feed.listingsImported} listings imported</span>
                      {feed.lastSyncAt && <span>Last sync {format(new Date(feed.lastSyncAt), "MMM d, h:mm a")}</span>}
                      {feed.lastSyncStatus === "no_listings_found" && (
                        <span className="text-amber-600">
                          No structured listings found on that page — try your main listings/search results page.
                        </span>
                      )}
                      {feed.lastSyncError && <span className="text-destructive">{feed.lastSyncError}</span>}
                    </div>
                    {feed.feedType === "own_idx_site" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncMutation.mutate(feed.id)}
                        disabled={syncMutation.isPending}
                        data-testid={`button-sync-feed-${feed.id}`}
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        )}
                        Sync now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Imported listings ({listings.length})</CardTitle>
                  <CardDescription>
                    Shown to investors with: "Listing provided by you via IDX" + your contact info + the listing brokerage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {listings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active listings imported yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Brokerage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listings.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.address || l.mlsNumber || "—"}</TableCell>
                            <TableCell>{l.city || "—"}</TableCell>
                            <TableCell>{l.listPrice ? `$${Math.round(l.listPrice).toLocaleString()}` : "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{l.listingBrokerage || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Card
                  className={`cursor-pointer transition-colors ${feedType === "own_idx_site" ? "border-primary" : ""}`}
                  onClick={() => setFeedType("own_idx_site")}
                  data-testid="card-feed-own-site"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-5 w-5 text-primary" />
                      I already have an IDX website
                    </CardTitle>
                    <CardDescription>
                      Point us at your listings page and we'll import your listings automatically. Free, live today.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card
                  className={`cursor-pointer transition-colors ${feedType === "repliers_idx" ? "border-primary" : ""}`}
                  onClick={() => setFeedType("repliers_idx")}
                  data-testid="card-feed-repliers"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-5 w-5 text-primary" />
                      Set up a licensed IDX/VOW feed
                    </CardTitle>
                    <CardDescription>
                      We provision a board-licensed feed through Repliers with Valery Real Estate. Data costs (if any)
                      are confirmed with you first.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {feedType === "own_idx_site" ? "Connect your IDX website" : "Request your licensed feed"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedType === "own_idx_site" && (
                    <div>
                      <Label htmlFor="idxUrl">Your IDX listings page URL *</Label>
                      <Input
                        id="idxUrl"
                        value={idxSiteUrl}
                        onChange={(e) => setIdxSiteUrl(e.target.value)}
                        placeholder="https://yoursite.ca/listings"
                        data-testid="input-idx-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use the page that lists your properties. We read the structured data your IDX provider already
                        publishes — nothing to install.
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>Real estate board (optional)</Label>
                    <Select value={boardName} onValueChange={setBoardName}>
                      <SelectTrigger data-testid="select-feed-board">
                        <SelectValue placeholder="Select your board" />
                      </SelectTrigger>
                      <SelectContent>
                        {REAL_ESTATE_BOARDS.map((board) => (
                          <SelectItem key={board} value={board}>{board}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <pre
                    className="text-xs text-muted-foreground bg-muted/30 border rounded-lg p-4 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed"
                    data-testid="text-idx-agreement-preview"
                  >
                    {agreementPreview}
                  </pre>

                  <div>
                    <Label htmlFor="feedSignedName">Full legal name *</Label>
                    <Input
                      id="feedSignedName"
                      value={signedName}
                      onChange={(e) => setSignedName(e.target.value)}
                      placeholder="Jane Smith"
                      data-testid="input-feed-signed-name"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Draw your signature *
                    </Label>
                    <SignaturePad onChange={setSignatureDataUrl} />
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    data-testid="button-create-feed"
                  >
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {feedType === "own_idx_site" ? "Sign & Import My Listings" : "Sign & Request Feed"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
