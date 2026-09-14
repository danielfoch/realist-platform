/**
 * Toronto ward-boundary importer (manual entry point).
 *
 *   npx tsx scripts/import-toronto-wards.ts
 *
 * The server now loads the wards itself at boot when municipal_wards is empty
 * (server/torontoWards.ts); this script remains for forcing a refresh after
 * the City updates the ward model.
 */

import { importTorontoWards, TORONTO_WARDS_GEOJSON_URL } from "../server/torontoWards";

async function main(): Promise<void> {
  console.log(`Downloading Toronto wards — ${TORONTO_WARDS_GEOJSON_URL}`);
  const r = await importTorontoWards();
  console.log(`Toronto wards done: ${r.imported} imported, ${r.skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[toronto-wards] import failed:", err);
  process.exit(1);
});
