import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { User, Building, FileCheck, Plus, Trash2, TrendingUp, DollarSign, Home, MapPin, Calculator, ExternalLink, Settings, GitCompare, MoreHorizontal, Search, Compass, Bookmark, ArrowRight, Clock3, Target } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GoogleConnectionCard } from "@/components/GoogleConnectionCard";
import { useState } from "react";
import type { InvestorProfile, InvestorKyc, PortfolioProperty, SavedDeal } from "@shared/schema";
import {
  removeRecentViewedListingSignal,
  removeSavedListingSignal,
  removeSavedSearchSignal,
  type SavedListingSignal,
  type SavedSearchSignal,
} from "@/lib/analytics";

const PROVINCES = [
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "QC", label: "Quebec" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "PE", label: "Prince Edward Island" },
];

const STRATEGY_TYPES = [
  { value: "buy_hold", label: "Buy and Hold" },
  { value: "brrr", label: "BRRR" },
  { value: "flip", label: "Fix and Flip" },
  { value: "airbnb", label: "Airbnb/Short-term Rental" },
  { value: "multiplex", label: "Multiplex" },
];

interface WorkspaceRecommendation {
  id: string;
  score: number;
  title: string;
  reason: string;
  href: string;
  cta: string;
}

interface InvestorWorkspace {
  discovery: {
    savedSearches: SavedSearchSignal[];
    savedListings: SavedListingSignal[];
    recentViewedListings: SavedListingSignal[];
  };
  savedDeals: SavedDeal[];
  recentAnalyses: Array<{
    id: string;
    address: string | null;
    city: string | null;
    province: string | null;
    strategyType: string;
    createdAt: string;
  }>;
  intentSummary: {
    geography: string | null;
    strategy: string | null;
    propertyType: string | null;
    targetBudget: number | null;
    signalCounts: {
      savedSearches: number;
      savedListings: number;
      recentViewedListings: number;
      savedDeals: number;
      analyses: number;
    };
  };
  recommendations: WorkspaceRecommendation[];
  profileCompletion: {
    hasProfile: boolean;
    hasKyc: boolean;
  };
}

function buildSearchHref(search: SavedSearchSignal): string {
  const prompt = [
    search.query,
    search.strategy?.replace(/_/g, " "),
    search.propertyType,
    search.geography,
    search.budgetMax ? `under $${Math.round(search.budgetMax).toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return prompt ? `/tools/cap-rates?q=${encodeURIComponent(prompt)}` : "/tools/cap-rates";
}

function buildAnalyzerHref(listing: SavedListingSignal): string {
  const params = new URLSearchParams();
  if (listing.address) params.set("address", listing.address);
  if (listing.city) params.set("city", listing.city);
  if (listing.price) params.set("price", String(listing.price));
  if (listing.listingId) params.set("mls", listing.listingId);
  return `/tools/analyzer${params.toString() ? `?${params.toString()}` : ""}`;
}

export default function InvestorPortal() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<InvestorProfile | null>({
    queryKey: ["/api/investor/profile"],
    enabled: isAuthenticated,
  });

  const { data: kyc, isLoading: kycLoading } = useQuery<InvestorKyc | null>({
    queryKey: ["/api/investor/kyc"],
    enabled: isAuthenticated,
  });

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<PortfolioProperty[]>({
    queryKey: ["/api/investor/portfolio"],
    enabled: isAuthenticated,
  });

  const { data: savedDeals, isLoading: savedDealsLoading } = useQuery<SavedDeal[]>({
    queryKey: ["/api/user/saved-deals"],
    enabled: isAuthenticated,
  });

  const { data: workspace, isLoading: workspaceLoading } = useQuery<InvestorWorkspace>({
    queryKey: ["/api/user/investor-workspace"],
    enabled: isAuthenticated,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<InvestorProfile>) => 
      apiRequest("PUT", "/api/investor/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const updateKycMutation = useMutation({
    mutationFn: (data: Partial<InvestorKyc>) => 
      apiRequest("PUT", "/api/investor/kyc", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor/kyc"] });
      toast({ title: "KYC information updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update KYC information", variant: "destructive" });
    },
  });

  const addPropertyMutation = useMutation({
    mutationFn: (data: Partial<PortfolioProperty>) => 
      apiRequest("POST", "/api/investor/portfolio", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor/portfolio"] });
      setAddPropertyOpen(false);
      toast({ title: "Property added to portfolio" });
    },
    onError: () => {
      toast({ title: "Failed to add property", variant: "destructive" });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest("DELETE", `/api/investor/portfolio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor/portfolio"] });
      toast({ title: "Property removed from portfolio" });
    },
    onError: () => {
      toast({ title: "Failed to remove property", variant: "destructive" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest("DELETE", `/api/user/saved-deals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved-deals"] });
      toast({ title: "Deal deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete deal", variant: "destructive" });
    },
  });

  const deleteDiscoverySignalMutation = useMutation({
    mutationFn: async ({ signalType, signalKey }: { signalType: string; signalKey: string }) =>
      apiRequest("DELETE", `/api/user/discovery-signals/${signalType}/${encodeURIComponent(signalKey)}`),
    onSuccess: (_, variables) => {
      if (variables.signalType === "saved_search") {
        removeSavedSearchSignal(variables.signalKey);
      } else if (variables.signalType === "saved_listing") {
        removeSavedListingSignal(variables.signalKey);
      } else if (variables.signalType === "recent_viewed_listing") {
        removeRecentViewedListingSignal(variables.signalKey);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/investor-workspace"] });
      toast({ title: "Removed from workspace" });
    },
    onError: () => {
      toast({ title: "Failed to update workspace", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-8">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
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
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4" data-testid="text-login-required">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to access your investor portal and manage your real estate portfolio.
            </p>
            <Button onClick={() => window.location.href = authPath("/login")} data-testid="button-sign-in">
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const portfolioValue = portfolio?.reduce((sum, p) => sum + (p.currentValue || p.purchasePrice || 0), 0) || 0;
  const monthlyRent = portfolio?.reduce((sum, p) => sum + (p.monthlyRent || 0), 0) || 0;
  const monthlyExpenses = portfolio?.reduce((sum, p) => sum + (p.monthlyExpenses || 0), 0) || 0;
  const monthlyCashflow = monthlyRent - monthlyExpenses;
  const savedSearchCount = workspace?.intentSummary.signalCounts.savedSearches || 0;
  const shortlistCount = workspace?.intentSummary.signalCounts.savedListings || 0;
  const savedDealCount = workspace?.intentSummary.signalCounts.savedDeals || savedDeals?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-investor-portal-title">
                Investor Portal
              </h1>
              <p className="text-muted-foreground">
                Welcome back, {user?.firstName || "Investor"}
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {kyc?.isAccreditedInvestor ? "Accredited Investor" : "Retail Investor"}
            </Badge>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card data-testid="stat-saved-searches">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saved Searches</p>
                    <p className="text-2xl font-bold font-mono">{savedSearchCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-shortlist-count">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Bookmark className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shortlist</p>
                    <p className="text-2xl font-bold font-mono">{shortlistCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-saved-deal-count">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saved Analyses</p>
                    <p className="text-2xl font-bold font-mono">{savedDealCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-portfolio-value">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Portfolio Value</p>
                    <p className="text-2xl font-bold font-mono">${portfolioValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="workspace" className="space-y-6">
            <TabsList data-testid="investor-tabs">
              <TabsTrigger value="workspace" data-testid="tab-workspace">Workspace</TabsTrigger>
              <TabsTrigger value="saved-deals" data-testid="tab-saved-deals">Analyses</TabsTrigger>
              <TabsTrigger value="portfolio" data-testid="tab-portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
              <TabsTrigger value="kyc" data-testid="tab-kyc">KYC / Accreditation</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="workspace" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <Card className="border-primary/20 bg-gradient-to-r from-background via-primary/5 to-accent/10">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Compass className="h-4 w-4" />
                          Continue the investor loop
                        </div>
                        <h2 className="text-2xl font-semibold">Two clear paths, one account-backed workspace</h2>
                        <p className="text-muted-foreground">
                          Analyze your own deal when you have an address. Search the map when you want opportunities. Your searches, shortlist, and analyses now feed the same workspace.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link href="/tools/analyzer">
                          <Button className="gap-2" data-testid="button-workspace-analyze">
                            <Calculator className="h-4 w-4" />
                            Use our AI calculator
                          </Button>
                        </Link>
                        <Link href="/tools/cap-rates">
                          <Button variant="outline" className="gap-2" data-testid="button-workspace-search-map">
                            <Search className="h-4 w-4" />
                            Search deals on map
                          </Button>
                        </Link>
                        <Link href="/compare">
                          <Button variant="ghost" className="gap-2" data-testid="button-workspace-compare">
                            <GitCompare className="h-4 w-4" />
                            Compare deals
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Intent Summary</CardTitle>
                    <CardDescription>Structured signals currently driving recommendations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {workspace?.intentSummary.geography && <Badge variant="secondary">{workspace.intentSummary.geography}</Badge>}
                      {workspace?.intentSummary.strategy && <Badge variant="secondary">{workspace.intentSummary.strategy.replace(/_/g, " ")}</Badge>}
                      {workspace?.intentSummary.propertyType && <Badge variant="secondary">{workspace.intentSummary.propertyType}</Badge>}
                      {workspace?.intentSummary.targetBudget && <Badge variant="secondary">Budget ${workspace.intentSummary.targetBudget.toLocaleString()}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{savedSearchCount} saved searches</p>
                      <p>{shortlistCount} shortlisted listings</p>
                      <p>{workspace?.intentSummary.signalCounts.recentViewedListings || 0} recent listing views</p>
                      <p>{workspace?.intentSummary.signalCounts.analyses || 0} recorded analyses</p>
                    </div>
                    {!workspace?.profileCompletion.hasProfile && (
                      <p className="text-sm text-muted-foreground">
                        Completing your profile will sharpen future recommendations and partner routing.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {workspaceLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Recommended Next Steps
                      </CardTitle>
                      <CardDescription>Ranked from your captured search, shortlist, and analysis intent.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workspace?.recommendations.length ? workspace.recommendations.map((recommendation) => (
                        <div key={recommendation.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{recommendation.title}</p>
                              <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
                            </div>
                            <Badge variant="outline">{recommendation.score}</Badge>
                          </div>
                          <Link href={recommendation.href}>
                            <Button variant="outline" size="sm" className="gap-2" data-testid={`button-recommendation-${recommendation.id}`}>
                              {recommendation.cta}
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="font-medium">No recommendations yet</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Run a search or save a listing and this workspace will start ranking your next best action.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Saved Searches
                      </CardTitle>
                      <CardDescription>First-class discovery intents you can reopen or prune.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workspace?.discovery.savedSearches.length ? workspace.discovery.savedSearches.slice(0, 5).map((search) => (
                        <div key={search.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{search.label}</p>
                              <p className="text-sm text-muted-foreground">{search.query || search.geography || "Saved search"}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDiscoverySignalMutation.mutate({ signalType: "saved_search", signalKey: search.id })}
                              data-testid={`button-remove-saved-search-${search.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {search.strategy && <Badge variant="secondary">{search.strategy.replace(/_/g, " ")}</Badge>}
                            {search.propertyType && <Badge variant="secondary">{search.propertyType}</Badge>}
                            {search.budgetMax && <Badge variant="outline">Up to ${search.budgetMax.toLocaleString()}</Badge>}
                          </div>
                          <div className="mt-3">
                            <Link href={buildSearchHref(search)}>
                              <Button variant="outline" size="sm" className="gap-2" data-testid={`button-open-saved-search-${search.id}`}>
                                Open search
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="font-medium">No saved searches yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Save a search from the analyzer or map to build repeat usage.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bookmark className="h-5 w-5" />
                        Shortlist
                      </CardTitle>
                      <CardDescription>Properties worth another look or full underwriting.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workspace?.discovery.savedListings.length ? workspace.discovery.savedListings.slice(0, 5).map((listing) => {
                        const signalKey = listing.listingId || listing.address || listing.id;
                        return (
                          <div key={signalKey} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-medium">{listing.label}</p>
                                <p className="text-sm text-muted-foreground">{listing.address || listing.city || "Saved listing"}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDiscoverySignalMutation.mutate({ signalType: "saved_listing", signalKey })}
                                data-testid={`button-remove-shortlist-${signalKey}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {listing.price && <Badge variant="outline">${listing.price.toLocaleString()}</Badge>}
                              {typeof listing.capRate === "number" && <Badge variant="secondary">{listing.capRate.toFixed(1)}% cap</Badge>}
                              {listing.propertyType && <Badge variant="secondary">{listing.propertyType}</Badge>}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Link href={buildAnalyzerHref(listing)}>
                                <Button variant="outline" size="sm" className="gap-2" data-testid={`button-analyze-shortlist-${signalKey}`}>
                                  Analyze
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              {listing.city && (
                                <Link href={`/tools/cap-rates?q=${encodeURIComponent(listing.city)}`}>
                                  <Button variant="ghost" size="sm" data-testid={`button-search-area-${signalKey}`}>
                                    Search area
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="font-medium">No shortlisted listings yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Save a listing from the map or analyzer and it will show up here.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock3 className="h-5 w-5" />
                        Recently Viewed
                      </CardTitle>
                      <CardDescription>Fast path back into listings you already explored.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workspace?.discovery.recentViewedListings.length ? workspace.discovery.recentViewedListings.slice(0, 5).map((listing) => {
                        const signalKey = listing.listingId || listing.address || listing.id;
                        return (
                          <div key={signalKey} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-medium">{listing.label}</p>
                                <p className="text-sm text-muted-foreground">{listing.address || listing.city || "Recent view"}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDiscoverySignalMutation.mutate({ signalType: "recent_viewed_listing", signalKey })}
                                data-testid={`button-remove-recent-${signalKey}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {listing.price && <Badge variant="outline">${listing.price.toLocaleString()}</Badge>}
                              {typeof listing.capRate === "number" && <Badge variant="secondary">{listing.capRate.toFixed(1)}% cap</Badge>}
                            </div>
                            <div className="mt-3">
                              <Link href={buildAnalyzerHref(listing)}>
                                <Button variant="outline" size="sm" className="gap-2" data-testid={`button-open-recent-${signalKey}`}>
                                  Review property
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="font-medium">No recent views yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Browse the map and recently viewed listings will appear here.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="portfolio" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Your Properties</h2>
                <Dialog open={addPropertyOpen} onOpenChange={setAddPropertyOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-add-property">
                      <Plus className="h-4 w-4" />
                      Add Property
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Property to Portfolio</DialogTitle>
                      <DialogDescription>
                        Track your existing investment properties to benchmark against new deals.
                      </DialogDescription>
                    </DialogHeader>
                    <AddPropertyForm 
                      onSubmit={(data) => addPropertyMutation.mutate(data)}
                      isPending={addPropertyMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {portfolioLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : portfolio?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No properties yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your existing investment properties to track performance and compare against new deals.
                    </p>
                    <Button onClick={() => setAddPropertyOpen(true)} data-testid="button-add-first-property">
                      Add Your First Property
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Cashflow</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolio?.map((property) => {
                        const cashflow = (property.monthlyRent || 0) - (property.monthlyExpenses || 0);
                        return (
                          <TableRow key={property.id} data-testid={`property-row-${property.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{property.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {property.city || property.address}, {property.province}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {STRATEGY_TYPES.find(t => t.value === property.strategyType)?.label || property.strategyType || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${(property.currentValue || property.purchasePrice || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={cashflow >= 0 ? "text-green-600" : "text-red-600"}>
                                ${cashflow.toLocaleString()}/mo
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => deletePropertyMutation.mutate(property.id)}
                                data-testid={`button-delete-property-${property.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {portfolio && portfolio.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setLocation("/compare")} data-testid="button-compare-deals">
                    Compare with New Deals
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved-deals" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Saved Deal Analyses</h2>
                <Button variant="outline" onClick={() => setLocation("/")} className="gap-2" data-testid="button-new-analysis">
                  <Calculator className="h-4 w-4" />
                  New Analysis
                </Button>
              </div>

              {savedDealsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : savedDeals?.length === 0 || !savedDeals ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No saved analyses yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Run a deal analysis and save it to see it here. Your analyses include key metrics like cap rate, cash-on-cash, and IRR.
                    </p>
                    <Button onClick={() => setLocation("/")} data-testid="button-start-analysis">
                      Start an Analysis
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Cash Flow</TableHead>
                        <TableHead className="text-right">Cap Rate</TableHead>
                        <TableHead className="text-right">CoC Return</TableHead>
                        <TableHead className="text-right">DSCR</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedDeals.map((deal) => {
                        const results = deal.resultsJson as Record<string, unknown> | null;
                        const monthlyCashFlow = Number(results?.monthlyCashFlow) || 0;
                        const capRate = Number(results?.capRate) || 0;
                        const cashOnCash = Number(results?.cashOnCash) || Number(results?.cashOnCashReturn) || 0;
                        const dscr = Number(results?.dscr) || 0;
                        
                        return (
                          <TableRow key={deal.id} data-testid={`row-saved-deal-${deal.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{deal.address || deal.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {deal.countryMode === "canada" ? "Canada" : "USA"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {STRATEGY_TYPES.find(t => t.value === deal.strategyType)?.label || deal.strategyType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={monthlyCashFlow >= 0 ? "text-green-600" : "text-red-500"}>
                                ${monthlyCashFlow.toLocaleString()}/mo
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={capRate >= 5 ? "text-green-600" : "text-muted-foreground"}>
                                {capRate.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={cashOnCash >= 8 ? "text-green-600" : "text-muted-foreground"}>
                                {cashOnCash.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={dscr >= 1.2 ? "text-green-600" : dscr >= 1 ? "text-muted-foreground" : "text-red-500"}>
                                {dscr.toFixed(2)}x
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-deal-menu-${deal.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => setLocation(`/?dealId=${deal.id}`)}
                                    data-testid={`menu-view-deal-${deal.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Analysis
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => setLocation("/compare")}
                                    data-testid={`menu-compare-deal-${deal.id}`}
                                  >
                                    <GitCompare className="h-4 w-4 mr-2" />
                                    Compare Deals
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => deleteDealMutation.mutate(deal.id)}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`menu-delete-deal-${deal.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your investor profile information.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProfileForm 
                    profile={profile}
                    onSubmit={(data) => updateProfileMutation.mutate(data)}
                    isPending={updateProfileMutation.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="kyc" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Know Your Customer (KYC)
                  </CardTitle>
                  <CardDescription>
                    Complete your investor verification for access to exclusive deals and higher investment limits.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <KycForm 
                    kyc={kyc}
                    onSubmit={(data) => updateKycMutation.mutate(data)}
                    isPending={updateKycMutation.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Settings
              </h2>
              
              <GoogleConnectionCard />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function ProfileForm({ 
  profile, 
  onSubmit, 
  isPending 
}: { 
  profile: InvestorProfile | null | undefined; 
  onSubmit: (data: Partial<InvestorProfile>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    phone: profile?.phone || "",
    city: profile?.city || "",
    province: profile?.province || "",
    bio: profile?.bio || "",
    investmentGoals: profile?.investmentGoals || "",
  });

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
      className="space-y-4"
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="(416) 555-0123"
            data-testid="input-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Toronto"
            data-testid="input-city"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="province">Province</Label>
        <Select
          value={formData.province}
          onValueChange={(value) => setFormData(prev => ({ ...prev, province: value }))}
        >
          <SelectTrigger data-testid="select-province">
            <SelectValue placeholder="Select province" />
          </SelectTrigger>
          <SelectContent>
            {PROVINCES.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">About You</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          placeholder="Tell us about yourself..."
          rows={2}
          data-testid="input-bio"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="investmentGoals">Investment Goals</Label>
        <Textarea
          id="investmentGoals"
          value={formData.investmentGoals}
          onChange={(e) => setFormData(prev => ({ ...prev, investmentGoals: e.target.value }))}
          placeholder="Describe your real estate investment goals..."
          rows={3}
          data-testid="input-investment-goals"
        />
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-save-profile">
        {isPending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}

function KycForm({ 
  kyc, 
  onSubmit, 
  isPending 
}: { 
  kyc: InvestorKyc | null | undefined; 
  onSubmit: (data: Partial<InvestorKyc>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    isAccreditedInvestor: kyc?.isAccreditedInvestor || false,
    estimatedNetWorth: kyc?.estimatedNetWorth || "",
    annualIncome: kyc?.annualIncome || "",
    investmentExperience: kyc?.investmentExperience || "",
    riskTolerance: kyc?.riskTolerance || "moderate",
  });

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <p className="font-medium">Accredited Investor Status</p>
          <p className="text-sm text-muted-foreground">
            I meet the criteria for an accredited investor (net worth over $1M or annual income over $200K)
          </p>
        </div>
        <Switch
          checked={formData.isAccreditedInvestor}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAccreditedInvestor: checked }))}
          data-testid="switch-accredited"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimatedNetWorth">Estimated Net Worth</Label>
          <Select
            value={formData.estimatedNetWorth}
            onValueChange={(value) => setFormData(prev => ({ ...prev, estimatedNetWorth: value }))}
          >
            <SelectTrigger data-testid="select-net-worth">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_100k">Under $100,000</SelectItem>
              <SelectItem value="100k_250k">$100,000 - $250,000</SelectItem>
              <SelectItem value="250k_500k">$250,000 - $500,000</SelectItem>
              <SelectItem value="500k_1m">$500,000 - $1,000,000</SelectItem>
              <SelectItem value="1m_5m">$1,000,000 - $5,000,000</SelectItem>
              <SelectItem value="over_5m">Over $5,000,000</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="annualIncome">Annual Income</Label>
          <Select
            value={formData.annualIncome}
            onValueChange={(value) => setFormData(prev => ({ ...prev, annualIncome: value }))}
          >
            <SelectTrigger data-testid="select-annual-income">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_50k">Under $50,000</SelectItem>
              <SelectItem value="50k_100k">$50,000 - $100,000</SelectItem>
              <SelectItem value="100k_200k">$100,000 - $200,000</SelectItem>
              <SelectItem value="200k_500k">$200,000 - $500,000</SelectItem>
              <SelectItem value="over_500k">Over $500,000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="investmentExperience">Investment Experience</Label>
        <Select
          value={formData.investmentExperience}
          onValueChange={(value) => setFormData(prev => ({ ...prev, investmentExperience: value }))}
        >
          <SelectTrigger data-testid="select-experience">
            <SelectValue placeholder="Select experience level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
            <SelectItem value="intermediate">Intermediate (3-5 years)</SelectItem>
            <SelectItem value="experienced">Experienced (6-10 years)</SelectItem>
            <SelectItem value="expert">Expert (10+ years)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="riskTolerance">Investment Risk Tolerance</Label>
        <Select
          value={formData.riskTolerance}
          onValueChange={(value) => setFormData(prev => ({ ...prev, riskTolerance: value }))}
        >
          <SelectTrigger data-testid="select-risk-tolerance">
            <SelectValue placeholder="Select risk level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">Conservative - Prioritize capital preservation</SelectItem>
            <SelectItem value="moderate">Moderate - Balanced growth and safety</SelectItem>
            <SelectItem value="aggressive">Aggressive - Maximize returns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-save-kyc">
        {isPending ? "Saving..." : "Save KYC Information"}
      </Button>
    </form>
  );
}

function AddPropertyForm({ 
  onSubmit, 
  isPending 
}: { 
  onSubmit: (data: Partial<PortfolioProperty>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    province: "ON",
    purchasePrice: 0,
    currentValue: 0,
    monthlyRent: 0,
    monthlyExpenses: 0,
    strategyType: "buy_hold",
    notes: "",
  });

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Property Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Downtown Condo"
          required
          data-testid="input-property-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="123 Main Street"
          data-testid="input-property-address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            data-testid="input-property-city"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Province</Label>
          <Select
            value={formData.province}
            onValueChange={(value) => setFormData(prev => ({ ...prev, province: value }))}
          >
            <SelectTrigger data-testid="select-property-province">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="strategyType">Investment Strategy</Label>
        <Select
          value={formData.strategyType}
          onValueChange={(value) => setFormData(prev => ({ ...prev, strategyType: value }))}
        >
          <SelectTrigger data-testid="select-property-strategy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_TYPES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase Price</Label>
          <Input
            id="purchasePrice"
            type="number"
            value={formData.purchasePrice}
            onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseInt(e.target.value) || 0 }))}
            data-testid="input-purchase-price"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentValue">Current Value</Label>
          <Input
            id="currentValue"
            type="number"
            value={formData.currentValue}
            onChange={(e) => setFormData(prev => ({ ...prev, currentValue: parseInt(e.target.value) || 0 }))}
            data-testid="input-current-value"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="monthlyRent">Monthly Rent</Label>
          <Input
            id="monthlyRent"
            type="number"
            value={formData.monthlyRent}
            onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: parseInt(e.target.value) || 0 }))}
            data-testid="input-monthly-rent"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyExpenses">Monthly Expenses</Label>
          <Input
            id="monthlyExpenses"
            type="number"
            value={formData.monthlyExpenses}
            onChange={(e) => setFormData(prev => ({ ...prev, monthlyExpenses: parseInt(e.target.value) || 0 }))}
            data-testid="input-monthly-expenses"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional notes about this property..."
          rows={2}
          data-testid="input-property-notes"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending} data-testid="button-submit-property">
          {isPending ? "Adding..." : "Add Property"}
        </Button>
      </DialogFooter>
    </form>
  );
}
