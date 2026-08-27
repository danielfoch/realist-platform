import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { unauthorizedCron } from "@/lib/cron";
import { enrichNewEpisodes } from "@/lib/podcast/enrich";

export const maxDuration = 300;

/**
 * Runs Tue/Fri shortly after the 5am ET episode drop (see vercel.json): pulls
 * the fresh feed, writes enrichment for new episodes, and revalidates the
 * pages that show the latest episode.
 */
export async function GET(request: NextRequest) {
  const unauthorized = unauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await enrichNewEpisodes();
    revalidatePath("/");
    revalidatePath("/podcast");
    for (const slug of result.enriched) {
      revalidatePath(`/podcast/${slug}`);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/podcast]", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
