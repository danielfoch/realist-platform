import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import {
  MapPin, Users, Handshake, PenTool, CheckCircle, Clock,
  ArrowRight, Building, Send, Eye, Loader2, FileText
} from "lucide-react";
import { format } from "date-fns";
import type { RealtorMarketClaim, RealtorLeadNotification, RealtorIntroduction, Lead } from "@shared/schema";

const PROVINCES = [
  "Ontario",
  "British Columbia",
  "Alberta",
  "Quebec",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Prince Edward Island",
];

type NotificationWithLead = RealtorLeadNotification & { lead: Lead };

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new": return "default";
    case "viewed": return "secondary";
    case "claimed": return "outline";
    case "active": return "default";
    case "pending": return "secondary";
    default: return "secondary";
  }
}

export default function RealtorNetwork() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const claimFormRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = usePersistedTab("realtorNetwork.activeTab", "markets", ["markets", "leads", "introductions"]);

  const { data: claims, isLoading: claimsLoading } = useQuery<RealtorMarketClaim[]>({
    queryKey: ["/api/realtor-network/my-claims"],
    enabled: isAuthenticated,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<NotificationWithLead[]>({
    queryKey: ["/api/realtor-network/my-leads"],
    enabled: isAuthenticated && (claims?.length ?? 0) > 0,
  });

  const { data: introductions, isLoading: introsLoading } = useQuery<RealtorIntroduction[]>({
    queryKey: ["/api/realtor-network/introductions"],
    enabled: isAuthenticated && (claims?.length ?? 0) > 0,
  });

  const hasClaims = (claims?.length ?? 0) > 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-8">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Demand first, commitment later: show a professional real investor
    // activity in their market before asking them to sign anything.
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-16">
          <div className="max-w-2xl mx-auto px-4 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Handshake className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold" data-testid="text-login-required">See investor demand in your market</h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Check how many investors are underwriting deals in your city right now — free,
                before you join anything.
              </p>
            </div>
            <MarketDemandLookup />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Ready to receive these leads? Sign in to claim your market.
              </p>
              <Button onClick={() => window.location.href = authPath("/login")} data-testid="button-sign-in">
                Sign In
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-8">
          {!hasClaims && !claimsLoading && <HeroSection onCTA={() => claimFormRef.current?.scrollIntoView({ behavior: "smooth" })} />}

          {hasClaims && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold" data-testid="text-realtor-network-title">
                  Realtor Partner Network
                </h1>
                <p className="text-muted-foreground">
                  Manage your markets, leads, and introductions
                </p>
              </div>
            </div>
          )}

          {hasClaims ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList data-testid="realtor-tabs">
                <TabsTrigger value="markets" data-testid="tab-markets">My Markets</TabsTrigger>
                <TabsTrigger value="leads" data-testid="tab-leads">My Leads</TabsTrigger>
                <TabsTrigger value="introductions" data-testid="tab-introductions">Introductions</TabsTrigger>
              </TabsList>

              <TabsContent value="markets" className="space-y-6">
                <MarketsSection claims={claims!} />
                <div ref={claimFormRef}>
                  <ClaimMarketForm />
                </div>
              </TabsContent>

              <TabsContent value="leads" className="space-y-4">
                <LeadsSection leads={leads} isLoading={leadsLoading} />
              </TabsContent>

              <TabsContent value="introductions" className="space-y-4">
                <IntroductionsSection introductions={introductions} isLoading={introsLoading} />
              </TabsContent>
            </Tabs>
          ) : (
            <div ref={claimFormRef}>
              <ClaimMarketForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function HeroSection({ onCTA }: { onCTA: () => void }) {
  const benefits = [
    { icon: Users, title: "Get matched with investors in your market", description: "Investors using Realist.ca in your city are automatically routed to you." },
    { icon: Handshake, title: "25% referral fee on closed deals", description: "Standard OREA Form 641 referral terms with Valery Real Estate Inc.. No upfront costs." },
    { icon: Send, title: "Formal introductions\u2014no cold calling", description: "We send a warm email introduction between you and the investor." },
  ];

  return (
    <div className="space-y-8" data-testid="section-hero">
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="gap-1" data-testid="badge-network">
          <Handshake className="h-3 w-3" />
          Realtor Partner Network
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold" data-testid="text-hero-title">
          Connect with Real Estate Investors
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Join the Realist.ca Realtor Network and receive qualified investor leads in your market.
          No cold calling. Just warm introductions and closed deals.
        </p>
        <Button size="lg" onClick={onCTA} data-testid="button-hero-cta">
          <ArrowRight className="h-4 w-4 mr-2" />
          Claim Your Market
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {benefits.map((b) => (
          <Card key={b.title} data-testid={`card-benefit-${b.title.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}>
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <b.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <MarketDemandLookup />
    </div>
  );
}

function MarketDemandLookup() {
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [searched, setSearched] = useState<{ city: string; province: string } | null>(null);

  const { data: demand, isLoading } = useQuery<{
    city: string;
    analyses30d: number;
    investors30d: number;
    lastActivityAt: string | null;
  }>({
    queryKey: [`/api/realtor-network/market-demand?city=${encodeURIComponent(searched?.city || "")}&province=${encodeURIComponent(searched?.province || "")}`],
    enabled: Boolean(searched?.city),
  });

  return (
    <Card data-testid="card-market-demand">
      <CardHeader>
        <CardTitle className="text-lg">Investor demand in your market</CardTitle>
        <CardDescription>Live counts from deals underwritten on Realist in the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (city.trim()) setSearched({ city: city.trim(), province });
          }}
        >
          <Input
            placeholder="City — e.g. Hamilton"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="sm:flex-1"
            data-testid="input-demand-city"
          />
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="sm:w-[200px]" data-testid="select-demand-province">
              <SelectValue placeholder="Province (optional)" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!city.trim() || isLoading} data-testid="button-check-demand">
            Check demand
          </Button>
        </form>

        {searched && (
          isLoading ? (
            <p className="text-sm text-muted-foreground">Checking {searched.city}…</p>
          ) : demand ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="demand-results">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-mono">{demand.analyses30d}</p>
                <p className="text-xs text-muted-foreground mt-1">deals analyzed in {demand.city} (30 days)</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-mono">{demand.investors30d}</p>
                <p className="text-xs text-muted-foreground mt-1">active investors</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-mono">
                  {demand.lastActivityAt ? new Date(demand.lastActivityAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">most recent analysis</p>
              </div>
            </div>
          ) : null
        )}
      </CardContent>
    </Card>
  );
}

// Shared referral-agreement copy — shown for transparency at registration,
// signed only at first lead claim.
function ReferralAgreementText() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-referral-agreement">
        The Receiving Brokerage acknowledges receipt of the referral information provided by <strong>Valery Real Estate Inc.</strong> (the "Referring Brokerage") and agrees to offer service to the referred Seller/Buyer. The Receiving Brokerage agrees to inform the Referring Brokerage of the results of this referral and provide documentation of the results including the Listing Agreement, Agreement of Purchase and Sale, and a statement of commission earnings or a copy of the Trade Record Sheet.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The Receiving Brokerage agrees to pay <strong>Valery Real Estate Inc.</strong> upon receipt of commission resulting from this referral, a fee of <strong>25%</strong> of the gross commission earned on any transaction that results from leads received through this platform.
      </p>
    </div>
  );
}

function ClaimMarketForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [marketCity, setMarketCity] = useState("");
  const [marketRegion, setMarketRegion] = useState("");

  const claimMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/realtor-network/claim-market", {
        marketCity,
        marketRegion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/my-claims"] });
      toast({ title: "Market Registered!", description: `You've registered ${marketCity}, ${marketRegion}. You'll be notified when investor leads appear.` });
      setMarketCity("");
      setMarketRegion("");
    },
    onError: () => {
      toast({ title: "Failed to register market", description: "Please try again or contact support.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!marketCity.trim()) {
      toast({ title: "City Required", description: "Please enter a market city.", variant: "destructive" });
      return;
    }
    if (!marketRegion) {
      toast({ title: "Province Required", description: "Please select a province.", variant: "destructive" });
      return;
    }
    claimMutation.mutate();
  };

  return (
    <Card data-testid="card-claim-market">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Register Your Market — Free
        </CardTitle>
        <CardDescription>
          Pick a city and province to get notified about investor leads in that area.
          No signature and no fees to register.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="marketCity">Market City</Label>
            <Input
              id="marketCity"
              value={marketCity}
              onChange={(e) => setMarketCity(e.target.value)}
              placeholder="e.g. Toronto, Vancouver, Calgary"
              data-testid="input-market-city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketRegion">Province</Label>
            <Select value={marketRegion} onValueChange={setMarketRegion}>
              <SelectTrigger data-testid="select-market-region">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              The referral agreement (for later — read it now)
            </CardTitle>
            <CardDescription className="text-xs">
              Based on OREA Form 641. You'll sign this only when you claim your first lead —
              never before you've seen real demand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralAgreementText />
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={claimMutation.isPending}
          data-testid="button-claim-market"
        >
          {claimMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Register Market — Free
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface PendingAgreement {
  claimId: string;
  notificationId: string;
  marketCity: string;
  marketRegion: string;
}

function AgreementSignDialog({
  pending,
  onOpenChange,
  onSigned,
}: {
  pending: PendingAgreement | null;
  onOpenChange: (open: boolean) => void;
  onSigned: (notificationId: string) => void;
}) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signedName, setSignedName] = useState("");

  useEffect(() => {
    if (!pending) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [pending]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCanvasCoords]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCanvasCoords]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    if (canvasRef.current) setSignatureDataUrl(canvasRef.current.toDataURL());
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  }, []);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!pending) throw new Error("nothing pending");
      await apiRequest("POST", "/api/realtor-network/sign-agreement", {
        claimId: pending.claimId,
        signedName,
        signatureDataUrl,
      });
    },
    onSuccess: () => {
      const notificationId = pending!.notificationId;
      toast({ title: "Agreement signed", description: "Claiming your lead now…" });
      setSignedName("");
      clearSignature();
      onOpenChange(false);
      onSigned(notificationId);
    },
    onError: () => {
      toast({ title: "Couldn't sign the agreement", description: "Please try again.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={Boolean(pending)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign the referral agreement for {pending?.marketCity}</DialogTitle>
          <DialogDescription>
            This is the commitment moment: you have a real lead waiting. Signing covers
            {" "}{pending?.marketCity}, {pending?.marketRegion} — 25% referral on closed transactions
            from Realist leads, nothing else.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-4 max-h-48 overflow-y-auto">
          <ReferralAgreementText />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dialogSignedName">Full Legal Name</Label>
          <Input
            id="dialogSignedName"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="Enter your full legal name"
            data-testid="input-signed-name"
          />
        </div>

        <div className="space-y-2">
          <Label>Signature (draw below)</Label>
          <div className="border rounded-md p-1 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full h-[150px] cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              data-testid="canvas-signature"
            />
          </div>
          <Button variant="outline" size="sm" onClick={clearSignature} data-testid="button-clear-signature">
            Clear Signature
          </Button>
        </div>

        <Button
          className="w-full"
          onClick={() => {
            if (!signedName.trim()) {
              toast({ title: "Name Required", description: "Please enter your full legal name.", variant: "destructive" });
              return;
            }
            if (!signatureDataUrl) {
              toast({ title: "Signature Required", description: "Please draw your signature.", variant: "destructive" });
              return;
            }
            signMutation.mutate();
          }}
          disabled={signMutation.isPending}
          data-testid="button-sign-agreement"
        >
          {signMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <PenTool className="h-4 w-4 mr-2" />
              Sign & Claim Lead
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MarketsSection({ claims }: { claims: RealtorMarketClaim[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold" data-testid="text-my-markets-heading">Your Claimed Markets</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {claims.map((claim) => (
          <Card key={claim.id} data-testid={`card-market-${claim.id}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold" data-testid={`text-market-city-${claim.id}`}>
                      {claim.marketCity}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-market-region-${claim.id}`}>
                      {claim.marketRegion}
                    </p>
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(claim.status)} data-testid={`badge-market-status-${claim.id}`}>
                  {claim.status === "active" ? (
                    <><CheckCircle className="h-3 w-3 mr-1" />Active</>
                  ) : (
                    <><Clock className="h-3 w-3 mr-1" />{claim.status}</>
                  )}
                </Badge>
              </div>
              {claim.referralAgreementSignedAt && (
                <p className="text-xs text-muted-foreground mt-3" data-testid={`text-signed-date-${claim.id}`}>
                  Signed: {format(new Date(claim.referralAgreementSignedAt), "MMM d, yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LeadsSection({ leads, isLoading }: { leads: NotificationWithLead[] | undefined; isLoading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingAgreement, setPendingAgreement] = useState<PendingAgreement | null>(null);

  const claimLeadMutation = useMutation({
    // Raw fetch (not apiRequest) so a 409 agreement_required can be handled
    // as a flow step instead of a generic error.
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/realtor-network/claim-lead/${notificationId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.error === "agreement_required") {
        return { agreementRequired: true as const, notificationId, ...data };
      }
      if (!res.ok) throw new Error(data?.error || "Failed to claim lead");
      return data as { success: boolean; crmContactId?: string | null };
    },
    onSuccess: (data: any) => {
      if (data?.agreementRequired) {
        setPendingAgreement({
          claimId: data.claimId,
          notificationId: data.notificationId,
          marketCity: data.marketCity,
          marketRegion: data.marketRegion,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/my-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/introductions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/my-claims"] });
      toast({
        title: "Lead Claimed!",
        description: "Introduction sent. The lead has been added to your CRM.",
        action: data?.crmContactId ? (
          <ToastAction altText="Open in CRM" onClick={() => { window.location.href = `/crm/contacts/${data.crmContactId}`; }}>
            Open in CRM
          </ToastAction>
        ) : undefined,
      });
    },
    onError: () => {
      toast({ title: "Failed to claim lead", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2" data-testid="text-no-leads">No leads yet</h3>
          <p className="text-muted-foreground">
            When investors analyze deals in your claimed market, notifications will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <AgreementSignDialog
        pending={pendingAgreement}
        onOpenChange={(open) => { if (!open) setPendingAgreement(null); }}
        onSigned={(notificationId) => claimLeadMutation.mutate(notificationId)}
      />
      <h2 className="text-xl font-semibold" data-testid="text-my-leads-heading">Lead Notifications</h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((notification) => (
              <TableRow key={notification.id} data-testid={`row-lead-${notification.id}`}>
                <TableCell>
                  <p className="font-medium" data-testid={`text-lead-address-${notification.id}`}>
                    {notification.dealAddress || "Address not specified"}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-lead-city-${notification.id}`}>
                    {notification.dealCity || "\u2014"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm" data-testid={`text-lead-strategy-${notification.id}`}>
                    {notification.dealStrategy || "\u2014"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(notification.status)} data-testid={`badge-lead-status-${notification.id}`}>
                    {notification.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-lead-date-${notification.id}`}>
                    {format(new Date(notification.notifiedAt), "MMM d, yyyy")}
                  </span>
                </TableCell>
                <TableCell>
                  {notification.status === "new" && (
                    <Button
                      size="sm"
                      onClick={() => claimLeadMutation.mutate(notification.id)}
                      disabled={claimLeadMutation.isPending}
                      data-testid={`button-claim-lead-${notification.id}`}
                    >
                      {claimLeadMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function IntroductionsSection({ introductions, isLoading }: { introductions: RealtorIntroduction[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!introductions || introductions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2" data-testid="text-no-introductions">No introductions yet</h3>
          <p className="text-muted-foreground">
            When you claim a lead, a formal introduction email is sent. Those records will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold" data-testid="text-introductions-heading">Introduction Log</h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead Name</TableHead>
              <TableHead>Date Sent</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {introductions.map((intro) => (
              <TableRow key={intro.id} data-testid={`row-intro-${intro.id}`}>
                <TableCell>
                  <p className="font-medium" data-testid={`text-intro-lead-${intro.id}`}>
                    {intro.leadName}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-intro-date-${intro.id}`}>
                    {format(new Date(intro.sentAt), "MMM d, yyyy")}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" data-testid={`badge-intro-status-${intro.id}`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
