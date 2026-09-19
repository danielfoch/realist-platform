/**
 * Carry member accounts over from the legacy realist.ca database.
 *
 *   SOURCE_DATABASE_URL=<legacy Replit/Neon url> DATABASE_URL=<this app's url> \
 *     npx tsx scripts/migrate-users.ts            # dry run: reads, counts, writes nothing
 *     npx tsx scripts/migrate-users.ts --commit   # performs the migration
 *
 * What moves:
 *   users                → users            (ids preserved, bcrypt hashes intact, emails lowercased,
 *                                            duplicate-by-case accounts folded into one)
 *   user_oauth_accounts  → users.google_id  (Google sign-in keeps working; tokens are NOT copied)
 *   investor_profiles    → users.city / province / investor_focus
 *   email_consent        → email_consent    (verbatim: timestamps + sources are the CASL proof)
 *   listing_watchers     → saved_deals      (kind 'listing'; only deliberate watches)
 *   saved_deals          → saved_deals      (kind 'analysis', read-only archive entries)
 *   multiplex_underwritings → multiplex_underwritings (verbatim)
 *   analyses (buy & hold) → deal_analyses   (recomputed on today's engine: track records,
 *                                            the leaderboard and learned defaults start warm)
 *   everything else a member owned → legacy_user_records (row-for-row JSON, secrets stripped)
 *
 * Properties: the source connection is forced read-only; the run is idempotent
 * (safe to repeat until cutover — it fills blanks and never overwrites what a
 * member changed here); output is counts only, never an email address.
 */

import { Pool, type PoolClient } from "pg";
import {
  effectiveConsent,
  mapLegacyUser,
  normalizeLegacyEmail,
  pickDuplicateWinner,
  snapshotFromLegacyDeal,
  stripSecrets,
  type LegacyRow,
  type MappedUser,
} from "../lib/migration/legacyUsers";
import { mapLegacyAnalysis } from "../lib/migration/legacyAnalyses";

const COMMIT = process.argv.includes("--commit");

/** Member-owned legacy tables with no home here yet; archived as JSON. */
const ARCHIVE_TABLES: Array<{ table: string; where?: string }> = [
  { table: "analyses" },
  { table: "saved_deals" },
  { table: "listing_watchers", where: "source_type LIKE 'watch_%'" },
  { table: "saved_searches" },
  { table: "portfolio_properties" },
  { table: "investor_profiles" },
  { table: "investor_kyc" },
  { table: "notification_preferences" },
  { table: "property_analyses" },
  { table: "buybox_mandates" },
  { table: "buybox_agreements" },
  { table: "underwriting_notes" },
  { table: "saved_reports" },
  { table: "discovery_signals", where: "signal_type = 'saved_listing'" },
  { table: "user_oauth_accounts" },
];

const REQUIRED_TARGET_TABLES = [
  "deal_analyses",
  "users",
  "email_consent",
  "saved_deals",
  "multiplex_underwritings",
  "legacy_user_records",
];

function log(message: string) {
  console.log(`[migrate-users] ${message}`);
}

type Queryable = Pool | PoolClient;

async function tableExists(db: Queryable, table: string): Promise<boolean> {
  const result = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  return (result.rowCount ?? 0) > 0;
}

async function columnsOf(db: Queryable, table: string): Promise<Set<string>> {
  const result = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  return new Set(result.rows.map((row) => String(row.column_name)));
}

async function readAll(db: Queryable, table: string, where?: string): Promise<LegacyRow[]> {
  if (!(await tableExists(db, table))) return [];
  const result = await db.query(`SELECT * FROM "${table}"${where ? ` WHERE ${where}` : ""}`);
  return result.rows as LegacyRow[];
}

/** Multi-row insert in chunks, keeping well under the 65k bind-parameter limit. */
async function insertRows(
  db: PoolClient,
  sqlHead: string,
  sqlTail: string,
  rows: unknown[][],
  chunkSize = 200,
): Promise<number> {
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const width = chunk[0].length;
    const placeholders = chunk
      .map((_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(",")})`)
      .join(",");
    const result = await db.query(`${sqlHead} VALUES ${placeholders} ${sqlTail}`, chunk.flat());
    written += result.rowCount ?? 0;
  }
  return written;
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("Set SOURCE_DATABASE_URL (legacy database) and DATABASE_URL (this app's database).");
  }
  if (sourceUrl === targetUrl) throw new Error("Source and target are the same database — refusing to run.");

  const sourcePool = new Pool({ connectionString: sourceUrl, max: 1 });
  const target = new Pool({ connectionString: targetUrl, max: 2 });
  // Every legacy read happens inside one READ ONLY transaction: Postgres itself
  // refuses writes, and all tables are seen at the same instant.
  const source = await sourcePool.connect();
  await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

  log(COMMIT ? "COMMIT run — the target database will be written." : "Dry run — nothing will be written. Add --commit to migrate.");

  try {
    // ── target readiness ────────────────────────────────────────────────────
    const missing: string[] = [];
    for (const table of REQUIRED_TARGET_TABLES) {
      if (!(await tableExists(target, table))) missing.push(table);
    }
    if (missing.length > 0) {
      throw new Error(`Target is missing tables (${missing.join(", ")}). Run \`npm run db:push\` against it first.`);
    }

    // ── read the legacy side ────────────────────────────────────────────────
    const legacyUsers = await readAll(source, "users");
    if (legacyUsers.length === 0) throw new Error("The legacy users table is empty or missing — wrong SOURCE_DATABASE_URL?");
    const oauth = await readAll(source, "user_oauth_accounts", "provider = 'google'");
    const profiles = await readAll(source, "investor_profiles");
    const ledger = await readAll(source, "email_consent");
    const prefs = await readAll(source, "notification_preferences");

    const googleByUser = new Map<string, string>();
    const time = (value: unknown) => (value instanceof Date ? value.getTime() : 0);
    for (const row of [...oauth].sort((a, b) => time(a.created_at) - time(b.created_at))) {
      const userId = String(row.user_id ?? "");
      const sub = typeof row.provider_user_id === "string" ? row.provider_user_id : null;
      if (userId && sub && !googleByUser.has(userId)) googleByUser.set(userId, sub);
    }
    const profileByUser = new Map(profiles.map((row) => [String(row.user_id), row]));
    const prefsByUser = new Map(prefs.map((row) => [String(row.user_id), row]));
    const ledgerByUser = groupBy(ledger, (row) => (row.user_id ? String(row.user_id) : null));

    // ── fold duplicate-by-case accounts ─────────────────────────────────────
    const byEmail = groupBy(legacyUsers, (row) => normalizeLegacyEmail(row.email));
    const unusable = legacyUsers.length - [...byEmail.values()].reduce((sum, rows) => sum + rows.length, 0);
    /** legacy id → the id that account lives under in the target. */
    const idMap = new Map<string, string>();
    const mapped: MappedUser[] = [];
    let foldedAccounts = 0;

    for (const rows of byEmail.values()) {
      const winner = rows.length === 1 ? rows[0] : pickDuplicateWinner(rows, (id) => googleByUser.has(id));
      const losers = rows.filter((row) => row !== winner);
      foldedAccounts += losers.length;
      const winnerId = String(winner.id);

      // The surviving account keeps any Google link and every consent row the duplicates held.
      const googleId = googleByUser.get(winnerId) ?? losers.map((row) => googleByUser.get(String(row.id))).find(Boolean) ?? null;
      const combinedLedger = rows.flatMap((row) => ledgerByUser.get(String(row.id)) ?? []);
      // An unsubscribe on ANY of the folded accounts still binds: it is the same inbox.
      const anyUnsubscribed = rows.some((row) => row.email_digest_opt_in === false);
      const anyMarketingOff = rows.some((row) => prefsByUser.get(String(row.id))?.marketing_email_enabled === false);
      const consent = effectiveConsent({
        ledger: combinedLedger,
        emailDigestOptIn: anyUnsubscribed ? false : winner.email_digest_opt_in,
        marketingEmailEnabled: anyMarketingOff ? false : prefsByUser.get(winnerId)?.marketing_email_enabled,
        userCreatedAt: winner.created_at,
      });
      const user = mapLegacyUser({
        user: winner,
        googleId,
        profile: profileByUser.get(winnerId) ?? null,
        consent,
        mergedIds: losers.map((row) => String(row.id)),
      });
      if (!user) continue;
      mapped.push(user);
      for (const row of rows) idMap.set(String(row.id), user.id);
    }

    // A Google identity may belong to one account only.
    const seenGoogle = new Set<string>();
    let googleCollisions = 0;
    for (const user of mapped) {
      if (!user.googleId) continue;
      if (seenGoogle.has(user.googleId)) {
        user.googleId = null;
        googleCollisions += 1;
      } else seenGoogle.add(user.googleId);
    }

    // ── people who already signed up here with the same email ───────────────
    const existing = await target.query("SELECT id, email, google_id FROM users");
    const targetByEmail = new Map<string, string>(existing.rows.map((row) => [String(row.email), String(row.id)]));
    const targetGoogle = new Map<string, string>(
      existing.rows.filter((row) => row.google_id).map((row) => [String(row.google_id), String(row.id)]),
    );
    let mergedIntoExisting = 0;
    for (const user of mapped) {
      const existingId = targetByEmail.get(user.email);
      if (existingId && existingId !== user.id) {
        for (const [legacyId, mappedId] of idMap) if (mappedId === user.id) idMap.set(legacyId, existingId);
        user.legacy = { ...user.legacy, legacyId: user.id };
        user.id = existingId;
        mergedIntoExisting += 1;
      }
      const googleOwner = user.googleId ? targetGoogle.get(user.googleId) : undefined;
      if (googleOwner && googleOwner !== user.id) user.googleId = null;
    }

    // ── report ──────────────────────────────────────────────────────────────
    log(`legacy users read:            ${legacyUsers.length}`);
    log(`  unusable (no valid email):  ${unusable}`);
    log(`  duplicate-by-case folded:   ${foldedAccounts}`);
    log(`accounts to carry over:       ${mapped.length}`);
    log(`  with a password:            ${mapped.filter((u) => u.passwordHash).length}`);
    log(`  with Google sign-in:        ${mapped.filter((u) => u.googleId).length}`);
    log(`  link-only (no password/Google): ${mapped.filter((u) => !u.passwordHash && !u.googleId).length}`);
    log(`  admins:                     ${mapped.filter((u) => u.role === "admin").length}`);
    log(`  marketing consent granted:  ${mapped.filter((u) => u.consentMarketing).length}`);
    log(`    of which legacy default (no recorded act): ${mapped.filter((u) => u.consentMarketing && u.consentSource === "legacy:default").length}`);
    log(`  marketing consent withheld: ${mapped.filter((u) => !u.consentMarketing).length}`);
    log(`  already signed up here (merged by email): ${mergedIntoExisting}`);
    if (googleCollisions) log(`  Google ids shared by two accounts (second unlinked): ${googleCollisions}`);

    const watchers = (await readAll(source, "listing_watchers", "source_type LIKE 'watch_%'")).filter((row) =>
      idMap.has(String(row.user_id)),
    );
    const legacyDeals = (await readAll(source, "saved_deals", "user_id IS NOT NULL")).filter((row) =>
      idMap.has(String(row.user_id)),
    );
    // The archive doubles as the record of what has already been carried over:
    // a save the member has since deleted here must not come back on a re-run.
    const carried = await target.query(
      "SELECT source_table, source_id FROM legacy_user_records WHERE source_table IN ('listing_watchers', 'saved_deals')",
    );
    const alreadyCarried = new Set(carried.rows.map((row) => `${row.source_table}:${row.source_id}`));
    const newWatchers = watchers.filter((row) => !alreadyCarried.has(`listing_watchers:${row.id}`));
    const newLegacyDeals = legacyDeals.filter((row) => !alreadyCarried.has(`saved_deals:${row.id}`));
    const underwritings = await readAll(source, "multiplex_underwritings");
    const ledgerRows = ledger.filter((row) => idMap.has(String(row.user_id)));
    log(`consent ledger rows:          ${ledgerRows.length}`);
    log(`watched listings → saved:     ${newWatchers.length} new (${watchers.length - newWatchers.length} carried earlier)`);
    log(`analyzer saves → archive list: ${newLegacyDeals.length} new (${legacyDeals.length - newLegacyDeals.length} carried earlier)`);
    log(`multiplex underwrites:        ${underwritings.length}`);

    // v1 analyses → today's analysis log. Members keep theirs; anonymous sessions still teach the market.
    const legacyAnalyses = await readAll(source, "analyses");
    const mappedAnalyses = legacyAnalyses.flatMap((row) => {
      const mapped = mapLegacyAnalysis(row);
      if (!mapped) return [];
      const userId = row.user_id ? idMap.get(String(row.user_id)) ?? null : null;
      const sessionId = typeof row.session_id === "string" && row.session_id ? row.session_id.slice(0, 64) : null;
      if (!userId && !sessionId) return [];
      return [{ mapped, userId, sessionId, actorKey: userId ? `user:${userId}` : `sid:legacy-${sessionId}` }];
    });
    log(`v1 analyses read:             ${legacyAnalyses.length}`);
    log(`  carried to the analysis log: ${mappedAnalyses.length} (${mappedAnalyses.filter((a) => a.userId).length} by members, ${mappedAnalyses.filter((a) => a.mapped.eligible).length} leaderboard-eligible)`);

    const archive: Array<{ table: string; rows: LegacyRow[]; keyColumn: string }> = [];
    for (const { table, where } of ARCHIVE_TABLES) {
      if (!(await tableExists(source, table))) continue;
      const columns = await columnsOf(source, table);
      if (!columns.has("user_id")) continue;
      const rows = (await readAll(source, table, [where, "user_id IS NOT NULL"].filter(Boolean).join(" AND "))).filter(
        (row) => idMap.has(String(row.user_id)),
      );
      archive.push({ table, rows, keyColumn: columns.has("id") ? "id" : "user_id" });
      log(`archive ${table.padEnd(26)} ${rows.length}`);
    }

    if (!COMMIT) {
      log("Dry run complete. Nothing was written.");
      return;
    }

    // ── write ───────────────────────────────────────────────────────────────
    const client = await target.connect();
    try {
      await client.query("BEGIN");

      const userRows = mapped.map((u) => [
        u.id, u.email, u.passwordHash, u.googleId, u.name, u.phone, u.city, u.province, u.investorFocus,
        u.role, u.emailVerifiedAt, u.consentMarketing, u.consentAt, u.consentSource, JSON.stringify(u.legacy), u.createdAt,
      ]);
      const usersWritten = await insertRows(
        client,
        `INSERT INTO users (id, email, password_hash, google_id, name, phone, city, province, investor_focus,
                            role, email_verified_at, consent_marketing, consent_at, consent_source, legacy, created_at)`,
        // Fill blanks; never overwrite what the member has set here. Consent is
        // only refreshed while it still rests on a legacy value.
        `ON CONFLICT (id) DO UPDATE SET
           password_hash     = COALESCE(users.password_hash, EXCLUDED.password_hash),
           google_id         = COALESCE(users.google_id, EXCLUDED.google_id),
           name              = COALESCE(users.name, EXCLUDED.name),
           phone             = COALESCE(users.phone, EXCLUDED.phone),
           city              = COALESCE(users.city, EXCLUDED.city),
           province          = COALESCE(users.province, EXCLUDED.province),
           investor_focus    = COALESCE(users.investor_focus, EXCLUDED.investor_focus),
           role              = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin' ELSE users.role END,
           email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at),
           consent_marketing = CASE WHEN users.consent_source IS NULL OR users.consent_source LIKE 'legacy:%'
                                    THEN EXCLUDED.consent_marketing ELSE users.consent_marketing END,
           consent_at        = CASE WHEN users.consent_source IS NULL OR users.consent_source LIKE 'legacy:%'
                                    THEN EXCLUDED.consent_at ELSE users.consent_at END,
           consent_source    = CASE WHEN users.consent_source IS NULL OR users.consent_source LIKE 'legacy:%'
                                    THEN EXCLUDED.consent_source ELSE users.consent_source END,
           legacy            = COALESCE(users.legacy, '{}'::jsonb) || EXCLUDED.legacy,
           created_at        = LEAST(users.created_at, EXCLUDED.created_at)`,
        userRows,
      );
      log(`users written:                ${usersWritten}`);

      if (ledgerRows.length) {
        const written = await insertRows(
          client,
          "INSERT INTO email_consent (id, user_id, channel, status, source, created_at)",
          "ON CONFLICT (id) DO NOTHING",
          ledgerRows.map((row) => [
            String(row.id), idMap.get(String(row.user_id)), String(row.channel ?? "email").slice(0, 10),
            String(row.status ?? "granted").slice(0, 10), row.source ? String(row.source).slice(0, 100) : null, row.created_at ?? new Date(),
          ]),
        );
        log(`consent ledger written:       ${written}`);
      }

      if (newWatchers.length) {
        const written = await insertRows(
          client,
          "INSERT INTO saved_deals (user_id, kind, ref_key, title, snapshot, created_at)",
          "ON CONFLICT (user_id, kind, ref_key) DO NOTHING",
          newWatchers
            .filter((row) => row.listing_mls_number)
            .map((row) => [
              idMap.get(String(row.user_id)), "listing", String(row.listing_mls_number),
              (typeof row.address_snapshot === "string" && row.address_snapshot.trim()) || `MLS® ${row.listing_mls_number}`,
              JSON.stringify({ source: "legacy_watchlist", city: row.city_snapshot ?? null, price: row.last_known_price ?? null }),
              row.created_at ?? new Date(),
            ]),
        );
        log(`watched listings saved:       ${written}`);
      }

      if (newLegacyDeals.length) {
        const written = await insertRows(
          client,
          "INSERT INTO saved_deals (user_id, kind, ref_key, title, snapshot, created_at)",
          "ON CONFLICT (user_id, kind, ref_key) DO NOTHING",
          newLegacyDeals.map((row) => [
            idMap.get(String(row.user_id)), "analysis", String(row.id),
            (typeof row.name === "string" && row.name.trim()) || (typeof row.address === "string" && row.address) || "Saved analysis",
            JSON.stringify(snapshotFromLegacyDeal(row)), row.created_at ?? new Date(),
          ]),
        );
        log(`analyzer saves listed:        ${written}`);
      }

      if (underwritings.length) {
        const written = await insertRows(
          client,
          `INSERT INTO multiplex_underwritings (id, user_id, session_id, address, lat, lng, postal_fsa,
                                                inputs_json, site_json, result_json, share_token, created_at)`,
          "ON CONFLICT DO NOTHING",
          underwritings.map((row) => [
            String(row.id), row.user_id ? idMap.get(String(row.user_id)) ?? null : null, row.session_id ?? null,
            row.address, row.lat ?? null, row.lng ?? null, row.postal_fsa ?? null,
            JSON.stringify(row.inputs_json ?? {}), JSON.stringify(row.site_json ?? {}),
            row.result_json == null ? null : JSON.stringify(row.result_json), row.share_token ?? null, row.created_at ?? new Date(),
          ]),
          100,
        );
        log(`multiplex underwrites written: ${written}`);
      }

      if (mappedAnalyses.length) {
        const written = await insertRows(
          client,
          `INSERT INTO deal_analyses (actor_key, user_id, session_id, deal_key, source, mls_number, address, city, province, fsa,
                                      units, price, inputs, defaults, edited, monthly_rent, cap_rate, cash_on_cash, dscr,
                                      monthly_cash_flow, irr, quality, eligible, is_public, engine_version, created_at, updated_at)`,
          // Never overwrite an analysis the member has redone here.
          "ON CONFLICT (actor_key, deal_key) DO NOTHING",
          mappedAnalyses.map(({ mapped: a, userId, sessionId, actorKey }) => [
            actorKey, userId, sessionId, a.dealKey, a.source, a.mlsNumber, a.address, a.city, a.province, a.fsa,
            a.units, a.price, JSON.stringify(a.inputs), JSON.stringify(a.defaults), JSON.stringify(a.edited), a.monthlyRent,
            a.capRate, a.cashOnCash, a.dscr, a.monthlyCashFlow, a.irr, a.quality, a.eligible, true, a.engineVersion, a.createdAt, a.createdAt,
          ]),
          100,
        );
        log(`analyses written:             ${written}`);
      }

      for (const { table, rows, keyColumn } of archive) {
        if (!rows.length) continue;
        // One statement may not touch the same (source_table, source_id) twice.
        const unique = [...new Map(rows.map((row) => [String(row[keyColumn]), row])).values()];
        const written = await insertRows(
          client,
          "INSERT INTO legacy_user_records (user_id, source_table, source_id, payload, source_created_at)",
          "ON CONFLICT (source_table, source_id) DO UPDATE SET payload = EXCLUDED.payload",
          unique.map((row) => [
            idMap.get(String(row.user_id)), table, String(row[keyColumn]),
            JSON.stringify(stripSecrets(row)), row.created_at ?? null,
          ]),
          100,
        );
        log(`archived ${table.padEnd(26)} ${written}`);
      }

      await client.query("COMMIT");
      log("Migration committed.");
    } catch (error) {
      await client.query("ROLLBACK");
      log("Rolled back — the target database is unchanged.");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await source.query("ROLLBACK").catch(() => {});
    source.release();
    await Promise.all([sourcePool.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(`[migrate-users] FAILED: ${(error as Error).message}`);
  process.exit(1);
});
