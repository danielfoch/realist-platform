import { describe, expect, it } from "vitest";
import {
  bboxOfGeometry,
  haversineMeters,
  pointInBbox,
  pointInGeometry,
  type GeoMultiPolygon,
  type GeoPolygon,
} from "./geoGeometry";

// Unit square at the origin
const square: GeoPolygon = {
  type: "Polygon",
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};

// Square with a hole in the middle
const donut: GeoPolygon = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};

const multi: GeoMultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]],
  ],
};

describe("pointInGeometry", () => {
  it("detects inside/outside for a simple polygon", () => {
    expect(pointInGeometry(5, 5, square)).toBe(true);
    expect(pointInGeometry(15, 5, square)).toBe(false);
    expect(pointInGeometry(-1, -1, square)).toBe(false);
  });

  it("respects holes", () => {
    expect(pointInGeometry(5, 5, donut)).toBe(false); // in the hole
    expect(pointInGeometry(2, 2, donut)).toBe(true); // in the ring
  });

  it("handles multipolygons", () => {
    expect(pointInGeometry(1, 1, multi)).toBe(true);
    expect(pointInGeometry(21, 21, multi)).toBe(true);
    expect(pointInGeometry(10, 10, multi)).toBe(false);
  });
});

describe("bbox helpers", () => {
  it("computes and tests bounding boxes", () => {
    const bbox = bboxOfGeometry(multi);
    expect(bbox).toEqual({ minLng: 0, minLat: 0, maxLng: 22, maxLat: 22 });
    expect(pointInBbox(1, 1, bbox)).toBe(true);
    expect(pointInBbox(23, 1, bbox)).toBe(false);
    expect(pointInBbox(23, 1, bbox, 2)).toBe(true); // padded
  });
});

describe("haversineMeters", () => {
  it("measures a known Toronto distance (CN Tower to Union Station ~ 500-600m)", () => {
    const d = haversineMeters(43.6426, -79.3871, 43.6453, -79.3806);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(700);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters(43.65, -79.38, 43.65, -79.38)).toBe(0);
  });
});
