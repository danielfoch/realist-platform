import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import {
  podcastEnrichmentPublishSchema,
  podcastEnrichmentUpdateSchema,
  podcastTranscriptIngestSchema,
} from "@shared/podcastEnrichment";
import {
  generatePodcastEnrichmentDraft,
  getPodcastEnrichmentAdminIndex,
  ingestPodcastTranscript,
  publishPodcastEnrichment,
  syncLatestOmnyTranscripts,
  updatePodcastEnrichmentDraft,
} from "./podcastEnrichment";

function podcastSyncApiKey(): string | undefined {
  return process.env.PODCAST_ENRICHMENT_API_KEY
    || process.env.REALIST_RESEARCH_API_KEY
    || process.env.DEAL_DESK_API_KEY;
}

function requirePodcastSyncKey(req: Request, res: Response, next: NextFunction): void {
  const expected = podcastSyncApiKey();
  const supplied = req.headers["x-api-key"] || req.headers["x-research-key"];
  if (!expected) {
    res.status(503).json({ success: false, error: "Podcast enrichment API key is not configured" });
    return;
  }
  if (supplied !== expected) {
    res.status(401).json({ success: false, error: "Invalid API key" });
    return;
  }
  next();
}

async function currentEpisodes() {
  const { getPodcastEpisodes } = await import("./podcastFeed");
  return getPodcastEpisodes();
}

async function runOmnySync() {
  const episodes = await currentEpisodes();
  return syncLatestOmnyTranscripts(episodes.filter((episode) => episode.clipId).slice(0, 8));
}

function sendRouteError(res: Response, error: any, fallback: string): void {
  if (error?.issues) {
    res.status(400).json({ success: false, error: "validation_failed", details: error.issues });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : /not configured/i.test(message) ? 503 : 500;
  res.status(status).json({ success: false, error: message });
}

export function registerPodcastEnrichmentRoutes(app: Express, isAdmin: RequestHandler): void {
  app.get("/api/admin/podcast-enrichments", isAdmin, async (_req, res) => {
    try {
      res.json(await getPodcastEnrichmentAdminIndex());
    } catch (error) {
      console.error("[podcast-enrichment] admin index failed:", error);
      sendRouteError(res, error, "Failed to load podcast enrichments");
    }
  });

  app.post("/api/admin/podcast-enrichments/sync", isAdmin, async (_req, res) => {
    try {
      res.json({ success: true, result: await runOmnySync() });
    } catch (error) {
      console.error("[podcast-enrichment] admin sync failed:", error);
      sendRouteError(res, error, "Failed to sync publisher transcripts");
    }
  });

  app.post("/api/integrations/podcast/enrichments/sync", requirePodcastSyncKey, async (_req, res) => {
    try {
      res.json({ success: true, result: await runOmnySync() });
    } catch (error) {
      console.error("[podcast-enrichment] integration sync failed:", error);
      sendRouteError(res, error, "Failed to sync publisher transcripts");
    }
  });

  app.post("/api/admin/podcast-enrichments/ingest", isAdmin, async (req, res) => {
    try {
      const payload = podcastTranscriptIngestSchema.parse(req.body);
      const episodes = await currentEpisodes();
      const episode = episodes.find((item) => item.slug === payload.episodeSlug);
      if (!episode) {
        res.status(404).json({ success: false, error: "Podcast episode not found in the current RSS feed" });
        return;
      }
      const ingested = await ingestPodcastTranscript({
        episode,
        transcriptText: payload.transcriptText,
        sourceKind: payload.sourceKind,
        sourceUrl: payload.sourceUrl,
      });
      let generationError: string | null = null;
      let status = ingested.row.status;
      if (payload.generate && !ingested.idempotent) {
        try {
          const generated = await generatePodcastEnrichmentDraft(episode.slug);
          status = generated.status;
        } catch (error) {
          generationError = error instanceof Error ? error.message : "Draft generation failed";
        }
      }
      res.status(ingested.idempotent ? 200 : 201).json({
        success: true,
        idempotent: ingested.idempotent,
        episodeSlug: episode.slug,
        status,
        generationError,
      });
    } catch (error) {
      console.error("[podcast-enrichment] transcript ingest failed:", error);
      sendRouteError(res, error, "Failed to ingest transcript");
    }
  });

  app.post("/api/admin/podcast-enrichments/:slug/generate", isAdmin, async (req, res) => {
    try {
      const row = await generatePodcastEnrichmentDraft(req.params.slug);
      res.json({ success: true, episodeSlug: row.episodeSlug, status: row.status });
    } catch (error) {
      console.error("[podcast-enrichment] generation failed:", error);
      sendRouteError(res, error, "Failed to generate podcast enrichment");
    }
  });

  app.put("/api/admin/podcast-enrichments/:slug", isAdmin, async (req, res) => {
    try {
      const draft = podcastEnrichmentUpdateSchema.parse(req.body);
      const row = await updatePodcastEnrichmentDraft(req.params.slug, draft);
      res.json({ success: true, episodeSlug: row.episodeSlug, status: row.status });
    } catch (error) {
      console.error("[podcast-enrichment] draft update failed:", error);
      sendRouteError(res, error, "Failed to update podcast enrichment");
    }
  });

  app.post("/api/admin/podcast-enrichments/:slug/publish", isAdmin, async (req, res) => {
    try {
      podcastEnrichmentPublishSchema.parse(req.body);
      if (!req.session?.userId) {
        res.status(401).json({ success: false, error: "Authentication required" });
        return;
      }
      const row = await publishPodcastEnrichment(req.params.slug, req.session.userId);
      res.json({
        success: true,
        episodeSlug: row.episodeSlug,
        status: row.status,
        publicUrl: `/insights/podcast/${row.episodeSlug}`,
      });
    } catch (error) {
      console.error("[podcast-enrichment] publish failed:", error);
      sendRouteError(res, error, "Failed to publish podcast enrichment");
    }
  });
}
