import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Neon serverless driver over HTTP: works identically in Vercel functions,
 * local dev, and GitHub Actions sync scripts. One query per request — no pool
 * management, no socket lifetimes to babysit.
 */
const connectionString = process.env.DATABASE_URL;

function createDb() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(neon(connectionString), { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

/** Lazy so modules that import the db can still be unit-tested without env. */
export function getDb() {
  if (!cached) cached = createDb();
  return cached;
}

export type Db = ReturnType<typeof getDb>;
