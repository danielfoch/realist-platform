/**
 * Coordinates for the cities the homepage map shows as its ambient rent
 * layer. Names match CMHC_CITY_RENTS keys exactly (lib/rents/cmhcRents.ts).
 * City-centre points, 2-decimal precision — plenty for a national map.
 */

export interface CityPoint {
  city: string;
  province: string;
  lat: number;
  lng: number;
}

export const CITY_COORDS: CityPoint[] = [
  // Ontario
  { city: "Toronto", province: "ON", lat: 43.65, lng: -79.38 },
  { city: "Mississauga", province: "ON", lat: 43.59, lng: -79.64 },
  { city: "Brampton", province: "ON", lat: 43.72, lng: -79.76 },
  { city: "Hamilton", province: "ON", lat: 43.26, lng: -79.87 },
  { city: "Ottawa", province: "ON", lat: 45.42, lng: -75.7 },
  { city: "London", province: "ON", lat: 42.98, lng: -81.25 },
  { city: "Kitchener", province: "ON", lat: 43.45, lng: -80.49 },
  { city: "Waterloo", province: "ON", lat: 43.46, lng: -80.52 },
  { city: "Windsor", province: "ON", lat: 42.32, lng: -83.04 },
  { city: "Oshawa", province: "ON", lat: 43.9, lng: -78.86 },
  { city: "Barrie", province: "ON", lat: 44.39, lng: -79.69 },
  { city: "Kingston", province: "ON", lat: 44.23, lng: -76.49 },
  { city: "Guelph", province: "ON", lat: 43.55, lng: -80.25 },
  { city: "St. Catharines", province: "ON", lat: 43.16, lng: -79.25 },
  { city: "Niagara Falls", province: "ON", lat: 43.09, lng: -79.08 },
  { city: "Oakville", province: "ON", lat: 43.45, lng: -79.69 },
  { city: "Burlington", province: "ON", lat: 43.33, lng: -79.8 },
  { city: "Sudbury", province: "ON", lat: 46.49, lng: -80.99 },
  { city: "Thunder Bay", province: "ON", lat: 48.38, lng: -89.25 },
  { city: "Peterborough", province: "ON", lat: 44.31, lng: -78.32 },
  // British Columbia
  { city: "Vancouver", province: "BC", lat: 49.28, lng: -123.12 },
  { city: "Surrey", province: "BC", lat: 49.19, lng: -122.85 },
  { city: "Burnaby", province: "BC", lat: 49.25, lng: -122.98 },
  { city: "Richmond", province: "BC", lat: 49.17, lng: -123.14 },
  { city: "Victoria", province: "BC", lat: 48.43, lng: -123.37 },
  { city: "Kelowna", province: "BC", lat: 49.89, lng: -119.5 },
  { city: "Kamloops", province: "BC", lat: 50.67, lng: -120.33 },
  { city: "Nanaimo", province: "BC", lat: 49.17, lng: -123.94 },
  { city: "Abbotsford", province: "BC", lat: 49.05, lng: -122.33 },
  { city: "Prince George", province: "BC", lat: 53.92, lng: -122.75 },
  // Prairies
  { city: "Calgary", province: "AB", lat: 51.05, lng: -114.07 },
  { city: "Edmonton", province: "AB", lat: 53.55, lng: -113.49 },
  { city: "Red Deer", province: "AB", lat: 52.27, lng: -113.81 },
  { city: "Lethbridge", province: "AB", lat: 49.69, lng: -112.84 },
  { city: "Saskatoon", province: "SK", lat: 52.13, lng: -106.67 },
  { city: "Regina", province: "SK", lat: 50.45, lng: -104.62 },
  { city: "Winnipeg", province: "MB", lat: 49.9, lng: -97.14 },
  // Quebec
  { city: "Montreal", province: "QC", lat: 45.5, lng: -73.57 },
  { city: "Quebec City", province: "QC", lat: 46.81, lng: -71.21 },
  { city: "Laval", province: "QC", lat: 45.57, lng: -73.71 },
  { city: "Gatineau", province: "QC", lat: 45.48, lng: -75.7 },
  { city: "Sherbrooke", province: "QC", lat: 45.4, lng: -71.89 },
  // Atlantic
  { city: "Halifax", province: "NS", lat: 44.65, lng: -63.58 },
  { city: "Moncton", province: "NB", lat: 46.09, lng: -64.78 },
  { city: "Saint John", province: "NB", lat: 45.27, lng: -66.06 },
  { city: "Fredericton", province: "NB", lat: 45.96, lng: -66.65 },
  { city: "Charlottetown", province: "PE", lat: 46.24, lng: -63.13 },
  { city: "St. John's", province: "NL", lat: 47.56, lng: -52.71 },
];
