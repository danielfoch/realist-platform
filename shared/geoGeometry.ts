/**
 * Pure GeoJSON geometry helpers for the Toronto geodata screeners.
 * Plain-JS (no PostGIS dependency) — same approach as landClaimScreener.
 * Coordinates are GeoJSON order: [lng, lat].
 */

export type Position = [number, number];

export interface GeoPolygon {
  type: "Polygon";
  coordinates: Position[][];
}

export interface GeoMultiPolygon {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type AreaGeometry = GeoPolygon | GeoMultiPolygon;

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function bboxOfGeometry(geom: AreaGeometry): Bbox {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const scan = (ring: Position[]) => {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geom.type === "Polygon") geom.coordinates.forEach(scan);
  else geom.coordinates.forEach((poly) => poly.forEach(scan));
  return { minLng, minLat, maxLng, maxLat };
}

export function pointInBbox(lng: number, lat: number, bbox: Bbox, padDeg = 0): boolean {
  return (
    lng >= bbox.minLng - padDeg &&
    lng <= bbox.maxLng + padDeg &&
    lat >= bbox.minLat - padDeg &&
    lat <= bbox.maxLat + padDeg
  );
}

/** Ray-casting point-in-ring test (even-odd rule). */
function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point-in-polygon honouring holes (outer ring minus inner rings). */
function pointInPolygonRings(lng: number, lat: number, rings: Position[][]): boolean {
  if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

export function pointInGeometry(lng: number, lat: number, geom: AreaGeometry): boolean {
  if (geom.type === "Polygon") return pointInPolygonRings(lng, lat, geom.coordinates);
  return geom.coordinates.some((poly) => pointInPolygonRings(lng, lat, poly));
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Approximate degrees of latitude for a metre buffer (fine at Toronto latitudes). */
export function metersToDegreesLat(meters: number): number {
  return meters / 111320;
}

// ─── Parcel-metric helpers ────────────────────────────────────────────────────
// Planar math on a local equirectangular projection — accurate to well under 1%
// at parcel scale (10–100m), which is inside the "screening estimate" tolerance
// everything downstream already assumes.

export interface GeoLineString {
  type: "LineString";
  coordinates: Position[];
}

export interface GeoMultiLineString {
  type: "MultiLineString";
  coordinates: Position[][];
}

export type LineGeometry = GeoLineString | GeoMultiLineString;

/** Metres per degree of longitude shrinks with latitude; latitude is ~constant. */
const M_PER_DEG_LAT = 111320;

export type XY = [number, number];

/** Projects [lng,lat] to local metres around an origin latitude. */
export function localProjector(originLng: number, originLat: number): (p: Position) => XY {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  return ([lng, lat]) => [(lng - originLng) * mPerDegLng, (lat - originLat) * M_PER_DEG_LAT];
}

/** Signed shoelace area of a projected ring (m²). Positive for CCW rings. */
function signedRingArea(ring: XY[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return sum / 2;
}

/** Geometry area in m² (holes subtracted, MultiPolygon parts summed). */
export function geometryAreaSqMeters(geom: AreaGeometry): number {
  const bbox = bboxOfGeometry(geom);
  const project = localProjector(bbox.minLng, (bbox.minLat + bbox.maxLat) / 2);
  const polyArea = (rings: Position[][]): number => {
    if (!rings.length) return 0;
    let area = Math.abs(signedRingArea(rings[0].map(project)));
    for (let i = 1; i < rings.length; i++) {
      area -= Math.abs(signedRingArea(rings[i].map(project)));
    }
    return Math.max(0, area);
  };
  if (geom.type === "Polygon") return polyArea(geom.coordinates);
  return geom.coordinates.reduce((sum, poly) => sum + polyArea(poly), 0);
}

/** Outer ring of the largest polygon part (the parcel proper for slivers). */
export function largestOuterRing(geom: AreaGeometry): Position[] {
  if (geom.type === "Polygon") return geom.coordinates[0] ?? [];
  let best: Position[] = [];
  let bestArea = -Infinity;
  for (const poly of geom.coordinates) {
    const ring = poly[0] ?? [];
    if (ring.length < 4) continue;
    const bbox = ringBbox(ring);
    const project = localProjector(bbox.minLng, (bbox.minLat + bbox.maxLat) / 2);
    const area = Math.abs(signedRingArea(ring.map(project)));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

function ringBbox(ring: Position[]): Bbox {
  return bboxOfGeometry({ type: "Polygon", coordinates: [ring] });
}

/** Area-weighted centroid of the largest outer ring, as [lng, lat]. */
export function geometryCentroid(geom: AreaGeometry): Position | null {
  const ring = largestOuterRing(geom);
  if (ring.length < 4) return null;
  const bbox = ringBbox(ring);
  const originLng = bbox.minLng;
  const originLat = (bbox.minLat + bbox.maxLat) / 2;
  const project = localProjector(originLng, originLat);
  const pts = ring.map(project);
  // Compute the signed area from the same cross terms used for the moments so
  // the sign conventions cancel (2A = Σ cross ⇒ 6A = 3·Σcross).
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cross = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a2 += cross;
    cx += (pts[j][0] + pts[i][0]) * cross;
    cy += (pts[j][1] + pts[i][1]) * cross;
  }
  if (Math.abs(a2) < 1e-9) return null;
  cx /= 3 * a2;
  cy /= 3 * a2;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  return [originLng + cx / mPerDegLng, originLat + cy / M_PER_DEG_LAT];
}

/** Monotone-chain convex hull of projected points. */
export function convexHull(points: XY[]): XY[] {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length <= 2) return pts;
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: XY[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export interface RotatedRect {
  /** Shorter side (m) — the frontage candidate for a typical rectangular lot. */
  widthM: number;
  /** Longer side (m) — the depth candidate. */
  depthM: number;
}

/**
 * Minimum-area rotated bounding rectangle of a geometry's outer ring
 * (rotating calipers over hull edges). Width ≤ depth by construction.
 */
export function minimumRotatedRect(geom: AreaGeometry): RotatedRect | null {
  const ring = largestOuterRing(geom);
  if (ring.length < 4) return null;
  const bbox = ringBbox(ring);
  const project = localProjector(bbox.minLng, (bbox.minLat + bbox.maxLat) / 2);
  const hull = convexHull(ring.map(project));
  if (hull.length < 3) return null;

  let best: RotatedRect | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i];
    const [bx, by] = hull[(i + 1) % hull.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-9) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [px, py] of hull) {
      const u = px * ux + py * uy;
      const v = -px * uy + py * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const w = maxU - minU;
    const h = maxV - minV;
    const area = w * h;
    if (area < bestArea) {
      bestArea = area;
      best = { widthM: Math.min(w, h), depthM: Math.max(w, h) };
    }
  }
  return best;
}

function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq < 1e-12 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Min distance (m) between two projected segments (0 when they intersect). */
function segmentToSegmentDistance(a1: XY, a2: XY, b1: XY, b2: XY): number {
  const d = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = d(a1, a2, b1);
  const o2 = d(a1, a2, b2);
  const o3 = d(b1, b2, a1);
  const o4 = d(b1, b2, a2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return 0; // proper intersection
  return Math.min(
    distancePointToSegment(b1[0], b1[1], a1[0], a1[1], a2[0], a2[1]),
    distancePointToSegment(b2[0], b2[1], a1[0], a1[1], a2[0], a2[1]),
    distancePointToSegment(a1[0], a1[1], b1[0], b1[1], b2[0], b2[1]),
    distancePointToSegment(a2[0], a2[1], b1[0], b1[1], b2[0], b2[1]),
  );
}

function polylineParts(line: LineGeometry): Position[][] {
  return line.type === "LineString" ? [line.coordinates] : line.coordinates;
}

/**
 * Min distance (m) between a geometry's outer boundary and a polyline.
 * Used for lane-access ("parcel edge within Xm of a laneway centreline")
 * and street-adjacency screening.
 */
export function minDistanceToPolylineMeters(geom: AreaGeometry, line: LineGeometry): number {
  const ring = largestOuterRing(geom);
  if (ring.length < 2) return Infinity;
  const bbox = ringBbox(ring);
  const project = localProjector(bbox.minLng, (bbox.minLat + bbox.maxLat) / 2);
  const ringPts = ring.map(project);
  let min = Infinity;
  for (const part of polylineParts(line)) {
    const linePts = part.map(project);
    for (let i = 0; i + 1 < linePts.length; i++) {
      for (let j = 0, k = ringPts.length - 1; j < ringPts.length; k = j++) {
        const dist = segmentToSegmentDistance(ringPts[k], ringPts[j], linePts[i], linePts[i + 1]);
        if (dist < min) min = dist;
        if (min === 0) return 0;
      }
    }
  }
  return min;
}

/**
 * Total length (m) of parcel-boundary edges whose midpoints lie within
 * maxDistM of the polyline — the street-frontage estimate for the edge(s)
 * facing that street. Returns 0 when the parcel doesn't touch the street.
 */
export function frontageAlongPolylineMeters(
  geom: AreaGeometry,
  line: LineGeometry,
  maxDistM: number,
): number {
  const ring = largestOuterRing(geom);
  if (ring.length < 2) return 0;
  const bbox = ringBbox(ring);
  const project = localProjector(bbox.minLng, (bbox.minLat + bbox.maxLat) / 2);
  const ringPts = ring.map(project);
  const lineParts = polylineParts(line).map((part) => part.map(project));

  let frontage = 0;
  for (let j = 0, k = ringPts.length - 1; j < ringPts.length; k = j++) {
    const [x1, y1] = ringPts[k];
    const [x2, y2] = ringPts[j];
    const edgeLen = Math.hypot(x2 - x1, y2 - y1);
    if (edgeLen < 1e-9) continue;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    let minDist = Infinity;
    for (const part of lineParts) {
      for (let i = 0; i + 1 < part.length; i++) {
        const dist = distancePointToSegment(mx, my, part[i][0], part[i][1], part[i + 1][0], part[i + 1][1]);
        if (dist < minDist) minDist = dist;
      }
    }
    if (minDist <= maxDistM) frontage += edgeLen;
  }
  return frontage;
}
