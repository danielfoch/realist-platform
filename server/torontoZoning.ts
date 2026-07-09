/**
 * Toronto zoning OVERLAY + WARD resolution for the Multiplex engine.
 *
 * Complements torontoGeo's Zoning Area (zone code) with the two overlay layers
 * that ship their development standards as attributes — the rare Canadian case
 * where max height and max lot coverage are open data, not bylaw text:
 *
 *   toronto_zoning_height    — Zoning Height Overlay   (HT_LABEL = max height m)
 *   toronto_zoning_coverage  — Zoning Lot Coverage Overlay (PRCNT_CVER = max %)
 *   toronto_wards            — City Wards (25-ward model) for exact sixplex status
 *
 * Same shape as torontoGeo: self-migrating tables, bbox prefilter +
 * point-in-polygon in JS, populated by scripts/import-toronto-zoning-overlays.ts.
 * Resolvers return { value, certainty:"verified" } or null (→ engine falls back
 * to its heuristic and says so). Licence: Open Government Licence – Toronto.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { pointInGeometry, type AreaGeometry } from "@shared/geoGeometry";
import { TORONTO_SIXPLEX_WARDS } from "./multiplexFeasibility";

/**
 * Sixplex geography — By-law 654-2025 / OPA 818 (council item 2025.PH22.4,
 * in force 2025-06-25): five- and six-unit multiplexes as-of-right ONLY in
 * nine wards. Other wards require a councillor opt-in (tracked in the admin
 * `sixplex_opt_in_wards` assumption). Derived from the engine's authoritative
 * TORONTO_SIXPLEX_WARDS so the bylaw list has exactly one home;
 * point-in-ward-polygon resolves a property to its ward number exactly,
 * replacing the FSA-prefix heuristic in multiplexFeasibility.
 */
export const TORONTO_SIXPLEX_WARD_NUMBERS: readonly number[] =
  TORONTO_SIXPLEX_WARDS.asOfRightWards.map((w) => w.ward);

export async function ensureTorontoZoningTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_zoning_height (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      max_height_m real,
      max_storeys  real,
      label        text,
      geojson      jsonb NOT NULL,
      min_lng double precision NOT NULL, min_lat double precision NOT NULL,
      max_lng double precision NOT NULL, max_lat double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_zoning_height_bbox_idx
    ON toronto_zoning_height (min_lat, max_lat, min_lng, max_lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_zoning_coverage (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      max_coverage_pct real,
      geojson      jsonb NOT NULL,
      min_lng double precision NOT NULL, min_lat double precision NOT NULL,
      max_lng double precision NOT NULL, max_lat double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_zoning_coverage_bbox_idx
    ON toronto_zoning_coverage (min_lat, max_lat, min_lng, max_lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_wards (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      ward_number integer NOT NULL,
      ward_name   text,
      geojson     jsonb NOT NULL,
      min_lng double precision NOT NULL, min_lat double precision NOT NULL,
      max_lng double precision NOT NULL, max_lat double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_wards_bbox_idx
    ON toronto_wards (min_lat, max_lat, min_lng, max_lng)
  `);
}

// ─── Overlay resolution ───────────────────────────────────────────────────────

export interface ZoningOverlays {
  /** Max lot coverage as a 0–1 fraction (from Lot Coverage Overlay), or null. */
  maxLotCoverageRatio: number | null;
  /** Max building height in metres (from Height Overlay), or null. */
  maxHeightM: number | null;
  /** Max storeys where the overlay states it (usually null; height governs). */
  maxStoreys: number | null;
  certainty: "verified";
}

/** Resolve the height + coverage overlays covering a point. Null when neither. */
export async function resolveZoningOverlays(lat: number, lng: number): Promise<ZoningOverlays | null> {
  const [coverageRows, heightRows] = await Promise.all([
    db.execute(sql`
      SELECT max_coverage_pct, geojson FROM toronto_zoning_coverage
      WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
      LIMIT 25
    `),
    db.execute(sql`
      SELECT max_height_m, max_storeys, geojson FROM toronto_zoning_height
      WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
      LIMIT 25
    `),
  ]);

  let maxLotCoverageRatio: number | null = null;
  for (const row of coverageRows.rows as Array<{ max_coverage_pct: number | null; geojson: AreaGeometry }>) {
    if (row.max_coverage_pct != null && pointInGeometry(lng, lat, row.geojson)) {
      maxLotCoverageRatio = row.max_coverage_pct / 100;
      break;
    }
  }

  let maxHeightM: number | null = null;
  let maxStoreys: number | null = null;
  for (const row of heightRows.rows as Array<{ max_height_m: number | null; max_storeys: number | null; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) {
      if (row.max_height_m != null && row.max_height_m > 0) maxHeightM = row.max_height_m;
      if (row.max_storeys != null && row.max_storeys > 0) maxStoreys = row.max_storeys;
      if (maxHeightM != null || maxStoreys != null) break;
    }
  }

  if (maxLotCoverageRatio == null && maxHeightM == null && maxStoreys == null) return null;
  return { maxLotCoverageRatio, maxHeightM, maxStoreys, certainty: "verified" };
}

// ─── Ward resolution ──────────────────────────────────────────────────────────

export interface WardResolution {
  wardNumber: number;
  wardName: string | null;
  sixplexAsOfRight: boolean;
  certainty: "verified";
}

/** Resolve a point to its City ward and whether sixplexes are as-of-right there. */
export async function resolveWard(lat: number, lng: number): Promise<WardResolution | null> {
  const rows = await db.execute(sql`
    SELECT ward_number, ward_name, geojson FROM toronto_wards
    WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
    LIMIT 25
  `);
  for (const row of rows.rows as Array<{ ward_number: number; ward_name: string | null; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) {
      return {
        wardNumber: row.ward_number,
        wardName: row.ward_name,
        sixplexAsOfRight: TORONTO_SIXPLEX_WARD_NUMBERS.includes(row.ward_number),
        certainty: "verified",
      };
    }
  }
  return null;
}

export async function zoningOverlaysLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_zoning_coverage LIMIT 1`);
  return r.rows.length > 0;
}

export async function wardsLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_wards LIMIT 1`);
  return r.rows.length > 0;
}
