/**
 * Toronto planning PRECEDENT layer for the Multiplex engine.
 *
 * The "your neighbours already did it" signal — the thing no one sells small
 * investors. Two open datasets, geocoded to points at import time:
 *
 *   toronto_permits  — building permits that CREATED dwelling units
 *                      (DWELLING_UNITS_CREATED ≥ 1), incl. second/laneway/
 *                      garden-suite structure types
 *   toronto_coa      — Committee of Adjustment applications + their decisions
 *                      (C_OF_A_DESCISION) — the minor-variance approval record
 *
 * Neither dataset ships coordinates, so the importer resolves each row's
 * street address against the Address Points layer (server/geocodeToronto).
 * getPrecedents(lat,lng,radius) answers: how many unit-adding permits and what
 * variance approval rate near this property.
 *
 * Populated by scripts/import-toronto-precedents.ts. Licence: OGL – Toronto.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { haversineMeters, metersToDegreesLat } from "@shared/geoGeometry";

export async function ensurePrecedentTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_permits (
      id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      permit_num    text,
      geo_id        text,
      address       text,
      structure_type text,
      permit_type   text,
      work          text,
      current_use   text,
      proposed_use  text,
      units_created integer,
      units_lost    integer,
      status        text,
      issued_date   text,
      lat           double precision,
      lng           double precision,
      imported_at   timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_permits_latlng_idx ON toronto_permits (lat, lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_coa (
      id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_file text,
      address        text,
      application_type text,
      work_type      text,
      decision       text,
      decision_class text,          -- 'approved' | 'refused' | 'other'
      appeal_decision text,
      hearing_date   text,
      lat            double precision,
      lng            double precision,
      imported_at    timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_coa_latlng_idx ON toronto_coa (lat, lng)
  `);
}

/** Normalize a raw C_OF_A_DESCISION string to a coarse class. */
export function classifyCoaDecision(raw: string | null | undefined): "approved" | "refused" | "other" {
  const d = (raw || "").toLowerCase();
  if (!d) return "other";
  // "Approved", "Approved with conditions", "Conditional Approval"
  if (d.includes("approv") || d.includes("granted") || d.includes("authorized")) return "approved";
  if (d.includes("refus") || d.includes("denied") || d.includes("dismiss")) return "refused";
  return "other";
}

export interface PrecedentSummary {
  radiusM: number;
  permits: {
    unitAddingCount: number;
    totalUnitsCreated: number;
    byStructureType: Record<string, number>;
    laneWayOrGardenCount: number;
    recentExamples: Array<{ address: string | null; structureType: string | null; unitsCreated: number | null; issuedDate: string | null; distanceM: number }>;
  };
  committeeOfAdjustment: {
    decided: number;
    approved: number;
    refused: number;
    approvalRate: number | null; // approved / (approved+refused)
    recentExamples: Array<{ address: string | null; applicationType: string | null; decision: string | null; hearingDate: string | null; distanceM: number }>;
  };
  dataAvailable: boolean;
  note: string;
}

const SUITE_RE = /lane|garden|second suite|secondary|multiplex|duplex|triplex|fourplex/i;

/**
 * Precedent within `radiusM` of a point. Reads a padded bbox then filters by
 * true haversine distance (same pattern as the tree screen).
 */
export async function getPrecedents(lat: number, lng: number, radiusM = 500): Promise<PrecedentSummary> {
  const [permitData, coaData] = await Promise.all([
    db.execute(sql`SELECT 1 FROM toronto_permits LIMIT 1`),
    db.execute(sql`SELECT 1 FROM toronto_coa LIMIT 1`),
  ]);
  const dataAvailable = permitData.rows.length > 0 || coaData.rows.length > 0;

  const pad = metersToDegreesLat(radiusM) * 1.5;
  const [permitRows, coaRows] = await Promise.all([
    db.execute(sql`
      SELECT address, structure_type, permit_type, work, units_created, issued_date, lat, lng
      FROM toronto_permits
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN ${lat - pad} AND ${lat + pad}
        AND lng BETWEEN ${lng - pad} AND ${lng + pad}
        AND units_created >= 1
      LIMIT 2000
    `),
    db.execute(sql`
      SELECT address, application_type, work_type, decision, decision_class, hearing_date, lat, lng
      FROM toronto_coa
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN ${lat - pad} AND ${lat + pad}
        AND lng BETWEEN ${lng - pad} AND ${lng + pad}
      LIMIT 2000
    `),
  ]);

  // ── Permits ──
  const byStructureType: Record<string, number> = {};
  let unitAddingCount = 0, totalUnitsCreated = 0, laneWayOrGardenCount = 0;
  const permitExamples: PrecedentSummary["permits"]["recentExamples"] = [];
  for (const p of permitRows.rows as Array<any>) {
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (d > radiusM) continue;
    unitAddingCount++;
    totalUnitsCreated += Number(p.units_created) || 0;
    const st = (p.structure_type as string) || "Unknown";
    byStructureType[st] = (byStructureType[st] || 0) + 1;
    if (SUITE_RE.test(`${p.structure_type} ${p.work} ${p.permit_type}`)) laneWayOrGardenCount++;
    permitExamples.push({ address: p.address, structureType: p.structure_type, unitsCreated: Number(p.units_created) || null, issuedDate: p.issued_date, distanceM: Math.round(d) });
  }
  permitExamples.sort((a, b) => a.distanceM - b.distanceM);

  // ── Committee of Adjustment ──
  let approved = 0, refused = 0;
  const coaExamples: PrecedentSummary["committeeOfAdjustment"]["recentExamples"] = [];
  for (const c of coaRows.rows as Array<any>) {
    const d = haversineMeters(lat, lng, c.lat, c.lng);
    if (d > radiusM) continue;
    if (c.decision_class === "approved") approved++;
    else if (c.decision_class === "refused") refused++;
    coaExamples.push({ address: c.address, applicationType: c.application_type, decision: c.decision, hearingDate: c.hearing_date, distanceM: Math.round(d) });
  }
  coaExamples.sort((a, b) => a.distanceM - b.distanceM);
  const decided = approved + refused;

  return {
    radiusM,
    permits: {
      unitAddingCount,
      totalUnitsCreated,
      byStructureType,
      laneWayOrGardenCount,
      recentExamples: permitExamples.slice(0, 8),
    },
    committeeOfAdjustment: {
      decided,
      approved,
      refused,
      approvalRate: decided > 0 ? Math.round((approved / decided) * 100) / 100 : null,
      recentExamples: coaExamples.slice(0, 8),
    },
    dataAvailable,
    note: dataAvailable
      ? "Precedent from City of Toronto open permit + Committee of Adjustment records, geocoded to point. Screening signal only — each application is decided on its own merits."
      : "Precedent layer not imported yet — run scripts/import-toronto-precedents.ts.",
  };
}

export async function precedentsLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_permits LIMIT 1`);
  return r.rows.length > 0;
}
