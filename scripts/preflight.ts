/**
 * npm run preflight                       — check the environment this shell has
 * npm run preflight -- --env .env.prod    — check a file (e.g. from `vercel env pull .env.prod --environment=production`)
 *
 * Read-only. Prints names and statuses, never a value. Exit code 1 when
 * something launch depends on is missing or broken.
 */
import { sql } from "drizzle-orm";
import { EXPECTED_TABLES, checkAnthropic, checkDatabase, checkDdf, checkGhl, checkResend, checkSecrets, checkSite, summarize, type CheckResult, type DbFacts } from "../lib/preflight/checks";

const envFlag = process.argv.indexOf("--env");
if (envFlag > -1 && process.argv[envFlag + 1]) process.loadEnvFile(process.argv[envFlag + 1]);

async function databaseFacts(): Promise<DbFacts | Error> {
  try {
    const { getDb } = await import("../lib/db");
    const db = getDb();
    const rows = async (query: ReturnType<typeof sql>) => {
      const result = await db.execute(query);
      return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>;
    };
    const tables = (await rows(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)).map((row) => String(row.table_name));
    const column = await rows(sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'digest_listings'`);
    const facts: DbFacts = { tables, hasNewestColumn: column.length > 0, members: 0, legacyMembers: 0, freshListings: 0, waitingDeliveries: 0 };
    if (EXPECTED_TABLES.every((table) => tables.includes(table)) && facts.hasNewestColumn) {
      const [counts] = await rows(sql`SELECT
        (SELECT count(*) FROM users)::int AS members,
        (SELECT count(*) FROM users WHERE legacy IS NOT NULL)::int AS legacy,
        (SELECT count(*) FROM ddf_listing_snapshots WHERE captured_at >= now() - interval '7 days')::int AS fresh,
        (SELECT count(*) FROM lead_deliveries WHERE status = 'pending')::int AS waiting`);
      Object.assign(facts, { members: Number(counts.members), legacyMembers: Number(counts.legacy), freshListings: Number(counts.fresh), waitingDeliveries: Number(counts.waiting) });
    }
    return facts;
  } catch (error) {
    return error as Error;
  }
}

async function main() {
  const env = process.env;
  const url = env.DATABASE_URL?.trim() ?? "";
  const results: CheckResult[] = [
    ...checkDatabase(url, url ? await databaseFacts() : new Error("not configured")),
    ...(await checkGhl(env)),
    await checkResend(env),
    ...checkSecrets(env),
    checkDdf(env),
    await checkAnthropic(env),
    checkSite(env),
  ];
  const mark = { ok: "✓", warn: "!", missing: "✗", broken: "✗" } as const;
  console.log("\nRealist — go-live preflight\n");
  for (const result of results) {
    console.log(`  ${mark[result.status]} ${result.name}${result.required ? "" : " (optional)"} — ${result.detail}`);
    if (result.fix && result.status !== "ok") console.log(`      → ${result.fix}`);
  }
  const summary = summarize(results);
  console.log(`\n${summary.line}${summary.ready ? "  Next: npx vercel --prod" : ""}\n`);
  process.exit(summary.ready ? 0 : 1);
}

main().catch((error) => {
  console.error("preflight crashed:", (error as Error).message);
  process.exit(2);
});
