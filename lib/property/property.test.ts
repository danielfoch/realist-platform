import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestSchema, number, sameStreet } from "./model";
import { geocode } from "./geocode";
import { assessmentAtAddress, permitsAtAddress, torontoVariances } from "./municipal";
const mockFetch = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => { vi.unstubAllGlobals(); mockFetch.mockReset(); });
const respond = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });

describe("property request and civic identity", () => {
  it("requires a full coordinate pair, rejecting blank, out-of-country and unknown values", () => {
    expect(requestSchema.safeParse({ lat: 43 }).success).toBe(false);
    expect(requestSchema.safeParse({ lat: 43, lng: "" }).success).toBe(false);
    expect(requestSchema.safeParse({ address: "15 Deermeade Pl SE, Calgary", source_url: "http://localhost/" }).success).toBe(false);
    expect(requestSchema.safeParse({ lat: 0, lng: 0 }).success).toBe(false);
    expect(requestSchema.safeParse({ address: "15 % street, Calgary" }).success).toBe(false);
    expect(requestSchema.safeParse({ lat: 43.6, lng: -79.3 }).success).toBe(true);
  });
  it("preserves street type and directional identity while accepting abbreviations", () => {
    expect(sameStreet("15 Deermeade Pl SE", "15 DEERMEADE PLACE SOUTHEAST")).toBe(true);
    expect(sameStreet("15 Deermeade Pl SE", "15 Deermeade Road SE")).toBe(false);
    expect(sameStreet("100 Queen St W", "100 Queen Street East")).toBe(false);
    expect(sameStreet("47 Ch St-Isidore", "47 Chemin Saint Isidore")).toBe(true);
    expect(sameStreet("90 St John St W", "90 Saint John Street West")).toBe(true);
    expect(number(null)).toBeNull(); expect(number(" ")).toBeNull(); expect(number("0")).toBe(0);
  });
});
describe("federal geocoding", () => {
  const hit = { key: "locate", name: "15 Deermeade Place Southeast, Calgary, Alberta", province: "Alberta", category: "Street", lat: 50.92, lng: -114.0, tag: ["INTERPOLATED_POSITION"] };
  it("labels a strict civic match as approximate and uses the replacement service", async () => {
    mockFetch.mockResolvedValue(respond([hit, { ...hit, name: "15 Deermeade Road Southeast, Calgary, Alberta" }]));
    const result = await geocode({ address: "15 Deermeade Pl SE, Calgary, AB" });
    expect(result.status).toBe("available"); expect(result.data?.accuracy).toBe("street_interpolated");
    const url = mockFetch.mock.calls[0][0] as URL;
    expect(url.hostname).toBe("geolocator.api.geo.ca"); expect(url.searchParams.get("keys")).toBe("locate");
  });
  it("accepts a province followed by a postal code and keeps city with supplied coordinates", async () => {
    mockFetch.mockResolvedValue(respond([hit]));
    expect((await geocode({ address: "15 Deermeade Pl SE, Calgary, AB T2J 5J8" })).status).toBe("available");
    expect((await geocode({ address: "90 Ash Crescent, Toronto, ON", lat: 43.6, lng: -79.4 })).data).toMatchObject({ address: "90 Ash Crescent", city: "Toronto", province: "ON", accuracy: "caller_supplied" });
  });
  it("rejects a street centroid, wrong municipality, different street and competing cities", async () => {
    mockFetch.mockResolvedValueOnce(respond([{ ...hit, tag: ["INTERPOLATED_CENTROID"] }]));
    expect((await geocode({ address: "15 Deermeade Pl SE", city: "Calgary" })).status).toBe("no_match");
    mockFetch.mockResolvedValueOnce(respond([{ ...hit, name: "15 Deermeade Place Southeast, Edmonton, Alberta" }]));
    expect((await geocode({ address: "15 Deermeade Pl SE", city: "Calgary" })).status).toBe("no_match");
    mockFetch.mockResolvedValueOnce(respond([hit, { ...hit, name: "15 Deermeade Place Southeast, Edmonton, Alberta" }]));
    expect((await geocode({ address: "15 Deermeade Pl SE" })).status).toBe("ambiguous");
  });
  it("never invents zero coordinates on an outage", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const result = await geocode({ address: "15 Deermeade Pl SE, Calgary, AB" });
    expect(result.status).toBe("unavailable"); expect(result.data).toBeNull();
  });
});
describe("municipal records", () => {
  it("maps Calgary's assessment, preserving unknowns and excluding source owner information", async () => {
    mockFetch.mockResolvedValue(respond([{ address: "15 DEERMEADE PL SE", roll_number: "150104206", roll_year: "2026", assessed_value: "729000.0", year_of_construction: "1981.0", land_size_sm: "610.1", owner_name: "PRIVATE" }]));
    const result = await assessmentAtAddress("15 Deermeade Place Southeast", "Calgary", "Alberta");
    expect(result.status).toBe("available"); expect(result.data).toMatchObject({ assessedValue: 729000, lotAreaM2: 610.1, yearBuilt: 1981, floorAreaM2: null, marketValueEstimate: null });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("refuses separate property units at the same address", async () => {
    mockFetch.mockResolvedValue(respond([1, 2].map(n => ({ address: "15 DEERMEADE PL SE", roll_number: String(n), roll_year: "2026", assessed_value: "100000" }))));
    const result = await assessmentAtAddress("15 Deermeade Pl SE", "Calgary", "AB");
    expect(result.status).toBe("ambiguous"); expect(result.data).toBeNull();
  });
  it("does not attach a different street or imply absence on an outage", async () => {
    mockFetch.mockResolvedValueOnce(respond([{ address: "15 DEERMEADE RD SE", roll_number: "1" }]));
    expect((await assessmentAtAddress("15 Deermeade Pl SE", "Calgary", "AB")).status).toBe("no_match");
    mockFetch.mockResolvedValueOnce(new Response("error", { status: 503 }));
    expect((await assessmentAtAddress("15 Deermeade Pl SE", "Calgary", "AB")).status).toBe("unavailable");
  });
  it("converts Winnipeg square feet to square metres and keeps the published roll year", async () => {
    mockFetch.mockResolvedValue(respond([{ full_address: "1636 MCCREARY ROAD", roll_number: "1", total_living_area: "1313", assessed_land_area: "197030", current_assessment_year: "2027", year_built: "1991" }]));
    const result = await assessmentAtAddress("1636 McCreary Rd", "Winnipeg", "MB");
    expect(result.data?.floorAreaM2).toBeCloseTo(122, 0); expect(result.data?.rollYear).toBe(2027); expect(result.data?.assessedValue).toBeNull();
  });
  it("bounds permit history, only matches this street, and strips applicant details", async () => {
    mockFetch.mockResolvedValue(respond([{ originaladdress: "248 SADDLELAKE DR NE", permitnum: "BP2013-09623", description: "SFD", estprojectcost: "246089.8", applicantname: "PRIVATE" }, { originaladdress: "248 SADDLELAKE RD NE", permitnum: "OTHER" }]));
    const result = await permitsAtAddress("248 Saddlelake Drive Northeast", "Calgary");
    expect(result.status).toBe("available"); expect(JSON.stringify(result)).not.toContain("OTHER"); expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("queries both Toronto feeds and preserves missing permit cost as null", async () => {
    mockFetch.mockImplementation(async (url: URL) => {
      expect(JSON.parse(url.searchParams.get("filters")!)).toEqual({ STREET_NUM: "90", STREET_NAME: "ASH" });
      return respond({ success: true, result: { records: [{ STREET_NUM: "90", STREET_NAME: "ASH", STREET_TYPE: "CRES", PERMIT_NUM: "P1", REVISION_NUM: "00", DESCRIPTION: "Fourplex", BUILDER_NAME: "PRIVATE" }], total: 1 } });
    });
    const result = await permitsAtAddress("90 Ash Crescent", "Toronto");
    expect(result.status).toBe("available"); expect(mockFetch).toHaveBeenCalledTimes(2); expect(JSON.stringify(result)).toContain('"estimatedProjectValue":null'); expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("never presents incomplete CKAN results as a complete no-match", async () => {
    mockFetch.mockResolvedValue(respond({ success: true, result: { records: [], total: 150 } }));
    expect((await torontoVariances("90 Ash Crescent", "Toronto")).status).toBe("unavailable");
  });
  it("keeps available Toronto records when the other feed is down", async () => {
    mockFetch.mockImplementation(async (url: URL) => url.searchParams.get("resource_id") === "51fd09cd-99d6-430a-9d42-c24a937b0cb0" ? new Response("error", { status: 503 }) : respond({ success: true, result: { records: [{ STREET_NUM: "90", STREET_NAME: "ASH", STREET_TYPE: "CRES", "REFERENCE_FILE#": "A1", C_OF_A_DESCISION: "Approved" }], total: 1 } }));
    const result = await torontoVariances("90 Ash Crescent", "Toronto");
    expect(result.status).toBe("available"); expect(result.truncated).toBe(true); expect(result.note).toContain("Incomplete");
  });
  it("matches Edmonton street abbreviations after a civic-number query", async () => {
    mockFetch.mockResolvedValue(respond([{ house_number: "1214", street_name: "16 AVENUE NW", account_number: "11140552", assessed_value: "570000" }]));
    const result = await assessmentAtAddress("1214 16 Ave NW", "Edmonton", "AB");
    expect(result.status).toBe("available"); expect(result.data?.assessedValue).toBe(570000);
  });
  it("rejects unexpected provider schemas", async () => {
    mockFetch.mockResolvedValue(respond({ error: "quota" }));
    expect((await assessmentAtAddress("15 Deermeade Pl SE", "Calgary", "AB")).status).toBe("unavailable");
  });
});
