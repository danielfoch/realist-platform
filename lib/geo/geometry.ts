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
