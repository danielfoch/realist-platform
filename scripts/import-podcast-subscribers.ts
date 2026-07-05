/**
 * Import a Substack subscriber export into the podcast-digest list — the
 * one-time seed for the Substack → realist.ca podcast-digest migration.
 *
 * Substack export: Subscribers → Export. Columns used: "Email", "Name",
 * "Start date" (subscription date, preserved as the consent timestamp so the
 * ledger shows the true origin of the relationship, not the import date).
 *
 * Each subscriber is upserted via ensurePodcastSubscriber(): finds/creates a
 * passwordless user, sets notification_preferences.podcast_digest_enabled =
 * true, and appends an email_consent ledger row. Idempotent — re-running
 * skips already-subscribed users. Invalid/missing emails are counted, not
 * fatal.
 *
 * CASL: these are existing newsletter subscribers migrating to the same
 * publisher's (Daniel Foch's) content on a new platform — implied consent
 * from the existing subscriber relationship, with the original subscribe
 * date recorded and one-click unsubscribe in every digest. Use a descriptive
 * --source so the ledger states exactly which list each grant came from.
 *
 * PREREQUISITE: the podcast-digest feature must be DEPLOYED first
 * (db:push has created notification_preferences.podcast_digest_enabled).
 *
 * Run (in the Replit shell, after uploading the CSVs):
 *   npx tsx scripts/import-podcast-subscribers.ts podcast.csv --source=podcast_substack_import --dry-run
 *   npx tsx scripts/import-podcast-subscribers.ts podcast.csv --source=podcast_substack_import
 *   npx tsx scripts/import-podcast-subscribers.ts danielfoch.csv --source=danielfoch_substack_import
 */

import fs from "fs";
import { ensurePodcastSubscriber } from "../server/podcastDigest";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

async function main() {
  const csvPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const source = (parseArg("source") || "substack_import").slice(0, 100);
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/import-podcast-subscribers.ts <substack-export.csv> [--source=<label>] [--dry-run]");
    process.exit(1);
  }

  // Strip a UTF-8 BOM if Substack included one.
  const raw = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const emailIdx = col("Email");
  const nameIdx = col("Name");
  const startIdx = col("Start date");
  if (emailIdx < 0) {
    console.error(`No "Email" column found. Headers: ${header.join(", ")}`);
    process.exit(1);
  }

  console.log(`[podcast-import] ${lines.length - 1} rows | source=${source} | dryRun=${dryRun}`);

  let processed = 0, created = 0, alreadySubscribed = 0, skippedInvalid = 0, errors = 0;
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const email = (cells[emailIdx] || "").trim().toLowerCase();
    if (!email || !email.includes("@")) { skippedInvalid++; continue; }
    if (seen.has(email)) continue; // dedupe within the file
    seen.add(email);

    const firstName = nameIdx >= 0 ? ((cells[nameIdx] || "").trim().split(/\s+/)[0] || null) : null;

    if (dryRun) {
      processed++;
      if (processed <= 5) console.log(`  would import: ${email}${firstName ? ` (${firstName})` : ""}`);
      continue;
    }

    try {
      const result = await ensurePodcastSubscriber(email, { firstName, source });
      processed++;
      if (result.created) created++;
      if (result.alreadySubscribed) alreadySubscribed++;
      if (processed % 250 === 0) console.log(`  …${processed} processed`);
      await new Promise((r) => setTimeout(r, 25)); // gentle on the DB
    } catch (err) {
      errors++;
      if (errors <= 10) console.error(`  FAILED ${email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `[podcast-import] done. processed=${processed} newUsers=${created} alreadySubscribed=${alreadySubscribed} skippedInvalid=${skippedInvalid} errors=${errors}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error("Fatal:", err); process.exit(1); });
