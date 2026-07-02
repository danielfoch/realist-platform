import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  Calculator,
  Home,
  Loader2,
  MapPin,
  Ruler,
  TrendingUp,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { NeighbourhoodInsights } from "@/components/NeighbourhoodInsights";
import { FieldNotes } from "@/components/experts/FieldNotes";
import { WatchListingButton } from "@/components/WatchListingButton";
import { ListingEngagementStrip } from "@/components/ListingEngagementStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ListingDetail = {
  id: number;
  mlsNumber: string;
  status: string | null;
  propertyType: string | null;
  structureType: string | null;
  addressStreet: string | null;
  addressUnit: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  addressPostalCode: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  listPrice: string | number | null;
  bedrooms: number | null;
  bedroomsPlus: number | null;
  bathroomsFull: number | null;
  bathroomsHalf: number | null;
  squareFootage: number | null;
  publicRemarks: string | null;
  estimatedMonthlyRent: string | number | null;
  capRate: string | number | null;
  grossYield: string | number | null;
  cashFlowMonthly: string | number | null;
  photoUrl: string | null;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: string | number | null | undefined): string {
  const parsed = toNumber(value);
  if (parsed === null) return "N/A";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function pct(value: string | number | null | undefined): string {
  const parsed = toNumber(value);
  return parsed === null ? "N/A" : `${parsed.toFixed(1)}%`;
}

function address(listing: ListingDetail): string {
  const street = [listing.addressUnit, listing.addressStreet].filter(Boolean).join(" - ");
  return [street, listing.addressCity, listing.addressProvince].filter(Boolean).join(", ");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function ListingDetailPage() {
  const [, params] = useRoute("/listings/:mlsNumber");
  const mlsNumber = params?.mlsNumber || "";
  const { data, isLoading, error } = useQuery<{ success: boolean; data: ListingDetail }>({
    queryKey: ["/api/listings", mlsNumber],
    queryFn: async () => {
      const response = await fetch(`/api/listings/${encodeURIComponent(mlsNumber)}`);
      if (!response.ok) throw new Error("Listing not found");
      return response.json();
    },
    enabled: !!mlsNumber,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center gap-4 px-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading listing analysis...</p>
        </main>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="Listing not found"
          description="This Realist.ca listing analysis page is no longer available."
          noIndex
        />
        <Navigation />
        <main className="container mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center gap-4 px-4 text-center">
          <Home className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Listing not found</h1>
          <p className="max-w-md text-muted-foreground">
            This listing may have expired, sold, or been removed from the active feed.
          </p>
          <Link href="/tools/listing-intelligence">
            <Button variant="outline">Browse listing intelligence</Button>
          </Link>
        </main>
      </div>
    );
  }

  const listing = data.data;
  const fullAddress = address(listing) || `MLS ${listing.mlsNumber}`;
  const description = `View Realist.ca's property analysis for ${fullAddress}: ${money(listing.listPrice)}, ${listing.bedrooms || "N/A"} bed, ${listing.bathroomsFull || "N/A"} bath, ${pct(listing.capRate)} cap rate, and investor due-diligence context.`;
  const canonicalUrl = `/listings/${encodeURIComponent(listing.mlsNumber)}`;
  const image = listing.photoUrl?.startsWith("http") ? listing.photoUrl : undefined;
  const remarks = listing.publicRemarks ? stripHtml(listing.publicRemarks) : "";
  const cashFlow = toNumber(listing.cashFlowMonthly);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: fullAddress,
      url: `https://realist.ca${canonicalUrl}`,
      image: image || "https://realist.ca/og-image.png",
      description,
      identifier: listing.mlsNumber,
      offers: toNumber(listing.listPrice)
        ? {
            "@type": "Offer",
            price: toNumber(listing.listPrice),
            priceCurrency: "CAD",
          }
        : undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: [listing.addressUnit, listing.addressStreet].filter(Boolean).join(" - ") || undefined,
        addressLocality: listing.addressCity || undefined,
        addressRegion: listing.addressProvince || undefined,
        postalCode: listing.addressPostalCode || undefined,
        addressCountry: "CA",
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${fullAddress} - MLS ${listing.mlsNumber} Analysis`}
        description={description}
        keywords={[fullAddress, listing.mlsNumber, "MLS listing analysis", "Canadian real estate investment"].join(", ")}
        canonicalUrl={canonicalUrl}
        ogImage={image}
        ogType="product"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>
      </Helmet>
      <Navigation />

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <Link href="/tools/listing-intelligence" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to listing intelligence
        </Link>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {listing.status && <Badge>{listing.status}</Badge>}
              <Badge variant="outline">MLS {listing.mlsNumber}</Badge>
              {(listing.structureType || listing.propertyType) && (
                <Badge variant="outline">{listing.structureType || listing.propertyType}</Badge>
              )}
            </div>

            <h1 className="mb-3 text-3xl font-bold tracking-normal md:text-5xl">{fullAddress}</h1>
            <p className="mb-3 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[listing.addressCity, listing.addressProvince, listing.addressPostalCode].filter(Boolean).join(", ")}
            </p>
            <ListingEngagementStrip mlsNumber={listing.mlsNumber} className="mb-6" />

            {listing.photoUrl ? (
              <img
                src={listing.photoUrl}
                alt={fullAddress}
                className="aspect-[16/10] w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" /> Realist analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">List price</div>
                  <div className="text-3xl font-bold">{money(listing.listPrice)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Cap rate" value={pct(listing.capRate)} />
                  <Metric label="Gross yield" value={pct(listing.grossYield)} />
                  <Metric label="Est. rent" value={money(listing.estimatedMonthlyRent)} />
                  <Metric
                    label="Cash flow"
                    value={money(listing.cashFlowMonthly)}
                    tone={cashFlow === null ? "neutral" : cashFlow >= 0 ? "positive" : "negative"}
                  />
                </div>
                <Link href={`/tools/analyzer?mls=${encodeURIComponent(listing.mlsNumber)}&address=${encodeURIComponent(fullAddress)}`}>
                  <Button className="w-full">
                    Analyze this deal <TrendingUp className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <WatchListingButton
                  className="w-full"
                  listingKey={listing.mlsNumber}
                  source="ddf"
                  address={fullAddress}
                  city={listing.addressCity || undefined}
                  price={toNumber(listing.listPrice) ?? undefined}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Property facts</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Fact icon={<BedDouble className="h-4 w-4" />} label="Bedrooms" value={`${listing.bedrooms || "N/A"}${listing.bedroomsPlus ? `+${listing.bedroomsPlus}` : ""}`} />
                <Fact icon={<Bath className="h-4 w-4" />} label="Bathrooms" value={`${listing.bathroomsFull || "N/A"}${listing.bathroomsHalf ? `.${listing.bathroomsHalf}` : ""}`} />
                <Fact icon={<Ruler className="h-4 w-4" />} label="Sq. ft." value={listing.squareFootage ? listing.squareFootage.toLocaleString() : "N/A"} />
                <Fact icon={<Building2 className="h-4 w-4" />} label="Type" value={listing.structureType || listing.propertyType || "N/A"} />
              </CardContent>
            </Card>

            <NeighbourhoodInsights lat={toNumber(listing.latitude)} lng={toNumber(listing.longitude)} />
          </div>
        </section>

        {remarks && (
          <section className="mt-10 max-w-4xl">
            <h2 className="mb-3 text-2xl font-bold">Listing remarks</h2>
            <p className="leading-8 text-muted-foreground">{remarks}</p>
          </section>
        )}

        <FieldNotes mlsNumber={listing.mlsNumber} />
      </main>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
