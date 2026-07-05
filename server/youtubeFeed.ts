/**
 * YouTube feed loader for Daniel Foch's channel (https://www.youtube.com/@daniel_foch).
 *
 * The exact mirror of server/podcastFeed.ts, for video pages. Single source of
 * truth for video data: fetches + parses the keyless per-channel Atom feed
 * once, caches it in memory for an hour (stale-on-error), and assigns stable
 * slugs so /api/youtube/videos, /insights/videos/:slug meta, the crawler
 * fallback, and sitemap-videos.xml all agree on the same video list.
 *
 * Channel id resolution + config: the @daniel_foch handle resolves to the
 * channel id UCeULGvCIbLn4eMpg-uGYkzQ (resolved once from the handle page —
 * see shared/brand.ts YOUTUBE_DEFAULT_CHANNEL_ID). Override with the
 * YOUTUBE_CHANNEL_ID env var. No API key is used — YouTube's Atom feed is
 * public, exactly like the podcast RSS feed.
 *
 * Enrichment: a downstream content agent can enrich SELECT videos into full
 * reports via the report-content system. This module is intentionally NOT
 * coupled to that — it exposes a getVideoSummary() seam (returns the feed
 * description today) where AI enrichment plugs in later. See getVideoSummary().
 */

import { YOUTUBE_DEFAULT_CHANNEL_ID, youtubeFeedUrl } from "@shared/brand";
import {
  assignVideoSlugs,
  deriveVideoKeywords,
  deriveVideoTopics,
  mapVideoCta,
  type VideoCta,
} from "@shared/youtubeVideos";

export interface YouTubeVideo {
  slug: string;
  videoId: string;
  title: string;
  /** Raw description text from media:description (plain text, not HTML). */
  description: string;
  /** ISO published timestamp from the Atom <published> tag. */
  pubDate: string;
  /** Canonical watch URL. */
  link: string;
  /** Best available thumbnail URL. */
  thumbnailUrl: string;
  viewCount: string;
  likeCount: string;
}

export interface RelatedVideo {
  slug: string;
  title: string;
  pubDate: string;
  thumbnailUrl: string;
}

export interface YouTubeVideoPayload extends YouTubeVideo {
  /** Description rendered as safe paragraph HTML (URLs auto-linked). */
  descriptionHtml: string;
  /** Responsive YouTube embed URL for the iframe (privacy-enhanced host). */
  embedUrl: string;
  topics: string[];
  keywords: string;
  cta: VideoCta;
  related: RelatedVideo[];
  /** Future enrichment seam — null today, see getVideoEnrichment(). */
  enrichment: YouTubeVideoEnrichment | null;
}

// ---------------------------------------------------------------------------
// Channel id (env override, hardcoded default resolved from the handle)
// ---------------------------------------------------------------------------

function getChannelId(): string {
  return process.env.YOUTUBE_CHANNEL_ID?.trim() || YOUTUBE_DEFAULT_CHANNEL_ID;
}

// ---------------------------------------------------------------------------
// Feed fetch + in-memory cache (1h TTL, deduped in-flight fetch)
// ---------------------------------------------------------------------------

const FEED_TTL_MS = 60 * 60 * 1000;

let cache: { videos: YouTubeVideo[]; fetchedAt: number } | null = null;
let inflight: Promise<YouTubeVideo[]> | null = null;

/** Atom text arrives entity-encoded — decode for display, slugs, topics. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Dependency-free Atom parser (mirrors podcastFeed's regex parser — no deps).
 * Each <entry> yields a video; media:group holds the description, thumbnail,
 * and media:community view/like stats.
 */
export function parseFeed(xmlText: string): YouTubeVideo[] {
  const items: Array<Omit<YouTubeVideo, "slug">> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryXml = match[1];

    const getTagContent = (tag: string) => {
      const regex = new RegExp(
        `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
      );
      const m = entryXml.match(regex);
      return m ? (m[1] || m[2] || "").trim() : "";
    };

    const getAttr = (tag: string, attr: string) => {
      const regex = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"[^>]*/?>`);
      const m = entryXml.match(regex);
      return m ? m[1] : "";
    };

    const videoId = getTagContent("yt:videoId");
    // Prefer the media:title/media:description inside media:group; fall back to
    // the entry-level <title>. All are entity-encoded in the Atom feed.
    const title = decodeXmlEntities(getTagContent("media:title") || getTagContent("title"));
    const description = decodeXmlEntities(getTagContent("media:description"));
    const pubDate = getTagContent("published");
    const link = getAttr("link", "href") || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
    const thumbnailUrl =
      getAttr("media:thumbnail", "url") ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");

    // media:community stats (best-effort; absent on brand-new uploads).
    const statsMatch = entryXml.match(/<media:statistics[^>]*\bviews="([^"]*)"/);
    const viewCount = statsMatch ? statsMatch[1] : "";
    const ratingMatch = entryXml.match(/<media:starRating[^>]*\bcount="([^"]*)"/);
    const likeCount = ratingMatch ? ratingMatch[1] : "";

    if (!videoId || !title) continue;
    items.push({ videoId, title, description, pubDate, link, thumbnailUrl, viewCount, likeCount });
  }

  return assignVideoSlugs(items);
}

async function fetchAndParseFeed(): Promise<YouTubeVideo[]> {
  const response = await fetch(youtubeFeedUrl(getChannelId()), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Realist/1.0)",
      Accept: "application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!response.ok) throw new Error(`YouTube feed fetch failed: ${response.status}`);
  return parseFeed(await response.text());
}

/**
 * Cached video list (feed order, newest first). A cold call awaits the fetch —
 * required so the crawler fallback for an uncached video URL still renders real
 * content. On refresh failure the stale cache is served.
 */
export async function getYouTubeVideos(): Promise<YouTubeVideo[]> {
  if (cache && Date.now() - cache.fetchedAt < FEED_TTL_MS) return cache.videos;
  if (!inflight) {
    inflight = fetchAndParseFeed()
      .then((videos) => {
        cache = { videos, fetchedAt: Date.now() };
        return videos;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (error) {
    if (cache) return cache.videos; // stale beats broken
    throw error;
  }
}

export async function getYouTubeVideoBySlug(slug: string): Promise<YouTubeVideo | null> {
  const videos = await getYouTubeVideos();
  return videos.find((video) => video.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Description → safe HTML + plain-text helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a plain-text YouTube description as safe paragraph HTML: HTML-escape
 * everything, auto-link bare http(s) URLs, and turn blank lines into
 * paragraphs / single newlines into <br>. No raw HTML from the feed is ever
 * emitted (YouTube descriptions are plain text, but we escape defensively).
 */
export function descriptionToHtml(description: string): string {
  const linkify = (text: string) =>
    escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const trimmed = url.replace(/[.,)]+$/, "");
      const trailing = url.slice(trimmed.length);
      return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${trimmed}</a>${trailing}`;
    });

  return description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${linkify(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Plain-text description (for meta descriptions / JSON-LD). */
export function stripDescription(description: string, maxLength = 300): string {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}

/** Privacy-enhanced embed URL for the responsive iframe. */
export function videoEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// ---------------------------------------------------------------------------
// Related videos (newest-first topic matches, padded with feed neighbours)
// ---------------------------------------------------------------------------

export function getRelatedVideos(
  video: YouTubeVideo,
  videos: YouTubeVideo[],
  limit = 4,
): RelatedVideo[] {
  const topics = new Set(deriveVideoTopics(video.title));
  const related: YouTubeVideo[] = [];

  if (topics.size > 0) {
    for (const candidate of videos) {
      if (candidate.slug === video.slug) continue;
      if (deriveVideoTopics(candidate.title).some((topic) => topics.has(topic))) {
        related.push(candidate);
        if (related.length >= limit) break;
      }
    }
  }

  if (related.length < limit) {
    const index = videos.findIndex((candidate) => candidate.slug === video.slug);
    for (let offset = 1; related.length < limit && offset < videos.length; offset++) {
      for (const neighbourIndex of [index - offset, index + offset]) {
        if (related.length >= limit) break;
        const neighbour = videos[neighbourIndex];
        if (!neighbour || neighbour.slug === video.slug) continue;
        if (!related.some((item) => item.slug === neighbour.slug)) related.push(neighbour);
      }
    }
  }

  return related
    .slice(0, limit)
    .map(({ slug, title, pubDate, thumbnailUrl }) => ({ slug, title, pubDate, thumbnailUrl }));
}

// ---------------------------------------------------------------------------
// Enrichment seam (mirrors the podcast getEpisodeSummary / enrichment seam)
// ---------------------------------------------------------------------------

/**
 * Enrichment seam — the video equivalent of the podcast getEpisodeSummary
 * seam. Returns the feed description today. Later, a downstream content agent
 * can enrich SELECT videos into full reports via the report-content system;
 * this is where an AI-written summary would be substituted, e.g.:
 *
 *   const enriched = await getVideoEnrichment(video.slug);
 *   return enriched?.summaryHtml ?? descriptionToHtml(video.description);
 *
 * Intentionally decoupled from the report-content system — no coupling here.
 */
export function getVideoSummary(video: YouTubeVideo): string {
  return video.description;
}

export interface YouTubeVideoEnrichment {
  summaryHtml?: string;
  keyTakeaways?: string[];
}

/**
 * Future enrichment hook: a `video_enrichments` lookup (by slug) can later
 * inject AI-written summaries / key takeaways into the page payload, the
 * crawler fallback, and the JSON-LD. Intentionally returns null today — the
 * page already renders a complete document without it, and callers must treat
 * null as "no enrichment". No table or feature yet.
 */
export async function getVideoEnrichment(_slug: string): Promise<YouTubeVideoEnrichment | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Full page payload
// ---------------------------------------------------------------------------

export async function getVideoPayload(slug: string): Promise<YouTubeVideoPayload | null> {
  const videos = await getYouTubeVideos();
  const video = videos.find((item) => item.slug === slug);
  if (!video) return null;

  return {
    ...video,
    descriptionHtml: descriptionToHtml(getVideoSummary(video)),
    embedUrl: videoEmbedUrl(video.videoId),
    topics: deriveVideoTopics(video.title),
    keywords: deriveVideoKeywords(video.title),
    cta: mapVideoCta(video.title),
    related: getRelatedVideos(video, videos),
    enrichment: await getVideoEnrichment(slug),
  };
}
