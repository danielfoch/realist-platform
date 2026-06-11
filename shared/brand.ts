/**
 * Single source of truth for Realist.ca brand entities and owned social handles.
 *
 * Imported by both the server meta layer (server/seoMeta.ts) and the client
 * SEO component (client/src/components/SEO.tsx) so the Organization schema
 * can never diverge between the two rendered documents again.
 *
 * IMPORTANT: these are the handles for The Canadian Real Estate Investor
 * podcast (Daniel Foch & Nick Hill). Do NOT use @TheCanadianInvestorPodcast
 * handles — those belong to The Canadian Investor, a different (stock
 * investing) podcast.
 */

export const BRAND_BASE_URL = "https://realist.ca";

export const PODCAST_NAME = "The Canadian Real Estate Investor";

/** Verified Apple Podcasts show URL. */
export const PODCAST_APPLE_URL =
  "https://podcasts.apple.com/ca/podcast/the-canadian-real-estate-investor/id1634197127";

/** Verified Spotify show URL. */
export const PODCAST_SPOTIFY_URL =
  "https://open.spotify.com/show/6wcDGtXn8Pa7K02l2Ujd3g";

/** Realist / CREI YouTube channel. */
export const PODCAST_YOUTUBE_URL =
  "https://www.youtube.com/@CanadianRealEstateInvestor";

/** Omny-hosted RSS feed for the show (also consumed by /api/podcast/episodes). */
export const PODCAST_RSS_URL =
  "https://www.omnycontent.com/d/playlist/d75d2ff4-a4dd-4a19-bcb1-ad35013dfc83/1d7b066c-9af2-431a-bea7-aecd01493da3/69cdac4f-3b2e-45b4-ae6f-aecd0152873d/podcast.rss";

export const PODCAST_SUBSTACK_URL =
  "https://thecanadianrealestateinvestor.substack.com/";

/** sameAs set for the PodcastSeries node. */
export const PODCAST_SAME_AS = [
  PODCAST_APPLE_URL,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
];

/** sameAs set for the single Organization node (owned handles only). */
export const ORGANIZATION_SAME_AS = [
  PODCAST_YOUTUBE_URL,
  "https://twitter.com/RealistCA",
  "https://www.instagram.com/realist.ca/",
  PODCAST_SUBSTACK_URL,
  PODCAST_APPLE_URL,
  PODCAST_SPOTIFY_URL,
];
