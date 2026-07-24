import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import { Loader2 } from "lucide-react";
import { createJvListingSchema, jvPartnerRoleLabels } from "@shared/jvPartnerMatching";
import { jvPartnerRoles, type JvPartnerRole } from "@shared/schema";

const provinces = ["ON", "BC", "AB", "QC", "NS", "NB", "MB", "SK", "PE", "NL", "YT", "NT", "NU"];

export default function JvPartnerListing() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [partnerRoleOffered, setPartnerRoleOffered] = useState<JvPartnerRole | "">("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [investmentMin, setInvestmentMin] = useState("");
  const [investmentMax, setInvestmentMax] = useState("");

  const createListingMutation = useMutation({
    mutationFn: async () => {
      const payload = createJvListingSchema.parse({
        title,
        description: description || undefined,
        partnerRoleOffered,
        city: city || undefined,
        province: province || undefined,
        investmentMin: investmentMin ? Number(investmentMin) : undefined,
        investmentMax: investmentMax ? Number(investmentMax) : undefined,
      });
      const response = await apiRequest("POST", "/api/jv-listings", payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Listing Created",
        description: data.matchCount > 0
          ? `We found ${data.matchCount} potential partner match${data.matchCount === 1 ? "" : "es"} for you.`
          : "Your JV partner listing is live.",
      });
      setLocation(`/jv-partners/${data.listing.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Could not create listing",
        description: error?.message || "Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>You need an account to post a JV partner listing.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setLocation(authPath("/login"))} data-testid="button-login">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Post a JV Partner Listing</CardTitle>
            <CardDescription>
              Tell the community what you bring to a deal. We will match you with
              complementary partners in your area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                createListingMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Development land in Durham Region"
                  required
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the deal, timeline, and who you are looking for..."
                  rows={5}
                  data-testid="input-description"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role You Offer</Label>
                  <Select value={partnerRoleOffered} onValueChange={(v) => setPartnerRoleOffered(v as JvPartnerRole)}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {jvPartnerRoles.map((role) => (
                        <SelectItem key={role} value={role}>{jvPartnerRoleLabels[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Province</Label>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger data-testid="select-province">
                      <SelectValue placeholder="Select a province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Toronto"
                  data-testid="input-city"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="investmentMin">Minimum Investment (CAD)</Label>
                  <Input
                    id="investmentMin"
                    type="number"
                    min={0}
                    value={investmentMin}
                    onChange={(e) => setInvestmentMin(e.target.value)}
                    placeholder="Optional"
                    data-testid="input-investment-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentMax">Maximum Investment (CAD)</Label>
                  <Input
                    id="investmentMax"
                    type="number"
                    min={0}
                    value={investmentMax}
                    onChange={(e) => setInvestmentMax(e.target.value)}
                    placeholder="Optional"
                    data-testid="input-investment-max"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createListingMutation.isPending || !title.trim() || !partnerRoleOffered}
                data-testid="button-submit-jv-listing"
              >
                {createListingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Posting...
                  </>
                ) : (
                  "Post Listing"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
