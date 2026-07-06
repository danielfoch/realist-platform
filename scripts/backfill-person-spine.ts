/**
 * PERSON SPINE phase 1 backfill — link existing `leads` and `crm_contacts`
 * rows to their `users` row by normalized email match.
 *
 * Strictly additive: stamps `leads.user_id` and `crm_contacts.linked_user_id`
 * where they are NULL and the row's email resolves to exactly one user
 * (normalizeEmail; oldest account wins on legacy duplicate-cased emails).
 * NO merging, NO deleting, NO overwriting existing links — links only, so
 * the script is idempotent: re-running reports everything as already-linked.
 *
 * Batched 500 rows at a time with keyset pagination, so it is safe on large
 * tables and restartable at any point.
 *
 * PREREQUISITE: `npm run db:push` must have added leads.user_id (phase 1
 * schema). crm_contacts.linked_user_id predates this and already exists.
 *
 * Run (dry-run FIRST — reports what would link without writing):
 *   npx tsx scripts/backfill-person-spine.ts --dry-run
 *   npx tsx scripts/backfill-person-spine.ts
 */

import { and, asc, gt, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { crmContacts, leads, users } from "../shared/schema";
import { buildEmailIndex, decideLink } from "../shared/personSpine";
import { normalizeEmail } from "../shared/authTokens";

const BATCH_SIZE = 500;

interface TableReport {
  scanned: number;
  linked: number;
  noMatch: number;
  noEmail: number;
  alreadyLinked: number;
}

/**
 * Resolve normalized emails → user id for a batch, memoized across batches.
 * Ordered by created_at so the OLDEST account wins when legacy rows share a
 * normalized email (users.email is unique, but casing predates normalization).
 */
const emailCache = new Map<string, string | null>();
async function resolveEmails(normalizedEmails: string[]): Promise<Map<string, string>> {
  const unknown = [...new Set(normalizedEmails)].filter((e) => e && !emailCache.has(e));
  if (unknown.length > 0) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, unknown))
      .orderBy(asc(users.createdAt));
    const index = buildEmailIndex(rows.map((r) => ({ id: r.id, email: r.email })));
    for (const email of unknown) emailCache.set(email, index.get(email) ?? null);
  }
  const out = new Map<string, string>();
  for (const email of new Set(normalizedEmails)) {
    const hit = emailCache.get(email);
    if (hit) out.set(email, hit);
  }
  return out;
}

async function backfillLeads(dryRun: boolean): Promise<TableReport> {
  const report: TableReport = { scanned: 0, linked: 0, noMatch: 0, noEmail: 0, alreadyLinked: 0 };
  const [{ count: alreadyLinked }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.userId} is not null`);
  report.alreadyLinked = Number(alreadyLinked);

  let lastId = "";
  for (;;) {
    const batch = await db
      .select({ id: leads.id, email: leads.email })
      .from(leads)
      .where(and(isNull(leads.userId), gt(leads.id, lastId)))
      .orderBy(asc(leads.id))
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1].id;
    report.scanned += batch.length;

    const emailIndex = await resolveEmails(batch.map((row) => normalizeEmail(row.email)));
    const idsByUser = new Map<string, string[]>();
    for (const row of batch) {
      const decision = decideLink({ email: row.email, linkedUserId: null }, emailIndex);
      if (decision.action === "link") {
        const ids = idsByUser.get(decision.userId) ?? [];
        ids.push(row.id);
        idsByUser.set(decision.userId, ids);
        report.linked += 1;
      } else if (decision.reason === "no-email") {
        report.noEmail += 1;
      } else {
        report.noMatch += 1;
      }
    }
    if (!dryRun) {
      for (const [userId, ids] of idsByUser) {
        await db
          .update(leads)
          .set({ userId })
          .where(and(inArray(leads.id, ids), isNull(leads.userId)));
      }
    }
    console.log(`  leads: scanned ${report.scanned} (last id ${lastId})`);
  }
  return report;
}

async function backfillCrmContacts(dryRun: boolean): Promise<TableReport> {
  const report: TableReport = { scanned: 0, linked: 0, noMatch: 0, noEmail: 0, alreadyLinked: 0 };
  const [{ count: alreadyLinked }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(sql`${crmContacts.linkedUserId} is not null`);
  report.alreadyLinked = Number(alreadyLinked);

  let lastId = "";
  for (;;) {
    const batch = await db
      .select({ id: crmContacts.id, email: crmContacts.email })
      .from(crmContacts)
      .where(and(isNull(crmContacts.linkedUserId), gt(crmContacts.id, lastId)))
      .orderBy(asc(crmContacts.id))
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1].id;
    report.scanned += batch.length;

    const emailIndex = await resolveEmails(batch.map((row) => normalizeEmail(row.email)));
    const idsByUser = new Map<string, string[]>();
    for (const row of batch) {
      const decision = decideLink({ email: row.email, linkedUserId: null }, emailIndex);
      if (decision.action === "link") {
        const ids = idsByUser.get(decision.userId) ?? [];
        ids.push(row.id);
        idsByUser.set(decision.userId, ids);
        report.linked += 1;
      } else if (decision.reason === "no-email") {
        report.noEmail += 1;
      } else {
        report.noMatch += 1;
      }
    }
    if (!dryRun) {
      for (const [userId, ids] of idsByUser) {
        await db
          .update(crmContacts)
          .set({ linkedUserId: userId })
          .where(and(inArray(crmContacts.id, ids), isNull(crmContacts.linkedUserId)));
      }
    }
    console.log(`  crm_contacts: scanned ${report.scanned} (last id ${lastId})`);
  }
  return report;
}

function printReport(label: string, report: TableReport, dryRun: boolean) {
  const verb = dryRun ? "would link" : "linked";
  console.log(`${label}:`);
  console.log(`  already-linked (before run): ${report.alreadyLinked}`);
  console.log(`  scanned (unlinked):          ${report.scanned}`);
  console.log(`  ${verb}:                  ${report.linked}`);
  console.log(`  no-match:                    ${report.noMatch}`);
  console.log(`  no-email:                    ${report.noEmail}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `Person Spine phase 1 backfill ${dryRun ? "(DRY RUN — no writes)" : "(LIVE)"} — links only, no merges, no deletes.`,
  );

  console.log("\nBackfilling leads.user_id ...");
  const leadReport = await backfillLeads(dryRun);

  console.log("\nBackfilling crm_contacts.linked_user_id ...");
  const contactReport = await backfillCrmContacts(dryRun);

  console.log("\n— Report —");
  printReport("leads", leadReport, dryRun);
  printReport("crm_contacts", contactReport, dryRun);
  if (dryRun) console.log("\nDry run complete. Re-run without --dry-run to write links.");

  await pool.end();
}

main().catch((err) => {
  console.error("backfill-person-spine failed:", err);
  process.exit(1);
});
