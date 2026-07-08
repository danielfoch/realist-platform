/**
 * Toronto parcel fabric + derived lot metrics for the Multiplex engine.
 *
 * The binding input for multiplex screening is the LOT — area, frontage, depth,
 * corner/lane access — which the underwriter currently asks the user to type.
 * This resolves it from the City's open parcel fabric (Property Boundaries) plus
 * the Toronto Centreline (laneway vs road classification), deriving metrics
 * geometrically via shared/geoGeometry:
 *
 *   toronto_parcels    — Property Boundaries polygons (geo_id joins permits)
 *   toronto_centreline — street/laneway centrelines, classified
 *
 * Precision: Property Boundaries are compiled ("not a substitute for a plan of
 * survey") — good enough to SCREEN, must be verified by survey before building.
 * getParcelMetrics surfaces that as basis:"parcel_fabric".
 *
 * Populated by scripts/import-toronto-parcels.ts. Same self-migrating,
 * bbox-prefilter pattern as torontoGeo. Licence: Open Government Licence – Toronto.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  frontageAlongPolylineMeters,
  geometryAreaSqMeters,
  geometryCentroid,
  minDistanceToPolylineMeters,
  minimumRotatedRect,
  bboxOfGeometry,
  type AreaGeometry,
  type LineGeometry,
} from "@shared/geoGeometry";

const M2_PER_SQFT = 0.09290304;
const M_PER_FT = 0.3048;
/**
 * A parcel edge "fronts" a road when within this many metres of its centreline.
 * Road centrelines run down the middle of the allowance, so a front property
 * line sits ~10–12 m from the centreline in Toronto — 8 m was too tight and
 * detected no fronting roads at all. 13 m catches the fronting street without
 * reaching a parallel street behind a normal-depth (30 m+) lot.
 */
const STREET_ADJACENCY_M = 13;
/** A rear parcel edge is "lane accessed" if within this many metres of a laneway. */
const LANE_ADJACENCY_M = 6;

export async function ensureParcelTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_parcels (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      geo_id      text,
      address     text,
      geojson     jsonb NOT NULL,
      min_lng double precision NOT NULL, min_lat double precision NOT NULL,
      max_lng double precision NOT NULL, max_lat double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_parcels_bbox_idx
    ON toronto_parcels (min_lat, max_lat, min_lng, max_lng)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_parcels_geo_id_idx ON toronto_parcels (geo_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_centreline (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      klass       text NOT NULL,   -- 'laneway' | 'road' | 'other'
      name        text,
      geojson     jsonb NOT NULL,
      min_lng double precision NOT NULL, min_lat double precision NOT NULL,
      max_lng double precision NOT NULL, max_lat double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_centreline_bbox_idx
    ON toronto_centreline (klass, min_lat, max_lat, min_lng, max_lng)
  `);
}

export interface ParcelMetrics {
  geoId: string | null;
  lotAreaSqft: number;
  lotAreaM2: number;
  frontageFt: number | null;
  depthFt: number | null;
  /** "street_edge" = frontage measured along the fronting road; "bounding_rect" = min-rect fallback. */
  frontageBasis: "street_edge" | "bounding_rect";
  cornerLot: boolean | null;
  laneAccess: boolean | null;
  basis: "parcel_fabric";
  precisionNote: string;
}

const PRECISION_NOTE =
  "Lot metrics are derived from the City's compiled Property Boundaries — a screening estimate, not a plan of survey. Confirm dimensions with a survey before relying on them.";

/** Bounding-box padding (deg) to catch centrelines just outside the parcel. */
function padDeg(meters: number): number {
  return meters / 111320 * 2;
}

/** Resolve the parcel polygon containing a point (smallest containing polygon wins). */
async function parcelAtPoint(lat: number, lng: number): Promise<{ geoId: string | null; geom: AreaGeometry } | null> {
  // Order by bbox area ascending so the smallest parcels (the true lots) are
  // always evaluated before any enclosing block/condo footprint — a plain
  // LIMIT with no ORDER BY could truncate out the real containing lot where
  // many bboxes overlap a point.
  const rows = await db.execute(sql`
    SELECT geo_id, geojson FROM toronto_parcels
    WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
    ORDER BY (max_lat - min_lat) * (max_lng - min_lng) ASC
    LIMIT 200
  `);
  const { pointInGeometry } = await import("@shared/geoGeometry");
  let best: { geoId: string | null; geom: AreaGeometry; area: number } | null = null;
  for (const row of rows.rows as Array<{ geo_id: string | null; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) {
      const area = geometryAreaSqMeters(row.geojson);
      if (!best || area < best.area) {
        // Prefer the SMALLEST containing polygon (the parcel, not an enclosing block).
        best = { geoId: row.geo_id, geom: row.geojson, area };
      }
    }
  }
  return best ? { geoId: best.geoId, geom: best.geom } : null;
}

async function centrelinesNear(geom: AreaGeometry, klass: "laneway" | "road"): Promise<LineGeometry[]> {
  const bbox = bboxOfGeometry(geom);
  const pad = padDeg(STREET_ADJACENCY_M);
  const rows = await db.execute(sql`
    SELECT geojson FROM toronto_centreline
    WHERE klass = ${klass}
      AND min_lat <= ${bbox.maxLat + pad} AND max_lat >= ${bbox.minLat - pad}
      AND min_lng <= ${bbox.maxLng + pad} AND max_lng >= ${bbox.minLng - pad}
    LIMIT 200
  `);
  return (rows.rows as Array<{ geojson: LineGeometry }>).map((r) => r.geojson);
}

/** Bearing (deg, 0–180) of a polyline's overall direction, for corner detection. */
function polylineBearing(line: LineGeometry): number | null {
  const parts = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  const part = parts.find((p) => p.length >= 2);
  if (!part) return null;
  const [x1, y1] = part[0];
  const [x2, y2] = part[part.length - 1];
  // Scale the longitude delta by cos(lat): a degree of longitude is ~0.72× a
  // degree of latitude at Toronto, so raw-degree bearings skew toward E–W and
  // would misjudge the 30° corner threshold.
  const cosLat = Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
  const deg = (Math.atan2(y2 - y1, (x2 - x1) * cosLat) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

/**
 * Derive lot metrics for the parcel under a point. Returns null when no parcel
 * layer is loaded or the point lands outside every parcel.
 */
export async function getParcelMetrics(lat: number, lng: number): Promise<ParcelMetrics | null> {
  const hit = await parcelAtPoint(lat, lng);
  if (!hit) return null;

  const areaM2 = geometryAreaSqMeters(hit.geom);
  const rect = minimumRotatedRect(hit.geom);

  // Lane access: any parcel edge within LANE_ADJACENCY_M of a laneway centreline.
  const laneways = await centrelinesNear(hit.geom, "laneway");
  let laneAccess: boolean | null = laneways.length ? false : null;
  for (const lane of laneways) {
    if (minDistanceToPolylineMeters(hit.geom, lane) <= LANE_ADJACENCY_M) { laneAccess = true; break; }
  }

  // Corner lot: parcel fronts ≥2 road centrelines whose bearings differ > 30°.
  // We also keep the longest ACTUAL along-street edge, which is the true
  // frontage — the min-rotated-rect short side mis-measures corner/flag/pipestem
  // lots (it can report the wide rear body of a narrow-pole lot as "frontage").
  const roads = await centrelinesNear(hit.geom, "road");
  let cornerLot: boolean | null = roads.length ? false : null;
  const frontingBearings: number[] = [];
  let maxFrontingM = 0;
  for (const road of roads) {
    const alongM = frontageAlongPolylineMeters(hit.geom, road, STREET_ADJACENCY_M);
    if (alongM > 2) {
      if (alongM > maxFrontingM) maxFrontingM = alongM;
      const b = polylineBearing(road);
      if (b != null) frontingBearings.push(b);
    }
  }
  if (frontingBearings.length >= 2) {
    outer: for (let i = 0; i < frontingBearings.length; i++) {
      for (let j = i + 1; j < frontingBearings.length; j++) {
        const diff = Math.abs(frontingBearings[i] - frontingBearings[j]);
        const angle = Math.min(diff, 180 - diff);
        if (angle > 30) { cornerLot = true; break outer; }
      }
    }
  }

  // Frontage: prefer the real street-facing edge length for single-frontage
  // lots. On a CORNER lot the long side edge also fronts a street, so the
  // fronting-edge length is ambiguous — there we use the min-rotated-rect short
  // side (the narrower street face, the conventional frontage). Fall back to the
  // rect too when no road fronts the parcel. Depth = area ÷ frontage.
  let frontageFt: number | null = null;
  let depthFt: number | null = null;
  let frontageBasis: "street_edge" | "bounding_rect" = "bounding_rect";
  if (maxFrontingM > 0 && cornerLot !== true) {
    frontageFt = Math.round((maxFrontingM / M_PER_FT) * 10) / 10;
    depthFt = Math.round(((areaM2 / maxFrontingM) / M_PER_FT) * 10) / 10;
    frontageBasis = "street_edge";
  } else if (rect) {
    frontageFt = Math.round((rect.widthM / M_PER_FT) * 10) / 10;
    depthFt = Math.round((rect.depthM / M_PER_FT) * 10) / 10;
    frontageBasis = "bounding_rect";
  }

  return {
    geoId: hit.geoId,
    lotAreaM2: Math.round(areaM2),
    lotAreaSqft: Math.round(areaM2 / M2_PER_SQFT),
    frontageFt,
    depthFt,
    frontageBasis,
    cornerLot,
    laneAccess,
    basis: "parcel_fabric",
    precisionNote: PRECISION_NOTE,
  };
}

/** Area-weighted parcel centroid — a better screening point than a geocode pin. */
export async function getParcelCentroid(lat: number, lng: number): Promise<[number, number] | null> {
  const hit = await parcelAtPoint(lat, lng);
  if (!hit) return null;
  return geometryCentroid(hit.geom);
}

export async function parcelsLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_parcels LIMIT 1`);
  return r.rows.length > 0;
}
