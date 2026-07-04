import { describe, expect, it } from "vitest";
import { mtm10ToLatLng, isWithinToronto } from "./torontoMtm";
import { mapDevelopmentRow } from "./developmentApplications";

describe("mtm10ToLatLng", () => {
  it("reprojects a real Toronto dev-application X/Y to the right place", () => {
    // 1001 Sheppard Ave E (verified against the live datastore, 2026-07).
    const { lat, lng } = mtm10ToLatLng(314865.906, 4847691.211);
    expect(lat).toBeCloseTo(43.771, 2);
    expect(lng).toBeCloseTo(-79.375, 2);
    expect(isWithinToronto({ lat, lng })).toBe(true);
  });

  it("rejects points outside the Toronto envelope", () => {
    expect(isWithinToronto({ lat: 45.5, lng: -73.6 })).toBe(false); // Montreal
    expect(isWithinToronto({ lat: 43.7, lng: -79.4 })).toBe(true);
  });
});

describe("mapDevelopmentRow", () => {
  // Field values verbatim from the live CKAN datastore (2026-07).
  const REAL = {
    application_type: "SA",
    "application#": "24 129384 NNY 17 SA",
    street_num: "1001",
    street_name: "SHEPPARD",
    street_type: "AVE",
    street_direction: "E",
    date_submitted: "2024-03-25T00:00:00",
    status: "Under Review ",
    x: "314865.906",
    y: "4847691.211",
    description: "Official Plan Amendment and Zoning By-law Amendment applications",
    ward_number: "17",
    ward_name: "Don Valley North",
    application_url: "https://www.toronto.ca/AIC/x",
  };

  it("maps a real row and reprojects its coordinates into Toronto", () => {
    const r = mapDevelopmentRow(REAL)!;
    expect(r.applicationNumber).toBe("24 129384 NNY 17 SA");
    expect(r.applicationType).toBe("SA");
    expect(r.address).toBe("1001 SHEPPARD AVE E");
    expect(r.status).toBe("Under Review"); // trimmed
    expect(r.dateSubmitted).toBe("2024-03-25");
    expect(r.lat).toBeCloseTo(43.771, 2);
    expect(r.lng).toBeCloseTo(-79.375, 2);
  });

  it("nulls coordinates when X/Y are absent, and drops rows without an application number", () => {
    const noCoords = mapDevelopmentRow({ ...REAL, x: "", y: "" })!;
    expect(noCoords.lat).toBeNull();
    expect(noCoords.lng).toBeNull();
    expect(mapDevelopmentRow({ street_num: "1", street_name: "MAIN" })).toBeNull();
  });
});
