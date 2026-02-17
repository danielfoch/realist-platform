import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Palette, Save, Loader2, Crown, ArrowLeft, Eye } from "lucide-react";

export default function PremiumBranding() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [disclaimerText, setDisclaimerText] = useState("");

  const { data: premiumStatus } = useQuery<{ isPremium: boolean }>({
    queryKey: ["/api/subscription/status"],
  });

  const { data: branding, isLoading: brandingLoading } = useQuery<{
    companyName?: string;
    primaryColor?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    disclaimerText?: string;
    logoUrl?: string;
  } | null>({
    queryKey: ["/api/branding"],
    enabled: isAuthenticated && premiumStatus?.isPremium === true,
  });

  useEffect(() => {
    if (branding) {
      setCompanyName(branding.companyName || "");
      setPrimaryColor(branding.primaryColor || "#0f172a");
      setContactEmail(branding.contactEmail || "");
      setContactPhone(branding.contactPhone || "");
      setWebsite(branding.website || "");
      setDisclaimerText(branding.disclaimerText || "");
    }
  }, [branding]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/branding", {
        companyName, primaryColor, contactEmail, contactPhone, website, disclaimerText,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Branding Saved", description: "Your custom branding has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save branding. Premium required.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!premiumStatus?.isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
          <Crown className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Premium Required</h1>
          <p className="text-muted-foreground">
            Custom branding is a premium feature. Upgrade to add your logo, company name, and colors to your exports.
          </p>
          <Button onClick={() => setLocation("/premium")} data-testid="button-upgrade-premium">
            Upgrade to Premium
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="outline" size="icon" onClick={() => setLocation("/premium")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Palette className="h-6 w-6" />
              Custom Branding
            </h1>
            <p className="text-sm text-muted-foreground">Personalize your PDF and Google Sheet exports</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>This information appears on your exported reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company / Brand Name</Label>
                <Input
                  id="companyName"
                  placeholder="Your Company Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-company-name"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    placeholder="(416) 555-0123"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  data-testid="input-website"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look of your exports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Brand Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-32 font-mono"
                    data-testid="input-primary-color-hex"
                  />
                  <div className="flex-1 h-10 rounded-md" style={{ backgroundColor: primaryColor }} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disclaimerText">Custom Disclaimer (optional)</Label>
                <Textarea
                  id="disclaimerText"
                  placeholder="This report is for informational purposes only..."
                  value={disclaimerText}
                  onChange={(e) => setDisclaimerText(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-disclaimer"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>How your branding will appear on exports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border">
                <div className="p-4" style={{ backgroundColor: primaryColor }}>
                  <div className="text-white">
                    <div className="text-xl font-bold">{companyName || "YOUR COMPANY"}</div>
                    <div className="text-sm opacity-80">Real Estate Investment Analysis</div>
                    <div className="text-xs opacity-60 mt-1">
                      {[contactEmail, contactPhone].filter(Boolean).join(" | ") || "contact@company.com"}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-muted/30 text-xs text-muted-foreground">
                  {disclaimerText || "This report is generated by Realist.ca for informational purposes."}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-branding"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Branding
          </Button>
        </div>
      </main>
    </div>
  );
}
