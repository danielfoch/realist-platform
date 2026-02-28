interface DdfTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DdfListing {
  ListingKey: string;
  MlsNumber?: string;
  ListPrice?: number;
  StandardStatus?: string;
  PropertyType?: string;
  PropertySubType?: string;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  LivingArea?: number;
  YearBuilt?: number;
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  Country?: string;
  Latitude?: number;
  Longitude?: number;
  ListingId?: string;
  PublicRemarks?: string;
  TaxAnnualAmount?: number;
  ListOfficeName?: string;
  ListAgentFullName?: string;
  Media?: Array<{ MediaURL?: string; Order?: number }>;
  ModificationTimestamp?: string;
  ListingContractDate?: string;
  DaysOnMarket?: number;
  [key: string]: any;
}

interface DdfSearchResponse {
  value: DdfListing[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const DDF_AUTH_URL = "https://identity.crea.ca/connect/token";
const DDF_API_BASE = "https://data.crea.ca/reso/odata";

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
  propertyType?: string;
  top?: number;
  skip?: number;
}): Promise<{ listings: DdfListing[]; count: number; nextLink?: string }> {
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
  if (params.propertyType) {
    filters.push(`PropertyType eq '${params.propertyType.replace(/'/g, "''")}'`);
  }

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", filters.join(" and "));
  queryParams.set("$count", "true");
  queryParams.set("$top", String(params.top || 48));
  if (params.skip) queryParams.set("$skip", String(params.skip));
  queryParams.set("$orderby", "ModificationTimestamp desc");
  queryParams.set(
    "$select",
    [
      "ListingKey", "MlsNumber", "ListPrice", "StandardStatus",
      "PropertyType", "PropertySubType",
      "BedroomsTotal", "BathroomsTotalInteger", "LivingArea", "YearBuilt",
      "UnparsedAddress", "StreetNumber", "StreetName", "StreetSuffix",
      "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
      "City", "StateOrProvince", "PostalCode", "Country",
      "Latitude", "Longitude",
      "PublicRemarks", "TaxAnnualAmount",
      "ListOfficeName", "ListAgentFullName",
      "ModificationTimestamp", "ListingContractDate", "DaysOnMarket",
    ].join(",")
  );

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
    throw new Error(`DDF search failed: ${response.status}`);
  }

  const data: DdfSearchResponse = await response.json();

  return {
    listings: data.value || [],
    count: data["@odata.count"] || data.value?.length || 0,
    nextLink: data["@odata.nextLink"],
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
  return {
    mlsNumber: ddf.MlsNumber || ddf.ListingKey,
    listPrice: ddf.ListPrice || 0,
    address: {
      streetNumber: ddf.StreetNumber || "",
      streetName: ddf.StreetName || "",
      streetSuffix: ddf.StreetSuffix || "",
      streetDirectionPrefix: ddf.StreetDirPrefix || "",
      streetDirection: ddf.StreetDirSuffix || "",
      unitNumber: ddf.UnitNumber || "",
      city: ddf.City || "",
      state: ddf.StateOrProvince || "",
      zip: ddf.PostalCode || "",
      country: ddf.Country || "CA",
      area: ddf.City || "",
    },
    map: ddf.Latitude && ddf.Longitude
      ? { latitude: ddf.Latitude, longitude: ddf.Longitude }
      : undefined,
    details: {
      numBedrooms: ddf.BedroomsTotal || undefined,
      numBathrooms: ddf.BathroomsTotalInteger || undefined,
      sqft: ddf.LivingArea ? String(ddf.LivingArea) : undefined,
      propertyType: ddf.PropertySubType || ddf.PropertyType || undefined,
      yearBuilt: ddf.YearBuilt ? String(ddf.YearBuilt) : undefined,
      description: ddf.PublicRemarks || undefined,
    },
    type: ddf.PropertyType || "Residential",
    class: "ResidentialProperty",
    status: ddf.StandardStatus === "Active" ? "A" : ddf.StandardStatus,
    images: ddf.Media?.sort((a, b) => (a.Order || 0) - (b.Order || 0)).map(m => m.MediaURL || "").filter(Boolean) || [],
    taxes: ddf.TaxAnnualAmount ? { annualAmount: ddf.TaxAnnualAmount } : undefined,
    daysOnMarket: ddf.DaysOnMarket || undefined,
    listDate: ddf.ListingContractDate || undefined,
    dataSource: "crea_ddf" as const,
  };
}

export function isDdfConfigured(): boolean {
  return !!(process.env.CREA_DDF_USERNAME && process.env.CREA_DDF_PASSWORD);
}
