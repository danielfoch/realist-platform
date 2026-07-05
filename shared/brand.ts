/**
 * Single source of truth for Realist.ca brand entities and social handles.
 *
 * Imported by both the server meta layer (server/seoMeta.ts) and the client
 * SEO component (client/src/components/SEO.tsx) so the Organization schema
 * can never diverge between the two rendered documents again.
 *
 * ENTITY MODEL (read before editing):
 * - The Canadian Real Estate Investor (CREI, hosted by Daniel Foch & Nick
 *   Hill) is part of The Canadian Investor Podcast Network. The show SHARES
 *   the network's YouTube/Instagram/TikTok channels — those network handles
 *   belong on the PodcastSeries sameAs.
 * - The Realist Organization node carries only Realist-owned handles; it is
 *   connected to the show through the schema graph (publisher/author
 *   relations), not by claiming the network's channels as its own identity.
 * - Do not confuse CREI with "The Canadian Investor" (the network's stock
 *   investing show, Braden Dennis & Simon Belanger) — different show, same
 *   network.
 */

export const BRAND_BASE_URL = "https://realist.ca";

export const PODCAST_NAME = "The Canadian Real Estate Investor";

/** Verified Apple Podcasts show URL. */
export const PODCAST_APPLE_URL =
  "https://podcasts.apple.com/ca/podcast/the-canadian-real-estate-investor/id1634197127";

/** Verified Spotify show URL. */
export const PODCAST_SPOTIFY_URL =
  "https://open.spotify.com/show/6wcDGtXn8Pa7K02l2Ujd3g";

/** Shared Canadian Investor Podcast Network YouTube channel (CREI episodes live here). */
export const PODCAST_YOUTUBE_URL = "https://www.youtube.com/@TCIPodcastNetwork";

/** Shared network Instagram. */
export const PODCAST_INSTAGRAM_URL = "https://www.instagram.com/tcipodcast.ca/";

/** Shared network TikTok. */
export const PODCAST_TIKTOK_URL = "https://www.tiktok.com/@tcipodcast.ca";

/** Omny-hosted RSS feed for the show (also consumed by /api/podcast/episodes). */
export const PODCAST_RSS_URL =
  "https://www.omnycontent.com/d/playlist/d75d2ff4-a4dd-4a19-bcb1-ad35013dfc83/1d7b066c-9af2-431a-bea7-aecd01493da3/69cdac4f-3b2e-45b4-ae6f-aecd0152873d/podcast.rss";

export const PODCAST_SUBSTACK_URL =
  "https://thecanadianrealestateinvestor.substack.com/";

// ---------------------------------------------------------------------------
// YouTube channel (Daniel Foch — https://www.youtube.com/@daniel_foch)
// ---------------------------------------------------------------------------

/**
 * Daniel Foch's YouTube channel id, resolved ONCE from the @daniel_foch handle
 * page (the canonical `channel/UC…` link / `"channelId"` field) and hardcoded
 * here as the default. Override with the YOUTUBE_CHANNEL_ID env var if the
 * channel ever moves. YouTube publishes a keyless per-channel Atom feed keyed
 * on this id (see YOUTUBE_FEED_URL). Resolution method, for the record:
 *   curl -s https://www.youtube.com/@daniel_foch \
 *     | grep -oE 'channel/UC[a-zA-Z0-9_-]{22}'
 */
export const YOUTUBE_DEFAULT_CHANNEL_ID = "UCeULGvCIbLn4eMpg-uGYkzQ";

export const YOUTUBE_HANDLE = "@daniel_foch";
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@daniel_foch";

/** Keyless per-channel Atom feed (~15 most recent videos). */
export function youtubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/** sameAs set for the PodcastSeries node (show + shared network channels). */
export const PODCAST_SAME_AS = [
  PODCAST_APPLE_URL,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
  PODCAST_INSTAGRAM_URL,
  PODCAST_TIKTOK_URL,
  PODCAST_SUBSTACK_URL,
];

/** sameAs set for the single Realist Organization node (Realist-owned only). */
export const ORGANIZATION_SAME_AS = [
  "https://twitter.com/RealistCA",
  "https://www.instagram.com/realist.ca/",
];
