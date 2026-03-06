import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

export interface ScreeningHitResult {
  featureId: string;
  featureName: string;
  nationName: string | null;
  treatyName: string | null;
  agreementName: string | null;
  province: string | null;
  category: string | null;
  layerName: string;
  layerGroup: string;
  sourceName: string;
  sourceUrl: string | null;
  hitType: "inside" | "intersects" | "within_buffer";
  distanceMeters: number | null;
}

export interface ScreeningResult {
  status: "overlap_found" | "near_overlap" | "no_overlap_found" | "limited_data";
  screeningMethod: "point_plus_buffer";
  bufferMeters: number;
  hitsCount: number;
  completeness: "basic" | "enhanced" | "limited";
  summary: string;
  hits: ScreeningHitResult[];
  disclaimer: string;
}

const DISCLAIMER = "This tool is for informational screening only and does not determine legal title, rights, obligations, or whether a property is definitively subject to a land claim. Data coverage varies by jurisdiction and source. Users should obtain legal, title, and Indigenous relations advice before relying on results.";

export async function screenLocation(
  lat: number,
  lng: number,
  bufferMeters: number = 0
): Promise<ScreeningResult> {
  const hits: ScreeningHitResult[] = [];

  const directHits = await db.execute(sql`
    SELECT
      f.id as feature_id,
      f.feature_name,
      f.nation_name,
      f.treaty_name,
      f.agreement_name,
      f.province,
      f.category,
      l.layer_name,
      l.layer_group,
      l.source_name,
      l.source_url,
      ST_Distance(
        f.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) as distance_m
    FROM indigenous_features f
    JOIN indigenous_layers l ON l.id = f.layer_id
    WHERE l.active = true
      AND ST_Intersects(f.geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
  `);

  for (const row of (directHits as any).rows || []) {
    hits.push({
      featureId: row.feature_id,
      featureName: row.feature_name || "Unknown",
      nationName: row.nation_name,
      treatyName: row.treaty_name,
      agreementName: row.agreement_name,
      province: row.province,
      category: row.category,
      layerName: row.layer_name,
      layerGroup: row.layer_group,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      hitType: "inside",
      distanceMeters: Math.round(row.distance_m || 0),
    });
  }

  if (bufferMeters > 0) {
    const bufferHits = await db.execute(sql`
      SELECT
        f.id as feature_id,
        f.feature_name,
        f.nation_name,
        f.treaty_name,
        f.agreement_name,
        f.province,
        f.category,
        l.layer_name,
        l.layer_group,
        l.source_name,
        l.source_url,
        ST_Distance(
          f.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) as distance_m
      FROM indigenous_features f
      JOIN indigenous_layers l ON l.id = f.layer_id
      WHERE l.active = true
        AND NOT ST_Intersects(f.geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
        AND ST_DWithin(
          f.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${bufferMeters}
        )
    `);

    for (const row of (bufferHits as any).rows || []) {
      hits.push({
        featureId: row.feature_id,
        featureName: row.feature_name || "Unknown",
        nationName: row.nation_name,
        treatyName: row.treaty_name,
        agreementName: row.agreement_name,
        province: row.province,
        category: row.category,
        layerName: row.layer_name,
        layerGroup: row.layer_group,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        hitType: "within_buffer",
        distanceMeters: Math.round(row.distance_m || 0),
      });
    }
  }

  const directCount = hits.filter(h => h.hitType === "inside").length;
  const nearCount = hits.filter(h => h.hitType === "within_buffer").length;

  let status: ScreeningResult["status"];
  if (directCount > 0) {
    status = "overlap_found";
  } else if (nearCount > 0) {
    status = "near_overlap";
  } else {
    status = "no_overlap_found";
  }

  const layers = await storage.getIndigenousLayers();
  const activeLayers = layers.filter(l => l.active);
  const completeness: ScreeningResult["completeness"] =
    activeLayers.length >= 2 ? "basic" : "limited";

  const summary = generateSummary(status, hits, bufferMeters);

  return {
    status,
    screeningMethod: "point_plus_buffer",
    bufferMeters,
    hitsCount: hits.length,
    completeness,
    summary,
    hits,
    disclaimer: DISCLAIMER,
  };
}

function generateSummary(
  status: ScreeningResult["status"],
  hits: ScreeningHitResult[],
  bufferMeters: number
): string {
  if (status === "no_overlap_found") {
    return bufferMeters > 0
      ? `No overlap with known treaty or Indigenous agreement areas was detected at this location or within ${bufferMeters}m. This is an informational screening result only and may not reflect all relevant agreements or claims.`
      : "No overlap with known treaty or Indigenous agreement areas was detected at this location. This is an informational screening result only and may not reflect all relevant agreements or claims.";
  }

  const directHits = hits.filter(h => h.hitType === "inside");
  const nearHits = hits.filter(h => h.hitType === "within_buffer");

  const parts: string[] = [];

  if (directHits.length > 0) {
    const names = [...new Set(directHits.map(h => h.featureName))].join(", ");
    parts.push(`This property is located within ${directHits.length} treaty or Indigenous agreement area(s): ${names}.`);
  }

  if (nearHits.length > 0) {
    const nearest = Math.min(...nearHits.map(h => h.distanceMeters || 0));
    const names = [...new Set(nearHits.map(h => h.featureName))].join(", ");
    parts.push(`Additionally, ${nearHits.length} area(s) are within the ${bufferMeters}m buffer: ${names} (nearest: ${nearest}m).`);
  }

  parts.push("This is an informational screening result only and may warrant further title, legal, and Indigenous relations review.");

  return parts.join(" ");
}

export async function getFeatureGeoJSON(): Promise<any> {
  const result = await db.execute(sql`
    SELECT
      f.id,
      f.feature_name,
      f.treaty_name,
      f.agreement_name,
      f.province,
      f.category,
      l.layer_name,
      l.layer_group,
      l.slug as layer_slug,
      ST_AsGeoJSON(ST_Simplify(f.geom, 0.01)) as geometry,
      ST_AsGeoJSON(f.centroid) as centroid_geojson
    FROM indigenous_features f
    JOIN indigenous_layers l ON l.id = f.layer_id
    WHERE l.active = true
  `);

  const features = ((result as any).rows || []).map((row: any) => ({
    type: "Feature",
    properties: {
      id: row.id,
      featureName: row.feature_name,
      treatyName: row.treaty_name,
      agreementName: row.agreement_name,
      province: row.province,
      category: row.category,
      layerName: row.layer_name,
      layerGroup: row.layer_group,
      layerSlug: row.layer_slug,
    },
    geometry: JSON.parse(row.geometry),
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}
