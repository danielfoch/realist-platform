import { describe, expect, it } from "vitest";
import {
  frontageAlongPolylineMeters,
  geometryAreaSqMeters,
  geometryCentroid,
  convexHull,
  minDistanceToPolylineMeters,
  minimumRotatedRect,
  type GeoLineString,
  type GeoPolygon,
  type XY,
} from "./geoGeometry";

/**
 * A 20m (frontage) × 40m (depth) rectangular lot near downtown Toronto.
 * Built in real lng/lat so the local-projection math is exercised end-to-end.
 * At lat 43.66, 1° lng ≈ 80,560 m and 1° lat ≈ 111,320 m.
 */
const lat0 = 43.66;
const lng0 = -79.38;
const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
const dLng = (m: number) => m / mPerDegLng;
const dLat = (m: number) => m / 111320;

const lot: GeoPolygon = {
  type: "Polygon",
  coordinates: [[
    [lng0, lat0],
    [lng0 + dLng(20), lat0],
    [lng0 + dLng(20), lat0 + dLat(40)],
    [lng0, lat0 + dLat(40)],
    [lng0, lat0],
  ]],
};

describe("geometryAreaSqMeters", () => {
  it("computes a 20x40 lot as ~800 m² within 0.5%", () => {
    const area = geometryAreaSqMeters(lot);
    expect(area).toBeGreaterThan(800 * 0.995);
    expect(area).toBeLessThan(800 * 1.005);
  });

  it("subtracts holes", () => {
    const donut: GeoPolygon = {
      type: "Polygon",
      coordinates: [
        lot.coordinates[0],
        [
          [lng0 + dLng(5), lat0 + dLat(5)],
          [lng0 + dLng(15), lat0 + dLat(5)],
          [lng0 + dLng(15), lat0 + dLat(15)],
          [lng0 + dLng(5), lat0 + dLat(15)],
          [lng0 + dLng(5), lat0 + dLat(5)],
        ],
      ],
    };
    // 800 - (10*10)=100 => ~700
    expect(geometryAreaSqMeters(donut)).toBeGreaterThan(690);
    expect(geometryAreaSqMeters(donut)).toBeLessThan(710);
  });
});

describe("minimumRotatedRect", () => {
  it("recovers frontage=20 depth=40 from an axis-aligned lot", () => {
    const rect = minimumRotatedRect(lot)!;
    expect(rect.widthM).toBeGreaterThan(19.5);
    expect(rect.widthM).toBeLessThan(20.5);
    expect(rect.depthM).toBeGreaterThan(39.5);
    expect(rect.depthM).toBeLessThan(40.5);
  });

  it("recovers dimensions from a 30-degree-rotated lot", () => {
    // Rotate the 20x40 lot 30° about its first corner (in projected metres).
    const theta = (30 * Math.PI) / 180;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const cornersM: XY[] = [
      [0, 0], [20, 0], [20, 40], [0, 40],
    ];
    const rotated: GeoPolygon = {
      type: "Polygon",
      coordinates: [[
        ...cornersM.map(([x, y]): [number, number] => {
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;
          return [lng0 + dLng(rx), lat0 + dLat(ry)];
        }),
        [lng0, lat0],
      ]],
    };
    const rect = minimumRotatedRect(rotated)!;
    expect(rect.widthM).toBeGreaterThan(19);
    expect(rect.widthM).toBeLessThan(21);
    expect(rect.depthM).toBeGreaterThan(39);
    expect(rect.depthM).toBeLessThan(41);
  });
});

describe("convexHull", () => {
  it("drops interior points", () => {
    const hull = convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(hull).toHaveLength(4);
  });
});

describe("geometryCentroid", () => {
  it("returns the lot centre", () => {
    const c = geometryCentroid(lot)!;
    expect(c[0]).toBeCloseTo(lng0 + dLng(10), 5);
    expect(c[1]).toBeCloseTo(lat0 + dLat(20), 5);
  });
});

describe("minDistanceToPolylineMeters + frontageAlongPolylineMeters", () => {
  // A laneway running along the rear (north) edge of the lot, 3m behind it.
  const rearLane: GeoLineString = {
    type: "LineString",
    coordinates: [
      [lng0 - dLng(10), lat0 + dLat(43)],
      [lng0 + dLng(30), lat0 + dLat(43)],
    ],
  };
  // A street running along the front (south) edge, 4m in front.
  const frontStreet: GeoLineString = {
    type: "LineString",
    coordinates: [
      [lng0 - dLng(10), lat0 - dLat(4)],
      [lng0 + dLng(30), lat0 - dLat(4)],
    ],
  };

  it("measures rear-lane distance ~3m", () => {
    const d = minDistanceToPolylineMeters(lot, rearLane);
    expect(d).toBeGreaterThan(2.5);
    expect(d).toBeLessThan(3.5);
  });

  it("counts the ~20m front edge as frontage on the street", () => {
    const f = frontageAlongPolylineMeters(lot, frontStreet, 6);
    expect(f).toBeGreaterThan(19);
    expect(f).toBeLessThan(21);
  });

  it("does not count the front edge as frontage on the far rear lane", () => {
    const f = frontageAlongPolylineMeters(lot, frontStreet, 6);
    const rearF = frontageAlongPolylineMeters(lot, rearLane, 6);
    // rear edge is ~3m from lane -> counts; front edge is ~47m -> does not
    expect(rearF).toBeGreaterThan(19);
    expect(rearF).toBeLessThan(21);
    expect(f).not.toBeCloseTo(rearF + 20, 0);
  });
});
