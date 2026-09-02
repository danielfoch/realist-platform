import { describe, expect, it } from "vitest";
import { parseDimensionString, parseLotDimensions } from "./lotDimensions";

describe("parseLotDimensions", () => {
  it("uses numeric fields in feet when the dimension string says FT", () => {
    const r = parseLotDimensions({ lotFrontage: 25, lotDepth: 120, lotSizeDimensions: "25 x 120 FT" });
    expect(r).toMatchObject({ frontageFt: 25, depthFt: 120, source: "fields" });
  });

  it("converts numeric metre fields when the string says M", () => {
    const r = parseLotDimensions({ lotFrontage: 7.62, lotDepth: 36.58, lotSizeDimensions: "7.62 x 36.58 M" });
    expect(r.source).toBe("fields");
    expect(r.frontageFt).toBeCloseTo(25, 0);
    expect(r.depthFt).toBeCloseTo(120, 0);
    expect(r.note).toMatch(/Converted from metres/);
  });

  it("infers metres from small numeric fields with no unit anywhere", () => {
    const r = parseLotDimensions({ lotFrontage: 9.14, lotDepth: 40.23 });
    expect(r.frontageFt).toBeCloseTo(30, 0);
    expect(r.depthFt).toBeCloseTo(132, 0);
    expect(r.note).toMatch(/Metres inferred/);
  });

  it("keeps large unit-less numeric fields as feet", () => {
    const r = parseLotDimensions({ lotFrontage: 30, lotDepth: 132 });
    expect(r).toMatchObject({ frontageFt: 30, depthFt: 132, source: "fields" });
    expect(r.note).toMatch(/Feet assumed/);
  });

  it("parses '25.00 x 120.00 Feet'", () => {
    const r = parseLotDimensions({ lotSizeDimensions: "25.00 x 120.00 Feet" });
    expect(r).toMatchObject({ frontageFt: 25, depthFt: 120, source: "dimensions_string" });
  });

  it("parses '× and 'by' separators with 'ft.'", () => {
    expect(parseLotDimensions({ lotSizeDimensions: "33 × 100 ft." })).toMatchObject({ frontageFt: 33, depthFt: 100 });
    expect(parseLotDimensions({ lotSizeDimensions: "40 by 110 feet" })).toMatchObject({ frontageFt: 40, depthFt: 110 });
  });

  it("parses per-side units like '25 ft x 120 ft'", () => {
    expect(parseLotDimensions({ lotSizeDimensions: "25 ft x 120 ft" })).toMatchObject({ frontageFt: 25, depthFt: 120 });
  });

  it("parses 'Metres' spelled out and uppercase X", () => {
    const r = parseLotDimensions({ lotSizeDimensions: "6.10 X 30.48 Metres" });
    expect(r.frontageFt).toBeCloseTo(20, 0);
    expect(r.depthFt).toBeCloseTo(100, 0);
  });

  it("uses a metric area unit as the unit hint for unit-less dims", () => {
    const r = parseLotDimensions({ lotFrontage: 12, lotDepth: 45, lotSizeArea: 540, lotSizeAreaUnits: "square meters" });
    expect(r.frontageFt).toBeCloseTo(39.4, 1);
    expect(r.depthFt).toBeCloseTo(147.6, 1);
    expect(r.areaSqft).toBe(Math.round(540 * 10.7639));
  });

  it("returns area_only for acres", () => {
    const r = parseLotDimensions({ lotSizeArea: 0.25, lotSizeAreaUnits: "acres" });
    expect(r).toMatchObject({ frontageFt: null, depthFt: null, areaSqft: 10_890, source: "area_only" });
  });

  it("returns area_only for hectares and sqft", () => {
    expect(parseLotDimensions({ lotSizeArea: 0.1, lotSizeAreaUnits: "hectares" }).areaSqft).toBe(10_764);
    expect(parseLotDimensions({ lotSizeArea: "3,000", lotSizeAreaUnits: "sqft" }).areaSqft).toBe(3_000);
  });

  it("returns none when nothing is usable", () => {
    expect(parseLotDimensions({}).source).toBe("none");
    expect(parseLotDimensions({ lotFrontage: 0, lotDepth: -5, lotSizeDimensions: "irregular" }).source).toBe("none");
  });

  it("prefers numeric fields over the string when both exist", () => {
    const r = parseLotDimensions({ lotFrontage: 26, lotDepth: 118, lotSizeDimensions: "25 x 120 FT" });
    expect(r).toMatchObject({ frontageFt: 26, depthFt: 118, source: "fields" });
  });
});

describe("parseDimensionString", () => {
  it("returns raw numbers and the stated unit", () => {
    expect(parseDimensionString("7.62 x 36.58 M")).toEqual({ a: 7.62, b: 36.58, unit: "m" });
    expect(parseDimensionString("25 x 120")).toEqual({ a: 25, b: 120, unit: null });
    expect(parseDimensionString("n/a")).toBeNull();
  });
});
