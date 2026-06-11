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

/** sameAs set for the PodcastSeries node (show + shared network channels). */
export const PODCAST_SAME_AS = [
  PODCAST_APPLE_URL,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
  PODCAST_INSTAGRAM_URL,
  PODCAST_TIKTOK_URL,
  PODCAST_SUBSTACK_URL,
];

/**
 * sameAs for the single Realist Organization node. Realist has NO owned
 * social handles yet (confirmed by Dan 2026-06-11 — @RealistCA and
 * instagram.com/realist.ca do not exist). Add real ones when created;
 * NEVER invent handles here, wrong sameAs is worse than none.
 */
export const ORGANIZATION_SAME_AS: string[] = [];

/**
 * Daniel Foch's personal handles — high personal search volume ("daniel
 * foch"); attached to his Person node (founder of Realist, host of CREI).
 */
export const DANIEL_FOCH_SAME_AS = [
  "https://x.com/danielfoch",
  "https://www.instagram.com/danielfoch/",
];
