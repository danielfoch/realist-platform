export const canadaProvinces = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
];

export const provinceCodeMap: Record<string, string> = {
  "Alberta": "AB",
  "British Columbia": "BC",
  "Manitoba": "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  "Nunavut": "NU",
  "Ontario": "ON",
  "Prince Edward Island": "PE",
  "Quebec": "QC",
  "Saskatchewan": "SK",
  "Yukon": "YT",
};

export const PROVINCES: { value: string; label: string }[] = [
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "QC", label: "Quebec" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
];

export function getProvinceCode(province: string): string {
  return provinceCodeMap[province] || province;
}

export function isOntario(province: string): boolean {
  return province === "Ontario" || province === "ON";
}

export interface MarketExpert {
  name: string;
  available: boolean;
  becomePartner?: boolean;
}

// Durham Region municipalities
const durhamRegionCities = [
  "oshawa", "pickering", "ajax", "whitby", "clarington", 
  "brock", "scugog", "uxbridge", "durham", "bowmanville",
  "courtice", "newcastle", "port perry", "brooklin"
];

function isDurhamRegion(city?: string): boolean {
  if (!city) return false;
  const normalizedCity = city.toLowerCase().trim();
  return durhamRegionCities.some(durhamCity => 
    normalizedCity.includes(durhamCity) || durhamCity.includes(normalizedCity)
  );
}

export function getMarketExpert(province: string, city?: string): MarketExpert {
  const code = getProvinceCode(province);
  
  // Check for Durham Region first (Ontario sub-region)
  if (code === "ON" && isDurhamRegion(city)) {
    return { name: "Trevor Nicolle", available: true };
  }
  
  switch (code) {
    case "ON":
      return { name: "Daniel Foch", available: true };
    case "BC":
      return { name: "James Anderson", available: true };
    case "AB":
      if (city?.toLowerCase().includes("calgary")) {
        return { name: "Sylvia Castonguay", available: true };
      }
      return { name: "", available: false };
    case "SK":
      return { name: "", available: false };
    case "MB":
      return { name: "Get your name here", available: false, becomePartner: true };
    case "QC":
      return { name: "LJ Aguinaga", available: true };
    case "NB":
      return { name: "Cameron Biroux", available: true };
    case "NS":
      return { name: "", available: false };
    default:
      return { name: "", available: false };
  }
}
