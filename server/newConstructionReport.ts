import { getDdfToken } from "./creaDdf";

const DDF_API_BASE = "https://ddfapi.realtor.ca/odata/v1";
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const REPORT_FIELDS = [
  "ListingKey", "ListingId", "ListPrice", "StandardStatus",
  "PropertySubType", "StructureType", "ArchitecturalStyle",
  "BedroomsTotal", "BathroomsTotalInteger",
  "LivingArea", "LivingAreaUnits", "BuildingAreaTotal", "BuildingAreaUnits",
  "YearBuilt",
  "UnparsedAddress", "City", "CityRegion", "StateOrProvince", "PostalCode",
  "Latitude", "Longitude",
  "PublicRemarks",
  "ModificationTimestamp", "OriginalEntryTimestamp",
].join(",");

interface RawListing {
  ListingKey: string;
  ListingId?: string;
  ListPrice?: number;
  PropertySubType?: string;
  StructureType?: string;
  ArchitecturalStyle?: string[];
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  LivingArea?: number;
  LivingAreaUnits?: string;
  BuildingAreaTotal?: number;
  BuildingAreaUnits?: string;
  YearBuilt?: number;
  UnparsedAddress?: string;
  City?: string;
  CityRegion?: string;
  StateOrProvince?: string;
  Latitude?: number;
  Longitude?: number;
  PublicRemarks?: string;
  OriginalEntryTimestamp?: string;
}

export interface NewConstructionReport {
  generatedAt: string;
  anchorYear: number;
  totalListings: number;
  totalWithPrice: number;
  totalWithSqft: number;
  national: {
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    avgPsf: number;
    medianPsf: number;
  };
  byProvince: Array<{
    province: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  byCity: Array<{
    city: string;
    province: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  byPropertyType: Array<{
    type: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  priceBands: Array<{
    band: string;
    count: number;
    minPrice: number;
    maxPrice: number;
  }>;
  preConstructionKeywordHits: {
    total: number;
    assignment: number;
    toBeBuilt: number;
    brandNew: number;
    preConstruction: number;
    builderInventory: number;
  };
  topExpensive: Array<{
    listingKey: string;
    listingId?: string;
    address: string;
    city: string;
    province: string;
    price: number;
    psf: number | null;
    yearBuilt?: number;
    type?: string;
  }>;
  sampleListings: Array<{
    listingKey: string;
    listingId?: string;
    address: string;
    city: string;
    province: string;
    price: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    psf: number | null;
    yearBuilt?: number;
    type?: string;
    excerpt: string;
  }>;
}

let cache: { report: NewConstructionReport; expiresAt: number } | null = null;
let inflightPromise: Promise<NewConstructionReport> | null = null;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function normalizeSqft(area: number | undefined, units: string | undefined): number | undefined {
  if (!area || area <= 0) return undefined;
  if (units && /m2|sqm|square\s*meter/i.test(units)) {
    return Math.round(area * 10.7639);
  }
  return Math.round(area);
}

function computePsf(price: number | undefined, sqft: number | undefined): number | null {
  if (!price || !sqft || sqft < 250 || sqft > 20000) return null;
  const psf = price / sqft;
  if (psf < 100 || psf > 5000) return null;
  return Math.round(psf);
}

function getBand(price: number): string {
  if (price < 500000) return "Under $500K";
  if (price < 750000) return "$500K–$750K";
  if (price < 1000000) return "$750K–$1M";
  if (price < 1500000) return "$1M–$1.5M";
  if (price < 2000000) return "$1.5M–$2M";
  if (price < 3000000) return "$2M–$3M";
  return "$3M+";
}

const BAND_ORDER = ["Under $500K", "$500K–$750K", "$750K–$1M", "$1M–$1.5M", "$1.5M–$2M", "$2M–$3M", "$3M+"];

async function fetchAllNewConstruction(anchorYear: number): Promise<RawListing[]> {
  const token = await getDdfToken();
  const listings: RawListing[] = [];
  const filter = `StandardStatus eq 'Active' and YearBuilt ge ${anchorYear}`;

  let skip = 0;
  let totalCount: number | null = null;
  const maxPages = 500;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    params.set("$filter", filter);
    params.set("$top", String(PAGE_SIZE));
    params.set("$skip", String(skip));
    params.set("$select", REPORT_FIELDS);
    params.set("$orderby", "ListingKey");
    if (page === 0) params.set("$count", "true");

    const url = `${DDF_API_BASE}/Property?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`CREA DDF page ${page} failed: HTTP ${res.status} — ${errText.substring(0, 200)}`);
    }
    const data = await res.json() as { value?: RawListing[]; "@odata.count"?: number };
    if (page === 0 && typeof data["@odata.count"] === "number") {
      totalCount = data["@odata.count"];
      console.log(`[new-construction] total listings to fetch: ${totalCount}`);
    }
    const batch = data.value || [];
    listings.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
    if (totalCount !== null && skip >= totalCount) break;
    if (page === maxPages - 1) {
      throw new Error(`CREA DDF pagination exceeded maxPages=${maxPages} (would truncate at ${listings.length} of ${totalCount ?? "?"}).`);
    }
  }

  if (totalCount !== null && listings.length < totalCount) {
    throw new Error(`CREA DDF fetch incomplete: got ${listings.length} of ${totalCount} listings.`);
  }

  console.log(`[new-construction] fetched ${listings.length} listings`);
  return listings;
}

function buildReport(listings: RawListing[], anchorYear: number): NewConstructionReport {
  const pricedListings = listings.filter((l) => l.ListPrice && l.ListPrice > 10000);
  const prices = pricedListings.map((l) => l.ListPrice!).filter((p) => p > 0);

  const psfValues: number[] = [];
  const withSqft = pricedListings.filter((l) => {
    const sqft = normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits);
    const psf = computePsf(l.ListPrice, sqft);
    if (psf !== null) {
      psfValues.push(psf);
      return true;
    }
    return false;
  });

  const provinceMap = new Map<string, RawListing[]>();
  for (const l of pricedListings) {
    const p = l.StateOrProvince || "Unknown";
    if (!provinceMap.has(p)) provinceMap.set(p, []);
    provinceMap.get(p)!.push(l);
  }
  const byProvince = Array.from(provinceMap.entries())
    .map(([province, items]) => {
      const ps = items.map((l) => l.ListPrice!);
      const psfs = items
        .map((l) => computePsf(l.ListPrice, normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits)))
        .filter((v): v is number => v !== null);
      return {
        province,
        count: items.length,
        avgPrice: mean(ps),
        medianPrice: median(ps),
        avgPsf: mean(psfs),
      };
    })
    .sort((a, b) => b.count - a.count);

  const cityMap = new Map<string, RawListing[]>();
  for (const l of pricedListings) {
    if (!l.City) continue;
    const key = `${l.City}|${l.StateOrProvince || ""}`;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key)!.push(l);
  }
  const byCity = Array.from(cityMap.entries())
    .map(([key, items]) => {
      const [city, province] = key.split("|");
      const ps = items.map((l) => l.ListPrice!);
      const psfs = items
        .map((l) => computePsf(l.ListPrice, normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits)))
        .filter((v): v is number => v !== null);
      return {
        city,
        province,
        count: items.length,
        avgPrice: mean(ps),
        medianPrice: median(ps),
        avgPsf: mean(psfs),
      };
    })
    .filter((c) => c.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const typeMap = new Map<string, RawListing[]>();
  for (const l of pricedListings) {
    const t = l.PropertySubType || l.StructureType || "Other";
    if (!typeMap.has(t)) typeMap.set(t, []);
    typeMap.get(t)!.push(l);
  }
  const byPropertyType = Array.from(typeMap.entries())
    .map(([type, items]) => {
      const ps = items.map((l) => l.ListPrice!);
      const psfs = items
        .map((l) => computePsf(l.ListPrice, normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits)))
        .filter((v): v is number => v !== null);
      return {
        type,
        count: items.length,
        avgPrice: mean(ps),
        medianPrice: median(ps),
        avgPsf: mean(psfs),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const bandMap = new Map<string, { count: number; minPrice: number; maxPrice: number }>();
  for (const b of BAND_ORDER) bandMap.set(b, { count: 0, minPrice: Infinity, maxPrice: 0 });
  for (const l of pricedListings) {
    const band = getBand(l.ListPrice!);
    const entry = bandMap.get(band)!;
    entry.count++;
    entry.minPrice = Math.min(entry.minPrice, l.ListPrice!);
    entry.maxPrice = Math.max(entry.maxPrice, l.ListPrice!);
  }
  const priceBands = BAND_ORDER.map((band) => {
    const e = bandMap.get(band)!;
    return {
      band,
      count: e.count,
      minPrice: e.minPrice === Infinity ? 0 : e.minPrice,
      maxPrice: e.maxPrice,
    };
  });

  const kw = {
    total: 0,
    assignment: 0,
    toBeBuilt: 0,
    brandNew: 0,
    preConstruction: 0,
    builderInventory: 0,
  };
  for (const l of listings) {
    const r = (l.PublicRemarks || "").toLowerCase();
    let hit = false;
    if (r.includes("assignment")) { kw.assignment++; hit = true; }
    if (r.includes("to be built") || r.includes("to-be-built")) { kw.toBeBuilt++; hit = true; }
    if (r.includes("brand new") || r.includes("brand-new")) { kw.brandNew++; hit = true; }
    if (r.includes("pre-construction") || r.includes("preconstruction") || r.includes("pre construction")) { kw.preConstruction++; hit = true; }
    if (r.includes("builder inventory") || r.includes("builder's inventory") || r.includes("builders inventory")) { kw.builderInventory++; hit = true; }
    if (hit) kw.total++;
  }

  const topExpensive = pricedListings
    .slice()
    .sort((a, b) => (b.ListPrice || 0) - (a.ListPrice || 0))
    .slice(0, 25)
    .map((l) => {
      const sqft = normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits);
      return {
        listingKey: l.ListingKey,
        listingId: l.ListingId,
        address: l.UnparsedAddress || "",
        city: l.City || "",
        province: l.StateOrProvince || "",
        price: l.ListPrice!,
        psf: computePsf(l.ListPrice, sqft),
        yearBuilt: l.YearBuilt,
        type: l.PropertySubType || l.StructureType,
      };
    });

  const sampleListings = pricedListings
    .filter((l) => l.PublicRemarks && l.City)
    .slice(0, 30)
    .map((l) => {
      const sqft = normalizeSqft(l.LivingArea ?? l.BuildingAreaTotal, l.LivingAreaUnits ?? l.BuildingAreaUnits);
      return {
        listingKey: l.ListingKey,
        listingId: l.ListingId,
        address: l.UnparsedAddress || "",
        city: l.City || "",
        province: l.StateOrProvince || "",
        price: l.ListPrice!,
        beds: l.BedroomsTotal,
        baths: l.BathroomsTotalInteger,
        sqft,
        psf: computePsf(l.ListPrice, sqft),
        yearBuilt: l.YearBuilt,
        type: l.PropertySubType || l.StructureType,
        excerpt: (l.PublicRemarks || "").substring(0, 200),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    anchorYear,
    totalListings: listings.length,
    totalWithPrice: pricedListings.length,
    totalWithSqft: withSqft.length,
    national: {
      avgPrice: mean(prices),
      medianPrice: median(prices),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgPsf: mean(psfValues),
      medianPsf: median(psfValues),
    },
    byProvince,
    byCity,
    byPropertyType,
    priceBands,
    preConstructionKeywordHits: kw,
    topExpensive,
    sampleListings,
  };
}

export async function getNewConstructionCanadaReport(forceRefresh = false): Promise<NewConstructionReport> {
  if (!forceRefresh && cache && Date.now() < cache.expiresAt) {
    return cache.report;
  }
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const now = new Date();
      const anchorYear = now.getFullYear() - 1;
      const listings = await fetchAllNewConstruction(anchorYear);
      const report = buildReport(listings, anchorYear);
      cache = { report, expiresAt: Date.now() + CACHE_TTL_MS };
      return report;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
