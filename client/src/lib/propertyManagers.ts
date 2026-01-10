export interface PropertyManager {
  name: string;
  companyName: string;
  province: string;
  provinceCode: string;
  city?: string;
  bio: string;
  website?: string;
  email?: string;
  phone?: string;
  calendlyUrl?: string;
}

// Default property manager for all areas (Royal York Property Management)
export const defaultPropertyManager: PropertyManager = {
  name: "Royal York Property Management",
  companyName: "Royal York Property Management",
  province: "Ontario",
  provinceCode: "ON",
  city: "Toronto",
  bio: "Canada's largest property management company with a proven track record of maximizing rental income and protecting your investment. Full-service management including tenant placement, maintenance, and financial reporting.",
  website: "https://royalyorkpropertymanagement.ca",
  email: "info@royalyorkpropertymanagement.ca",
  calendlyUrl: "https://calendly.com/royalyork/consultation",
};

// Area-specific property managers (for future marketplace)
export const propertyManagers: Record<string, PropertyManager> = {};

// Get property manager for a specific city/province
export function getPropertyManager(city: string, provinceCode: string): PropertyManager {
  // Check for city-specific manager first
  const cityKey = `${city.toLowerCase()}_${provinceCode}`;
  if (propertyManagers[cityKey]) {
    return propertyManagers[cityKey];
  }
  
  // Check for province-level manager
  if (propertyManagers[provinceCode]) {
    return propertyManagers[provinceCode];
  }
  
  // Fall back to default (Royal York)
  return defaultPropertyManager;
}

// Check if there's a specific property manager for this area
export function hasPropertyManager(city: string, provinceCode: string): boolean {
  const cityKey = `${city.toLowerCase()}_${provinceCode}`;
  return cityKey in propertyManagers || provinceCode in propertyManagers;
}

export const propertyManagerApplicationUrl = "https://forms.gle/property-manager-application";
