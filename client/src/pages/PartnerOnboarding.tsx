import { useState, useMemo } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import { useLocation } from "wouter";
import { Handshake, CheckCircle, PenTool, ArrowRight, Loader2, Kanban, Mail } from "lucide-react";
import {
  REAL_ESTATE_BOARDS,
  buildReferralAgreement,
  getReferralTerms,
  isNetworkPartnerType,
  type NetworkPartnerType,
} from "@shared/partnerNetwork";

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

function partnerTypeFromQuery(): NetworkPartnerType {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("type");
  return isNetworkPartnerType(requested) ? requested : "realtor";
}

export default function PartnerOnboarding() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [partnerType, setPartnerType] = useState<NetworkPartnerType>(partnerTypeFromQuery);
  const [brokerageName, setBrokerageName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [realEstateBoard, setRealEstateBoard] = useState("");
  const [marketCity, setMarketCity] = useState("");
  const [marketRegion, setMarketRegion] = useState("");
  const [signedName, setSignedName] = useState("");
  const [joined, setJoined] = useState(false);

  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  const terms = getReferralTerms(partnerType);
  const isRealtor = partnerType === "realtor";

  const agreementPreview = useMemo(() => {
    return buildReferralAgreement({
      partnerType,
      signedName: signedName.trim() || "[Your full legal name]",
      brokerageName: brokerageName.trim() || "[Your brokerage]",
      marketCity: marketCity.trim() || "[Market city]",
      marketRegion: marketRegion || "[Province]",
      realEstateBoard: isRealtor ? realEstateBoard || null : null,
      licenseNumber: licenseNumber.trim() || null,
      signedAtIso: new Date().toISOString(),
    }).text;
  }, [partnerType, signedName, brokerageName, marketCity, marketRegion, realEstateBoard, licenseNumber, isRealtor]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/partner-network/join", {
        partnerType,
        marketCity: marketCity.trim(),
        marketRegion,
        realEstateBoard: isRealtor && realEstateBoard ? realEstateBoard : undefined,
        brokerageName: brokerageName.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        signedName: signedName.trim(),
        signatureDataUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      setJoined(true);
      window.scrollTo({ top: 0 });
    },
    onError: (error: Error) => {
      toast({ title: "Could not complete signup", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!brokerageName.trim()) {
      toast({ title: "Brokerage required", description: isRealtor ? "Enter your brokerage name." : "Enter your brokerage/company name.", variant: "destructive" });
      return;
    }
    if (!marketCity.trim() || !marketRegion) {
      toast({ title: "Market required", description: "Enter the city and province you serve.", variant: "destructive" });
      return;
    }
    if (isRealtor && !realEstateBoard) {
      toast({ title: "Board required", description: "Select your real estate board.", variant: "destructive" });
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
    joinMutation.mutate();
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
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Handshake className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4" data-testid="text-login-required">Create your free account first</h1>
            <p className="text-muted-foreground mb-6">
              Your Realist account is your partner login: it's where your leads, CRM, and email alerts live. Sign in or create an account to continue — it takes 30 seconds.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => (window.location.href = authPath("/create-account"))} data-testid="button-create-account">
                Create Account
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = authPath("/login"))} data-testid="button-sign-in">
                Sign In
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-16">
          <div className="max-w-lg mx-auto px-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4" data-testid="text-joined-title">You're in the network!</h1>
            <p className="text-muted-foreground mb-8">
              You've claimed <strong>{marketCity}, {marketRegion}</strong>. When investors analyze deals in your market,
              you'll get an email alert and the lead will land in your partner portal. A copy of your signed agreement
              is on its way to your inbox.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Button size="lg" onClick={() => navigate("/partner/network")} data-testid="button-goto-network">
                <Mail className="mr-2 h-4 w-4" />
                View My Leads
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/crm")} data-testid="button-goto-crm">
                <Kanban className="mr-2 h-4 w-4" />
                Open My CRM
              </Button>
            </div>
            {isRealtor && (
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => navigate("/partner/listings")}
                data-testid="button-goto-listings-feed"
              >
                Bonus: put your listings in front of investors — connect your IDX feed →
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Partner Onboarding - Realist.ca"
        description="Claim your market, sign the referral agreement, and start receiving investor leads."
        canonicalUrl="/partner/onboarding"
      />

      <main className="py-10">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="text-center">
            <Badge variant="secondary" className="mb-3">
              <Handshake className="h-3 w-3 mr-1" />
              Partner Onboarding
            </Badge>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-onboarding-title">Claim your market</h1>
            <p className="text-muted-foreground">
              No monthly fees. {terms.feePercent}% referral fee only when a referred deal {terms.successEvent}.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>1. Who you are</CardTitle>
              <CardDescription>Tell investors (and us) who they're working with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>I am a</Label>
                <div className="flex gap-2 mt-2">
                  <Badge
                    variant={isRealtor ? "default" : "outline"}
                    className="cursor-pointer px-4 py-2"
                    onClick={() => setPartnerType("realtor")}
                    data-testid="select-type-realtor"
                  >
                    Realtor
                  </Badge>
                  <Badge
                    variant={!isRealtor ? "default" : "outline"}
                    className="cursor-pointer px-4 py-2"
                    onClick={() => setPartnerType("mortgage_broker")}
                    data-testid="select-type-mortgage-broker"
                  >
                    Mortgage Broker
                  </Badge>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brokerage">{isRealtor ? "Brokerage *" : "Brokerage / Company *"}</Label>
                  <Input
                    id="brokerage"
                    value={brokerageName}
                    onChange={(e) => setBrokerageName(e.target.value)}
                    placeholder={isRealtor ? "Royal LePage" : "Dominion Lending"}
                    data-testid="input-brokerage"
                  />
                </div>
                <div>
                  <Label htmlFor="license">License # (optional)</Label>
                  <Input
                    id="license"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder={isRealtor ? "Registration number" : "Provincial license number"}
                    data-testid="input-license"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(416) 555-0123"
                    data-testid="input-phone"
                  />
                </div>
                {isRealtor && (
                  <div>
                    <Label>Real Estate Board *</Label>
                    <Select value={realEstateBoard} onValueChange={setRealEstateBoard}>
                      <SelectTrigger data-testid="select-board">
                        <SelectValue placeholder="Select your board" />
                      </SelectTrigger>
                      <SelectContent>
                        {REAL_ESTATE_BOARDS.map((board) => (
                          <SelectItem key={board} value={board}>{board}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Your market</CardTitle>
              <CardDescription>You'll receive leads from investors analyzing deals here.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="marketCity">City *</Label>
                  <Input
                    id="marketCity"
                    value={marketCity}
                    onChange={(e) => setMarketCity(e.target.value)}
                    placeholder="Hamilton"
                    data-testid="input-market-city"
                  />
                </div>
                <div>
                  <Label>Province *</Label>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Referral agreement</CardTitle>
              <CardDescription>
                {terms.feePercent}% of your compensation on {isRealtor ? "closed" : "funded"} referred deals, payable to{" "}
                {terms.payeeName}, {terms.payeeCompany}. No monthly fees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre
                className="text-xs text-muted-foreground bg-muted/30 border rounded-lg p-4 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed"
                data-testid="text-agreement-preview"
              >
                {agreementPreview}
              </pre>
              <div>
                <Label htmlFor="signedName">Full legal name *</Label>
                <Input
                  id="signedName"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder="Jane Smith"
                  data-testid="input-signed-name"
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
                onClick={handleSubmit}
                disabled={joinMutation.isPending}
                data-testid="button-join-network"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Sign & Join the Network
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By signing you agree to the referral agreement above (version stored with your signature).
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
