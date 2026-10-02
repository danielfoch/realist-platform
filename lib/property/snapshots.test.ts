import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { useTestDb } from "@/lib/test/db";
import { getDb } from "@/lib/db";
import { clearSnapshotCache, ensureSnapshotTables, loadSnapshot, refreshHealth, refreshSnapshot, type Snapshot } from "./snapshots";
let db: Awaited<ReturnType<typeof useTestDb>>;
const value = (id: number): Snapshot => ({ dataset: "toronto-heritage", retrievedAt: new Date().toISOString(), sourceUpdatedAt: null, rowCount: 1, records: [{ OBJECTID: id, ADDRESS: "16 Soho St", STATUS: "Part IV" }] });
beforeAll(async () => { db = await useTestDb(); await ensureSnapshotTables(); }, 30000);
afterAll(async () => { clearSnapshotCache(); await db.close(); });
describe("atomic public snapshot publication", () => {
  it("publishes a complete last-good snapshot and reports server refresh health", async () => {
    expect(await refreshSnapshot("toronto-heritage", async () => value(1))).toMatchObject({ status: "succeeded", records: 1 });
    expect(await loadSnapshot("toronto-heritage")).toMatchObject({ delivery: "automatic_database_snapshot", records: [{ OBJECTID: 1 }] });
    expect((await refreshHealth())[0]).toMatchObject({ status: "succeeded", error_code: null });
  });
  it("keeps the last-good payload on fetch failure and incomplete or duplicate candidates", async () => {
    for (const candidate of [null, { ...value(2), rowCount: 2 }, { ...value(2), rowCount: 2, records: [{ OBJECTID: 2 }, { OBJECTID: 2 }] }]) {
      expect((await refreshSnapshot("toronto-heritage", async () => { if (!candidate) throw new Error("upstream outage"); return candidate; })).status).toBe("failed");
      clearSnapshotCache(); expect((await loadSnapshot("toronto-heritage"))?.records[0].OBJECTID).toBe(1);
    }
    expect((await refreshHealth())[0]).toMatchObject({ status: "failed", error_code: "source_validation_or_fetch_failed" });
  });
  it("does not let a concurrent or superseded worker overwrite the last-good snapshot", async () => {
    let release!: () => void; let entered!: () => void;
    const gate = new Promise<void>(r => { release = r; }); const started = new Promise<void>(r => { entered = r; });
    const first = refreshSnapshot("toronto-heritage", async () => { entered(); await gate; return value(3); }); await started;
    expect((await refreshSnapshot("toronto-heritage", async () => value(4))).status).toBe("already_running");
    await getDb().execute(sql`UPDATE property_refresh_runs SET token = 'new-owner' WHERE key = 'toronto-heritage'`);
    release(); expect((await first).status).toBe("lease_lost"); clearSnapshotCache();
    expect((await loadSnapshot("toronto-heritage"))?.records[0].OBJECTID).toBe(1);
  });
});
