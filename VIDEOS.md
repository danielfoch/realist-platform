# YouTube Video Pages (`/insights/videos`)

Auto-generated, crawlable video pages for Daniel Foch's YouTube channel
(<https://www.youtube.com/@daniel_foch>). This is the exact mirror of the
podcast episode-pages system — same shape, same caching, same SEO/sitemap
treatment — for video content.

## Channel id — how it is resolved & configured

YouTube publishes a **keyless** per-channel Atom feed:

```
https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>
```

The `@daniel_foch` handle was resolved to its channel id **once**, from the
handle page's canonical `channel/UC…` link:

```sh
curl -s https://www.youtube.com/@daniel_foch \
  | grep -oE 'channel/UC[a-zA-Z0-9_-]{22}'
# → UCeULGvCIbLn4eMpg-uGYkzQ
```

That id is hardcoded as the default in `shared/brand.ts`
(`YOUTUBE_DEFAULT_CHANNEL_ID`). Override it with the **`YOUTUBE_CHANNEL_ID`**
env var if the channel ever moves — `server/youtubeFeed.ts#getChannelId()` reads
the env first and falls back to the default. No API key is required; the Atom
feed is public, exactly like the podcast RSS feed.

## Caching

`server/youtubeFeed.ts` fetches + parses the Atom feed once and caches it
**in memory for 1 hour** (`FEED_TTL_MS`), with a deduped in-flight fetch and
**stale-on-error** (a failed refresh serves the last good cache). No database
tables — the content is feed-driven, like the podcast. The Atom feed returns
the ~15 most recent videos.

## What each page contains

- Responsive YouTube embed (`youtube-nocookie.com`), H1 title, full description,
  published date, a "Watch on YouTube" link, and a contextual Deal Analyzer /
  Cap Rate CTA.
- Server-rendered `VideoObject` + `BreadcrumbList` JSON-LD (`server/seoMeta.ts`).
- A crawler fallback (`server/seoRender.ts`) that contains the **description
  text and a link**, not just the iframe.
- A `sitemap-videos.xml` entry with the real `uploadDate` as `lastmod`,
  registered in the sitemap index.

## Enrichment seam

`server/youtubeFeed.ts#getVideoSummary(video)` returns the feed description
today. This is the seam where a **downstream content agent** can later enrich
*select* videos into full reports via the report-content system (see
`getVideoEnrichment()` for the by-slug hook). This module is intentionally **not
coupled** to the report-content system — the enrichment plugs in here without
changing the feed rail. `shared/youtubeVideos.ts#selectVideosSince()` gives that
agent (and the weekly digest) a "videos published since last check" selector.

## Endpoints / routes

- `GET /api/youtube/videos` — cached list (returns `slug`).
- `GET /api/youtube/videos/:slug` — full page payload.
- `/insights/videos` (hub) and `/insights/videos/:slug` (detail) — client routes.
- `/sitemap-videos.xml`.
