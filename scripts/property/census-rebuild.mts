/** Scoped operator workflow: snapshot -> validated candidate -> atomic replacement.
 * No credential output, persistent staging tables, deletes or schema push.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Client, neonConfig } from "@neondatabase/serverless";
import { CENSUS_MAPPING_VERSION } from "../../lib/property/ingest/census";
import { censusProfileConsistent } from "../../lib/property/census-quality";
import type { Row } from "../../lib/property/model";

const args = process.argv.slice(2), mode = args[0];
const option = (key: string, fallback: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const dir = option("output", "/Users/danielfoch/Documents/Homies/outputs/census-rebuild-2026-10-02");
const backupPath = path.join(dir, "census-rollback.json.gz"), manifestPath = path.join(dir, "census-rollback-manifest.json");
const candidatePath = option("candidate", path.join(dir, "census-candidate.json.gz"));
const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
neonConfig.webSocketConstructor = WebSocket;
const db = new Client({ connectionString: (await fs.readFile(option("database-url-file", "/private/tmp/census-rebuild-database-url"), "utf8")).trim() });
db.on("error", () => { console.error("Census database connection failed"); });

async function state() {
  const signature = (await db.query("SELECT count(*)::integer AS count, md5(COALESCE(string_agg(md5(to_jsonb(p)::text), '' ORDER BY dauid),'')) AS signature FROM census_da_profiles p")).rows[0];
  const metadata: Record<string, Row[]> = {};
  for (const [table, clause] of [["data_layers", "key='census_da_profiles'"], ["property_import_runs", "key='census_da_profiles'"], ["property_import_files", "dataset_key='census_da_profiles'"]]) {
    metadata[table] = (await db.query(`SELECT to_jsonb(t) AS record FROM ${table} t WHERE ${clause} ORDER BY to_jsonb(t)::text`)).rows.map(r => r.record);
  }
  return { ...signature, metadata };
}
async function backup() {
  await fs.mkdir(dir, { recursive: true });
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const before = await state();
  assert(before.count === 57936, "Existing Census count changed; review scope before replacement");
  const records: Row[] = []; let last = "";
  for (;;) {
    const rows = (await db.query("SELECT to_jsonb(p) AS record FROM census_da_profiles p WHERE dauid>$1 ORDER BY dauid LIMIT 2000", [last])).rows.map(r => r.record);
    if (!rows.length) break;
    records.push(...rows); last = String(rows.at(-1)!.dauid);
  }
  assert(records.length === before.count, "Incomplete rollback snapshot");
  const data = gzipSync(JSON.stringify({ capturedAt: new Date().toISOString(), ...before, records }));
  await fs.writeFile(backupPath, data, { flag: "wx", mode: 0o600 });
  const decoded = JSON.parse(gunzipSync(await fs.readFile(backupPath)).toString());
  assert(decoded.records.length === records.length, "Rollback copy failed roundtrip verification");
  await fs.writeFile(manifestPath, JSON.stringify({ capturedAt: decoded.capturedAt, count: before.count, databaseSignature: before.signature, metadata: before.metadata, backupSha256: digest(data), backupBytes: data.length, backupPath }, null, 2)+"\n", { flag: "wx", mode: 0o600 });
  await db.query("COMMIT");
  console.log(JSON.stringify({ status: "rollback_saved", rows: before.count, bytes: data.length, sha256: digest(data), backupPath }));
}
async function publish() {
  assert(args.includes("--write"), "Explicit --write is required for the approved Census replacement");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const backupData = await fs.readFile(backupPath);
  assert(digest(backupData) === manifest.backupSha256, "Rollback checksum mismatch");
  const rollback = JSON.parse(gunzipSync(backupData).toString()) as { records: Row[] };
  const candidateData = await fs.readFile(candidatePath);
  const candidate = JSON.parse(gunzipSync(candidateData).toString()) as { mappingVersion: string; records: Row[]; sha256: string; hashes: Row; characteristics: number; observations: number; rejected: number };
  assert(candidate.mappingVersion === CENSUS_MAPPING_VERSION, "Candidate mapping is not verified");
  assert(candidate.records.length === manifest.count && candidate.records.length === 57936, "Replacement count exceeds the approved scope");
  const oldIds = new Set(rollback.records.map(r => String(r.dauid))), newIds = new Set<string>();
  for (const r of candidate.records) {
    const id = String(r.dauid);
    assert(oldIds.has(id) && !newIds.has(id) && r.census_year === 2021 && censusProfileConsistent(r.profile as Row), "Replacement geography or profile failed validation");
    newIds.add(id);
  }
  assert(newIds.size === oldIds.size, "Replacement IDs differ from the rollback copy");
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='10s'");
  await db.query("SET LOCAL statement_timeout='120s'");
  await db.query("LOCK TABLE census_da_profiles IN SHARE ROW EXCLUSIVE MODE");
  const current = await state();
  assert(current.count === manifest.count && current.signature === manifest.databaseSignature && JSON.stringify(current.metadata) === JSON.stringify(manifest.metadata), "Census data changed after backup; no replacement published");
  await db.query("CREATE TEMP TABLE census_candidate (LIKE census_da_profiles INCLUDING ALL) ON COMMIT DROP");
  for (let i=0; i<candidate.records.length; i+=1000) {
    await db.query("INSERT INTO census_candidate(dauid,census_year,profile) SELECT dauid,census_year,profile FROM jsonb_populate_recordset(NULL::census_da_profiles,$1::jsonb)", [JSON.stringify(candidate.records.slice(i,i+1000))]);
  }
  const checked = (await db.query("SELECT count(*)::integer AS count, count(*) FILTER (WHERE profile->>'mappingVersion'=$1)::integer AS verified FROM census_candidate", [CENSUS_MAPPING_VERSION])).rows[0];
  assert(checked.count === manifest.count && checked.verified === manifest.count, "Database candidate count mismatch");
  const replacement = await db.query("UPDATE census_da_profiles p SET census_year=c.census_year,profile=c.profile,imported_at=now() FROM census_candidate c WHERE p.dauid=c.dauid");
  assert(replacement.rowCount === manifest.count, "Replacement row count mismatch");
  const layer = await db.query("UPDATE data_layers SET last_imported_at=now(), row_count=$1, notes=$2 WHERE key='census_da_profiles'", [manifest.count, `Verified ${CENSUS_MAPPING_VERSION}; 33 complete characteristic extracts; scoped atomic rebuild with saved rollback copy. Housing counts are rounded; income reference year 2020; area-level values, not property valuations.`]);
  assert(layer.rowCount === 1, "Census registry row missing");
  const cursor = { mappingVersion: CENSUS_MAPPING_VERSION, sha256: candidate.sha256, candidateSha256: digest(candidateData), backupSha256: manifest.backupSha256, characteristics: candidate.characteristics, sourceObservations: candidate.observations, hostedRows: manifest.count, atomicReplacement: true };
  const run = await db.query("UPDATE property_import_runs SET status='complete',expected_rows=$1,processed_rows=$1,rejected_rows=$2,cursor=$3::jsonb,error=NULL,updated_at=now(),completed_at=now() WHERE key='census_da_profiles'", [manifest.count, candidate.rejected, JSON.stringify(cursor)]);
  assert(run.rowCount === 1, "Census import health row missing");
  const after = await state();
  await db.query("COMMIT");
  const audit = { completedAt: new Date().toISOString(), rows: replacement.rowCount, ...cursor, databaseSignature: after.signature };
  await fs.writeFile(path.join(dir,"census-publication.json"), JSON.stringify(audit,null,2)+"\n", { mode: 0o600 });
  console.log(JSON.stringify({ status: "census_replaced_atomically", ...audit }));
}
async function verify() {
  const counts = (await db.query("SELECT count(*)::integer AS profiles,count(*) FILTER (WHERE profile->>'mappingVersion'=$1)::integer AS verified,count(*) FILTER (WHERE (profile->>'avgHouseholdSize')::numeric>20)::integer AS invalid_averages FROM census_da_profiles", [CENSUS_MAPPING_VERSION])).rows[0];
  assert(counts.profiles === 57936 && counts.verified === 57936 && counts.invalid_averages === 0, "Published Census validation failed");
  const audit = { verifiedAt: new Date().toISOString(), ...counts, ...(await state()) };
  await fs.writeFile(path.join(dir,"census-database-verification.json"),JSON.stringify(audit,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(counts));
}
try {
  await db.connect();
  if (mode === "backup") await backup();
  else if (mode === "publish") await publish();
  else if (mode === "verify") await verify();
  else throw new Error("Modes: backup, publish --write, verify");
} catch (error) {
  await db.query("ROLLBACK").catch(()=>undefined);
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,"[redacted]") : "Census rebuild failed"); process.exitCode=1;
} finally { await db.end(); }
