import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { episodeEnrichments } from "@/lib/db/schema";
import type { PodcastEpisodeEnrichment } from "./feed";

export async function getEpisodeEnrichmentRow(
  slug: string,
): Promise<PodcastEpisodeEnrichment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(episodeEnrichments)
    .where(eq(episodeEnrichments.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    summaryHtml: row.summaryHtml ?? undefined,
    keyTakeaways: row.keyTakeaways ?? undefined,
    relatedResearch: row.relatedResearch ?? undefined,
  };
}
