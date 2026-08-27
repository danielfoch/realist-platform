/**
 * Podcast feed loader for The Canadian Real Estate Investor.
 *
 * Single source of truth for episode data: fetches + parses the Omny RSS feed
 * once, caches it in memory for an hour, and assigns stable slugs so
 * /podcast, /podcast/:slug, and the sitemap all agree on the same episode
 * list.
 */

import { PODCAST_RSS_URL } from "@/lib/brand";
import {
  assignEpisodeSlugs,
  deriveEpisodeKeywords,
  deriveEpisodeTopics,
  mapEpisodeCta,
  type EpisodeCta,
} from "./episodes";
import { encyclopediaGuides } from "@/lib/encyclopedia";

export interface PodcastEpisode {
  slug: string;
  title: string;
  /** Raw (unsanitized) show-notes HTML from the feed. */
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: string;
  link: string;
  imageUrl: string;
}

export interface RelatedEpisode {
  slug: string;
  title: string;
  pubDate: string;
}

export interface PodcastEpisodePayload extends PodcastEpisode {
  /** Sanitized show notes with conservative encyclopedia auto-links. */
  showNotesHtml: string;
  topics: string[];
  keywords: string;
  cta: EpisodeCta;
  related: RelatedEpisode[];
  /** AI enrichment (summary, takeaways, chart) — null until generated. */
  enrichment: PodcastEpisodeEnrichment | null;
}

// ---------------------------------------------------------------------------
// Feed fetch + in-memory cache (1h TTL, deduped in-flight fetch)
// ---------------------------------------------------------------------------

const FEED_TTL_MS = 60 * 60 * 1000;

let cache: { episodes: PodcastEpisode[]; fetchedAt: number } | null = null;
let inflight: Promise<PodcastEpisode[]> | null = null;

/** Feed titles and attribute values arrive entity-encoded ("Rates &amp;amp;
 * Rents", "audio.mp3?a=1&amp;amp;b=2") — decode for display, slugs, topic
 * matching, and URLs. An undecoded `&amp;amp;` in the enclosure URL corrupts
 * Omny's signed-redirect query string and playback 400s. Descriptions stay
 * as HTML. */
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

/** Exported for tests/tooling; production callers use getPodcastEpisodes(). */
export function parseFeed(xmlText: string): PodcastEpisode[] {
  const items: Array<Omit<PodcastEpisode, "slug">> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  const feedImageMatch = xmlText.match(/<image>[\s\S]*?<url>([^<]+)<\/url>[\s\S]*?<\/image>/);
  const feedImage = feedImageMatch ? decodeXmlEntities(feedImageMatch[1]) : "";

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const getTagContent = (tag: string) => {
      const regex = new RegExp(
        `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
      );
      const m = itemXml.match(regex);
      return m ? (m[1] || m[2] || "").trim() : "";
    };

    const getAttr = (tag: string, attr: string) => {
      const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`);
      const m = itemXml.match(regex);
      return m ? m[1] : "";
    };

    const title = decodeXmlEntities(getTagContent("title"));
    const description = getTagContent("description") || getTagContent("itunes:summary");
    const pubDate = getTagContent("pubDate");
    const link = decodeXmlEntities(getTagContent("link"));
    const duration = getTagContent("itunes:duration");
    const audioUrl = decodeXmlEntities(getAttr("enclosure", "url")) || link;
    const imageUrl = decodeXmlEntities(getAttr("itunes:image", "href")) || feedImage;

    if (!title) continue;
    items.push({ title, description, pubDate, audioUrl, duration, link, imageUrl });
  }

  return assignEpisodeSlugs(items);
}

async function fetchAndParseFeed(): Promise<PodcastEpisode[]> {
  const response = await fetch(PODCAST_RSS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Realist/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    // Next.js fetch cache would double-cache under the in-memory layer; keep
    // one cache with one TTL.
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
  return parseFeed(await response.text());
}

/**
 * Cached episode list (feed order, newest first). A cold call awaits the
 * fetch — required so an uncached episode URL still renders real content. On
 * refresh failure the stale cache is served.
 */
export async function getPodcastEpisodes(): Promise<PodcastEpisode[]> {
  if (cache && Date.now() - cache.fetchedAt < FEED_TTL_MS) return cache.episodes;
  if (!inflight) {
    inflight = fetchAndParseFeed()
      .then((episodes) => {
        cache = { episodes, fetchedAt: Date.now() };
        return episodes;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (error) {
    if (cache) return cache.episodes; // stale beats broken
    throw error;
  }
}

export async function getEpisodeBySlug(slug: string): Promise<PodcastEpisode | null> {
  const episodes = await getPodcastEpisodes();
  return episodes.find((episode) => episode.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Show notes: sanitize + conservative encyclopedia auto-linking
// ---------------------------------------------------------------------------

/**
 * Defensive sanitization of feed HTML before it is rendered on realist.ca
 * (via dangerouslySetInnerHTML). Strips active content and event handlers;
 * keeps basic formatting tags.
 */
export function sanitizeShowNotesHtml(html: string): string {
  let out = html;
  out = out.replace(/<(script|style|iframe|object|embed|form|svg)\b[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<\/?(script|style|iframe|object|embed|form|svg|link|meta|base)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  out = out.replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '$1="#"');
  return out;
}

interface EncyclopediaTerm {
  title: string;
  href: string;
  pattern: RegExp;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longest titles first so "Cap Rate Compression" wins over "Cap Rate". */
let encyclopediaTerms: EncyclopediaTerm[] | null = null;
function getEncyclopediaTerms(): EncyclopediaTerm[] {
  if (!encyclopediaTerms) {
    encyclopediaTerms = encyclopediaGuides
      .filter((guide) => guide.title.length >= 3)
      .map((guide) => ({
        title: guide.title,
        href: `/encyclopedia/${guide.slug}`,
        pattern: new RegExp(`\\b(${escapeRegExp(guide.title)})\\b`, "i"),
      }))
      .sort((a, b) => b.title.length - a.title.length);
  }
  return encyclopediaTerms;
}

/**
 * Conservatively auto-link encyclopedia terms inside show-notes HTML:
 * exact-term (word boundary) matches only, first occurrence per term, never
 * inside existing anchors or headings, at most `maxLinks` per episode.
 */
export function linkEncyclopediaTerms(html: string, maxLinks = 5): string {
  const terms = getEncyclopediaTerms();
  const parts = html.split(/(<[^>]+>)/g);
  const linkedTerms = new Set<string>();
  let linksAdded = 0;
  let anchorDepth = 0;
  let headingDepth = 0;

  const out = parts.map((part) => {
    if (part.startsWith("<")) {
      if (/^<a[\s>]/i.test(part)) anchorDepth += 1;
      else if (/^<\/a\s*>/i.test(part)) anchorDepth = Math.max(0, anchorDepth - 1);
      else if (/^<h[1-6][\s>]/i.test(part)) headingDepth += 1;
      else if (/^<\/h[1-6]\s*>/i.test(part)) headingDepth = Math.max(0, headingDepth - 1);
      return part;
    }
    if (anchorDepth > 0 || headingDepth > 0 || linksAdded >= maxLinks || !part.trim()) return part;

    let text = part;
    for (const term of terms) {
      if (linksAdded >= maxLinks) break;
      if (linkedTerms.has(term.href)) continue;
      const match = term.pattern.exec(text);
      if (!match) continue;
      const start = match.index;
      const end = start + match[1].length;
      text = `${text.slice(0, start)}<a href="${term.href}">${match[1]}</a>${text.slice(end)}`;
      linkedTerms.add(term.href);
      linksAdded += 1;
    }
    return text;
  });

  return out.join("");
}

/** Plain-text version of show notes (for meta descriptions / JSON-LD). */
export function stripShowNotes(html: string, maxLength = 300): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}

/** itunes:duration ("HH:MM:SS", "MM:SS", or seconds) → ISO 8601 (PT…). */
export function durationToIso8601(duration: string): string | null {
  if (!duration) return null;
  let totalSeconds: number;
  if (/^\d+$/.test(duration.trim())) {
    totalSeconds = parseInt(duration.trim(), 10);
  } else {
    const segments = duration.split(":").map((s) => parseInt(s, 10));
    if (segments.some((n) => isNaN(n))) return null;
    totalSeconds = segments.reduce((acc, n) => acc * 60 + n, 0);
  }
  if (!totalSeconds || totalSeconds <= 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${seconds ? `${seconds}S` : ""}` || null;
}

// ---------------------------------------------------------------------------
// Related episodes
// ---------------------------------------------------------------------------

/**
 * Episodes sharing at least one derived topic (newest first), padded with
 * date-adjacent neighbours from the feed when topic matches run short.
 */
export function getRelatedEpisodes(
  episode: PodcastEpisode,
  episodes: PodcastEpisode[],
  limit = 4,
): RelatedEpisode[] {
  const topics = new Set(deriveEpisodeTopics(episode.title));
  const related: PodcastEpisode[] = [];

  if (topics.size > 0) {
    for (const candidate of episodes) {
      if (candidate.slug === episode.slug) continue;
      if (deriveEpisodeTopics(candidate.title).some((topic) => topics.has(topic))) {
        related.push(candidate);
        if (related.length >= limit) break;
      }
    }
  }

  if (related.length < limit) {
    const index = episodes.findIndex((candidate) => candidate.slug === episode.slug);
    for (let offset = 1; related.length < limit && offset < episodes.length; offset++) {
      for (const neighbourIndex of [index - offset, index + offset]) {
        if (related.length >= limit) break;
        const neighbour = episodes[neighbourIndex];
        if (!neighbour || neighbour.slug === episode.slug) continue;
        if (!related.some((item) => item.slug === neighbour.slug)) related.push(neighbour);
      }
    }
  }

  return related.slice(0, limit).map(({ slug, title, pubDate }) => ({ slug, title, pubDate }));
}

// ---------------------------------------------------------------------------
// Enrichment (AI summary + takeaways + related chart), stored in Postgres
// ---------------------------------------------------------------------------

export interface PodcastEpisodeEnrichment {
  summaryHtml?: string;
  keyTakeaways?: string[];
  /** Slug of a stats.realist.ca chart or /research report related to the episode. */
  relatedResearch?: Array<{ href: string; label: string }>;
}

/**
 * Enrichment hook: the podcast cron writes an `episode_enrichments` row per
 * new episode (AI summary, key takeaways, related research links); this reads
 * it back for the page payload and JSON-LD. Callers must treat null as "no
 * enrichment" — the page renders a complete document without it.
 */
export async function getEpisodeEnrichment(slug: string): Promise<PodcastEpisodeEnrichment | null> {
  try {
    const { getEpisodeEnrichmentRow } = await import("./enrichmentStore");
    return await getEpisodeEnrichmentRow(slug);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Full page payload
// ---------------------------------------------------------------------------

export async function getEpisodePayload(slug: string): Promise<PodcastEpisodePayload | null> {
  const episodes = await getPodcastEpisodes();
  const episode = episodes.find((item) => item.slug === slug);
  if (!episode) return null;

  const showNotesHtml = linkEncyclopediaTerms(sanitizeShowNotesHtml(episode.description));
  return {
    ...episode,
    showNotesHtml,
    topics: deriveEpisodeTopics(episode.title),
    keywords: deriveEpisodeKeywords(episode.title),
    cta: mapEpisodeCta(episode.title),
    related: getRelatedEpisodes(episode, episodes),
    enrichment: await getEpisodeEnrichment(slug),
  };
}
