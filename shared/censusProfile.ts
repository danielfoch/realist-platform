/**
 * StatCan 2021 Census Profile (98-401-X2021006) → dissemination-area profiles.
 *
 * The comprehensive CSV is long-format: one row per (geography, characteristic),
 * grouped by geography. These helpers are pure (no I/O, no DB) so they can be
 * unit-tested under shared/ and consumed by scripts/import-census-da.ts, which
 * streams the multi-GB file line by line.
 *
 * Characteristics are matched by CHARACTERISTIC_ID — verified against the real
 * Territories extract (2026-07): names carry hierarchy indentation and embedded
 * commas, IDs are stable across the whole 2021 release.
 *
 * Licence: Statistics Canada Open Licence — attribution required on display
 * surfaces (see ATTRIBUTION below), no endorsement implied.
 */

import { parseCsv } from "./usListingsCsv";

export const CENSUS_YEAR = 2021;

export const ATTRIBUTION =
  "Source: Statistics Canada, Census of Population, 2021 (98-401-X2021006). Adapted under the Statistics Canada Open Licence.";

/** CHARACTERISTIC_ID → profile slot. */
const SCALAR_CHARACTERISTICS: Record<number, keyof ScalarSlots> = {
  1: "population",
  4: "totalPrivateDwellings",
  5: "dwellingsOccupiedByUsualResidents",
  6: "populationDensityPerKm2",
  7: "landAreaKm2",
  57: "avgHouseholdSize",
  243: "medianHouseholdIncome",
  252: "avgHouseholdIncome",
  1414: "householdsByTenureTotal",
  1415: "ownerHouseholds",
  1416: "renterHouseholds",
  1488: "medianDwellingValue",
  1489: "avgDwellingValue",
  1494: "medianRentedShelterCost",
  1495: "avgRentedShelterCost",
};

/** Structural type of dwelling (100% data), ID 41 = total. */
const DWELLING_TYPE_CHARACTERISTICS: Record<number, string> = {
  42: "singleDetached",
  43: "semiDetached",
  44: "rowHouse",
  45: "duplexApartment",
  46: "apartmentUnderFiveStoreys",
  47: "apartmentFivePlusStoreys",
  48: "otherSingleAttached",
  49: "movableDwelling",
};
const DWELLING_TYPE_TOTAL_ID = 41;

/** Period of construction (25% sample), ID 1440 = total. */
const CONSTRUCTION_PERIOD_CHARACTERISTICS: Record<number, string> = {
  1441: "1960 or before",
  1442: "1961 to 1980",
  1443: "1981 to 1990",
  1444: "1991 to 2000",
  1445: "2001 to 2005",
  1446: "2006 to 2010",
  1447: "2011 to 2015",
  1448: "2016 to 2021",
};
const CONSTRUCTION_PERIOD_TOTAL_ID = 1440;
/** Periods counted as "built 2001 or later" for the newer-construction share. */
const NEWER_PERIODS = new Set(["2001 to 2005", "2006 to 2010", "2011 to 2015", "2016 to 2021"]);

interface ScalarSlots {
  population: number | null;
  totalPrivateDwellings: number | null;
  dwellingsOccupiedByUsualResidents: number | null;
  populationDensityPerKm2: number | null;
  landAreaKm2: number | null;
  avgHouseholdSize: number | null;
  medianHouseholdIncome: number | null;
  avgHouseholdIncome: number | null;
  householdsByTenureTotal: number | null;
  ownerHouseholds: number | null;
  renterHouseholds: number | null;
  medianDwellingValue: number | null;
  avgDwellingValue: number | null;
  medianRentedShelterCost: number | null;
  avgRentedShelterCost: number | null;
}

export interface DaProfile extends ScalarSlots {
  dauid: string;
  censusYear: number;
  dwellingsByTypeTotal: number | null;
  dwellingMix: Record<string, number>;
  constructionPeriodsTotal: number | null;
  constructionPeriods: Record<string, number>;
}

/** Column indexes resolved from the CSV header row. */
export interface CensusColumnIndex {
  altGeoCode: number;
  geoLevel: number;
  characteristicId: number;
  countTotal: number;
}

export function indexCensusColumns(headerCells: string[]): CensusColumnIndex {
  const find = (name: string): number => {
    const idx = headerCells.findIndex((c) => c.trim().toUpperCase() === name);
    if (idx === -1) throw new Error(`Census CSV header is missing expected column ${name}`);
    return idx;
  };
  return {
    altGeoCode: find("ALT_GEO_CODE"),
    geoLevel: find("GEO_LEVEL"),
    characteristicId: find("CHARACTERISTIC_ID"),
    countTotal: find("C1_COUNT_TOTAL"),
  };
}

/** StatCan suppression/quality symbols ("x", "F", "..", "...") and blanks → null. */
export function parseCensusValue(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function emptyDaProfile(dauid: string): DaProfile {
  return {
    dauid,
    censusYear: CENSUS_YEAR,
    population: null,
    totalPrivateDwellings: null,
    dwellingsOccupiedByUsualResidents: null,
    populationDensityPerKm2: null,
    landAreaKm2: null,
    avgHouseholdSize: null,
    medianHouseholdIncome: null,
    avgHouseholdIncome: null,
    householdsByTenureTotal: null,
    ownerHouseholds: null,
    renterHouseholds: null,
    medianDwellingValue: null,
    avgDwellingValue: null,
    medianRentedShelterCost: null,
    avgRentedShelterCost: null,
    dwellingsByTypeTotal: null,
    dwellingMix: {},
    constructionPeriodsTotal: null,
    constructionPeriods: {},
  };
}

/** Apply one CSV data row's characteristic to the accumulating profile. */
export function applyCharacteristic(profile: DaProfile, characteristicId: number, value: number | null): void {
  const scalarSlot = SCALAR_CHARACTERISTICS[characteristicId];
  if (scalarSlot) {
    profile[scalarSlot] = value;
    return;
  }
  if (characteristicId === DWELLING_TYPE_TOTAL_ID) {
    profile.dwellingsByTypeTotal = value;
    return;
  }
  const dwellingType = DWELLING_TYPE_CHARACTERISTICS[characteristicId];
  if (dwellingType) {
    if (value !== null) profile.dwellingMix[dwellingType] = value;
    return;
  }
  if (characteristicId === CONSTRUCTION_PERIOD_TOTAL_ID) {
    profile.constructionPeriodsTotal = value;
    return;
  }
  const period = CONSTRUCTION_PERIOD_CHARACTERISTICS[characteristicId];
  if (period && value !== null) profile.constructionPeriods[period] = value;
}

/** True when the row's CHARACTERISTIC_ID is one this profile consumes (import fast-path). */
export function isWantedCharacteristic(characteristicId: number): boolean {
  return (
    characteristicId in SCALAR_CHARACTERISTICS ||
    characteristicId === DWELLING_TYPE_TOTAL_ID ||
    characteristicId in DWELLING_TYPE_CHARACTERISTICS ||
    characteristicId === CONSTRUCTION_PERIOD_TOTAL_ID ||
    characteristicId in CONSTRUCTION_PERIOD_CHARACTERISTICS
  );
}

/** Convenience for tests/small files: parse a whole CSV string into DA profiles. */
export function parseCensusCsv(content: string): DaProfile[] {
  const rows = parseCsv(content).filter((r) => r.length > 1);
  if (!rows.length) return [];
  const cols = indexCensusColumns(rows[0]);
  const profiles = new Map<string, DaProfile>();
  for (const row of rows.slice(1)) {
    if (row[cols.geoLevel]?.trim() !== "Dissemination area") continue;
    const dauid = row[cols.altGeoCode]?.trim();
    if (!dauid) continue;
    let profile = profiles.get(dauid);
    if (!profile) {
      profile = emptyDaProfile(dauid);
      profiles.set(dauid, profile);
    }
    const id = Number(row[cols.characteristicId]);
    if (!Number.isFinite(id) || !isWantedCharacteristic(id)) continue;
    applyCharacteristic(profile, id, parseCensusValue(row[cols.countTotal]));
  }
  return [...profiles.values()];
}

// ─── Display/derived stats ────────────────────────────────────────────────────

export interface NeighbourhoodStats {
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
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Share of a count against a denominator, or null when either side is unusable. */
function sharePct(count: number | null, total: number | null): number | null {
  if (count === null || total === null || total <= 0) return null;
  return round1((count / total) * 100);
}

export function deriveNeighbourhoodStats(profile: DaProfile): NeighbourhoodStats {
  let dominantDwellingType: NeighbourhoodStats["dominantDwellingType"] = null;
  if (profile.dwellingsByTypeTotal && profile.dwellingsByTypeTotal > 0) {
    const entries = Object.entries(profile.dwellingMix).sort((a, b) => b[1] - a[1]);
    if (entries.length && entries[0][1] > 0) {
      dominantDwellingType = {
        type: entries[0][0],
        sharePct: sharePct(entries[0][1], profile.dwellingsByTypeTotal)!,
      };
    }
  }

  let builtSince2001SharePct: number | null = null;
  if (profile.constructionPeriodsTotal && profile.constructionPeriodsTotal > 0) {
    const newer = Object.entries(profile.constructionPeriods)
      .filter(([period]) => NEWER_PERIODS.has(period))
      .reduce((sum, [, count]) => sum + count, 0);
    builtSince2001SharePct = sharePct(newer, profile.constructionPeriodsTotal);
  }

  return {
    dauid: profile.dauid,
    censusYear: profile.censusYear,
    population: profile.population,
    populationDensityPerKm2: profile.populationDensityPerKm2,
    avgHouseholdSize: profile.avgHouseholdSize,
    medianHouseholdIncome: profile.medianHouseholdIncome,
    renterSharePct: sharePct(profile.renterHouseholds, profile.householdsByTenureTotal),
    ownerSharePct: sharePct(profile.ownerHouseholds, profile.householdsByTenureTotal),
    medianDwellingValue: profile.medianDwellingValue,
    medianRentedShelterCost: profile.medianRentedShelterCost,
    dominantDwellingType,
    dwellingMix: profile.dwellingMix,
    builtSince2001SharePct,
    attribution: ATTRIBUTION,
  };
}

/** Human labels for dwelling-mix keys (client + SEO fallback rendering). */
export const DWELLING_TYPE_LABELS: Record<string, string> = {
  singleDetached: "Single-detached",
  semiDetached: "Semi-detached",
  rowHouse: "Row house",
  duplexApartment: "Duplex apartment",
  apartmentUnderFiveStoreys: "Low-rise apartment",
  apartmentFivePlusStoreys: "High-rise apartment",
  otherSingleAttached: "Other attached",
  movableDwelling: "Movable dwelling",
};
