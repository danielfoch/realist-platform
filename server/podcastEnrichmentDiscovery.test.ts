import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("transcript-backed podcast enrichment discovery", () => {
  it("persists private transcripts and reviewed public briefs", () => {
    const migration = read("migrations/0019_podcast_episode_enrichments.sql");
    const schema = read("shared/schema.ts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS podcast_episode_enrichments");
    expect(migration).toContain("transcript_text text NOT NULL");
    expect(migration).toContain("reviewed_by_user_id");
    expect(schema).toContain("podcastEpisodeEnrichments");
  });

  it("checks publisher transcripts after the scheduled RSS refresh without auto-publishing", () => {
    const feed = read("server/podcastFeed.ts");
    const enrichment = read("server/podcastEnrichment.ts");
    expect(feed).toContain("syncLatestOmnyTranscripts");
    expect(feed).toContain('cron.schedule("10 5 * * 2,5"');
    expect(enrichment).toContain('status: "ready_for_review"');
    expect(enrichment).not.toMatch(/syncLatestOmnyTranscripts[\s\S]*publishPodcastEnrichment\(/);
  });

  it("keeps raw transcripts private and exposes only published summaries", () => {
    const enrichment = read("server/podcastEnrichment.ts");
    const routes = read("server/podcastEnrichmentRoutes.ts");
    expect(enrichment).toContain("getPublishedPodcastEpisodeEnrichment");
    expect(enrichment).toContain('row.status !== "published"');
    expect(routes).not.toContain('app.get("/api/podcast/transcript');
  });

  it("renders reviewed briefs, provenance, caveats, FAQ, and crawler content", () => {
    const page = read("client/src/pages/PodcastEpisodeDetail.tsx");
    const crawler = read("server/seoRender.ts");
    const meta = read("server/seoMeta.ts");
    expect(page).toContain("Transcript-backed episode brief");
    expect(page).toContain("does not independently verify speaker claims");
    expect(page).toContain("Episode questions, answered");
    expect(crawler).toContain("Transcript-backed · Admin reviewed");
    expect(meta).toContain('"@type": "FAQPage"');
  });
});
