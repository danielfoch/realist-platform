import { describe, expect, it } from "vitest";
import { PERMIT_CITY_ADAPTERS, permitLooseKey } from "./buildingPermits";

const adapter = (key: string) => {
  const a = PERMIT_CITY_ADAPTERS.find((c) => c.key === key);
  if (!a) throw new Error(`no adapter ${key}`);
  return a;
};

describe("permitLooseKey", () => {
  it("cuts city suffixes and unit markers before keying", () => {
    // Vancouver-style full address with unit marker
    expect(permitLooseKey("863 W 20TH AVENUE #3, Vancouver, BC V5Z 1Y3")).toBe("863 w 20th avenue");
    // matches the listing-side key for the same street
    expect(permitLooseKey("863 W 20th Avenue")).toBe("863 w 20th avenue");
  });

  it("returns null without a civic number", () => {
    expect(permitLooseKey("Lane behind Main St")).toBeNull();
    expect(permitLooseKey(null)).toBeNull();
  });
});

describe("Vancouver adapter", () => {
  // Field values verbatim from the live Opendatasoft CSV export (2026-07).
  it("maps a real export row", () => {
    const p = adapter("vancouver").mapRow({
      permitnumber: "DB-2020-02870",
      issuedate: "2021-02-05",
      projectvalue: "15000.0",
      typeofwork: "Demolition / Deconstruction",
      address: "4006 W 30TH AVENUE, Vancouver, BC V6S 1X5",
      projectdescription: "To demolish the existing one family dwelling building ($15,000) on this site.",
      propertyuse: "Dwelling Uses",
      geo_point_2d: "49.2534, -123.2018",
    })!;
    expect(p.permitNumber).toBe("DB-2020-02870");
    expect(p.city).toBe("Vancouver");
    expect(p.looseAddressKey).toBe("4006 w 30th avenue");
    expect(p.estimatedValue).toBe(15000);
    expect(p.issuedDate).toBe("2021-02-05");
    expect(p.lat).toBeCloseTo(49.2534);
    expect(p.lng).toBeCloseTo(-123.2018);
    expect(p.workType).toBe("Demolition / Deconstruction");
  });

  it("returns null coords for a malformed point and null for a missing permit number", () => {
    const a = adapter("vancouver");
    const p = a.mapRow({ permitnumber: "X", geo_point_2d: "not a point" })!;
    expect(p.lat).toBeNull();
    expect(a.mapRow({ address: "1 Main St" })).toBeNull();
  });
});

describe("Calgary adapter", () => {
  // Field values verbatim from the live Socrata CSV (2026-07).
  it("maps a real row including estprojectcost", () => {
    const p = adapter("calgary").mapRow({
      permitnum: "BP2026-03492",
      estprojectcost: "35000",
      statuscurrent: "Cancelled",
      issueddate: "2026-03-20T00:00:00.000",
      permittype: "Residential Improvement Project",
      workclassgroup: "Improvement",
      description: "Basement Dev",
      housingunits: "0",
      originaladdress: "91 CATALINA CI NE",
      latitude: "51.09056575496761",
      longitude: "-114.0",
    })!;
    expect(p.permitNumber).toBe("BP2026-03492");
    expect(p.looseAddressKey).toBe("91 catalina ci ne");
    expect(p.status).toBe("Cancelled");
    expect(p.issuedDate).toBe("2026-03-20");
    expect(p.estimatedValue).toBe(35000);
    expect(p.units).toBe(0);
  });
});

describe("Montréal adapter", () => {
  // Field values verbatim from the live CKAN datastore (2026-07).
  it("maps a real row, collapsing padded addresses", () => {
    const p = adapter("montreal").mapRow({
      no_demande: "1200002409",
      id_permis: "1200007320",
      date_emission: "1997-08-04",
      emplacement: "   23  rue Robert",
      arrondissement: "L'Île-Bizard - Sainte-Geneviève",
      description_type_demande: "Piscine",
      description_type_batiment: "Résidentiel",
      nature_travaux: "INSTALLATION D'UNE PISCINE",
      nb_logements: "0",
      longitude: "-73.88439323447705",
      latitude: "45.49252410972622",
    })!;
    expect(p.permitNumber).toBe("1200007320");
    expect(p.city).toBe("Montréal");
    expect(p.address).toBe("23 rue Robert");
    expect(p.looseAddressKey).toBe("23 robert");
    expect(p.issuedDate).toBe("1997-08-04");
    expect(p.workType).toBe("Piscine");
    expect(p.lat).toBeCloseTo(45.4925);
  });

  it("declares a browser UA header (the CKAN host rejects default agents)", () => {
    expect(adapter("montreal").headers?.["User-Agent"]).toMatch(/Mozilla/);
  });
});
