/**
 * Global setup for the E2E smoke pack.
 *
 * Responsibilities (in order):
 *  1. If something is already answering on baseURL, reuse it: skip BOTH the
 *     database preparation and the server boot. This is the local-dev path —
 *     run `npm run dev` (or `npm start`) yourself and the pack tests that.
 *  2. Otherwise prepare the database (requires DATABASE_URL):
 *       a. `CREATE EXTENSION IF NOT EXISTS postgis` — shared/schema.ts
 *          declares PostGIS `geometry` columns, so a fresh postgres needs the
 *          extension before the schema can be pushed. In CI we run a
 *          postgis/postgis image; on a plain postgres this statement fails
 *          and we log a warning (push will then fail loudly on the geometry
 *          tables, which is the honest failure mode).
 *       b. `npx drizzle-kit push --force`. Why push + --force instead of the
 *          migrations dir: prod itself was pushed from shared/schema.ts, and
 *          on a FRESH database the diff is pure CREATEs so push never hits a
 *          data-loss prompt — but --force pins the non-interactive behaviour
 *          so a future ambiguous diff can't hang CI waiting for stdin.
 *       c. Create the `sessions` table. connect-pg-simple is configured with
 *          createTableIfMissing:false and the table lives only in
 *          migrations/0000 (it is NOT in shared/schema.ts), so push alone
 *          leaves it missing.
 *  3. Boot the production bundle (`node dist/index.cjs` — run `npm run
 *     build` first) and wait for `/` to answer 200. The app needs no external
 *     secrets to boot: Stripe/Resend/GHL/Twilio credentials are all resolved
 *     lazily and their failures are caught; only DATABASE_URL (hard throw in
 *     server/db.ts) and SESSION_SECRET (hard throw in server/auth.ts) are
 *     required, and we default SESSION_SECRET to a dummy here.
 *
 * The returned function is Playwright's global teardown: it kills the server
 * we spawned (and only a server we spawned).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import type { FullConfig } from "@playwright/test";

const BOOT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

function log(message: string) {
  console.log(`[e2e-setup] ${message}`);
}

async function ping(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    return res.status;
  } catch {
    return null;
  }
}

async function prepareDatabase(rootDir: string, databaseUrl: string) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
      log("PostGIS extension ready");
    } catch (err: any) {
      log(
        `WARNING: could not enable PostGIS (${err.message}). ` +
          "shared/schema.ts declares geometry columns, so drizzle-kit push " +
          "will fail unless the database image ships PostGIS " +
          "(CI uses postgis/postgis:16-3.4).",
      );
    }

    log("Pushing drizzle schema (npx drizzle-kit push --force)...");
    const push = spawnSync("npx", ["drizzle-kit", "push", "--force", "--config=drizzle.config.ts"], {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180_000,
    });
    if (push.status !== 0) {
      throw new Error(`drizzle-kit push failed with exit code ${push.status}`);
    }

    // connect-pg-simple session store table — lives only in migrations/0000,
    // not in shared/schema.ts, so push does not create it.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar PRIMARY KEY NOT NULL,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions USING btree (expire)`,
    );
    log("Database ready (schema pushed, sessions table ensured)");
  } finally {
    await client.end();
  }
}

async function waitForServer(baseURL: string, child: ChildProcess, logFile: string) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    const status = await ping(baseURL + "/");
    if (status === 200) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`server did not answer 200 on ${baseURL}/ within ${BOOT_TIMEOUT_MS / 1000}s`);
}

export default async function globalSetup(config: FullConfig) {
  // NOTE: config.rootDir is the TEST root (the e2e/ dir), not the repo root.
  // The repo root is where playwright.config.ts lives.
  const rootDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) || "http://localhost:5000";

  // SAFETY GATE (reuse mode): the pack fires synthetic POSTs (magic-link
  // requests, analyzer runs) at whatever answers baseURL. Refuse non-local
  // targets unless explicitly overridden, so E2E_BASE_URL=https://realist.ca
  // can't happen by accident.
  const baseHost = new URL(baseURL).hostname;
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseHost) &&
    process.env.E2E_DANGEROUSLY_ALLOW_REMOTE_DB !== "1"
  ) {
    throw new Error(
      `[e2e-setup] REFUSING to target non-local baseURL "${baseURL}" — the ` +
        "smoke pack sends synthetic POSTs at its target. If this really is " +
        "a disposable/staging deployment, set E2E_DANGEROUSLY_ALLOW_REMOTE_DB=1.",
    );
  }

  // 1. Reuse a running server (local dev path). No DB setup in this mode:
  //    we never push schema at a database somebody is actively using. Only a
  //    clean 200 counts as "the app" — anything else answering the port is a
  //    foreign process (on macOS, AirPlay squats on :5000 and answers 403).
  const existing = await ping(baseURL + "/");
  if (existing === 200) {
    log(`Reusing server already running at ${baseURL} — skipping DB setup and boot.`);
    return;
  }
  if (existing !== null) {
    throw new Error(
      `[e2e-setup] Something is already listening on ${baseURL} but answered HTTP ${existing} — ` +
        "that does not look like this app (on macOS, AirPlay Receiver squats on port 5000). " +
        "Stop it or point the pack elsewhere with E2E_BASE_URL (e.g. http://localhost:5099).",
    );
  }

  // 2. Fresh boot path — the CI path. DATABASE_URL is mandatory.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "[e2e-setup] Nothing is listening on " +
        baseURL +
        " and DATABASE_URL is not set. Either start the app yourself " +
        "(npm run dev) or provide a disposable postgres via DATABASE_URL — " +
        "see e2e/README.md.",
    );
  }

  // SAFETY GATE: this path runs `drizzle-kit push --force`, which on a
  // non-fresh database will happily DROP whatever isn't in shared/schema.ts
  // (sessions, every ensureAppTables table, stripe-sync's schema...). This
  // repo's normal workflow exports the LIVE Neon/Replit DATABASE_URL, so a
  // developer running `npm run test:e2e` in that shell must not be one
  // silent step away from destroying production. Only loopback databases
  // are accepted; anything else requires the explicit opt-out.
  const dbHost = (() => {
    try {
      return new URL(databaseUrl).hostname;
    } catch {
      return "";
    }
  })();
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost);
  if (!isLoopback && process.env.E2E_DANGEROUSLY_ALLOW_REMOTE_DB !== "1") {
    throw new Error(
      `[e2e-setup] REFUSING to run against DATABASE_URL host "${dbHost}" — ` +
        "the E2E setup pushes schema with --force and would mutate (and " +
        "partially DROP) any real database. Point DATABASE_URL at a " +
        "disposable local postgres (see e2e/README.md), or if this remote " +
        "database really is disposable, set E2E_DANGEROUSLY_ALLOW_REMOTE_DB=1.",
    );
  }

  await prepareDatabase(rootDir, databaseUrl);

  // 3. Boot the production bundle.
  const serverCommand = process.env.E2E_SERVER_COMMAND || "node dist/index.cjs";
  if (serverCommand === "node dist/index.cjs" && !fs.existsSync(path.join(rootDir, "dist", "index.cjs"))) {
    throw new Error(
      "[e2e-setup] dist/index.cjs not found — run `npm run build` first " +
        "(or set E2E_SERVER_COMMAND to boot the app another way).",
    );
  }

  const logDir = path.join(rootDir, "test-results");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "e2e-server.log");
  const out = fs.openSync(logFile, "w");

  const port = new URL(baseURL).port || "5000";
  log(`Booting app: ${serverCommand} (PORT=${port}, log: ${logFile})`);
  const [cmd, ...args] = serverCommand.split(" ");
  const child = spawn(cmd, args, {
    cwd: rootDir,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      PORT: port,
      DATABASE_URL: databaseUrl,
      // The only boot-required secret. Any value works; nothing in the smoke
      // pack authenticates a session.
      SESSION_SECRET: process.env.SESSION_SECRET || "e2e-smoke-dummy-session-secret",
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  });

  try {
    await waitForServer(baseURL, child, logFile);
  } catch (err) {
    child.kill("SIGKILL");
    let tail = "";
    try {
      const lines = fs.readFileSync(logFile, "utf-8").split("\n");
      tail = lines.slice(-40).join("\n");
    } catch {
      /* no log */
    }
    throw new Error(`[e2e-setup] ${(err as Error).message}\n--- server log tail ---\n${tail}`);
  }
  log(`Server is up at ${baseURL}`);

  // Returned function = global teardown: kill the server we spawned.
  return async () => {
    log("Stopping E2E app server...");
    child.kill("SIGTERM");
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 5_000),
    );
    await Promise.race([exited, timeout]);
  };
}
