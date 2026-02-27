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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
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
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-16">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Handshake className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4" data-testid="text-login-required">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to access the Realtor Partner Network and start receiving investor leads.
            </p>
            <Button onClick={() => window.location.href = "/login"} data-testid="button-sign-in">
              Sign In
            </Button>
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
            <Tabs defaultValue="markets" className="space-y-6">
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
    { icon: Handshake, title: "25% referral fee on closed deals", description: "Simple, transparent compensation. No upfront costs to join." },
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
    </div>
  );
}

function ClaimMarketForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [marketCity, setMarketCity] = useState("");
  const [marketRegion, setMarketRegion] = useState("");
  const [signedName, setSignedName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

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

  const claimMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/realtor-network/claim-market", {
        marketCity,
        marketRegion,
        signedName,
        signatureDataUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/my-claims"] });
      toast({ title: "Market Claimed!", description: `You've claimed ${marketCity}, ${marketRegion}. You'll receive leads from this area.` });
      setMarketCity("");
      setMarketRegion("");
      setSignedName("");
      clearSignature();
    },
    onError: () => {
      toast({ title: "Failed to claim market", description: "Please try again or contact support.", variant: "destructive" });
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
    if (!signedName.trim()) {
      toast({ title: "Name Required", description: "Please enter your full legal name.", variant: "destructive" });
      return;
    }
    if (!signatureDataUrl) {
      toast({ title: "Signature Required", description: "Please draw your signature.", variant: "destructive" });
      return;
    }
    claimMutation.mutate();
  };

  return (
    <Card data-testid="card-claim-market">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Claim a Market
        </CardTitle>
        <CardDescription>
          Select a city and province to start receiving investor leads in that area.
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
              Referral Agreement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-referral-agreement">
              I agree to pay a 25% referral fee to Realist.ca on all transactions that result from leads received through this platform.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="signedName">Full Legal Name</Label>
          <Input
            id="signedName"
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
          onClick={handleSubmit}
          disabled={claimMutation.isPending}
          data-testid="button-claim-market"
        >
          {claimMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <PenTool className="h-4 w-4 mr-2" />
              Sign Agreement & Claim Market
            </>
          )}
        </Button>
      </CardContent>
    </Card>
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

  const claimLeadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("POST", `/api/realtor-network/claim-lead/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/my-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/realtor-network/introductions"] });
      toast({ title: "Lead Claimed!", description: "A formal introduction has been sent to the investor." });
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
