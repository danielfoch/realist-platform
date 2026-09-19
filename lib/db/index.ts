import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Production runs on Neon over HTTP: one query per request, no pool or socket
 * lifetimes to babysit — identical in Vercel functions and GitHub Actions.
 * Any other Postgres URL (local Docker, CI) gets a node-postgres pool so the
 * app can be exercised end to end without a Neon project.
 *
 * Both drivers expose the same drizzle query surface used here (select /
 * insert / update / delete / execute with `.rows`); the app never opens
 * transactions, which neon-http does not support.
 */
export type Db = NeonHttpDatabase<typeof schema>;

function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (isNeonUrl(connectionString)) {
    return drizzleNeon(neon(connectionString), { schema });
  }
  return drizzlePg(new Pool({ connectionString, max: 5 }), { schema }) as unknown as Db;
}

let cached: Db | null = null;

/** Lazy so modules that import the db can still be unit-tested without env. */
export function getDb(): Db {
  if (!cached) cached = createDb();
  return cached;
}
