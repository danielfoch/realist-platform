import { z } from "zod";

export const PODCAST_ENRICHMENT_STATUSES = [
  "transcript_ready",
  "ready_for_review",
  "published",
  "needs_revision",
] as const;

export type PodcastEnrichmentStatus = (typeof PODCAST_ENRICHMENT_STATUSES)[number];

export const podcastEpisodeFaqSchema = z.object({
  question: z.string().trim().min(10).max(240),
  answer: z.string().trim().min(30).max(1_000),
});

export type PodcastEpisodeFaq = z.infer<typeof podcastEpisodeFaqSchema>;

const episodeSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "episodeSlug must be lowercase kebab-case");

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "sourceUrl must use HTTPS");

export const podcastTranscriptIngestSchema = z.object({
  episodeSlug: episodeSlugSchema,
  transcriptText: z.string().min(500).max(500_000),
  sourceKind: z.enum(["omny_publisher", "publisher_upload", "manual_transcript"]).default("manual_transcript"),
  sourceUrl: httpsUrlSchema.optional(),
  generate: z.boolean().default(true),
});

export const podcastEnrichmentDraftSchema = z.object({
  summaryText: z.string().trim().min(80).max(3_000),
  keyTakeaways: z.array(z.string().trim().min(20).max(600)).min(2).max(8),
  faq: z.array(podcastEpisodeFaqSchema).max(6).default([]),
});

export const podcastEnrichmentUpdateSchema = podcastEnrichmentDraftSchema;

export const podcastEnrichmentPublishSchema = z.object({
  confirm: z.literal("publish"),
});

export type PodcastEnrichmentDraft = z.infer<typeof podcastEnrichmentDraftSchema>;

export interface PublishedPodcastEpisodeEnrichment extends PodcastEnrichmentDraft {
  sourceKind: "omny_publisher" | "publisher_upload" | "manual_transcript";
  sourceUrl: string | null;
  sourceLabel: string;
  reviewedAt: string;
  publishedAt: string;
}

export function normalizeTranscriptText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function transcriptSourceLabel(
  sourceKind: "omny_publisher" | "publisher_upload" | "manual_transcript",
): string {
  if (sourceKind === "omny_publisher") return "Publisher transcript from Omny Studio";
  if (sourceKind === "publisher_upload") return "Publisher-supplied transcript";
  return "Manually supplied episode transcript";
}

export function validatePodcastEnrichmentDraft(value: unknown): {
  draft: PodcastEnrichmentDraft | null;
  errors: string[];
} {
  const parsed = podcastEnrichmentDraftSchema.safeParse(value);
  if (parsed.success) return { draft: parsed.data, errors: [] };
  return {
    draft: null,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "draft"}: ${issue.message}`),
  };
}
