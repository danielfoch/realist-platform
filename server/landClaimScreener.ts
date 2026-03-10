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
  isHighSensitivity?: boolean;
  legalContextType?: string | null;
  geometryConfidence?: string | null;
  authorityLevel?: string | null;
  disclaimerText?: string | null;
  statusLabel?: string | null;
  sourceSummary?: string | null;
  sourceDate?: string | null;
  geometryMethod?: string | null;
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
  hasHighSensitivityHits: boolean;
  highSensitivityBanner: string | null;
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
      isHighSensitivity: false,
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
        isHighSensitivity: false,
      });
    }
  }

  const watchDirectHits = await db.execute(sql`
    SELECT
      w.id,
      w.slug,
      w.overlay_name,
      w.overlay_group,
      w.nation_name,
      w.legal_context_type,
      w.source_summary,
      w.source_url,
      w.source_date,
      w.geometry_method,
      w.geometry_confidence,
      w.authority_level,
      w.disclaimer_text,
      w.status_label,
      ST_Distance(
        w.geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) as distance_m
    FROM watch_overlays w
    WHERE w.active = true
      AND w.geom IS NOT NULL
      AND ST_Intersects(w.geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
  `);

  for (const row of (watchDirectHits as any).rows || []) {
    hits.push({
      featureId: row.id,
      featureName: row.overlay_name,
      nationName: row.nation_name,
      treatyName: null,
      agreementName: null,
      province: null,
      category: row.legal_context_type,
      layerName: row.overlay_name,
      layerGroup: row.overlay_group,
      sourceName: row.source_summary || "Research Overlay",
      sourceUrl: row.source_url,
      hitType: "inside",
      distanceMeters: Math.round(row.distance_m || 0),
      isHighSensitivity: true,
      legalContextType: row.legal_context_type,
      geometryConfidence: row.geometry_confidence,
      authorityLevel: row.authority_level,
      disclaimerText: row.disclaimer_text,
      statusLabel: row.status_label,
      sourceSummary: row.source_summary,
      sourceDate: row.source_date,
      geometryMethod: row.geometry_method,
    });
  }

  if (bufferMeters > 0) {
    const watchBufferHits = await db.execute(sql`
      SELECT
        w.id,
        w.slug,
        w.overlay_name,
        w.overlay_group,
        w.nation_name,
        w.legal_context_type,
        w.source_summary,
        w.source_url,
        w.source_date,
        w.geometry_method,
        w.geometry_confidence,
        w.authority_level,
        w.disclaimer_text,
        w.status_label,
        ST_Distance(
          w.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) as distance_m
      FROM watch_overlays w
      WHERE w.active = true
        AND w.geom IS NOT NULL
        AND NOT ST_Intersects(w.geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
        AND ST_DWithin(
          w.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${bufferMeters}
        )
    `);

    for (const row of (watchBufferHits as any).rows || []) {
      hits.push({
        featureId: row.id,
        featureName: row.overlay_name,
        nationName: row.nation_name,
        treatyName: null,
        agreementName: null,
        province: null,
        category: row.legal_context_type,
        layerName: row.overlay_name,
        layerGroup: row.overlay_group,
        sourceName: row.source_summary || "Research Overlay",
        sourceUrl: row.source_url,
        hitType: "within_buffer",
        distanceMeters: Math.round(row.distance_m || 0),
        isHighSensitivity: true,
        legalContextType: row.legal_context_type,
        geometryConfidence: row.geometry_confidence,
        authorityLevel: row.authority_level,
        disclaimerText: row.disclaimer_text,
        statusLabel: row.status_label,
        sourceSummary: row.source_summary,
        sourceDate: row.source_date,
        geometryMethod: row.geometry_method,
      });
    }
  }

  const hsHits = hits.filter(h => h.isHighSensitivity);
  hits.sort((a, b) => {
    if (a.isHighSensitivity && !b.isHighSensitivity) return -1;
    if (!a.isHighSensitivity && b.isHighSensitivity) return 1;
    return 0;
  });

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

  let highSensitivityBanner: string | null = null;
  if (hsHits.length > 0) {
    const insideHS = hsHits.filter(h => h.hitType === "inside");
    const nearHS = hsHits.filter(h => h.hitType === "within_buffer");
    if (insideHS.length > 0) {
      highSensitivityBanner = "This property falls within a high-sensitivity Indigenous rights / title watch area. This result is based on a court decision, agreement text, or historic tract mapping and requires source-specific review. Informational screening only. Legal, title, and Indigenous relations review recommended.";
    } else if (nearHS.length > 0) {
      highSensitivityBanner = "This property is near a high-sensitivity Indigenous rights / title watch area. Source-specific review is recommended. Informational screening only.";
    }
  }

  return {
    status,
    screeningMethod: "point_plus_buffer",
    bufferMeters,
    hitsCount: hits.length,
    completeness,
    summary,
    hits,
    disclaimer: DISCLAIMER,
    hasHighSensitivityHits: hsHits.length > 0,
    highSensitivityBanner,
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
  const hsHits = hits.filter(h => h.isHighSensitivity);

  const parts: string[] = [];

  if (hsHits.length > 0) {
    const hsNames = [...new Set(hsHits.map(h => h.featureName))].join("; ");
    parts.push(`HIGH-SENSITIVITY: This location intersects ${hsHits.length} active-contestation / research watch area(s): ${hsNames}. Source-specific review required.`);
  }

  const standardDirect = directHits.filter(h => !h.isHighSensitivity);
  const standardNear = nearHits.filter(h => !h.isHighSensitivity);

  if (standardDirect.length > 0) {
    const names = [...new Set(standardDirect.map(h => h.featureName))].join(", ");
    parts.push(`This property is located within ${standardDirect.length} treaty or Indigenous agreement area(s): ${names}.`);
  }

  if (standardNear.length > 0) {
    const nearest = Math.min(...standardNear.map(h => h.distanceMeters || 0));
    const names = [...new Set(standardNear.map(h => h.featureName))].join(", ");
    parts.push(`Additionally, ${standardNear.length} area(s) are within the ${bufferMeters}m buffer: ${names} (nearest: ${nearest}m).`);
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
      ST_AsGeoJSON(f.centroid) as centroid_geojson,
      FALSE as is_high_sensitivity,
      NULL as legal_context_type,
      NULL as geometry_confidence,
      NULL as authority_level,
      NULL as status_label,
      NULL as source_summary,
      NULL as source_date,
      NULL as geometry_method,
      NULL as disclaimer_text
    FROM indigenous_features f
    JOIN indigenous_layers l ON l.id = f.layer_id
    WHERE l.active = true

    UNION ALL

    SELECT
      w.id,
      w.overlay_name as feature_name,
      NULL as treaty_name,
      NULL as agreement_name,
      w.jurisdiction as province,
      w.legal_context_type as category,
      w.overlay_name as layer_name,
      w.overlay_group as layer_group,
      w.slug as layer_slug,
      ST_AsGeoJSON(ST_Simplify(w.geom, 0.005)) as geometry,
      NULL as centroid_geojson,
      TRUE as is_high_sensitivity,
      w.legal_context_type,
      w.geometry_confidence,
      w.authority_level,
      w.status_label,
      w.source_summary,
      w.source_date,
      w.geometry_method,
      w.disclaimer_text
    FROM watch_overlays w
    WHERE w.active = true AND w.geom IS NOT NULL
  `);

  const features = ((result as any).rows || []).map((row: any) => {
    if (!row.geometry) return null;
    return {
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
        isHighSensitivity: row.is_high_sensitivity,
        legalContextType: row.legal_context_type,
        geometryConfidence: row.geometry_confidence,
        authorityLevel: row.authority_level,
        statusLabel: row.status_label,
        sourceSummary: row.source_summary,
        sourceDate: row.source_date,
        geometryMethod: row.geometry_method,
        disclaimerText: row.disclaimer_text,
      },
      geometry: JSON.parse(row.geometry),
    };
  }).filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
}
