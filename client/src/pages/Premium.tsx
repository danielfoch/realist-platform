import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown, Check, CreditCard, PenTool, FileText, Shield,
  Users, Calendar, Palette, FileDown, Percent, Loader2,
  ExternalLink, ArrowRight,
} from "lucide-react";
import { usePremiumGate } from "@/hooks/use-premium-gate";

const BENEFITS = [
  { icon: Palette, title: "Custom-Branded Exports", description: "Add your logo, company name, and colors to PDF and Google Sheet exports" },
  { icon: Users, title: "Weekly Calls", description: "Join weekly strategy calls on skool.com/realist with other investors" },
  { icon: Percent, title: "Discounted Events", description: "Get discounted access to all our paid events and workshops" },
  { icon: FileDown, title: "Unlimited Exports", description: "Export unlimited PDF and Google Sheets analysis reports" },
  { icon: Crown, title: "Full Calculator Access", description: "Unlock all calculator features including stress tests, proforma, and advanced metrics" },
];

export default function Premium() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { trackConversion } = usePremiumGate();
  const [showBRA, setShowBRA] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signedName, setSignedName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const searchParams = new URLSearchParams(search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (success === "true") {
      toast({ title: "Welcome to Premium!", description: "Your subscription is now active." });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    }
    if (canceled === "true") {
      toast({ title: "Checkout canceled", description: "No charges were made.", variant: "destructive" });
    }
  }, [success, canceled, toast]);

  const { data: premiumStatus } = useQuery<{
    tier: string;
    isPremium: boolean;
    premiumSource?: string;
    braExpiresAt?: string;
    braExpired?: boolean;
    hasBraSigned?: boolean;
  }>({
    queryKey: ["/api/subscription/status"],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [showBRA]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) setSignatureDataUrl(canvasRef.current.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/checkout", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      trackConversion();
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start checkout. Please try again.", variant: "destructive" });
    },
  });

  const braMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/subscription/claim-bra-premium", {
        signedName,
        signatureDataUrl,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      trackConversion();
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({ title: "Premium Activated!", description: "Your 3-month premium access is now active." });
      if (data.redirectTo) setLocation(data.redirectTo);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to activate premium. Please try again.", variant: "destructive" });
    },
  });

  const handleBRASubmit = () => {
    if (!signedName.trim()) {
      toast({ title: "Name Required", description: "Please enter your full legal name.", variant: "destructive" });
      return;
    }
    if (!signatureDataUrl) {
      toast({ title: "Signature Required", description: "Please sign in the signature box.", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: "Agreement Required", description: "Please agree to the terms.", variant: "destructive" });
      return;
    }
    braMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (premiumStatus?.isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 py-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">You're a Premium Member</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              You have full access to all premium features including custom branding, 
              advanced calculator tools, and weekly calls.
            </p>
            {premiumStatus.premiumSource === "bra" && premiumStatus.braExpiresAt && (
              <p className="text-sm text-muted-foreground">
                Your BRA-based premium expires on {new Date(premiumStatus.braExpiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setLocation("/tools/analyzer")} data-testid="button-go-analyzer">
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Analyzer
              </Button>
              <Button variant="outline" onClick={() => setLocation("/premium/branding")} data-testid="button-customize-branding">
                <Palette className="h-4 w-4 mr-2" />
                Customize Branding
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

      <main className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4" data-testid="badge-premium">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Unlock the Full Power of Realist
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get advanced analysis tools, custom branding, weekly strategy calls, 
            and discounted event access for just $10/month.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex gap-4" data-testid={`benefit-${benefit.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <benefit.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">
            Premium also includes access to our community at{" "}
            <a href="https://skool.com/realist" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              skool.com/realist
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
          </p>
        </div>

        <Separator className="my-10" />

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="relative overflow-visible" data-testid="card-stripe-checkout">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscribe Monthly
              </CardTitle>
              <CardDescription>$10/month, cancel anytime</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold">
                $10<span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2">
                {["All premium features", "Custom-branded exports", "Weekly strategy calls", "Discounted event access", "Cancel anytime"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast({ title: "Sign in required", description: "Please sign in to subscribe.", variant: "destructive" });
                    setLocation("/login");
                    return;
                  }
                  checkoutMutation.mutate();
                }}
                disabled={checkoutMutation.isPending}
                data-testid="button-subscribe-stripe"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Subscribe for $10/month
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-visible border-primary/30" data-testid="card-bra-premium">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Get Premium for Free
              </CardTitle>
              <CardDescription>Sign a 3-month buyer representation agreement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold">
                $0<span className="text-lg font-normal text-muted-foreground">/3 months</span>
              </div>
              <ul className="space-y-2">
                {["All premium features", "Custom-branded exports", "Weekly strategy calls", "Discounted event access", "BuyBox purchase criteria tool"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full"
                variant="outline"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast({ title: "Sign in required", description: "Please sign in to continue.", variant: "destructive" });
                    setLocation("/login");
                    return;
                  }
                  setShowBRA(true);
                }}
                data-testid="button-bra-premium"
              >
                <PenTool className="h-4 w-4 mr-2" />
                Sign BRA & Get Free Premium
              </Button>
            </CardContent>
          </Card>
        </div>

        {showBRA && (
          <div className="mt-12 max-w-3xl mx-auto space-y-6" data-testid="section-bra-signing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Buyer Representation Agreement
                </CardTitle>
                <CardDescription>
                  Sign below to activate your free 3-month premium membership. After 3 months, you can renew or subscribe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <h3>1. PARTIES</h3>
                    <p>
                      <strong>Buyer:</strong> {user?.firstName} {user?.lastName} ({user?.email})<br />
                      <strong>Brokerage:</strong> Valery Real Estate Inc.<br />
                      <strong>Agent:</strong> Daniel Foch (and any referrals, co-brokers, or assigns)
                    </p>

                    <h3>2. EXCLUSIVE AUTHORITY & SCOPE</h3>
                    <p>
                      The Buyer grants the Brokerage exclusive authority to act on behalf of the Buyer 
                      for the purpose of locating, negotiating, and facilitating the purchase of real 
                      property during the Term of this Agreement (3 months).
                    </p>

                    <h3>3. TERM</h3>
                    <p>
                      This Agreement begins on the date of signing and expires 90 days later. 
                      In exchange for signing, the Buyer receives complimentary Premium access 
                      to all Realist.ca tools and features for the duration of the Agreement.
                    </p>

                    <h3>4. COMMISSION & COMPENSATION</h3>
                    <p>
                      The Brokerage is entitled to receive commission from the seller or listing 
                      brokerage. If the seller-offered commission is less than 2.5%, the Buyer 
                      agrees to pay the difference at closing.
                    </p>

                    <h3>5. HOLDOVER PERIOD</h3>
                    <p>
                      If the Buyer purchases a property introduced during the Term within 60 days 
                      after expiry, the commission provisions above shall apply.
                    </p>

                    <h3>6. PREMIUM ACCESS</h3>
                    <p>
                      In consideration of signing this Agreement, the Buyer receives complimentary 
                      access to Realist.ca Premium features including custom branding, weekly strategy 
                      calls, and all advanced analysis tools for the duration of the Term. After expiry, 
                      the Buyer may renew the Agreement or subscribe at $10/month to retain Premium access.
                    </p>

                    <h3>7. ELECTRONIC SIGNATURE</h3>
                    <p>
                      The Buyer agrees that their electronic signature below is legally binding.
                    </p>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="braSignedName">Full Legal Name</Label>
                  <Input
                    id="braSignedName"
                    placeholder="Enter your full legal name"
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    data-testid="input-bra-signed-name"
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
                      data-testid="canvas-bra-signature"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={clearSignature} data-testid="button-clear-bra-signature">
                    Clear Signature
                  </Button>
                </div>

                <div className="flex items-start space-x-3 pt-4">
                  <Checkbox
                    id="braAgreedToTerms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    data-testid="checkbox-bra-agree"
                  />
                  <Label htmlFor="braAgreedToTerms" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the Buyer Representation Agreement above. I understand 
                    this creates a legal agreement for 3 months and grants me free Premium access.
                  </Label>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleBRASubmit}
                  disabled={braMutation.isPending}
                  data-testid="button-submit-bra-premium"
                >
                  {braMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <PenTool className="h-4 w-4 mr-2" />
                      Sign & Activate Premium
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
