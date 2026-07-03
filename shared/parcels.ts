/**
 * City of Toronto Property Boundaries (parcels) → lot geometry + area.
 *
 * Toronto has no open assessment roll (MPAC is licensed), so the parcel fabric
 * is the source of truth for lot size. The "4326" CSV export ships each parcel
 * as PARCELID + STATEDAREA (e.g. "271.68 sq.m") + a WGS84 GeoJSON MultiPolygon
 * string — verified against the live resource (2026-07). A listing is matched
 * to its parcel spatially (point-in-polygon), and the parcel's STATEDAREA gives
 * the lot area directly — no geometry computation needed for the 80% win.
 * Frontage/depth (an oriented-bounding-box heuristic on the polygon) is a
 * documented follow-up.
 *
 * Pure module: the importer streams the CSV and calls parseParcelRow; the
 * enrichment API resolves listings to parcels via bbox + point-in-polygon.
 */

import { bboxOfGeometry, type AreaGeometry, type Bbox } from "./geoGeometry";

export interface ParcelRecord {
  parcelId: string;
  lotAreaM2: number | null;
  geometry: AreaGeometry;
  bbox: Bbox;
}

const SQFT_PER_M2 = 10.7639;
const M2_PER_ACRE = 4046.8564224;

/** "271.68 sq.m" → 271.68 (m²). Handles sq.ft / ac units defensively. */
export function parseStatedArea(raw: string | undefined): number | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  const n = parseFloat(t); // grabs the leading number; the "." in "sq.m" must not be stripped into it
  if (!Number.isFinite(n) || n <= 0) return null;
  if (t.includes("sq.ft") || t.includes("sq ft") || t.includes("sqft")) return Math.round((n / SQFT_PER_M2) * 10) / 10;
  if (/\bac\b|acre/.test(t)) return Math.round(n * M2_PER_ACRE * 10) / 10;
  return Math.round(n * 10) / 10; // default: square metres
}

/**
 * Parse one parcels-CSV row. Returns null when the id or geometry is missing or
 * the geometry isn't a polygon. Rows arrive with lower-cased header keys.
 */
export function parseParcelRow(row: Record<string, string>): ParcelRecord | null {
  const parcelId = (row.parcelid ?? "").trim();
  const geomRaw = (row.geometry ?? "").trim();
  if (!parcelId || !geomRaw) return null;
  let geometry: AreaGeometry;
  try {
    const parsed = JSON.parse(geomRaw);
    if (parsed?.type !== "Polygon" && parsed?.type !== "MultiPolygon") return null;
    geometry = parsed as AreaGeometry;
  } catch {
    return null;
  }
  return {
    parcelId,
    lotAreaM2: parseStatedArea(row.statedarea),
    geometry,
    bbox: bboxOfGeometry(geometry),
  };
}

export const TORONTO_PARCELS_ATTRIBUTION =
  "Contains information licensed under the Open Government Licence – Toronto.";
