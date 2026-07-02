import { describe, expect, it } from "vitest";
import {
  deriveNeighbourhoodStats,
  emptyDaProfile,
  indexCensusColumns,
  isWantedCharacteristic,
  parseCensusCsv,
  parseCensusValue,
} from "./censusProfile";

// Verbatim rows from the real 98-401-X2021006 Territories extract (DA 60010188),
// including the embedded-comma "Population, 2021" name and indented child names.
const HEADER =
  "CENSUS_YEAR,DGUID,ALT_GEO_CODE,GEO_LEVEL,GEO_NAME,TNR_SF,TNR_LF,DATA_QUALITY_FLAG,CHARACTERISTIC_ID,CHARACTERISTIC_NAME,CHARACTERISTIC_NOTE,C1_COUNT_TOTAL,SYMBOL,C2_COUNT_MEN+,SYMBOL,C3_COUNT_WOMEN+,SYMBOL,C10_RATE_TOTAL,SYMBOL,C11_RATE_MEN+,SYMBOL,C12_RATE_WOMEN+,SYMBOL";

const row = (id: number, name: string, value: string): string =>
  `2021,"2021S051260010188","60010188","Dissemination area","60010188",11.1,30.9,"01030",${id},"${name}",,${value},"",,"...",,"...",,"...",,"...",,"..."`;

const FIXTURE = [
  HEADER,
  row(1, "Population, 2021", "479"),
  row(4, "Total private dwellings", "234"),
  row(6, "Population density per square kilometre", "478.9"),
  row(41, "Total - Occupied private dwellings by structural type of dwelling - 100% data", "210"),
  row(42, "  Single-detached house", "145"),
  row(46, "  Apartment in a building that has fewer than five storeys", "15"),
  row(49, "  Movable dwelling", "30"),
  row(57, "Average household size", "2.3"),
  row(243, "  Median total income of household in 2020 ($)", "76500"),
  row(1414, "Total - Private households by tenure - 25% sample data", "205"),
  row(1415, "  Owner", "95"),
  row(1416, "  Renter", "110"),
  row(1440, "Total - Occupied private dwellings by period of construction - 25% sample data", "205"),
  row(1442, "  1961 to 1980", "80"),
  row(1447, "  2011 to 2015", "10"),
  row(1488, "  Median value of dwellings ($)", "150000"),
  row(1494, "  Median monthly shelter costs for rented dwellings ($)", "950"),
  // Non-DA geography must be ignored:
  `2021,"2021A000011124","01","Country","Canada",3.1,4.3,"20000",1,"Population, 2021",1,36991981,"",,"...",,"...",,"...",,"...",,"..."`,
  // Unwanted characteristic on the DA must be ignored:
  row(8, "Total - Age groups of the population - 100% data", "480"),
].join("\n");

describe("parseCensusValue", () => {
  it("parses plain and decimal numbers", () => {
    expect(parseCensusValue("479")).toBe(479);
    expect(parseCensusValue("478.9")).toBe(478.9);
  });

  it("returns null for StatCan suppression symbols and blanks", () => {
    for (const symbol of ["", "  ", "x", "F", "..", "..."]) {
      expect(parseCensusValue(symbol)).toBeNull();
    }
  });
});

describe("indexCensusColumns", () => {
  it("resolves the columns the importer needs", () => {
    const cols = indexCensusColumns(HEADER.split(","));
    expect(cols).toEqual({ altGeoCode: 2, geoLevel: 3, characteristicId: 8, countTotal: 11 });
  });

  it("throws on a header missing a required column", () => {
    expect(() => indexCensusColumns(["DGUID", "GEO_LEVEL"])).toThrow(/ALT_GEO_CODE/);
  });
});

describe("parseCensusCsv", () => {
  it("builds one profile per dissemination area from real-format rows", () => {
    const profiles = parseCensusCsv(FIXTURE);
    expect(profiles).toHaveLength(1);
    const p = profiles[0];
    expect(p.dauid).toBe("60010188");
    expect(p.population).toBe(479);
    expect(p.totalPrivateDwellings).toBe(234);
    expect(p.populationDensityPerKm2).toBe(478.9);
    expect(p.avgHouseholdSize).toBe(2.3);
    expect(p.medianHouseholdIncome).toBe(76500);
    expect(p.householdsByTenureTotal).toBe(205);
    expect(p.ownerHouseholds).toBe(95);
    expect(p.renterHouseholds).toBe(110);
    expect(p.medianDwellingValue).toBe(150000);
    expect(p.medianRentedShelterCost).toBe(950);
    expect(p.dwellingsByTypeTotal).toBe(210);
    expect(p.dwellingMix).toEqual({ singleDetached: 145, apartmentUnderFiveStoreys: 15, movableDwelling: 30 });
    expect(p.constructionPeriodsTotal).toBe(205);
    expect(p.constructionPeriods).toEqual({ "1961 to 1980": 80, "2011 to 2015": 10 });
  });

  it("keeps suppressed values as null", () => {
    const suppressed = [HEADER, row(243, "  Median total income of household in 2020 ($)", "x")].join("\n");
    const [p] = parseCensusCsv(suppressed);
    expect(p.medianHouseholdIncome).toBeNull();
  });
});

describe("isWantedCharacteristic", () => {
  it("accepts scalar, dwelling-type and construction-period ids and rejects others", () => {
    for (const id of [1, 6, 41, 42, 49, 57, 243, 1414, 1416, 1440, 1448, 1488, 1494]) {
      expect(isWantedCharacteristic(id)).toBe(true);
    }
    for (const id of [2, 8, 50, 244, 1417, 1439, 9999]) {
      expect(isWantedCharacteristic(id)).toBe(false);
    }
  });
});

describe("deriveNeighbourhoodStats", () => {
  it("derives tenure shares, dominant dwelling type and newer-construction share", () => {
    const [profile] = parseCensusCsv(FIXTURE);
    const stats = deriveNeighbourhoodStats(profile);
    expect(stats.renterSharePct).toBe(53.7);
    expect(stats.ownerSharePct).toBe(46.3);
    expect(stats.dominantDwellingType).toEqual({ type: "singleDetached", sharePct: 69 });
    expect(stats.builtSince2001SharePct).toBe(4.9); // 10 of 205
    expect(stats.medianHouseholdIncome).toBe(76500);
    expect(stats.attribution).toMatch(/Statistics Canada/);
  });

  it("returns nulls rather than dividing by zero or missing denominators", () => {
    const stats = deriveNeighbourhoodStats(emptyDaProfile("35000001"));
    expect(stats.renterSharePct).toBeNull();
    expect(stats.ownerSharePct).toBeNull();
    expect(stats.dominantDwellingType).toBeNull();
    expect(stats.builtSince2001SharePct).toBeNull();
  });
});
