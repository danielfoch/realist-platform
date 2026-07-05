/**
 * Shared YouTube video SEO helpers for /insights/videos/:slug.
 *
 * Pure functions only (no fetch, no DOM): stable, collision-safe slug
 * generation, topic/keyword derivation from video titles, the topic→tool CTA
 * mapping, and a "videos published since last check" selector for the
 * downstream content agent / weekly digest. Imported by server/youtubeFeed.ts
 * (feed cache, crawler fallback, sitemap) and the client video page, and
 * unit-tested in shared/youtubeVideos.test.ts.
 *
 * This is the exact analog of shared/podcastEpisodes.ts — the YouTube video
 * equivalent of the podcast episode-pages system. It reuses the podcast slug
 * and topic machinery so both rails behave identically.
 */

import {
  assignEpisodeSlugs,
  deriveEpisodeKeywords,
  deriveEpisodeTopics,
  detectEpisodeCity,
  mapEpisodeCta,
  slugifyEpisodeTitle,
  type EpisodeCta,
  type EpisodeCtaLink,
  type SluggableEpisode,
} from "./podcastEpisodes";

// ---------------------------------------------------------------------------
// Slugs (delegated to the shared, unit-tested podcast slug machinery)
// ---------------------------------------------------------------------------

/**
 * Deterministic video title → slug. Identical rules to the podcast: lowercase,
 * apostrophes removed, "&" → "and", accents stripped, other runs → hyphens.
 */
export function slugifyVideoTitle(title: string): string {
  return slugifyEpisodeTitle(title);
}

export interface SluggableVideo extends SluggableEpisode {
  title: string;
  /** RFC3339 / ISO published timestamp from the Atom feed's <published>. */
  pubDate: string;
}

/**
 * Assign a stable slug to every video in the feed. Same collision rule as the
 * podcast: the OLDEST video in a same-title group keeps the bare slug, newer
 * ones get a -YYYY-MM-DD suffix, then -2/-3 on further collision. Published
 * URLs never change as new videos arrive.
 */
export function assignVideoSlugs<T extends SluggableVideo>(
  videos: T[],
): Array<T & { slug: string }> {
  return assignEpisodeSlugs(videos);
}

// ---------------------------------------------------------------------------
// Topics / keywords (shared with the podcast term dictionary)
// ---------------------------------------------------------------------------

/** Derive a short topics list from a video title. */
export function deriveVideoTopics(title: string, maxTopics = 6): string[] {
  return deriveEpisodeTopics(title, maxTopics);
}

/** Keywords meta line for a video page. */
export function deriveVideoKeywords(title: string): string {
  return [
    ...deriveVideoTopics(title),
    "Canadian real estate",
    "Daniel Foch",
    "real estate investing Canada",
    "YouTube",
  ].join(", ");
}

/** First recognized city in the title, or null (re-exported for callers). */
export function detectVideoCity(title: string) {
  return detectEpisodeCity(title);
}

// ---------------------------------------------------------------------------
// Topic → tool CTA mapping (shared with the podcast)
// ---------------------------------------------------------------------------

export type VideoCta = EpisodeCta;
export type VideoCtaLink = EpisodeCtaLink;

/** Map a video title to its contextual tool CTA (same routing as the podcast). */
export function mapVideoCta(title: string): VideoCta {
  return mapEpisodeCta(title);
}

// ---------------------------------------------------------------------------
// Selection: "videos published since last check"
// ---------------------------------------------------------------------------

export interface SelectableVideo {
  slug: string;
  pubDate: string;
}

/**
 * Videos published strictly after `sinceIso` (newest first), for the content
 * agent / weekly digest that enriches or links new videos. Videos with an
 * unparseable pubDate are excluded (they can't be ordered reliably). When
 * `sinceIso` is missing/unparseable, all videos are returned sorted newest
 * first — the natural "first run" behaviour.
 */
export function selectVideosSince<T extends SelectableVideo>(
  videos: T[],
  sinceIso?: string | null,
): T[] {
  const parse = (value: string): number => {
    const time = new Date(value).getTime();
    return isNaN(time) ? NaN : time;
  };
  const since = sinceIso ? parse(sinceIso) : NaN;

  return videos
    .map((video) => ({ video, time: parse(video.pubDate) }))
    .filter(({ time }) => !isNaN(time) && (isNaN(since) || time > since))
    .sort((a, b) => b.time - a.time)
    .map(({ video }) => video);
}
