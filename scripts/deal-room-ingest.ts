/**
 * Manual/cron entrypoint for the Deal Room recording ingest.
 *
 *   npm run deal-room:ingest
 *
 * Same work the /api/deal-room/sweep endpoint does for recordings, callable
 * from a shell or the OpenClaw scheduler. Requires DATABASE_URL plus the
 * DEAL_ROOM_GOOGLE_SA_JSON / DEAL_ROOM_DRIVE_FOLDER_ID env vars.
 */

import { ingestDealRoomRecordings } from "../server/dealRoomIngest";

async function main() {
  const report = await ingestDealRoomRecordings();
  console.log(JSON.stringify(report, null, 2));
  if (!report.configured) {
    console.error("Ingest is not configured — set DEAL_ROOM_GOOGLE_SA_JSON and DEAL_ROOM_DRIVE_FOLDER_ID.");
    process.exitCode = 1;
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error("deal-room-ingest failed:", err);
    process.exit(1);
  },
);
