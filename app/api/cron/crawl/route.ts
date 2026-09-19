import { NextRequest, NextResponse } from "next/server";
import { unauthorizedCron } from "@/lib/cron";
import { runCrawlSlice } from "@/lib/ddf/resumableCrawl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every ten minutes: work the data sync forward for one time budget (rents, then
 * for-sale listings province by province), or find it finished and resting until
 * tomorrow. See lib/ddf/resumableCrawl.ts. Counts only in the response.
 */
export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, ...(await runCrawlSlice()) });
  } catch (error) {
    console.error("[cron/crawl]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "crawl slice failed" }, { status: 503 });
  }
}
