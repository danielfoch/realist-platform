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

function pointInPolygon(lat: number, lng: number, coordinates: number[][][]): boolean {
  for (const ring of coordinates) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][1], yi = ring[i][0];
      const xj = ring[j][1], yj = ring[j][0];
      if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

function pointInGeometry(lat: number, lng: number, geojson: any): boolean {
  if (!geojson) return false;
  if (geojson.type === "Polygon") {
    return pointInPolygon(lat, lng, geojson.coordinates);
  }
  if (geojson.type === "MultiPolygon") {
    return geojson.coordinates.some((coords: number[][][]) => pointInPolygon(lat, lng, coords));
  }
  return false;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bboxContainsOrNear(bbox: string | null, lat: number, lng: number, bufferDeg: number): boolean {
  if (!bbox) return true;
  try {
    const b = JSON.parse(bbox);
    if (Array.isArray(b) && b.length >= 4) {
      const [minLng, minLat, maxLng, maxLat] = b;
      return lng >= minLng - bufferDeg && lng <= maxLng + bufferDeg &&
             lat >= minLat - bufferDeg && lat <= maxLat + bufferDeg;
    }
  } catch {}
  return true;
}

function computeBboxFromGeojson(geojson: any): [number, number, number, number] | null {
  if (!geojson || !geojson.coordinates) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  function processCoords(coords: any) {
    if (typeof coords[0] === "number") {
      minLng = Math.min(minLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLng = Math.max(maxLng, coords[0]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      for (const c of coords) processCoords(c);
    }
  }
  processCoords(geojson.coordinates);
  if (minLng === Infinity) return null;
  return [minLng, minLat, maxLng, maxLat];
}

export async function screenLocation(
  lat: number,
  lng: number,
  bufferMeters: number = 0
): Promise<ScreeningResult> {
  const hits: ScreeningHitResult[] = [];
  const bufferDeg = bufferMeters / 111000;

  const featureRows = await db.execute(sql`
    SELECT
      f.id as feature_id,
      f.feature_name,
      f.nation_name,
      f.treaty_name,
      f.agreement_name,
      f.province,
      f.category,
      f.geojson,
      f.bbox,
      f.centroid_lat,
      f.centroid_lng,
      l.layer_name,
      l.layer_group,
      l.source_name,
      l.source_url
    FROM indigenous_features f
    JOIN indigenous_layers l ON l.id = f.layer_id
    WHERE l.active = true
  `);

  for (const row of (featureRows as any).rows || []) {
    if (!bboxContainsOrNear(row.bbox, lat, lng, bufferDeg + 0.5)) continue;

    const geojson = row.geojson;
    const isInside = geojson ? pointInGeometry(lat, lng, geojson) : false;

    if (isInside) {
      const distM = row.centroid_lat && row.centroid_lng
        ? haversineDistance(lat, lng, row.centroid_lat, row.centroid_lng)
        : 0;
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
        distanceMeters: Math.round(distM),
        isHighSensitivity: false,
      });
    } else if (bufferMeters > 0 && row.centroid_lat && row.centroid_lng) {
      const distM = haversineDistance(lat, lng, row.centroid_lat, row.centroid_lng);
      const bbox = row.bbox ? JSON.parse(row.bbox) : null;
      let closestDist = distM;
      if (bbox && bbox.length >= 4) {
        const clampedLng = Math.max(bbox[0], Math.min(bbox[2], lng));
        const clampedLat = Math.max(bbox[1], Math.min(bbox[3], lat));
        closestDist = haversineDistance(lat, lng, clampedLat, clampedLng);
      }

      if (closestDist <= bufferMeters) {
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
          distanceMeters: Math.round(closestDist),
          isHighSensitivity: false,
        });
      }
    }
  }

  const watchRows = await db.execute(sql`
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
      w.geojson
    FROM watch_overlays w
    WHERE w.active = true
      AND w.geojson IS NOT NULL
  `);

  for (const row of (watchRows as any).rows || []) {
    const geojson = typeof row.geojson === "string" ? JSON.parse(row.geojson) : row.geojson;
    if (!geojson) continue;

    const wBbox = computeBboxFromGeojson(geojson);
    if (wBbox && !bboxContainsOrNear(JSON.stringify(wBbox), lat, lng, bufferDeg + 0.1)) continue;

    const isInside = pointInGeometry(lat, lng, geojson);

    if (isInside) {
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
        distanceMeters: 0,
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
    } else if (bufferMeters > 0 && wBbox) {
      const clampedLng = Math.max(wBbox[0], Math.min(wBbox[2], lng));
      const clampedLat = Math.max(wBbox[1], Math.min(wBbox[3], lat));
      const dist = haversineDistance(lat, lng, clampedLat, clampedLng);

      if (dist <= bufferMeters) {
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
          distanceMeters: Math.round(dist),
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
      f.geojson,
      f.centroid_lat,
      f.centroid_lng,
      l.layer_name,
      l.layer_group,
      l.slug as layer_slug,
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
      w.geojson,
      NULL as centroid_lat,
      NULL as centroid_lng,
      w.overlay_name as layer_name,
      w.overlay_group as layer_group,
      w.slug as layer_slug,
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
    WHERE w.active = true AND w.geojson IS NOT NULL
  `);

  const features = ((result as any).rows || []).map((row: any) => {
    const geojson = row.geojson;
    if (!geojson) return null;
    const geo = typeof geojson === "string" ? JSON.parse(geojson) : geojson;
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
      geometry: geo,
    };
  }).filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
}
