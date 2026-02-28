interface DdfTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DdfMediaItem {
  MediaKey?: string;
  MediaURL?: string;
  Order?: number;
  PreferredPhotoYN?: boolean;
  MediaCategory?: string;
}

interface DdfListing {
  ListingKey: string;
  ListingId?: string;
  ListPrice?: number;
  StandardStatus?: string;
  PropertySubType?: string;
  StructureType?: string;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsPartial?: number;
  LivingArea?: number;
  LivingAreaUnits?: string;
  BuildingAreaTotal?: number;
  BuildingAreaUnits?: string;
  YearBuilt?: number;
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
  City?: string;
  CityRegion?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  Country?: string;
  Latitude?: number;
  Longitude?: number;
  PublicRemarks?: string;
  TaxAnnualAmount?: number;
  TotalActualRent?: number;
  Stories?: number;
  ParkingTotal?: number;
  ArchitecturalStyle?: string[];
  Basement?: string[];
  PhotosCount?: number;
  Media?: DdfMediaItem[];
  ModificationTimestamp?: string;
  OriginalEntryTimestamp?: string;
  NumberOfUnitsTotal?: number;
  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  [key: string]: any;
}

interface DdfSearchResponse {
  value: DdfListing[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const DDF_AUTH_URL = "https://identity.crea.ca/connect/token";
const DDF_API_BASE = "https://ddfapi.realtor.ca/odata/v1";

const DDF_SELECT_FIELDS = [
  "ListingKey", "ListingId", "ListPrice", "StandardStatus",
  "PropertySubType", "StructureType",
  "BedroomsTotal", "BathroomsTotalInteger", "BathroomsPartial",
  "LivingArea", "LivingAreaUnits", "BuildingAreaTotal", "BuildingAreaUnits",
  "YearBuilt", "Stories",
  "UnparsedAddress", "StreetNumber", "StreetName", "StreetSuffix",
  "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
  "City", "CityRegion", "StateOrProvince", "PostalCode", "Country",
  "Latitude", "Longitude",
  "PublicRemarks", "TaxAnnualAmount", "TotalActualRent",
  "ParkingTotal", "NumberOfUnitsTotal",
  "AssociationFee", "AssociationFeeFrequency",
  "PhotosCount", "Media",
  "ModificationTimestamp", "OriginalEntryTimestamp",
].join(",");

export async function getDdfToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const username = process.env.CREA_DDF_USERNAME;
  const password = process.env.CREA_DDF_PASSWORD;

  if (!username || !password) {
    throw new Error("CREA DDF credentials not configured");
  }

  const response = await fetch(DDF_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: username,
      client_secret: password,
      scope: "DDFApi_Read",
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF token error:", response.status, errorText);
    throw new Error(`DDF authentication failed: ${response.status} - ${errorText}`);
  }

  const data: DdfTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  console.log("DDF token acquired, expires in", data.expires_in, "seconds");
  return cachedToken.token;
}

export async function searchDdfListings(params: {
  city?: string;
  stateOrProvince?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minUnits?: number;
  propertySubType?: string;
  excludeBusinessSales?: boolean;
  excludeParking?: boolean;
  latitudeMin?: number;
  latitudeMax?: number;
  longitudeMin?: number;
  longitudeMax?: number;
  top?: number;
  skip?: number;
}): Promise<{ listings: DdfListing[]; count: number; numPages: number; page: number }> {
  const token = await getDdfToken();

  const filters: string[] = [];
  filters.push("StandardStatus eq 'Active'");

  if (params.city) {
    filters.push(`City eq '${params.city.replace(/'/g, "''")}'`);
  }
  if (params.stateOrProvince) {
    filters.push(`StateOrProvince eq '${params.stateOrProvince.replace(/'/g, "''")}'`);
  }
  if (params.minPrice) {
    filters.push(`ListPrice ge ${params.minPrice}`);
  }
  if (params.maxPrice) {
    filters.push(`ListPrice le ${params.maxPrice}`);
  }
  if (params.minBeds) {
    filters.push(`BedroomsTotal ge ${params.minBeds}`);
  }
  if (params.maxBeds) {
    filters.push(`BedroomsTotal le ${params.maxBeds}`);
  }
  if (params.minUnits && params.minUnits > 1) {
    filters.push(`NumberOfUnitsTotal ge ${params.minUnits}`);
  }
  if (params.propertySubType) {
    filters.push(`PropertySubType eq '${params.propertySubType.replace(/'/g, "''")}'`);
  }
  // PropertySubType exclusions applied post-fetch (OData enum filtering not supported)
  if (params.latitudeMin != null && params.latitudeMax != null) {
    filters.push(`Latitude ge ${params.latitudeMin} and Latitude le ${params.latitudeMax}`);
  }
  if (params.longitudeMin != null && params.longitudeMax != null) {
    filters.push(`Longitude ge ${params.longitudeMin} and Longitude le ${params.longitudeMax}`);
  }

  const top = params.top || 48;
  const skip = params.skip || 0;

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", filters.join(" and "));
  queryParams.set("$count", "true");
  queryParams.set("$top", String(top));
  if (skip > 0) queryParams.set("$skip", String(skip));
  queryParams.set("$orderby", "ModificationTimestamp desc");
  queryParams.set("$select", DDF_SELECT_FIELDS);

  const url = `${DDF_API_BASE}/Property?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF search error:", response.status, errorText);
    throw new Error(`DDF search failed: ${response.status} - ${errorText}`);
  }

  const data: DdfSearchResponse = await response.json();
  let listings = data.value || [];

  const EXCLUDED_SUBTYPES = new Set<string>();
  if (params.excludeParking) {
    EXCLUDED_SUBTYPES.add("parking");
    EXCLUDED_SUBTYPES.add("locker");
    EXCLUDED_SUBTYPES.add("storage");
  }
  if (params.excludeBusinessSales) {
    EXCLUDED_SUBTYPES.add("business");
    EXCLUDED_SUBTYPES.add("commercial");
    EXCLUDED_SUBTYPES.add("sale of business");
  }
  if (EXCLUDED_SUBTYPES.size > 0) {
    listings = listings.filter((l) => {
      const sub = (l.PropertySubType || "").toLowerCase();
      for (const ex of EXCLUDED_SUBTYPES) {
        if (sub.includes(ex)) return false;
      }
      return true;
    });
  }

  const rawCount = data["@odata.count"] || listings.length;
  const totalCount = EXCLUDED_SUBTYPES.size > 0 ? listings.length : rawCount;
  const currentPage = Math.floor(skip / top) + 1;
  const totalPages = EXCLUDED_SUBTYPES.size > 0 ? 1 : Math.ceil(rawCount / top);

  return {
    listings,
    count: totalCount,
    numPages: totalPages,
    page: currentPage,
  };
}

export async function getDdfListing(listingKey: string): Promise<DdfListing | null> {
  const token = await getDdfToken();

  const url = `${DDF_API_BASE}/Property('${listingKey}')`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`DDF listing fetch failed: ${response.status}`);
  }

  return response.json();
}

export function normalizeDdfToRepliersFormat(ddf: DdfListing): any {
  const images = (ddf.Media || [])
    .sort((a, b) => (a.Order || 0) - (b.Order || 0))
    .map(m => m.MediaURL || "")
    .filter(Boolean);

  const sqft = ddf.LivingArea
    ? String(ddf.LivingArea)
    : ddf.BuildingAreaTotal
      ? String(ddf.BuildingAreaTotal)
      : undefined;

  return {
    mlsNumber: ddf.ListingId || ddf.ListingKey,
    listPrice: ddf.ListPrice || 0,
    address: {
      streetNumber: ddf.StreetNumber || "",
      streetName: ddf.StreetName || "",
      streetSuffix: ddf.StreetSuffix || "",
      streetDirectionPrefix: ddf.StreetDirPrefix || "",
      streetDirection: ddf.StreetDirSuffix || "",
      unitNumber: ddf.UnitNumber || "",
      city: ddf.City || "",
      neighborhood: ddf.CityRegion || "",
      state: ddf.StateOrProvince || "",
      zip: ddf.PostalCode || "",
      country: (ddf.Country === "Canada" || ddf.Country === "CAN") ? "CA" : ddf.Country || "CA",
      area: ddf.CityRegion || ddf.City || "",
    },
    map: ddf.Latitude && ddf.Longitude
      ? { latitude: ddf.Latitude, longitude: ddf.Longitude }
      : undefined,
    details: {
      numBedrooms: ddf.BedroomsTotal || undefined,
      numBathrooms: ddf.BathroomsTotalInteger || undefined,
      numBathroomsPlus: ddf.BathroomsPartial || undefined,
      sqft,
      propertyType: ddf.PropertySubType || ddf.StructureType || undefined,
      yearBuilt: ddf.YearBuilt ? String(ddf.YearBuilt) : undefined,
      description: ddf.PublicRemarks || undefined,
      numParkingSpaces: ddf.ParkingTotal || undefined,
      basement1: ddf.Basement?.join(", ") || undefined,
    },
    type: ddf.PropertySubType || "Residential",
    class: "ResidentialProperty",
    status: ddf.StandardStatus === "Active" ? "A" : ddf.StandardStatus,
    images,
    taxes: ddf.TaxAnnualAmount ? { annualAmount: ddf.TaxAnnualAmount } : undefined,
    daysOnMarket: ddf.OriginalEntryTimestamp
      ? Math.floor((Date.now() - new Date(ddf.OriginalEntryTimestamp).getTime()) / 86400000)
      : undefined,
    listDate: ddf.OriginalEntryTimestamp || undefined,
    totalActualRent: ddf.TotalActualRent || undefined,
    dataSource: "crea_ddf" as const,
  };
}

export async function searchDdfByMlsNumber(mlsNumber: string): Promise<DdfListing | null> {
  const token = await getDdfToken();

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", `ListingId eq '${mlsNumber.replace(/'/g, "''")}'`);
  queryParams.set("$top", "1");
  queryParams.set("$select", DDF_SELECT_FIELDS);

  const url = `${DDF_API_BASE}/Property?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF MLS search error:", response.status, errorText);
    throw new Error(`DDF MLS search failed: ${response.status} - ${errorText}`);
  }

  const data: DdfSearchResponse = await response.json();
  return data.value?.[0] || null;
}

export function isDdfConfigured(): boolean {
  return !!(process.env.CREA_DDF_USERNAME && process.env.CREA_DDF_PASSWORD);
}
