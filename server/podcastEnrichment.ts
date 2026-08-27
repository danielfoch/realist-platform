import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { podcastEpisodeEnrichments } from "@shared/schema";
import {
  normalizeTranscriptText,
  podcastEnrichmentDraftSchema,
  transcriptSourceLabel,
  validatePodcastEnrichmentDraft,
  type PodcastEnrichmentDraft,
  type PublishedPodcastEpisodeEnrichment,
} from "@shared/podcastEnrichment";

const OMNY_ORGANIZATION_ID = "d75d2ff4-a4dd-4a19-bcb1-ad35013dfc83";
const GENERATION_MODEL = "claude-opus-4-8";
const MAX_REMOTE_TRANSCRIPT_BYTES = 2_000_000;

export interface EnrichablePodcastEpisode {
  slug: string;
  clipId: string;
  title: string;
  pubDate: string;
}

interface OmnyClipMetadata {
  TranscriptUrl?: unknown;
  HasPublishedTranscript?: unknown;
}

export interface PodcastTranscriptSyncResult {
  checked: number;
  unavailable: number;
  unchanged: number;
  drafted: number;
  awaitingGeneration: number;
  failed: Array<{ episodeSlug: string; error: string }>;
}

function validPublishedDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transcriptHash(transcriptText: string): string {
  return crypto.createHash("sha256").update(transcriptText).digest("hex");
}

export function isAllowedOmnyTranscriptUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "omnycontent.com"
      || host.endsWith(".omnycontent.com")
      || host === "omny.fm"
      || host.endsWith(".omny.fm");
  } catch {
    return false;
  }
}

function textFromJson(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  for (const key of ["transcript", "Transcript", "content", "Content", "text", "Text"]) {
    if (typeof object[key] === "string") return object[key] as string;
  }
  for (const key of ["segments", "Segments", "items", "Items", "lines", "Lines"]) {
    const rows = object[key];
    if (!Array.isArray(rows)) continue;
    const text = rows
      .map((row) => {
        if (typeof row === "string") return row;
        if (!row || typeof row !== "object") return "";
        const item = row as Record<string, unknown>;
        const line = item.text ?? item.Text ?? item.content ?? item.Content;
        const speaker = item.speaker ?? item.Speaker ?? item.speakerName ?? item.SpeakerName;
        return typeof line === "string"
          ? `${typeof speaker === "string" && speaker.trim() ? `${speaker.trim()}: ` : ""}${line}`
          : "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  return null;
}

/** Convert plain text, WebVTT/SRT, or common transcript JSON into private text. */
export function extractTranscriptText(raw: string, contentType = "text/plain"): string {
  let text = raw;
  if (/json/i.test(contentType) || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    const parsed = JSON.parse(raw) as unknown;
    const extracted = Array.isArray(parsed)
      ? textFromJson({ segments: parsed })
      : textFromJson(parsed);
    if (!extracted) throw new Error("Transcript JSON did not contain recognized text fields");
    text = extracted;
  } else if (/vtt|srt/i.test(contentType) || /^WEBVTT/i.test(raw.trim()) || /-->/m.test(raw)) {
    text = raw
      .split("\n")
      .filter((line) => !/^\s*WEBVTT\s*$/i.test(line))
      .filter((line) => !/^\s*\d+\s*$/.test(line))
      .filter((line) => !/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->/.test(line))
      .map((line) => line.replace(/<[^>]+>/g, ""))
      .join("\n");
  }
  return normalizeTranscriptText(text);
}

async function fetchTextWithinLimit(url: string): Promise<{ raw: string; contentType: string }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json, text/vtt, text/plain, */*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Transcript fetch failed: ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_REMOTE_TRANSCRIPT_BYTES) throw new Error("Transcript file exceeds the 2 MB import limit");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_REMOTE_TRANSCRIPT_BYTES) throw new Error("Transcript file exceeds the 2 MB import limit");
  return {
    raw: buffer.toString("utf8"),
    contentType: response.headers.get("content-type") || "text/plain",
  };
}

async function fetchOmnyClipMetadata(clipId: string): Promise<OmnyClipMetadata> {
  const response = await fetch(
    `https://api.omny.fm/orgs/${OMNY_ORGANIZATION_ID}/clips/${encodeURIComponent(clipId)}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Omny clip metadata failed: ${response.status}`);
  return response.json() as Promise<OmnyClipMetadata>;
}

export async function ingestPodcastTranscript(input: {
  episode: EnrichablePodcastEpisode;
  transcriptText: string;
  sourceKind: "omny_publisher" | "publisher_upload" | "manual_transcript";
  sourceUrl?: string | null;
}): Promise<{ row: typeof podcastEpisodeEnrichments.$inferSelect; idempotent: boolean }> {
  const transcriptText = normalizeTranscriptText(input.transcriptText);
  if (transcriptText.length < 500 || transcriptText.length > 500_000) {
    throw new Error("Transcript must contain between 500 and 500,000 characters");
  }
  const sha256 = transcriptHash(transcriptText);
  const [existing] = await db.select().from(podcastEpisodeEnrichments)
    .where(eq(podcastEpisodeEnrichments.episodeSlug, input.episode.slug))
    .limit(1);
  if (existing?.transcriptSha256 === sha256) return { row: existing, idempotent: true };

  const [row] = await db.insert(podcastEpisodeEnrichments).values({
    episodeSlug: input.episode.slug,
    clipId: input.episode.clipId || null,
    episodeTitle: input.episode.title,
    episodePublishedAt: validPublishedDate(input.episode.pubDate),
    transcriptSourceKind: input.sourceKind,
    transcriptSourceUrl: input.sourceUrl || null,
    transcriptSha256: sha256,
    transcriptText,
    status: "transcript_ready",
    summaryText: null,
    keyTakeawaysJson: [],
    faqJson: [],
    generationModel: null,
    generationError: null,
    generatedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: podcastEpisodeEnrichments.episodeSlug,
    set: {
      clipId: input.episode.clipId || null,
      episodeTitle: input.episode.title,
      episodePublishedAt: validPublishedDate(input.episode.pubDate),
      transcriptSourceKind: input.sourceKind,
      transcriptSourceUrl: input.sourceUrl || null,
      transcriptSha256: sha256,
      transcriptText,
      status: "transcript_ready",
      summaryText: null,
      keyTakeawaysJson: [],
      faqJson: [],
      generationModel: null,
      generationError: null,
      generatedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      publishedAt: null,
      updatedAt: new Date(),
    },
  }).returning();
  return { row, idempotent: false };
}

function parseGeneratedDraft(raw: string): PodcastEnrichmentDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Generation did not return a JSON object");
  return podcastEnrichmentDraftSchema.parse(JSON.parse(raw.slice(start, end + 1)));
}

export async function generatePodcastEnrichmentDraft(episodeSlug: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const [row] = await db.select().from(podcastEpisodeEnrichments)
    .where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug))
    .limit(1);
  if (!row) throw new Error("Podcast transcript not found");

  try {
    const response = await new Anthropic().messages.create({
      model: GENERATION_MODEL,
      max_tokens: 2_000,
      system:
        "Create an editorial draft for a Canadian real-estate podcast episode using only the supplied transcript. " +
        "Do not verify, strengthen, or invent facts, statistics, names, quotations, sources, or investment advice. " +
        "Attribute factual assertions to the conversation with wording such as 'the hosts discuss' or 'the guest says'. " +
        "Use plain text only. Return ONLY valid JSON with this shape: " +
        '{"summaryText":"2-4 concise paragraphs","keyTakeaways":["2-8 transcript-grounded takeaways"],"faq":[{"question":"...","answer":"..."}]}. ' +
        "FAQ answers must describe what the episode says, not present speaker claims as independently verified facts.",
      messages: [{
        role: "user",
        content: `Episode title: ${row.episodeTitle}\n\nTranscript:\n${row.transcriptText.slice(0, 150_000)}`,
      }],
    });
    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const draft = parseGeneratedDraft(raw);
    const [updated] = await db.update(podcastEpisodeEnrichments).set({
      status: "ready_for_review",
      summaryText: draft.summaryText,
      keyTakeawaysJson: draft.keyTakeaways,
      faqJson: draft.faq,
      generationModel: GENERATION_MODEL,
      generationError: null,
      generatedAt: new Date(),
      reviewedByUserId: null,
      reviewedAt: null,
      publishedAt: null,
      updatedAt: new Date(),
    }).where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug)).returning();
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Podcast enrichment generation failed";
    await db.update(podcastEpisodeEnrichments).set({
      status: "needs_revision",
      generationError: message.slice(0, 2_000),
      updatedAt: new Date(),
    }).where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug));
    throw error;
  }
}

export async function updatePodcastEnrichmentDraft(episodeSlug: string, draft: PodcastEnrichmentDraft) {
  const validated = podcastEnrichmentDraftSchema.parse(draft);
  const [row] = await db.update(podcastEpisodeEnrichments).set({
    status: "ready_for_review",
    summaryText: validated.summaryText,
    keyTakeawaysJson: validated.keyTakeaways,
    faqJson: validated.faq,
    generationError: null,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
    updatedAt: new Date(),
  }).where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug)).returning();
  if (!row) throw new Error("Podcast enrichment not found");
  return row;
}

export async function publishPodcastEnrichment(episodeSlug: string, reviewedByUserId: string) {
  const [row] = await db.select().from(podcastEpisodeEnrichments)
    .where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug))
    .limit(1);
  if (!row) throw new Error("Podcast enrichment not found");
  const { errors } = validatePodcastEnrichmentDraft({
    summaryText: row.summaryText,
    keyTakeaways: row.keyTakeawaysJson,
    faq: row.faqJson,
  });
  if (errors.length) throw new Error(`Publish blocked: ${errors.join("; ")}`);
  const now = new Date();
  const [published] = await db.update(podcastEpisodeEnrichments).set({
    status: "published",
    reviewedByUserId,
    reviewedAt: now,
    publishedAt: now,
    updatedAt: now,
  }).where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug)).returning();
  return published;
}

export async function getPodcastEnrichmentAdminIndex(limit = 100) {
  return db.select({
    episodeSlug: podcastEpisodeEnrichments.episodeSlug,
    clipId: podcastEpisodeEnrichments.clipId,
    episodeTitle: podcastEpisodeEnrichments.episodeTitle,
    episodePublishedAt: podcastEpisodeEnrichments.episodePublishedAt,
    transcriptSourceKind: podcastEpisodeEnrichments.transcriptSourceKind,
    transcriptSourceUrl: podcastEpisodeEnrichments.transcriptSourceUrl,
    transcriptLength: sql<number>`char_length(${podcastEpisodeEnrichments.transcriptText})`,
    status: podcastEpisodeEnrichments.status,
    summaryText: podcastEpisodeEnrichments.summaryText,
    keyTakeawaysJson: podcastEpisodeEnrichments.keyTakeawaysJson,
    faqJson: podcastEpisodeEnrichments.faqJson,
    generationModel: podcastEpisodeEnrichments.generationModel,
    generationError: podcastEpisodeEnrichments.generationError,
    generatedAt: podcastEpisodeEnrichments.generatedAt,
    reviewedAt: podcastEpisodeEnrichments.reviewedAt,
    publishedAt: podcastEpisodeEnrichments.publishedAt,
    updatedAt: podcastEpisodeEnrichments.updatedAt,
  }).from(podcastEpisodeEnrichments)
    .orderBy(desc(podcastEpisodeEnrichments.episodePublishedAt), desc(podcastEpisodeEnrichments.updatedAt))
    .limit(Math.max(1, Math.min(250, limit)));
}

export async function getPublishedPodcastEpisodeEnrichment(
  episodeSlug: string,
): Promise<PublishedPodcastEpisodeEnrichment | null> {
  const [row] = await db.select().from(podcastEpisodeEnrichments)
    .where(eq(podcastEpisodeEnrichments.episodeSlug, episodeSlug))
    .limit(1);
  if (!row || row.status !== "published" || !row.summaryText || !row.reviewedAt || !row.publishedAt) return null;
  const { draft } = validatePodcastEnrichmentDraft({
    summaryText: row.summaryText,
    keyTakeaways: row.keyTakeawaysJson,
    faq: row.faqJson,
  });
  if (!draft) return null;
  const sourceKind = row.transcriptSourceKind as PublishedPodcastEpisodeEnrichment["sourceKind"];
  return {
    ...draft,
    sourceKind,
    sourceUrl: row.transcriptSourceUrl,
    sourceLabel: transcriptSourceLabel(sourceKind),
    reviewedAt: row.reviewedAt.toISOString(),
    publishedAt: row.publishedAt.toISOString(),
  };
}

export async function getPublishedPodcastEnrichmentLastmods(): Promise<Map<string, string>> {
  const rows = await db.select({
    episodeSlug: podcastEpisodeEnrichments.episodeSlug,
    updatedAt: podcastEpisodeEnrichments.updatedAt,
  }).from(podcastEpisodeEnrichments)
    .where(eq(podcastEpisodeEnrichments.status, "published"));
  return new Map(rows.map((row) => [row.episodeSlug, row.updatedAt.toISOString()]));
}

export async function syncLatestOmnyTranscripts(
  episodes: EnrichablePodcastEpisode[],
): Promise<PodcastTranscriptSyncResult> {
  const result: PodcastTranscriptSyncResult = {
    checked: 0,
    unavailable: 0,
    unchanged: 0,
    drafted: 0,
    awaitingGeneration: 0,
    failed: [],
  };
  for (const episode of episodes.slice(0, 8)) {
    if (!episode.clipId) continue;
    result.checked += 1;
    try {
      const metadata = await fetchOmnyClipMetadata(episode.clipId);
      const sourceUrl = typeof metadata.TranscriptUrl === "string" ? metadata.TranscriptUrl : "";
      if (metadata.HasPublishedTranscript !== true || !sourceUrl) {
        result.unavailable += 1;
        continue;
      }
      if (!isAllowedOmnyTranscriptUrl(sourceUrl)) throw new Error("Omny returned an untrusted transcript URL");
      const remote = await fetchTextWithinLimit(sourceUrl);
      const transcriptText = extractTranscriptText(remote.raw, remote.contentType);
      const ingested = await ingestPodcastTranscript({
        episode,
        transcriptText,
        sourceKind: "omny_publisher",
        sourceUrl,
      });
      if (ingested.idempotent) {
        if (ingested.row.status === "published" || ingested.row.status === "ready_for_review") {
          result.unchanged += 1;
        } else if (!process.env.ANTHROPIC_API_KEY) {
          result.awaitingGeneration += 1;
        } else {
          await generatePodcastEnrichmentDraft(episode.slug);
          result.drafted += 1;
        }
        continue;
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        result.awaitingGeneration += 1;
        continue;
      }
      await generatePodcastEnrichmentDraft(episode.slug);
      result.drafted += 1;
    } catch (error) {
      result.failed.push({
        episodeSlug: episode.slug,
        error: error instanceof Error ? error.message : "Transcript sync failed",
      });
    }
  }
  return result;
}
