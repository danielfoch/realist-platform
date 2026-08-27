import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * AI enrichment for podcast episodes, written by the podcast cron when a new
 * episode lands (Tue/Fri 5am ET) and read back into the episode page payload.
 * The RSS feed stays the source of truth for the episode itself — this table
 * only ever adds to it, keyed by the stable episode slug.
 */
export const episodeEnrichments = pgTable("episode_enrichments", {
  slug: text("slug").primaryKey(),
  /** Sanitized HTML summary written by the enrichment model. */
  summaryHtml: text("summary_html"),
  keyTakeaways: jsonb("key_takeaways").$type<string[]>(),
  relatedResearch:
    jsonb("related_research").$type<Array<{ href: string; label: string }>>(),
  episodeTitle: text("episode_title").notNull(),
  episodePubDate: text("episode_pub_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
