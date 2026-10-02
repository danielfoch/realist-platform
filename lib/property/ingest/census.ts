/** Bound to Statistics Canada CL_CHARACTERISTIC 1.3 English labels, verified 2026-10-02. */
export const censusScalars: Record<string, string> = {
  "1": "population",
  "4": "totalPrivateDwellings",
  "5": "dwellingsOccupiedByUsualResidents",
  "6": "populationDensityPerKm2",
  "7": "landAreaKm2",
  "56": "avgHouseholdSize",
  "229": "medianHouseholdIncome",
  "238": "avgHouseholdIncome",
  "1400": "householdsByTenureTotal",
  "1401": "ownerHouseholds",
  "1402": "renterHouseholds",
  "1474": "medianDwellingValue",
  "1475": "avgDwellingValue",
  "1480": "medianRentedShelterCost",
  "1481": "avgRentedShelterCost"
};
export const censusTypes: Record<string, string> = {
  "42": "singleDetached",
  "43": "semiDetached",
  "44": "rowHouse",
  "45": "duplexApartment",
  "46": "apartmentUnderFiveStoreys",
  "47": "apartmentFivePlusStoreys",
  "48": "otherSingleAttached",
  "49": "movableDwelling"
};
export const censusPeriods: Record<string, string> = {
  "1427": "1960 or before",
  "1428": "1961 to 1980",
  "1429": "1981 to 1990",
  "1430": "1991 to 2000",
  "1431": "2001 to 2005",
  "1432": "2006 to 2010",
  "1433": "2011 to 2015",
  "1434": "2016 to 2021"
};
export const censusLabels: Record<string, string> = {
  "1": "Population, 2021",
  "4": "Total private dwellings",
  "5": "Private dwellings occupied by usual residents",
  "6": "Population density per square kilometre",
  "7": "Land area in square kilometres",
  "56": "Average household size",
  "229": "Median total income of household in 2020 ($)",
  "238": "Average total income of household in 2020 ($)",
  "1400": "Total - Private households by tenure - 25% sample data",
  "1401": "Owner",
  "1402": "Renter",
  "1474": "Median value of dwellings ($)",
  "1475": "Average value of dwellings ($)",
  "1480": "Median monthly shelter costs for rented dwellings ($)",
  "1481": "Average monthly shelter costs for rented dwellings ($)",
  "42": "Single-detached house",
  "43": "Semi-detached house",
  "44": "Row house",
  "45": "Apartment or flat in a duplex",
  "46": "Apartment in a building that has fewer than five storeys",
  "47": "Apartment in a building that has five or more storeys",
  "48": "Other single-attached house",
  "49": "Movable dwelling",
  "1427": "1960 or before",
  "1428": "1961 to 1980",
  "1429": "1981 to 1990",
  "1430": "1991 to 2000",
  "1431": "2001 to 2005",
  "1432": "2006 to 2010",
  "1433": "2011 to 2015",
  "1434": "2016 to 2021",
  "41": "Total - Occupied private dwellings by structural type of dwelling - 100% data",
  "1426": "Total - Occupied private dwellings by period of construction - 25% sample data"
};
export const CENSUS_MAPPING_VERSION = "statcan-2021-characteristics-1.3-verified";

/** Guard meanings, not just numeric codes, before any candidate import is assembled. */
export function validateCensusLabels(xml: string): void {
  for (const [id, label] of Object.entries(censusLabels)) {
    const code = xml.match(new RegExp(`<(?:\\w+:)?Code\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?Code>`))?.[1];
    const english = code?.match(/<(?:\w+:)?Name\b[^>]*xml:lang="en"[^>]*>([\s\S]*?)<\/(?:\w+:)?Name>/)?.[1];
    if (english !== label) throw new Error(`Census characteristic ${id} definition changed; review mapping before import`);
  }
}
