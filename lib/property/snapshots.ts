import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { Row } from "./model";

export const DATASETS = ["toronto-rental-buildings", "toronto-building-evaluations", "brampton-additional-units", "brampton-heritage", "toronto-heritage", "toronto-development", "hamilton-heritage", "hamilton-development"] as const;
export type Dataset = typeof DATASETS[number];
export interface Snapshot {
  dataset: string; retrievedAt: string; sourceUpdatedAt: string | null; rowCount: number; records: Row[];
  sourceRelease?: string; sourceQuery?: string; selectedFields?: string[];
}
export interface LoadedSnapshot extends Snapshot { delivery: "automatic_database_snapshot" | "compiled_fallback"; }
export function validateSnapshot(value: unknown, key: Dataset): Snapshot {
  const s = value as Snapshot;
  const id = ["toronto-rental-buildings"].includes(key) ? "RSN" : ["toronto-building-evaluations", "toronto-development"].includes(key) ? "_id" : "OBJECTID";
  if (!s || s.dataset !== key || !Number.isFinite(Date.parse(s.retrievedAt)) || s.sourceUpdatedAt !== null && !Number.isFinite(Date.parse(s.sourceUpdatedAt)) || !Array.isArray(s.records) || s.records.length !== s.rowCount || s.rowCount < 1 || s.rowCount > 50_000) throw new Error("Invalid complete snapshot");
  if (s.records.some(r => !r || typeof r !== "object" || Array.isArray(r) || r[id] === null || r[id] === undefined) || new Set(s.records.map(r => String(r[id]))).size !== s.rowCount) throw new Error("Invalid snapshot identities");
  return s;
}
const cache = new Map<Dataset, { expires: number; value: Promise<LoadedSnapshot | null> }>();
export function clearSnapshotCache() { cache.clear(); }
export function loadSnapshot(key: Dataset): Promise<LoadedSnapshot | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = (async () => {
    try {
      const r = (await getDb().execute(sql`SELECT payload FROM property_public_snapshots WHERE key = ${key}`)).rows[0];
      if (r) return { ...validateSnapshot(r.payload, key), delivery: "automatic_database_snapshot" as const };
    } catch { /* Cold deployment or DB outage: retain the traced last-good asset. */ }
    try {
      const raw = JSON.parse(await readFile(join(process.cwd(), "lib/property/data", `${key}.json`), "utf8"));
      return { ...validateSnapshot(raw, key), delivery: "compiled_fallback" as const };
    } catch { return null; }
  })();
  cache.set(key, { value, expires: Date.now() + 300_000 });
  return value;
}
/** Only these two new tables; never push the platform schema into production. */
export async function ensureSnapshotTables() {
  await getDb().execute(sql`CREATE TABLE IF NOT EXISTS property_public_snapshots (key text PRIMARY KEY, payload jsonb NOT NULL, published_at timestamp NOT NULL DEFAULT now())`);
  await getDb().execute(sql`CREATE TABLE IF NOT EXISTS property_refresh_runs (key text PRIMARY KEY, token text, lease_until timestamp, last_attempt_at timestamp, last_success_at timestamp, status text NOT NULL, error_code text)`);
}
export async function refreshSnapshot(key: Dataset, fetcher: () => Promise<Snapshot>): Promise<{ dataset: string; status: string; records?: number }> {
  const token = randomUUID();
  const claim = await getDb().execute(sql`INSERT INTO property_refresh_runs (key, token, lease_until, last_attempt_at, status) VALUES (${key}, ${token}, now() + interval '10 minutes', now(), 'running') ON CONFLICT (key) DO UPDATE SET token = EXCLUDED.token, lease_until = EXCLUDED.lease_until, last_attempt_at = EXCLUDED.last_attempt_at, status = 'running', error_code = NULL WHERE property_refresh_runs.lease_until IS NULL OR property_refresh_runs.lease_until < now() RETURNING key`);
  if (!claim.rows.length) return { dataset: key, status: "already_running" };
  let phase = "source";
  try {
    const snapshot = validateSnapshot(await fetcher(), key);
    phase = "publication";
    // Publication and health update share one atomic statement, guarded by the current lease token.
    const result = await getDb().execute(sql`WITH owner AS (SELECT key FROM property_refresh_runs WHERE key = ${key} AND token = ${token} AND lease_until > now()), published AS (INSERT INTO property_public_snapshots (key, payload, published_at) SELECT key, ${JSON.stringify(snapshot)}::jsonb, now() FROM owner ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, published_at = EXCLUDED.published_at RETURNING key) UPDATE property_refresh_runs SET status = 'succeeded', last_success_at = now(), lease_until = NULL, token = NULL, error_code = NULL WHERE key IN (SELECT key FROM published) AND token = ${token} RETURNING key`);
    if (!result.rows.length) return { dataset: key, status: "lease_lost" };
    clearSnapshotCache();
    return { dataset: key, status: "succeeded", records: snapshot.rowCount };
  } catch {
    const code = phase === "publication" ? "database_publication_failed" : "source_validation_or_fetch_failed";
    await getDb().execute(sql`UPDATE property_refresh_runs SET status = 'failed', error_code = ${code}, lease_until = NULL, token = NULL WHERE key = ${key} AND token = ${token}`);
    return { dataset: key, status: "failed" };
  }
}
export async function refreshHealth() {
  try { return (await getDb().execute(sql`SELECT key, status, last_attempt_at, last_success_at, lease_until, error_code FROM property_refresh_runs ORDER BY key`)).rows; } catch { return []; }
}
