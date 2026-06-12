import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Mail, Phone, ExternalLink, BedDouble, Bath } from "lucide-react";
import type { PartnerListing } from "@shared/schema";

interface PartnerListingWithAttribution extends PartnerListing {
  attribution: {
    partnerName: string;
    partnerCompany: string | null;
    partnerEmail: string | null;
    partnerPhone: string | null;
    board: string | null;
    caption: string;
    listingBrokerage: string | null;
  };
}

export default function PartnerListings() {
  const [cityFilter, setCityFilter] = useState("");

  const { data: listings, isLoading } = useQuery<PartnerListingWithAttribution[]>({
    queryKey: ["/api/partner-listings", cityFilter],
    queryFn: async () => {
      const params = cityFilter ? `?city=${encodeURIComponent(cityFilter)}` : "";
      const res = await fetch(`/api/partner-listings${params}`);
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Listings from Realist Network Partners"
        description="Properties listed by realtors in the Realist Partner Network, with direct contact to the local expert behind each one."
        canonicalUrl="/listings/partners"
      />

      <main className="py-10">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-partner-listings-title">Partner listings</h1>
            <p className="text-muted-foreground">
              Properties from realtors in the Realist Partner Network. Contact the listing partner directly, or analyze
              any property with the Deal Analyzer.
            </p>
          </div>

          <Input
            className="max-w-xs"
            placeholder="Filter by city…"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            data-testid="input-partner-listings-city"
          />

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : !listings || listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No partner listings{cityFilter ? ` in ${cityFilter}` : ""} yet. Check back soon.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {listings.map((listing) => (
                <Card key={listing.id} data-testid={`card-partner-listing-${listing.id}`}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start gap-3">
                      {listing.photoUrl ? (
                        <img
                          src={listing.photoUrl}
                          alt={listing.address || "Listing photo"}
                          className="h-20 w-24 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="flex h-20 w-24 items-center justify-center rounded-lg bg-muted shrink-0">
                          <Building className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{listing.address || listing.mlsNumber || "Listing"}</p>
                        <p className="text-sm text-muted-foreground">
                          {[listing.city, listing.region].filter(Boolean).join(", ")}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {listing.listPrice != null && (
                            <Badge variant="outline">${Math.round(listing.listPrice).toLocaleString()}</Badge>
                          )}
                          {listing.bedrooms != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <BedDouble className="h-3 w-3" />{listing.bedrooms}
                            </span>
                          )}
                          {listing.bathrooms != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Bath className="h-3 w-3" />{listing.bathrooms}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                    )}

                    <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                      <p className="font-medium" data-testid={`text-attribution-${listing.id}`}>
                        {listing.attribution.caption}
                      </p>
                      {listing.attribution.listingBrokerage && (
                        <p className="text-muted-foreground">
                          Listing brokerage: {listing.attribution.listingBrokerage}
                        </p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        {listing.attribution.partnerEmail && (
                          <a
                            className="flex items-center gap-1 text-primary hover:underline"
                            href={`mailto:${listing.attribution.partnerEmail}`}
                          >
                            <Mail className="h-3 w-3" />
                            {listing.attribution.partnerEmail}
                          </a>
                        )}
                        {listing.attribution.partnerPhone && (
                          <a
                            className="flex items-center gap-1 text-primary hover:underline"
                            href={`tel:${listing.attribution.partnerPhone}`}
                          >
                            <Phone className="h-3 w-3" />
                            {listing.attribution.partnerPhone}
                          </a>
                        )}
                        {listing.sourceUrl && (
                          <a
                            className="flex items-center gap-1 text-primary hover:underline"
                            href={listing.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View listing
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
