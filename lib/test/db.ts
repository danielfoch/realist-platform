import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "@/lib/db/schema";
import { setDbForTests, type Db } from "@/lib/db";

/**
 * A real Postgres, in process, with the real schema — so the queries that
 * matter (row claiming, percentiles, window functions, jsonb) are tested as
 * written rather than mocked. One per test file; call close() in afterAll.
 */
export async function useTestDb(): Promise<{ db: Db; sql: PGlite; close: () => Promise<void> }> {
  const client = new PGlite();
  // The app's timestamps are zone-less and written in UTC, as on Neon. PGlite would otherwise use the host's zone.
  await client.exec("SET TIME ZONE 'UTC'");
  const db = drizzle(client, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { apply } = await pushSchema(schema, db as any);
  await apply();
  setDbForTests(db as unknown as Db);
  return {
    db: db as unknown as Db,
    sql: client,
    close: async () => {
      setDbForTests(null);
      await client.close();
    },
  };
}
