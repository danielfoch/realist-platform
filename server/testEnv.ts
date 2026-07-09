/**
 * Test-only env shim. server/db.ts fail-fasts at import when DATABASE_URL is
 * unset (intentional for runtime boots). Pure-logic tests that import server
 * modules import this FIRST — ES modules evaluate in import order — so the
 * module graph can load without a provisioned database. pg's Pool is lazy and
 * never connects unless a query runs, which pure tests don't do.
 */
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test_unused";

export {};
