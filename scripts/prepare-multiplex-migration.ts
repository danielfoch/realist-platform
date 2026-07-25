/**
 * Pre-push safety step for bringing multiplex_underwritings under drizzle.
 *
 * RUN THIS BEFORE `npm run db:push`.
 *
 *   npx tsx scripts/prepare-multiplex-migration.ts          # report only
 *   npx tsx scripts/prepare-multiplex-migration.ts --apply  # null the orphans
 *
 * Why it is needed: the table was created by raw DDL with `user_id varchar` and
 * NO foreign key, so nothing ever stopped a row from pointing at a user that was
 * later deleted. shared/schema.ts now declares that FK, and Postgres refuses to
 * add a constraint that existing rows violate — push would fail partway with a
 * confusing error.
 *
 * Nulling is the right repair, not deleting: the FK is `onDelete: set null`
 * precisely because an underwriting keeps its analytical value for the market
 * rollups after its author is gone. This script just applies that same rule
 * retroactively to rows that predate the constraint.
 *
 * Safe to run repeatedly — it is a no-op once there are no orphans.
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  const apply = process.argv.includes("--apply");

  const tableExists = await db.execute(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'multiplex_underwritings'
  `);
  if (!tableExists.rows.length) {
    console.log("multiplex_underwritings does not exist yet — nothing to prepare.");
    console.log("Run `npm run db:push` to create it.");
    return;
  }

  const orphans = await db.execute(sql`
    SELECT u.id, u.user_id, u.address, u.created_at
    FROM multiplex_underwritings u
    WHERE u.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users x WHERE x.id = u.user_id)
    ORDER BY u.created_at DESC
  `);

  const [{ total } = { total: 0 }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM multiplex_underwritings
  `)).rows as Array<{ total: number }>;

  console.log(`multiplex_underwritings: ${total} row(s) total`);
  console.log(`orphaned user_id (points at a deleted user): ${orphans.rows.length}`);

  if (!orphans.rows.length) {
    console.log("\nNo orphans. `npm run db:push` can add the foreign key safely.");
    return;
  }

  for (const row of orphans.rows.slice(0, 20) as Array<Record<string, unknown>>) {
    console.log(`  ${row.id}  user_id=${row.user_id}  ${String(row.address).slice(0, 48)}`);
  }
  if (orphans.rows.length > 20) {
    console.log(`  … and ${orphans.rows.length - 20} more`);
  }

  if (!apply) {
    console.log("\nRe-run with --apply to null these user_ids, then `npm run db:push`.");
    console.log("The underwriting rows themselves are kept — only the dangling link is cleared.");
    return;
  }

  const result = await db.execute(sql`
    UPDATE multiplex_underwritings u
    SET user_id = NULL
    WHERE u.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users x WHERE x.id = u.user_id)
  `);
  console.log(`\nCleared ${result.rowCount ?? 0} dangling user_id link(s).`);
  console.log("`npm run db:push` can now add the foreign key.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("prepare-multiplex-migration failed:", err);
    process.exit(1);
  });
