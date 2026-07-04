import { useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown, Check, CreditCard, Users, Palette, FileDown, Percent, Loader2,
  ExternalLink, ArrowRight, KeyRound,
} from "lucide-react";
import { usePremiumGate } from "@/hooks/use-premium-gate";

const BENEFITS = [
  { icon: Palette, title: "Custom-Branded Exports", description: "Add your logo, company name, and colors to PDF and Google Sheet exports" },
  { icon: Users, title: "Weekly Calls", description: "Join weekly strategy calls on skool.com/realist with other investors" },
  { icon: Percent, title: "Discounted Events", description: "Get discounted access to all our paid events and workshops" },
  { icon: FileDown, title: "Unlimited Exports", description: "Export unlimited PDF and Google Sheets analysis reports" },
  { icon: Crown, title: "Full Calculator Access", description: "Unlock all calculator features including stress tests, proforma, and advanced metrics" },
];

// The former "free premium for signing an exclusive BRA" tier was removed
// deliberately: representation is a serious commitment that deserves its own
// honest, lawyer-reviewed flow — not a pricing incentive. Do not reintroduce
// it here without legal review (TRESA/RECO inducement + informed-consent).
export default function Premium() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { trackConversion } = usePremiumGate();

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
            <h1 className="text-3xl md:text-4xl font-bold">You're a Premium Member</h1>
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

      <main className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4" data-testid="badge-premium">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
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

        <div className="max-w-md mx-auto mb-8 rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Prefer we do the work? Realist's team can review your deal and see it through with you —{" "}
          <Link href="/work-with-realist" className="text-primary underline">learn how representation works</Link>.
        </div>

        <div className="max-w-md mx-auto">
          <Card className="relative overflow-visible border-primary/30" data-testid="card-stripe-checkout">
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
                    setLocation(authPath("/login"));
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

          <Card className="mt-8" data-testid="card-mcp-claude">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Use Realist inside Claude
              </CardTitle>
              <CardDescription>
                Realist runs as an MCP server. Mint an API key and Claude can underwrite
                listings, find deals, and pull market reports with your Realist account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full" data-testid="button-mint-api-key">
                <Link href="/account/api-keys">
                  Mint an API key
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
