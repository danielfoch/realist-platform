import { useQuery } from "@tanstack/react-query";
import { Landmark, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Mirrors NeighbourhoodStats from shared/censusProfile.ts (via GET /api/enrichment). */
type NeighbourhoodStats = {
  dauid: string;
  censusYear: number;
  population: number | null;
  populationDensityPerKm2: number | null;
  avgHouseholdSize: number | null;
  medianHouseholdIncome: number | null;
  renterSharePct: number | null;
  ownerSharePct: number | null;
  medianDwellingValue: number | null;
  medianRentedShelterCost: number | null;
  dominantDwellingType: { type: string; sharePct: number } | null;
  dwellingMix: Record<string, number>;
  builtSince2001SharePct: number | null;
  attribution: string;
};

const DWELLING_TYPE_LABELS: Record<string, string> = {
  singleDetached: "Single-detached",
  semiDetached: "Semi-detached",
  rowHouse: "Row house",
  duplexApartment: "Duplex apartment",
  apartmentUnderFiveStoreys: "Low-rise apartment",
  apartmentFivePlusStoreys: "High-rise apartment",
  otherSingleAttached: "Other attached",
  movableDwelling: "Movable dwelling",
};

function money(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function pct(value: number | null): string | null {
  return value === null ? null : `${value}%`;
}

/** Mirrors PropertyAssessment from server/enrichment.ts (Québec roll, MAMH). */
type PropertyAssessment = {
  address: string | null;
  municipality: string | null;
  rollYear: number | null;
  yearBuilt: number | null;
  yearBuiltEstimated: boolean;
  storeys: number | null;
  floorAreaM2: number | null;
  lotAreaM2: number | null;
  frontageM: number | null;
  dwellings: number | null;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  attribution: string;
};

const SQFT_PER_M2 = 10.7639;

/** Mirrors PermitActivity from server/enrichment.ts (municipal open data). */
type PermitActivity = {
  atAddress: Array<{
    permitNumber: string;
    issuedDate: string | null;
    permitType: string | null;
    workType: string | null;
    status: string | null;
    description: string | null;
    estimatedValue: number | null;
    units: number | null;
  }>;
  nearby: { radiusM: number; windowMonths: number; count: number; totalValue: number | null } | null;
  attribution: string | null;
};

export function NeighbourhoodInsights({
  lat,
  lng,
  address,
  city,
  listPrice,
  className,
}: {
  lat: number | null;
  lng: number | null;
  address?: string;
  city?: string | null;
  listPrice?: number | null;
  className?: string;
}) {
  const enabled = (lat !== null && lng !== null) || !!address;
  const { data } = useQuery<{
    success: boolean;
    data: {
      neighbourhood: NeighbourhoodStats | null;
      property: PropertyAssessment | null;
      permits: PermitActivity | null;
    };
  }>({
    queryKey: ["/api/enrichment", lat, lng, address, city],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lat !== null && lng !== null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
      }
      if (address) params.set("address", address);
      if (city) params.set("city", city);
      const response = await fetch(`/api/enrichment?${params}`);
      if (!response.ok) throw new Error("Enrichment unavailable");
      return response.json();
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const stats = data?.data?.neighbourhood;
  const property = data?.data?.property ?? null;
  const permits = data?.data?.permits ?? null;
  // Render nothing until an enrichment layer is imported / the lookup matches.
  if (!stats && !property && !permits) return null;
  return (
    <>
      {property && <PropertyIntelligenceCard property={property} listPrice={listPrice ?? null} className={className} />}
      {permits && <PermitsCard permits={permits} className={className} />}
      {stats && <NeighbourhoodCard stats={stats} className={className} />}
    </>
  );
}

function PermitsCard({ permits, className }: { permits: PermitActivity; className?: string }) {
  const { atAddress, nearby } = permits;
  if (!atAddress.length && !nearby) return null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" /> Building permits
        </CardTitle>
      </CardHeader>
      <CardContent>
        {atAddress.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">At this address</div>
            {atAddress.slice(0, 5).map((p) => (
              <div key={p.permitNumber} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{p.workType || p.permitType || "Permit"}</span>
                  <span className="text-xs text-muted-foreground">
                    {[p.issuedDate, p.status].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {(p.estimatedValue !== null || p.units !== null) && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {[
                      p.estimatedValue !== null ? money(p.estimatedValue) : null,
                      p.units !== null && p.units > 0 ? `${p.units} unit${p.units === 1 ? "" : "s"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
              </div>
            ))}
          </div>
        )}
        {nearby && (
          <p className={`text-sm text-muted-foreground ${atAddress.length ? "mt-3" : ""}`}>
            {nearby.count.toLocaleString()} permit{nearby.count === 1 ? "" : "s"} issued within{" "}
            {Math.round(nearby.radiusM / 100) / 10} km in the last {nearby.windowMonths} months
            {nearby.totalValue !== null ? ` — ${money(nearby.totalValue)} in declared project value` : ""}.
          </p>
        )}
        {permits.attribution && <p className="mt-3 text-xs text-muted-foreground">{permits.attribution}</p>}
      </CardContent>
    </Card>
  );
}

function PropertyIntelligenceCard({
  property,
  listPrice,
  className,
}: {
  property: PropertyAssessment;
  listPrice: number | null;
  className?: string;
}) {
  const assessedRatio =
    listPrice && property.totalValue ? Math.round((listPrice / property.totalValue) * 100) / 100 : null;
  const facts: Array<{ label: string; value: string | null }> = [
    {
      label: "Year built",
      value: property.yearBuilt ? `${property.yearBuilt}${property.yearBuiltEstimated ? " (est.)" : ""}` : null,
    },
    {
      label: `Assessed value${property.rollYear ? ` (${property.rollYear} roll)` : ""}`,
      value: money(property.totalValue),
    },
    { label: "Listed at × assessed", value: assessedRatio !== null ? `${assessedRatio}×` : null },
    {
      label: "Lot area",
      value: property.lotAreaM2 !== null ? `${Math.round(property.lotAreaM2 * SQFT_PER_M2).toLocaleString()} sq. ft.` : null,
    },
    {
      label: "Floor area (assessment)",
      value:
        property.floorAreaM2 !== null ? `${Math.round(property.floorAreaM2 * SQFT_PER_M2).toLocaleString()} sq. ft.` : null,
    },
    { label: "Frontage", value: property.frontageM !== null ? `${property.frontageM} m` : null },
    { label: "Storeys", value: property.storeys?.toString() ?? null },
    { label: "Dwelling units", value: property.dwellings?.toString() ?? null },
  ].filter((f) => f.value !== null);
  if (!facts.length) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" /> Property intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{f.label}</div>
              <div className="font-semibold">{f.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Matched to the assessment roll for {property.address ?? "this address"}
          {property.municipality ? `, ${property.municipality}` : ""}. {property.attribution}
        </p>
      </CardContent>
    </Card>
  );
}

function NeighbourhoodCard({ stats, className }: { stats: NeighbourhoodStats; className?: string }) {

  const facts: Array<{ label: string; value: string | null }> = [
    { label: "Renter share", value: pct(stats.renterSharePct) },
    { label: "Median household income", value: money(stats.medianHouseholdIncome) },
    { label: "Median home value (census)", value: money(stats.medianDwellingValue) },
    { label: "Median rent paid", value: money(stats.medianRentedShelterCost) },
    { label: "Avg household size", value: stats.avgHouseholdSize?.toString() ?? null },
    {
      label: "Most common dwelling",
      value: stats.dominantDwellingType
        ? `${DWELLING_TYPE_LABELS[stats.dominantDwellingType.type] ?? stats.dominantDwellingType.type} (${stats.dominantDwellingType.sharePct}%)`
        : null,
    },
    { label: "Built since 2001", value: pct(stats.builtSince2001SharePct) },
    {
      label: "Population density",
      value: stats.populationDensityPerKm2 !== null ? `${Math.round(stats.populationDensityPerKm2).toLocaleString()}/km²` : null,
    },
  ].filter((f) => f.value !== null);

  if (!facts.length) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Neighbourhood snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{f.label}</div>
              <div className="font-semibold">{f.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {stats.attribution.replace("Source: ", `${stats.censusYear} census dissemination area. Source: `)}
        </p>
      </CardContent>
    </Card>
  );
}
