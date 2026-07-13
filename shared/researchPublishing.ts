import { z } from "zod";
import {
  DEFAULT_AUTHOR,
  validateReportContent,
  type ReportContent,
} from "./reportContent";

export const RESEARCH_ARTICLE_STATUSES = [
  "draft",
  "needs_revision",
  "ready_for_review",
  "publish_blocked",
  "published",
] as const;

export type ResearchArticleStatus = (typeof RESEARCH_ARTICLE_STATUSES)[number];

const slugSchema = z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case");

export const researchDraftIngestSchema = z.object({
  sourceId: z.string().trim().min(1).max(240),
  idempotencyKey: z.string().trim().min(8).max(240),
  article: z.custom<ReportContent>((value) => typeof value === "object" && value !== null, "article must be a ReportContent object"),
});

export const researchPublishRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(240),
  confirm: z.literal("publish").optional(),
});

export function normalizeResearchArticle(raw: ReportContent): ReportContent {
  return {
    ...raw,
    slug: slugSchema.parse(raw.slug),
    kind: raw.kind || "research",
    author: raw.author || DEFAULT_AUTHOR,
  };
}

export function validateResearchArticle(raw: ReportContent): { article: ReportContent; errors: string[] } {
  const article = normalizeResearchArticle(raw);
  const validation = validateReportContent(article);
  return { article, errors: validation.errors };
}

export function draftStatusFromErrors(errors: string[]): ResearchArticleStatus {
  return errors.length > 0 ? "needs_revision" : "ready_for_review";
}
