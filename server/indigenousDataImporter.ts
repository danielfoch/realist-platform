import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

interface LayerConfig {
  slug: string;
  layerName: string;
  layerGroup: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  esriEndpoint: string;
  fieldMapping: {
    featureName: string;
    treatyName?: string;
    agreementName?: string;
    province?: string;
    category?: string;
    externalId?: string;
  };
}

const LAYER_CONFIGS: LayerConfig[] = [
  {
    slug: "historic-treaties-federal",
    layerName: "Historic Treaties",
    layerGroup: "historic_treaty",
    sourceName: "Indigenous Services Canada (SAC-ISC)",
    sourceUrl: "https://open.canada.ca/data/en/dataset/f5b9e498-5eb3-4ae7-b8e2-a86b2e43e394",
    licence: "Open Government Licence - Canada",
    esriEndpoint: "https://geo.sac-isc.gc.ca/geomatics/rest/services/Donnees_Ouvertes-Open_Data/Historic_Treaty_E/MapServer/0",
    fieldMapping: {
      featureName: "ENAME",
      treatyName: "ENAME",
      province: "PROVINCES_EN",
      category: "CATEGORY_TYPE_EN",
      externalId: "OBJECTID",
    },
  },
  {
    slug: "modern-treaties-federal",
    layerName: "Modern Treaties & Indigenous Agreements",
    layerGroup: "modern_treaty",
    sourceName: "Indigenous Services Canada (SAC-ISC)",
    sourceUrl: "https://open.canada.ca/data/en/dataset/f5b9e498-5eb3-4ae7-b8e2-a86b2e43e394",
    licence: "Open Government Licence - Canada",
    esriEndpoint: "https://geo.sac-isc.gc.ca/geomatics/rest/services/Donnees_Ouvertes-Open_Data/Modern_Treaty_E/MapServer/0",
    fieldMapping: {
      featureName: "ENAME",
      agreementName: "ENAME",
      province: "PROVINCES_EN",
      category: "CATEGORY_TYPE_EN",
      externalId: "OBJECTID",
    },
  },
];

async function fetchEsriFeatures(endpoint: string): Promise<any[]> {
  const allFeatures: any[] = [];
  let offset = 0;
  const batchSize = 100;

  while (true) {
    const url = `${endpoint}/query?where=1%3D1&f=geojson&outFields=*&resultRecordCount=${batchSize}&resultOffset=${offset}`;
    console.log(`[indigenous-import] Fetching from ${endpoint} offset=${offset}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESRI fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const features = data.features || [];
    allFeatures.push(...features);

    if (features.length < batchSize) break;
    offset += batchSize;
  }

  return allFeatures;
}

async function importLayer(config: LayerConfig): Promise<{ imported: number; errors: number }> {
  console.log(`[indigenous-import] Importing layer: ${config.layerName}`);

  let layer = await storage.getIndigenousLayerBySlug(config.slug);
  if (!layer) {
    layer = await storage.createIndigenousLayer({
      slug: config.slug,
      layerName: config.layerName,
      layerGroup: config.layerGroup,
      sourceName: config.sourceName,
      sourceUrl: config.sourceUrl,
      licence: config.licence,
      active: true,
    });
  }

  await db.execute(sql`DELETE FROM indigenous_features WHERE layer_id = ${layer.id}`);

  const features = await fetchEsriFeatures(config.esriEndpoint);
  let imported = 0;
  let errors = 0;

  for (const feature of features) {
    try {
      const props = feature.properties || {};
      const geojsonStr = JSON.stringify(feature.geometry);
      const fm = config.fieldMapping;

      const featureName = props[fm.featureName] || null;
      const treatyName = fm.treatyName ? props[fm.treatyName] || null : null;
      const agreementName = fm.agreementName ? props[fm.agreementName] || null : null;
      const province = fm.province ? props[fm.province] || null : null;
      const category = fm.category ? props[fm.category] || null : null;
      const externalId = fm.externalId ? String(props[fm.externalId]) : null;

      const bbox = feature.geometry?.bbox
        ? JSON.stringify(feature.geometry.bbox)
        : null;

      let centroidLat: number | null = null;
      let centroidLng: number | null = null;
      if (feature.geometry?.coordinates) {
        const coords: number[][] = [];
        function extractCoords(c: any) {
          if (typeof c[0] === "number" && typeof c[1] === "number" && c.length >= 2) {
            coords.push(c);
          } else if (Array.isArray(c)) {
            for (const sub of c) extractCoords(sub);
          }
        }
        extractCoords(feature.geometry.coordinates);
        if (coords.length > 0) {
          centroidLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          centroidLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        }
      }

      await db.execute(sql`
        INSERT INTO indigenous_features (
          id, layer_id, feature_external_id, feature_name, nation_name, treaty_name,
          agreement_name, claim_name, province, category, status, metadata_json, bbox,
          geojson, centroid_lat, centroid_lng, created_at
        ) VALUES (
          gen_random_uuid()::text,
          ${layer.id},
          ${externalId},
          ${featureName},
          ${featureName},
          ${treatyName},
          ${agreementName},
          NULL,
          ${province},
          ${category},
          'active',
          ${JSON.stringify(props)},
          ${bbox},
          ${geojsonStr}::jsonb,
          ${centroidLat},
          ${centroidLng},
          NOW()
        )
      `);

      imported++;
    } catch (err: any) {
      console.error(`[indigenous-import] Error importing feature:`, err.message);
      errors++;
    }
  }

  await storage.updateIndigenousLayer(layer.id, {
    featureCount: imported,
    lastImportedAt: new Date(),
    lastCheckedAt: new Date(),
  });

  console.log(`[indigenous-import] ${config.layerName}: ${imported} imported, ${errors} errors`);
  return { imported, errors };
}

export async function importAllLayers(): Promise<{ total: number; errors: number; layers: string[] }> {
  let total = 0;
  let totalErrors = 0;
  const layers: string[] = [];

  for (const config of LAYER_CONFIGS) {
    try {
      const result = await importLayer(config);
      total += result.imported;
      totalErrors += result.errors;
      layers.push(`${config.layerName}: ${result.imported} features`);
    } catch (err: any) {
      console.error(`[indigenous-import] Failed to import ${config.layerName}:`, err.message);
      totalErrors++;
      layers.push(`${config.layerName}: FAILED - ${err.message}`);
    }
  }

  console.log(`[indigenous-import] Complete: ${total} total features, ${totalErrors} errors`);
  return { total, errors: totalErrors, layers };
}

export async function checkAndImportIfEmpty(): Promise<void> {
  const result = await db.execute(sql`SELECT COUNT(*)::int as count FROM indigenous_features`);
  const count = (result as any).rows?.[0]?.count || 0;

  if (count === 0) {
    console.log("[indigenous-import] No features found, running initial import...");
    await importAllLayers();
  } else {
    console.log(`[indigenous-import] ${count} features already loaded, skipping import`);
  }
}

export { LAYER_CONFIGS };
