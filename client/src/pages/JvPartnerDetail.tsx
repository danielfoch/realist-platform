import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import { MapPin, DollarSign, Loader2, Handshake, ArrowLeft } from "lucide-react";
import { jvPartnerRoleLabels } from "@shared/jvPartnerMatching";
import type { JvPartnerListing } from "@shared/schema";
import { formatCad } from "./JvPartnerHub";

export default function JvPartnerDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ listing: JvPartnerListing }>({
    queryKey: ["/api/jv-listings", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/jv-listings/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Listing not found");
      return res.json();
    },
    retry: false,
  });

  const interestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jv-listings/${params.id}/interest`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.alreadyInterested ? "Already Interested" : "Interest Recorded",
        description: data.alreadyInterested
          ? "You have already expressed interest in this listing."
          : "The listing owner can now see your interest in their matches.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jv-matches"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not record interest",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/jv-listings/${params.id}/status`, { status: "closed" });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Listing Closed", description: "Your listing is no longer active." });
      queryClient.invalidateQueries({ queryKey: ["/api/jv-listings", params.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not close listing",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-2xl text-center">
          <h1 className="text-2xl font-bold mb-4">Listing not found</h1>
          <Link href="/jv-partners">
            <Button variant="outline" data-testid="button-back-to-hub">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to JV Partners
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const listing = data.listing;
  const isOwner = isAuthenticated && user?.id === listing.userId;
  const isActive = listing.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Link href="/jv-partners">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Listings
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-2">
              <div>
                <CardTitle className="text-2xl">{listing.title}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-2">
                  <MapPin className="h-4 w-4" />
                  {[listing.city, listing.province].filter(Boolean).join(", ") || "Location flexible"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {jvPartnerRoleLabels[listing.partnerRoleOffered as keyof typeof jvPartnerRoleLabels] ?? listing.partnerRoleOffered}
                </Badge>
                {!isActive && <Badge variant="outline">Closed</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {listing.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
            )}

            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              <span>
                Investment range:{" "}
                {listing.investmentMin || listing.investmentMax
                  ? `${formatCad(listing.investmentMin)} – ${formatCad(listing.investmentMax)}`
                  : "Flexible"}
              </span>
            </div>

            {isOwner ? (
              <div className="flex gap-2">
                {isActive && (
                  <Button
                    variant="outline"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    data-testid="button-close-listing"
                  >
                    Mark as Closed
                  </Button>
                )}
              </div>
            ) : isActive && (
              isAuthenticated ? (
                <Button
                  onClick={() => interestMutation.mutate()}
                  disabled={interestMutation.isPending}
                  data-testid="button-express-interest"
                >
                  {interestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Handshake className="h-4 w-4 mr-2" />
                  )}
                  Express Interest
                </Button>
              ) : (
                <Button onClick={() => setLocation(authPath("/login"))} data-testid="button-login-to-connect">
                  Sign In to Express Interest
                </Button>
              )
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
