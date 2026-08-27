/**
 * DDF yield crawl entrypoint for GitHub Actions cron (long-running; too slow
 * for a Vercel function). Usage: npx tsx scripts/sync-ddf.ts [YYYY-MM]
 */
import { runDdfYieldCrawl, checkDdfCoverage } from "@/lib/ddf/crawler";

if (!process.env.DATABASE_URL) {
  console.error("[sync-ddf] DATABASE_URL is not set");
  process.exit(1);
}

const month = process.argv[2];

(async () => {
  const summary = await runDdfYieldCrawl(month);
  console.log(
    `[sync-ddf] ${summary.totalListings} listings across ${summary.citiesCrawled} cities, ` +
      `${summary.provincesCompleted} provinces (month ${summary.month}, skipped pages: ${summary.skippedPages})`,
  );
  await checkDdfCoverage(summary.month || month);
  process.exit(0);
})().catch((error) => {
  console.error("[sync-ddf] crawl failed:", error);
  process.exit(1);
});
