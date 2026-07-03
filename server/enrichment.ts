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
 * v2 adds the property layer: Québec assessment-roll units (MAMH open data,
 * imported by scripts/import-quebec-roll.ts) matched to listings by a loose
 * civic-number + street-name key.
 *
 * v3 adds building permits (Vancouver/Calgary/Montréal open data, imported by
 * scripts/import-building-permits.ts): permit history at the address + issued
 * activity within 1km over the trailing 24 months.
 *
 * GET /api/enrichment?lat=..&lng=..&address=..&city=..  → { neighbourhood, property, permits }
 * GET /api/enrichment/layers  → registry (freshness/licence per layer)
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { haversineMeters, metersToDegreesLat, pointInGeometry, type AreaGeometry } from "@shared/geoGeometry";
import {
  deriveNeighbourhoodStats,
  emptyDaProfile,
  type DaProfile,
  type NeighbourhoodStats,
} from "@shared/censusProfile";
import { looseKeyFromListingAddress, QUEBEC_ROLL_ATTRIBUTION } from "@shared/quebecRoll";
import { ASSESSMENT_ROLL_ATTRIBUTION } from "@shared/assessmentRolls";
import { PERMIT_CITY_ADAPTERS, permitLooseKey } from "@shared/buildingPermits";
import { DEVELOPMENT_APPLICATIONS_ATTRIBUTION } from "@shared/developmentApplications";

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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS assessment_units (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source             text NOT NULL,
      municipality_code  text NOT NULL,
      municipality_name  text,
      roll_year          integer,
      matricule          text,
      address            text,
      loose_address_key  text,
      lot_number         text,
      cubf               text,
      frontage_m         real,
      lot_area_m2        double precision,
      storeys            real,
      year_built         integer,
      year_built_estimated boolean,
      floor_area_m2      real,
      dwellings          integer,
      market_ref_date    text,
      land_value         bigint,
      building_value     bigint,
      total_value        bigint,
      previous_roll_value bigint,
      imported_at        timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, municipality_code, matricule)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS assessment_units_loose_key_idx
    ON assessment_units (loose_address_key)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS assessment_units_muni_idx
    ON assessment_units (municipality_code)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS building_permits (
      id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source            text NOT NULL,
      permit_number     text NOT NULL,
      city              text,
      province          text,
      address           text,
      loose_address_key text,
      permit_type       text,
      work_type         text,
      status            text,
      description       text,
      units             integer,
      estimated_value   double precision,
      issued_date       date,
      lat               double precision,
      lng               double precision,
      imported_at       timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, permit_number)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS building_permits_loose_key_idx
    ON building_permits (loose_address_key)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS building_permits_latlng_idx
    ON building_permits (lat, lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS development_applications (
      id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source             text NOT NULL,
      application_number text NOT NULL,
      application_type   text,
      status             text,
      address            text,
      description        text,
      date_submitted     date,
      ward_number        text,
      ward_name          text,
      application_url    text,
      lat                double precision,
      lng                double precision,
      imported_at        timestamp NOT NULL DEFAULT now(),
      UNIQUE (source, application_number)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS development_applications_latlng_idx
    ON development_applications (lat, lng)
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

// ─── Property assessment lookup ──────────────────────────────────────────────

export interface PropertyAssessment {
  address: string | null;
  municipality: string | null;
  rollYear: number | null;
  cubf: string | null;
  yearBuilt: number | null;
  yearBuiltEstimated: boolean;
  storeys: number | null;
  floorAreaM2: number | null;
  lotAreaM2: number | null;
  frontageM: number | null;
  dwellings: number | null;
  marketRefDate: string | null;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  previousRollValue: number | null;
  attribution: string;
}

const foldName = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export async function getPropertyAssessment(
  address: string,
  city?: string | null,
): Promise<PropertyAssessment | null> {
  const key = looseKeyFromListingAddress(address);
  if (!key) return null;
  const rows = await db.execute(sql`
    SELECT source, address, municipality_name, roll_year, cubf, year_built, year_built_estimated,
           storeys, floor_area_m2, lot_area_m2, frontage_m, dwellings, market_ref_date,
           land_value, building_value, total_value, previous_roll_value
    FROM assessment_units
    WHERE loose_address_key = ${key}
    LIMIT 10
  `);
  let candidates = rows.rows as Array<Record<string, unknown>>;
  if (!candidates.length) return null;
  // The same "47 saint isidore" can exist in many municipalities — use the
  // listing's city to disambiguate, and refuse to guess when we can't.
  if (candidates.length > 1) {
    if (!city) return null;
    const target = foldName(city);
    candidates = candidates.filter((r) => {
      const muni = foldName(String(r.municipality_name ?? ""));
      return muni && (target.includes(muni) || muni.includes(target));
    });
    if (candidates.length !== 1) return null;
  }
  const r = candidates[0];
  const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    address: (r.address as string) ?? null,
    municipality: (r.municipality_name as string) ?? null,
    rollYear: n(r.roll_year),
    cubf: (r.cubf as string) ?? null,
    yearBuilt: n(r.year_built),
    yearBuiltEstimated: !!r.year_built_estimated,
    storeys: n(r.storeys),
    floorAreaM2: n(r.floor_area_m2),
    lotAreaM2: n(r.lot_area_m2),
    frontageM: n(r.frontage_m),
    dwellings: n(r.dwellings),
    marketRefDate: (r.market_ref_date as string) ?? null,
    landValue: n(r.land_value),
    buildingValue: n(r.building_value),
    totalValue: n(r.total_value),
    previousRollValue: n(r.previous_roll_value),
    attribution: ASSESSMENT_ROLL_ATTRIBUTION[String(r.source)] ?? QUEBEC_ROLL_ATTRIBUTION,
  };
}

// ─── Building-permit activity ────────────────────────────────────────────────

const NEARBY_RADIUS_M = 1000;
const NEARBY_WINDOW_MONTHS = 24;

export interface PermitAtAddress {
  permitNumber: string;
  issuedDate: string | null;
  permitType: string | null;
  workType: string | null;
  status: string | null;
  description: string | null;
  estimatedValue: number | null;
  units: number | null;
}

export interface PermitActivity {
  atAddress: PermitAtAddress[];
  nearby: {
    radiusM: number;
    windowMonths: number;
    count: number;
    totalValue: number | null;
  } | null;
  attribution: string | null;
}

export async function getPermitActivity(
  address: string | null,
  city: string | null,
  lat: number | null,
  lng: number | null,
): Promise<PermitActivity | null> {
  const key = address ? permitLooseKey(address) : null;
  const cityFold = city ? foldName(city) : null;

  let atAddress: PermitAtAddress[] = [];
  let attribution: string | null = null;
  if (key) {
    const rows = await db.execute(sql`
      SELECT source, permit_number, issued_date, permit_type, work_type, status,
             description, estimated_value, units, city
      FROM building_permits
      WHERE loose_address_key = ${key}
      ORDER BY issued_date DESC NULLS LAST
      LIMIT 25
    `);
    let hits = rows.rows as Array<Record<string, unknown>>;
    // Loose keys collide across cities — keep only rows whose city matches the
    // listing's when we have one to compare.
    if (cityFold) {
      hits = hits.filter((r) => {
        const permitCity = foldName(String(r.city ?? ""));
        return permitCity && (cityFold.includes(permitCity) || permitCity.includes(cityFold));
      });
    }
    atAddress = hits.slice(0, 10).map((r) => ({
      permitNumber: String(r.permit_number),
      issuedDate: r.issued_date ? String(r.issued_date).slice(0, 10) : null,
      permitType: (r.permit_type as string) ?? null,
      workType: (r.work_type as string) ?? null,
      status: (r.status as string) ?? null,
      description: typeof r.description === "string" ? r.description.slice(0, 280) : null,
      estimatedValue: r.estimated_value === null || r.estimated_value === undefined ? null : Number(r.estimated_value),
      units: r.units === null || r.units === undefined ? null : Number(r.units),
    }));
    if (hits.length) {
      const src = String(hits[0].source);
      const adapter = PERMIT_CITY_ADAPTERS.find((a) => a.key === src);
      attribution = adapter?.attribution ?? null;
    }
  }

  let nearby: PermitActivity["nearby"] = null;
  if (lat !== null && lng !== null) {
    const padLat = metersToDegreesLat(NEARBY_RADIUS_M) * 1.2;
    const padLng = padLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const rows = await db.execute(sql`
      SELECT lat, lng, estimated_value, source
      FROM building_permits
      WHERE lat BETWEEN ${lat - padLat} AND ${lat + padLat}
        AND lng BETWEEN ${lng - padLng} AND ${lng + padLng}
        AND issued_date >= now() - interval '${sql.raw(String(NEARBY_WINDOW_MONTHS))} months'
      LIMIT 5000
    `);
    let count = 0;
    let totalValue = 0;
    let anyValue = false;
    let nearestSource: string | null = null;
    for (const r of rows.rows as Array<{ lat: number; lng: number; estimated_value: number | null; source: string }>) {
      if (haversineMeters(lat, lng, r.lat, r.lng) > NEARBY_RADIUS_M) continue;
      count++;
      nearestSource = nearestSource ?? r.source;
      if (r.estimated_value !== null && r.estimated_value !== undefined) {
        totalValue += Number(r.estimated_value);
        anyValue = true;
      }
    }
    if (count > 0) {
      nearby = {
        radiusM: NEARBY_RADIUS_M,
        windowMonths: NEARBY_WINDOW_MONTHS,
        count,
        totalValue: anyValue ? Math.round(totalValue) : null,
      };
      if (!attribution && nearestSource) {
        attribution = PERMIT_CITY_ADAPTERS.find((a) => a.key === nearestSource)?.attribution ?? null;
      }
    }
  }

  if (!atAddress.length && !nearby) return null;
  return { atAddress, nearby, attribution };
}

// ─── Development activity ─────────────────────────────────────────────────────

const DEV_RADIUS_M = 800;
const DEV_WINDOW_MONTHS = 36;

export interface DevelopmentActivity {
  radiusM: number;
  windowMonths: number;
  count: number;
  nearby: Array<{
    applicationType: string | null;
    status: string | null;
    address: string | null;
    description: string | null;
    dateSubmitted: string | null;
    applicationUrl: string | null;
    distanceM: number;
  }>;
  attribution: string;
}

/** Development applications submitted within DEV_RADIUS_M over the trailing window. */
export async function getDevelopmentActivity(lat: number, lng: number): Promise<DevelopmentActivity | null> {
  const padLat = metersToDegreesLat(DEV_RADIUS_M) * 1.2;
  const padLng = padLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const rows = await db.execute(sql`
    SELECT application_type, status, address, description, date_submitted, application_url, lat, lng
    FROM development_applications
    WHERE lat BETWEEN ${lat - padLat} AND ${lat + padLat}
      AND lng BETWEEN ${lng - padLng} AND ${lng + padLng}
      AND date_submitted >= now() - interval '${sql.raw(String(DEV_WINDOW_MONTHS))} months'
    LIMIT 2000
  `);
  const near: DevelopmentActivity["nearby"] = [];
  for (const r of rows.rows as Array<{
    application_type: string | null;
    status: string | null;
    address: string | null;
    description: string | null;
    date_submitted: string | null;
    application_url: string | null;
    lat: number;
    lng: number;
  }>) {
    const d = haversineMeters(lat, lng, r.lat, r.lng);
    if (d > DEV_RADIUS_M) continue;
    near.push({
      applicationType: r.application_type,
      status: r.status,
      address: r.address,
      description: typeof r.description === "string" ? r.description.slice(0, 280) : null,
      dateSubmitted: r.date_submitted ? String(r.date_submitted).slice(0, 10) : null,
      applicationUrl: r.application_url,
      distanceM: Math.round(d),
    });
  }
  if (!near.length) return null;
  near.sort((a, b) => (b.dateSubmitted ?? "").localeCompare(a.dateSubmitted ?? "") || a.distanceM - b.distanceM);
  return {
    radiusM: DEV_RADIUS_M,
    windowMonths: DEV_WINDOW_MONTHS,
    count: near.length,
    nearby: near.slice(0, 5),
    attribution: DEVELOPMENT_APPLICATIONS_ATTRIBUTION,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerEnrichmentRoutes(app: Express): void {
  ensureEnrichmentTables().catch((err) =>
    console.error("[enrichment] failed to ensure tables:", err?.message ?? err),
  );

  app.get("/api/enrichment", async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const address = typeof req.query.address === "string" ? req.query.address.trim() : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!hasPoint && !address) {
      return res.status(400).json({ success: false, error: "lat+lng or address query params are required" });
    }
    try {
      const [neighbourhood, property, permits, development] = await Promise.all([
        hasPoint ? getNeighbourhoodStats(lat, lng) : Promise.resolve(null),
        address ? getPropertyAssessment(address, city || null) : Promise.resolve(null),
        getPermitActivity(address || null, city || null, hasPoint ? lat : null, hasPoint ? lng : null),
        hasPoint ? getDevelopmentActivity(lat, lng) : Promise.resolve(null),
      ]);
      return res.json({ success: true, data: { neighbourhood, property, permits, development } });
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
