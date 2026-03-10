import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

interface WatchOverlayConfig {
  slug: string;
  overlayName: string;
  overlayGroup: string;
  jurisdiction: string;
  nationName: string;
  legalContextType: string;
  sourceSummary: string;
  sourceUrl: string;
  sourceDate: string;
  geometryMethod: string;
  geometryConfidence: string;
  authorityLevel: string;
  disclaimerText: string;
  statusLabel: string;
  createdBy: string;
  digitizationNotes: string;
  geojson: object;
}

const COWICHAN_RICHMOND_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-123.2500, 49.1950],
    [-123.2500, 49.2100],
    [-123.2200, 49.2200],
    [-123.1800, 49.2250],
    [-123.1400, 49.2200],
    [-123.1000, 49.2150],
    [-123.0700, 49.2050],
    [-123.0500, 49.1950],
    [-123.0400, 49.1800],
    [-123.0400, 49.1650],
    [-123.0500, 49.1500],
    [-123.0700, 49.1400],
    [-123.0900, 49.1350],
    [-123.1200, 49.1300],
    [-123.1500, 49.1300],
    [-123.1800, 49.1350],
    [-123.2100, 49.1450],
    [-123.2300, 49.1600],
    [-123.2450, 49.1750],
    [-123.2500, 49.1950],
  ]],
};

const MUSQUEAM_TERRITORY_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-123.2700, 49.3100],
    [-123.2600, 49.3200],
    [-123.2200, 49.3300],
    [-123.1800, 49.3300],
    [-123.1400, 49.3200],
    [-123.1000, 49.3000],
    [-123.0700, 49.2800],
    [-123.0500, 49.2600],
    [-123.0400, 49.2400],
    [-123.0400, 49.2200],
    [-123.0500, 49.2000],
    [-123.0700, 49.1900],
    [-123.1000, 49.1850],
    [-123.1300, 49.1800],
    [-123.1600, 49.1800],
    [-123.1900, 49.1850],
    [-123.2100, 49.1900],
    [-123.2300, 49.2000],
    [-123.2500, 49.2200],
    [-123.2600, 49.2400],
    [-123.2700, 49.2600],
    [-123.2750, 49.2800],
    [-123.2700, 49.3100],
  ]],
};

const MUSQUEAM_SOI_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-123.3500, 49.3500],
    [-123.3200, 49.3600],
    [-123.2700, 49.3600],
    [-123.2200, 49.3500],
    [-123.1600, 49.3400],
    [-123.1000, 49.3200],
    [-123.0500, 49.2900],
    [-123.0200, 49.2600],
    [-123.0000, 49.2300],
    [-122.9900, 49.2000],
    [-123.0000, 49.1700],
    [-123.0200, 49.1500],
    [-123.0500, 49.1400],
    [-123.0900, 49.1300],
    [-123.1300, 49.1200],
    [-123.1700, 49.1200],
    [-123.2100, 49.1300],
    [-123.2500, 49.1500],
    [-123.2800, 49.1700],
    [-123.3100, 49.2000],
    [-123.3300, 49.2300],
    [-123.3400, 49.2600],
    [-123.3500, 49.2900],
    [-123.3500, 49.3200],
    [-123.3500, 49.3500],
  ]],
};

const HALDIMAND_TRACT_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-79.6100, 42.8700],
    [-79.6300, 42.9000],
    [-79.6500, 42.9400],
    [-79.6700, 42.9800],
    [-79.7000, 43.0200],
    [-79.7300, 43.0600],
    [-79.7600, 43.1000],
    [-79.7900, 43.1400],
    [-79.8200, 43.1800],
    [-79.8500, 43.2200],
    [-79.8800, 43.2600],
    [-79.9100, 43.3000],
    [-79.9400, 43.3400],
    [-79.9700, 43.3800],
    [-80.0000, 43.4200],
    [-80.0300, 43.4600],
    [-80.0600, 43.5000],
    [-80.0900, 43.5400],
    [-80.1200, 43.5700],
    [-80.3200, 43.5700],
    [-80.2900, 43.5400],
    [-80.2600, 43.5000],
    [-80.2300, 43.4600],
    [-80.2000, 43.4200],
    [-80.1700, 43.3800],
    [-80.1400, 43.3400],
    [-80.1100, 43.3000],
    [-80.0800, 43.2600],
    [-80.0500, 43.2200],
    [-80.0200, 43.1800],
    [-79.9900, 43.1400],
    [-79.9600, 43.1000],
    [-79.9300, 43.0600],
    [-79.9000, 43.0200],
    [-79.8700, 42.9800],
    [-79.8500, 42.9400],
    [-79.8300, 42.9000],
    [-79.8100, 42.8700],
    [-79.7500, 42.8500],
    [-79.7000, 42.8500],
    [-79.6500, 42.8600],
    [-79.6100, 42.8700],
  ]],
};

const OVERLAYS: WatchOverlayConfig[] = [
  {
    slug: "cowichan-title-lands-richmond",
    overlayName: "Cowichan Title Lands (Court / Judgment Watch Layer)",
    overlayGroup: "high_sensitivity",
    jurisdiction: "provincial",
    nationName: "Cowichan Tribes",
    legalContextType: "court_decision",
    sourceSummary: "Based on Cowichan Tribes v. Canada, 2025 BCSC 1490, which addressed Aboriginal title to lands in the Richmond area of British Columbia (Lulu Island / Sea Island vicinity). This overlay is derived from publicly available court materials and briefing documents.",
    sourceUrl: "https://www.bccourts.ca/jdb-txt/sc/25/14/2025BCSC1490.htm",
    sourceDate: "2025-10-01",
    geometryMethod: "manual_digitization",
    geometryConfidence: "medium",
    authorityLevel: "high_for_context_not_cadastral",
    disclaimerText: "This property appears to fall within or near the Richmond-area lands addressed in Cowichan Tribes v. Canada, 2025 BCSC 1490. This overlay may be based on manually digitized court-related mapping and is for screening only. Review source documents and obtain legal/title advice before relying on this result.",
    statusLabel: "Court Decision Watch",
    createdBy: "Realist Research",
    digitizationNotes: "Polygon manually digitized from court judgment description of Richmond/Lulu Island lands. Approximate boundary only — not parcel-level cadastral data.",
    geojson: COWICHAN_RICHMOND_POLYGON,
  },
  {
    slug: "musqueam-territory-agreement-watch",
    overlayName: "Musqueam Territory (Descriptive Agreement Watch Layer)",
    overlayGroup: "high_sensitivity",
    jurisdiction: "provincial",
    nationName: "Musqueam Indian Band (xʷməθkʷəy̓əm)",
    legalContextType: "rights_recognition_agreement",
    sourceSummary: "Approximate territory watch area derived from the 2026 Musqueam rights recognition agreement and related public territorial descriptions. This is NOT a treaty, NOT a finalized land claim boundary, and does NOT automatically affect private lands.",
    sourceUrl: "https://www.musqueam.bc.ca",
    sourceDate: "2026-01-15",
    geometryMethod: "manual_digitization",
    geometryConfidence: "medium",
    authorityLevel: "contextual",
    disclaimerText: "This property falls within an approximate Musqueam territory watch area derived from public declaration / agreement materials. The 2026 rights recognition agreement is not itself a treaty or land claim agreement and does not by itself establish a parcel-level legal determination. This overlay is approximate and for informational screening only.",
    statusLabel: "Rights Recognition Watch",
    createdBy: "Realist Research",
    digitizationNotes: "Polygon traced from publicly available Musqueam territory descriptions and public reference maps covering Metro Vancouver south shore area. Not cadastral — descriptive approximation.",
    geojson: MUSQUEAM_TERRITORY_POLYGON,
  },
  {
    slug: "musqueam-soi-approximate",
    overlayName: "Musqueam Statement of Intent / Declaration Approximate Boundary",
    overlayGroup: "high_sensitivity",
    jurisdiction: "provincial",
    nationName: "Musqueam Indian Band (xʷməθkʷəy̓əm)",
    legalContextType: "statement_of_intent_boundary",
    sourceSummary: "Broader approximate boundary derived from Musqueam Statement of Intent filings and public declaration materials. This represents a wider territorial reference area and should be treated as a low-confidence descriptive boundary.",
    sourceUrl: "https://www.bctreaty.ca",
    sourceDate: "2026-01-15",
    geometryMethod: "descriptive_approximation",
    geometryConfidence: "low",
    authorityLevel: "non_cadastral_reference",
    disclaimerText: "This property falls within a broader approximate Musqueam Statement of Intent / declaration area. This is a low-confidence descriptive boundary for informational context only. It does not represent a legal determination, treaty boundary, or enforceable land claim area. Independent legal and title review recommended.",
    statusLabel: "SOI / Declaration Watch",
    createdBy: "Realist Research",
    digitizationNotes: "Broader territory polygon approximated from BC Treaty Commission SOI filings and public Musqueam declaration materials. Very approximate — for contextual screening only.",
    geojson: MUSQUEAM_SOI_POLYGON,
  },
  {
    slug: "haldimand-tract-historic-watch",
    overlayName: "Haldimand Tract (Historic / Litigation Watch Layer)",
    overlayGroup: "high_sensitivity",
    jurisdiction: "provincial",
    nationName: "Six Nations of the Grand River",
    legalContextType: "historic_tract_litigation",
    sourceSummary: "The Haldimand Tract, proclaimed by Governor Frederick Haldimand in 1784, granted Six Nations peoples six miles on each side of the Grand River from its mouth to its source. This overlay represents an approximate historic tract boundary based on widely referenced public historical mapping. Active litigation by Six Nations continues regarding portions of this tract.",
    sourceUrl: "https://www.sixnations.ca",
    sourceDate: "1784-10-25",
    geometryMethod: "imported_public_reference_polygon",
    geometryConfidence: "medium",
    authorityLevel: "semi_authoritative",
    disclaimerText: "This property appears to fall within the historic Haldimand Tract reference area. This is a historic/litigation watch overlay and not a parcel-level legal determination. Users should review active Six Nations litigation materials and obtain legal/title advice.",
    statusLabel: "Historic Tract / Litigation Watch",
    createdBy: "Realist Research",
    digitizationNotes: "Polygon derived from widely used public historic tract mappings of the Haldimand Proclamation lands (six miles each side of Grand River, mouth to source). Approximate historic boundary — not surveyed parcel data.",
    geojson: HALDIMAND_TRACT_POLYGON,
  },
];

export async function seedWatchOverlays(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const config of OVERLAYS) {
    const existing = await storage.getWatchOverlayBySlug(config.slug);
    if (existing) {
      skipped++;
      continue;
    }

    const overlay = await storage.createWatchOverlay({
      slug: config.slug,
      overlayName: config.overlayName,
      overlayGroup: config.overlayGroup,
      jurisdiction: config.jurisdiction,
      nationName: config.nationName,
      legalContextType: config.legalContextType,
      sourceSummary: config.sourceSummary,
      sourceUrl: config.sourceUrl,
      sourceDate: config.sourceDate,
      geometryMethod: config.geometryMethod,
      geometryConfidence: config.geometryConfidence,
      authorityLevel: config.authorityLevel,
      disclaimerText: config.disclaimerText,
      statusLabel: config.statusLabel,
      active: true,
      createdBy: config.createdBy,
      digitizationNotes: config.digitizationNotes,
    });

    const geojsonStr = JSON.stringify(config.geojson);
    await db.execute(sql`
      UPDATE watch_overlays
      SET geom = ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326)
      WHERE id = ${overlay.id}
    `);

    created++;
    console.log(`[watch-overlays] Created: ${config.overlayName}`);
  }

  console.log(`[watch-overlays] Seed complete: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

export async function checkAndSeedWatchOverlays(): Promise<void> {
  const overlays = await storage.getWatchOverlays();
  if (overlays.length === 0) {
    console.log("[watch-overlays] No overlays found, seeding...");
    await seedWatchOverlays();
  } else {
    console.log(`[watch-overlays] ${overlays.length} overlays already loaded, skipping seed`);
  }
}
