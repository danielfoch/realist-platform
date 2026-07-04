import { describe, expect, it } from "vitest";
import { ASSESSMENT_ROLL_ADAPTERS, ASSESSMENT_ROLL_ATTRIBUTION } from "./assessmentRolls";

const adapter = (key: string) => {
  const a = ASSESSMENT_ROLL_ADAPTERS.find((c) => c.key === key);
  if (!a) throw new Error(`no adapter ${key}`);
  return a;
};

describe("Winnipeg adapter", () => {
  // Verbatim from the live Socrata resource d4mq-wa44 (2026-07).
  it("maps a real row, converting sqft areas to m²", () => {
    const r = adapter("winnipeg").mapRow({
      roll_number: "01000001000",
      full_address: "1636 MCCREARY ROAD",
      total_living_area: "1313",
      year_built: "1991",
      total_assessed_value: "893000",
      assessed_land_area: "197030",
      property_use_code: "RESSD - DETACHED SINGLE DWELLING",
      current_assessment_year: "2027",
      assessment_date: "2025-04-01T00:00:00.000",
    })!;
    expect(r.matricule).toBe("01000001000");
    expect(r.address).toBe("1636 MCCREARY ROAD");
    expect(r.looseAddressKey).toBe("1636 mccreary road");
    expect(r.yearBuilt).toBe(1991);
    expect(r.totalValue).toBe(893000);
    expect(r.floorAreaM2).toBeCloseTo(122, 0); // 1313 sqft
    expect(r.lotAreaM2).toBeCloseTo(18305, 0); // 197030 sqft
    expect(r.rollYear).toBe(2027);
    expect(r.marketRefDate).toBe("2025-04-01");
    expect(r.cubf).toBe("RESSD - DETACHED SINGLE DWELLING");
  });
});

describe("Calgary adapter", () => {
  // Verbatim from the live Socrata resource 4bsw-nn7w (2026-07).
  it("maps a real row; land_size_sm is already m², year has a .0 suffix", () => {
    const r = adapter("calgary").mapRow({
      roll_year: "2026",
      roll_number: "150104206",
      address: "15 DEERMEADE PL SE",
      assessed_value: "729000.0",
      assessment_class: "RE",
      year_of_construction: "1981.0",
      land_use_designation: "R-CG",
      land_size_sm: "610.1",
    })!;
    expect(r.matricule).toBe("150104206");
    expect(r.looseAddressKey).toBe("15 deermeade pl se");
    expect(r.totalValue).toBe(729000);
    expect(r.yearBuilt).toBe(1981);
    expect(r.lotAreaM2).toBeCloseTo(610.1, 1);
    expect(r.cubf).toBe("R-CG");
    expect(r.rollYear).toBe(2026);
    expect(r.floorAreaM2).toBeNull();
  });

  it("drops an implausible/zero year rather than storing it", () => {
    const r = adapter("calgary").mapRow({ roll_number: "1", address: "1 A ST", assessed_value: "100000", year_of_construction: "0" })!;
    expect(r.yearBuilt).toBeNull();
  });
});

describe("Edmonton adapter", () => {
  // Verbatim from the live Socrata resource q7d6-ambg (2026-07).
  it("assembles the address from house_number + street_name", () => {
    const r = adapter("edmonton").mapRow({
      account_number: "4058129",
      house_number: "870",
      street_name: "ABBOTTSFIELD ROAD NW",
      assessed_value: "165000",
      tax_class: "Residential",
      mill_class_1: "RESIDENTIAL",
      latitude: "53.57632901357068",
      longitude: "-113.39230350026378",
    })!;
    expect(r.matricule).toBe("4058129");
    expect(r.address).toBe("870 ABBOTTSFIELD ROAD NW");
    expect(r.looseAddressKey).toBe("870 abbottsfield road nw");
    expect(r.totalValue).toBe(165000);
    expect(r.cubf).toBe("RESIDENTIAL");
    expect(r.yearBuilt).toBeNull();
  });
});

describe("Nova Scotia (PVSC) adapter", () => {
  // Verbatim from the live PVSC resource a859-xvcs on thedatazone.ca (2026-07).
  it("assembles the address from parts, keeps the aan key and per-row municipality", () => {
    const r = adapter("ns-pvsc").mapRow({
      municipal_unit: "CAPE BRETON REGIONAL MUNICIPALITY (CBRM)",
      aan: "00000485",
      address_num: "10",
      address_street: "CLARKE",
      address_suffix: "AVE",
      address_city: "COXHEATH",
      living_units: "1",
      year_built: "1980",
      square_foot_living_area: "2066",
      style: "1 Storey",
    })!;
    expect(r.matricule).toBe("00000485"); // aan keeps its leading zeros (string, not int)
    expect(r.municipalityName).toBe("CAPE BRETON REGIONAL MUNICIPALITY (CBRM)");
    expect(r.address).toBe("10 CLARKE AVE");
    expect(r.looseAddressKey).toBe("10 clarke ave");
    expect(r.yearBuilt).toBe(1980);
    expect(r.floorAreaM2).toBeCloseTo(192, 0); // 2066 sqft
    expect(r.dwellings).toBe(1);
    expect(r.totalValue).toBeNull(); // assessed value is aan-joined from bt58 (follow-up)
    expect(r.cubf).toBe("1 Storey");
  });
});

describe("shared behaviour", () => {
  it("returns null when the roll/account id is missing", () => {
    expect(adapter("winnipeg").mapRow({ full_address: "1 Main St" })).toBeNull();
    expect(adapter("calgary").mapRow({ address: "1 Main St" })).toBeNull();
    expect(adapter("edmonton").mapRow({ house_number: "1", street_name: "MAIN ST" })).toBeNull();
    expect(adapter("ns-pvsc").mapRow({ address_num: "1", address_street: "MAIN" })).toBeNull();
  });

  it("exposes an attribution string per source", () => {
    expect(ASSESSMENT_ROLL_ATTRIBUTION.winnipeg).toMatch(/Winnipeg/);
    expect(ASSESSMENT_ROLL_ATTRIBUTION.calgary).toMatch(/Calgary/);
    expect(ASSESSMENT_ROLL_ATTRIBUTION.edmonton).toMatch(/Edmonton/);
    expect(ASSESSMENT_ROLL_ATTRIBUTION["ns-pvsc"]).toMatch(/PVSC/);
  });
});
