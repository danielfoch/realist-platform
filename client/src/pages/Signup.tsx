import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, TrendingUp, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Signup() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<"investor" | "professional" | null>(null);

  const createProfileMutation = useMutation({
    mutationFn: async (role: "investor" | "professional") => {
      if (role === "investor") {
        return apiRequest("POST", "/api/investor/profile", {});
      } else {
        const response = await fetch("/api/subscription", { credentials: "include" });
        if (!response.ok) throw new Error("Failed to create subscription");
        return response.json();
      }
    },
    onSuccess: (_, role) => {
      if (role === "investor") {
        queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
        setLocation("/investor");
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        setLocation("/professional/dashboard");
      }
      toast({ title: "Welcome! Your profile has been created." });
    },
    onError: () => {
      toast({ title: "Failed to create profile", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  const handleRoleSelect = (role: "investor" | "professional") => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (selectedRole) {
      createProfileMutation.mutate(selectedRole);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-8 md:py-12">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="py-8 md:py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-signup-title">
              Welcome to Realist.ca, {user?.firstName || "there"}!
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Let's personalize your experience. Tell us how you'll be using Realist.ca.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              className={`cursor-pointer transition-all hover-elevate ${
                selectedRole === "investor" 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-muted-foreground/50"
              }`}
              onClick={() => handleRoleSelect("investor")}
              data-testid="card-role-investor"
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedRole === "investor" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">Real Estate Investor</CardTitle>
                    <CardDescription>I want to analyze deals for my portfolio</CardDescription>
                  </div>
                  {selectedRole === "investor" && (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Analyze unlimited investment properties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Build and track your property portfolio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Access cashback programs in your province</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Export professional analysis reports</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover-elevate ${
                selectedRole === "professional" 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-muted-foreground/50"
              }`}
              onClick={() => handleRoleSelect("professional")}
              data-testid="card-role-professional"
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedRole === "professional" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">Real Estate Professional</CardTitle>
                    <CardDescription>Realtor, mortgage broker, or industry partner</CardDescription>
                  </div>
                  {selectedRole === "professional" && (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Generate branded PDF reports for clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Custom company logo and contact info</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Become a Featured Market Expert</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building className="w-4 h-4 mt-0.5 text-primary" />
                    <span>Host local investor meetups</span>
                  </li>
                </ul>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Subscription tiers:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-muted px-2 py-1 rounded">Free: 5 pulls/mo</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">$10/mo: 25 pulls</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">$25/mo: Unlimited</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              disabled={!selectedRole || createProfileMutation.isPending}
              onClick={handleContinue}
              className="min-w-[200px] gap-2"
              data-testid="button-continue-signup"
            >
              {createProfileMutation.isPending ? (
                "Creating your profile..."
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            You can change your preferences anytime in settings
          </p>
        </div>
      </main>
    </div>
  );
}
