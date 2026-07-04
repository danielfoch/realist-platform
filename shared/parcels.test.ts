import { describe, expect, it } from "vitest";
import { parseParcelRow, parseStatedArea } from "./parcels";

describe("parseStatedArea", () => {
  it("parses the live 'NNN sq.m' format to square metres", () => {
    expect(parseStatedArea("271.68 sq.m")).toBe(271.7);
    expect(parseStatedArea("559.49 sq.m")).toBe(559.5);
  });
  it("converts sq.ft and acres, rejects junk", () => {
    expect(parseStatedArea("10763.9 sq.ft")).toBeCloseTo(1000, 0);
    expect(parseStatedArea("1 ac")).toBeCloseTo(4046.9, 0);
    expect(parseStatedArea("")).toBeNull();
    expect(parseStatedArea("n/a")).toBeNull();
  });
});

describe("parseParcelRow", () => {
  // Verbatim from the live Property Boundaries 4326 CSV (2026-07).
  const REAL = {
    parcelid: "5460202",
    feature_type: "COMMON",
    statedarea: "271.68 sq.m",
    geometry:
      '{"coordinates": [[[[-79.4175607337478, 43.6528059237451], [-79.417968635699, 43.6527253120818], [-79.4179945521022, 43.6527915212556], [-79.4175888141072, 43.6528776875076], [-79.4175607337478, 43.6528059237451]]]], "type": "MultiPolygon"}',
  };

  it("parses a real parcel row: id, area, geometry and bbox", () => {
    const p = parseParcelRow(REAL)!;
    expect(p.parcelId).toBe("5460202");
    expect(p.lotAreaM2).toBe(271.7);
    expect(p.geometry.type).toBe("MultiPolygon");
    expect(p.bbox.minLat).toBeCloseTo(43.6527, 3);
    expect(p.bbox.maxLng).toBeCloseTo(-79.4176, 3);
  });

  it("rejects rows with no id, no geometry, or non-polygon geometry", () => {
    expect(parseParcelRow({ ...REAL, parcelid: "" })).toBeNull();
    expect(parseParcelRow({ ...REAL, geometry: "" })).toBeNull();
    expect(parseParcelRow({ ...REAL, geometry: '{"type":"Point","coordinates":[0,0]}' })).toBeNull();
    expect(parseParcelRow({ ...REAL, geometry: "not json" })).toBeNull();
  });
});
