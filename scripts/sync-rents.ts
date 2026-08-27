/**
 * Rent ingestion entrypoint for GitHub Actions cron: DDF lease listings into
 * rent_listings, then the rent_pulse aggregate rebuild.
 * Usage: npx tsx scripts/sync-rents.ts [--dry-run]
 */
import { runRentIngestion } from "@/lib/rents/ingestion";

if (!process.env.DATABASE_URL) {
  console.error("[sync-rents] DATABASE_URL is not set");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

runRentIngestion({ dryRun })
  .then(({ totals, pulseRows }) => {
    console.log(
      `[sync-rents] fetched=${totals.fetched}, mapped=${totals.mapped}, inserted=${totals.inserted}, ` +
        `refreshed=${totals.refreshed}, pulseRows=${pulseRows}${dryRun ? " (dry run)" : ""}`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("[sync-rents] ingestion failed:", error);
    process.exit(1);
  });
