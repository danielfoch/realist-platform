import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Search, MapPin, Users, DollarSign, Loader2, Handshake } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { jvPartnerRoleLabels } from "@shared/jvPartnerMatching";
import { jvPartnerRoles, type JvPartnerListing, type JvPartnerMatch } from "@shared/schema";

const provinces = ["ON", "BC", "AB", "QC", "NS", "NB", "MB", "SK", "PE", "NL", "YT", "NT", "NU"];

export function formatCad(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "Not specified";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function JvListingCard({ listing }: { listing: JvPartnerListing }) {
  return (
    <Card data-testid={`card-jv-listing-${listing.id}`}>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">{listing.title}</CardTitle>
          <Badge variant="secondary">
            {jvPartnerRoleLabels[listing.partnerRoleOffered as keyof typeof jvPartnerRoleLabels] ?? listing.partnerRoleOffered}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {[listing.city, listing.province].filter(Boolean).join(", ") || "Location flexible"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {listing.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{listing.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {listing.investmentMin || listing.investmentMax
              ? `${formatCad(listing.investmentMin)} – ${formatCad(listing.investmentMax)}`
              : "Investment flexible"}
          </span>
          <Link href={`/jv-partners/${listing.id}`}>
            <Button variant="outline" size="sm" data-testid={`button-view-jv-${listing.id}`}>
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JvPartnerHub() {
  const { isAuthenticated } = useAuth();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [minInvestment, setMinInvestment] = useState<string>("");
  const [maxInvestment, setMaxInvestment] = useState<string>("");

  const params = new URLSearchParams();
  if (roleFilter !== "all") params.set("role", roleFilter);
  if (provinceFilter !== "all") params.set("province", provinceFilter);
  if (minInvestment) params.set("investmentMin", minInvestment);
  if (maxInvestment) params.set("investmentMax", maxInvestment);
  const queryString = params.toString();

  const { data, isLoading } = useQuery<{ listings: JvPartnerListing[] }>({
    queryKey: ["/api/jv-listings", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/jv-listings${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
  });

  const { data: matchesData } = useQuery<{ matches: { match: JvPartnerMatch; listing: JvPartnerListing }[] }>({
    queryKey: ["/api/jv-matches"],
    enabled: isAuthenticated,
  });

  const listings = data?.listings || [];
  const matches = matchesData?.matches || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">JV Partners</h1>
            <p className="text-muted-foreground">
              Find joint-venture partners — land, capital, development, realtors, and GCs
            </p>
          </div>
          <Link href="/jv-partners/new">
            <Button data-testid="button-create-jv-listing">
              Post a Listing
            </Button>
          </Link>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {jvPartnerRoles.map((role) => (
                    <SelectItem key={role} value={role}>{jvPartnerRoleLabels[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                <SelectTrigger data-testid="select-province">
                  <SelectValue placeholder="Province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {provinces.map((province) => (
                    <SelectItem key={province} value={province}>{province}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Min investment"
                value={minInvestment}
                onChange={(e) => setMinInvestment(e.target.value)}
                data-testid="input-min-investment"
              />
              <Input
                type="number"
                placeholder="Max investment"
                value={maxInvestment}
                onChange={(e) => setMaxInvestment(e.target.value)}
                data-testid="input-max-investment"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No listings found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters, or post the first listing.
              </p>
              <Link href="/jv-partners/new">
                <Button data-testid="button-create-jv-listing-empty">Post a Listing</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <JvListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {isAuthenticated && matches.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              My Matches
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {matches.map(({ match, listing }) => (
                <Card key={match.id} data-testid={`card-jv-match-${match.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg">{listing.title}</CardTitle>
                      <Badge variant={match.matchType === "interest" ? "default" : "secondary"}>
                        {match.matchType === "interest" ? "Interest" : "Suggested"}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Status: {match.status}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/jv-partners/${listing.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-match-${match.id}`}>
                        View Listing
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
