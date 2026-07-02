/**
 * Open-data enrichment spine.
 *
 * v1 = neighbourhood layer: StatCan 2021 Census dissemination-area boundaries +
 * profiles (imported by scripts/import-census-da.ts), resolved for a lat/lng via
 * the torontoGeo bbox-prefilter + point-in-polygon pattern — no PostGIS needed.
 *
 * Also owns the data_layers registry: every open-data import records its source,
 * licence, attribution and freshness here so coverage is visible in admin and
 * attribution strings reach display surfaces.
 *
 * GET /api/enrichment?lat=..&lng=..  → { neighbourhood, layers }
 * GET /api/enrichment/layers         → registry (freshness/licence per layer)
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { pointInGeometry, type AreaGeometry } from "@shared/geoGeometry";
import {
  deriveNeighbourhoodStats,
  emptyDaProfile,
  type DaProfile,
  type NeighbourhoodStats,
} from "@shared/censusProfile";

// ─── Tables ──────────────────────────────────────────────────────────────────

export async function ensureEnrichmentTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS data_layers (
      key              text PRIMARY KEY,
      name             text NOT NULL,
      source_url       text,
      licence          text,
      attribution      text,
      geography        text,
      refresh_cadence  text,
      last_imported_at timestamp,
      row_count        integer,
      notes            text
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS census_da_boundaries (
      dauid         text PRIMARY KEY,
      province_code text,
      land_area_km2 real,
      geojson       jsonb NOT NULL,
      min_lng       double precision NOT NULL,
      min_lat       double precision NOT NULL,
      max_lng       double precision NOT NULL,
      max_lat       double precision NOT NULL,
      imported_at   timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS census_da_bbox_idx
    ON census_da_boundaries (min_lat, max_lat, min_lng, max_lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS census_da_profiles (
      dauid                 text PRIMARY KEY,
      census_year           integer NOT NULL,
      profile               jsonb NOT NULL,
      imported_at           timestamp NOT NULL DEFAULT now()
    )
  `);
}

/** Upsert a layer's registry row after an import (called by import scripts). */
export async function recordDataLayer(layer: {
  key: string;
  name: string;
  sourceUrl?: string;
  licence?: string;
  attribution?: string;
  geography?: string;
  refreshCadence?: string;
  rowCount?: number;
  notes?: string;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO data_layers (key, name, source_url, licence, attribution, geography, refresh_cadence, last_imported_at, row_count, notes)
    VALUES (${layer.key}, ${layer.name}, ${layer.sourceUrl ?? null}, ${layer.licence ?? null}, ${layer.attribution ?? null},
            ${layer.geography ?? null}, ${layer.refreshCadence ?? null}, now(), ${layer.rowCount ?? null}, ${layer.notes ?? null})
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      source_url = EXCLUDED.source_url,
      licence = EXCLUDED.licence,
      attribution = EXCLUDED.attribution,
      geography = EXCLUDED.geography,
      refresh_cadence = EXCLUDED.refresh_cadence,
      last_imported_at = now(),
      row_count = EXCLUDED.row_count,
      notes = EXCLUDED.notes
  `);
}

// ─── Dissemination-area resolution ───────────────────────────────────────────

export async function resolveDauid(lat: number, lng: number): Promise<string | null> {
  const candidates = await db.execute(sql`
    SELECT dauid, geojson
    FROM census_da_boundaries
    WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
    LIMIT 25
  `);
  for (const row of candidates.rows as Array<{ dauid: string; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) return row.dauid;
  }
  return null;
}

function rehydrateProfile(dauid: string, stored: Record<string, unknown>): DaProfile {
  // Stored profile is the DaProfile JSON written by the importer; merge over an
  // empty profile so older imports missing newer fields still read cleanly.
  return { ...emptyDaProfile(dauid), ...(stored as Partial<DaProfile>) };
}

export async function getNeighbourhoodStats(lat: number, lng: number): Promise<NeighbourhoodStats | null> {
  const dauid = await resolveDauid(lat, lng);
  if (!dauid) return null;
  const rows = await db.execute(sql`
    SELECT profile FROM census_da_profiles WHERE dauid = ${dauid} LIMIT 1
  `);
  const stored = rows.rows[0] as { profile: Record<string, unknown> } | undefined;
  if (!stored) return null;
  return deriveNeighbourhoodStats(rehydrateProfile(dauid, stored.profile));
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerEnrichmentRoutes(app: Express): void {
  ensureEnrichmentTables().catch((err) =>
    console.error("[enrichment] failed to ensure tables:", err?.message ?? err),
  );

  app.get("/api/enrichment", async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, error: "lat and lng query params are required" });
    }
    try {
      const neighbourhood = await getNeighbourhoodStats(lat, lng);
      return res.json({ success: true, data: { neighbourhood } });
    } catch (err: any) {
      console.error("[enrichment] lookup failed:", err?.message ?? err);
      return res.status(500).json({ success: false, error: "Enrichment lookup failed" });
    }
  });

  app.get("/api/enrichment/layers", async (_req: Request, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT key, name, source_url, licence, attribution, geography, refresh_cadence, last_imported_at, row_count, notes
        FROM data_layers
        ORDER BY key
      `);
      return res.json({ success: true, data: rows.rows });
    } catch (err: any) {
      console.error("[enrichment] layers listing failed:", err?.message ?? err);
      return res.status(500).json({ success: false, error: "Layer registry unavailable" });
    }
  });
}
