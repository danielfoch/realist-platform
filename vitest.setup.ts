// Shared setup for the vitest unit suite (see vitest.config.ts).
//
// Unit tests must never require a real database. server/db.ts throws at
// import time when DATABASE_URL is unset, but the pg Pool it constructs is
// lazy and never opens a connection unless something actually queries it.
// Give it an inert placeholder so modules that import { db } (e.g.
// server/notifications.ts) can be loaded in isolation. If a test ever tries
// to run a query against this placeholder it will fail loudly with a
// connection error, which is the behavior we want.
process.env.DATABASE_URL ??=
  "postgresql://vitest:vitest@127.0.0.1:5432/vitest_placeholder";
