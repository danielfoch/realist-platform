# Realist SEO Conventions

PR title: **SEO foundation: indexability, metadata, schema, sitemap, internal linking**

## Rendering model

Realist is an Express + Vite React app, not a Next.js app. Public routes hydrate client-side, while crawler-visible HTML is injected server-side through:

- `server/seoMeta.ts` for titles, descriptions, canonicals, OpenGraph, Twitter tags, RSS alternate links, and JSON-LD.
- `server/seoRender.ts` for initial HTML body content on priority public routes.
- `server/sitemap.ts` for sitemap generation.

New public pages should either have meaningful static HTML in `server/seoRender.ts` or otherwise be safe to index from the initial server response.

## Metadata rules

- Use canonical non-www URLs: `https://realist.ca/path`.
- Use lowercase paths with no trailing slash except `/`.
- Strip tracking query params from canonical URLs.
- Title pattern: `{Page Topic} | Realist`, target 60 characters or less.
- Description target: 140-160 characters, include the primary keyword and a next action.
- Add an RSS alternate link for blog/report surfaces.

## Structured data

Sitewide server responses include:

- `Organization`
- `WebSite` with `SearchAction`

Content pages should add:

- Reports: `Report` or `Article`, plus `Dataset` where data is cited.
- Podcast: `PodcastSeries` and `PodcastEpisode` when episode URLs exist.
- FAQ sections: `FAQPage`.
- Non-home pages: `BreadcrumbList`.

Validate changed templates with Schema.org validator and Google's Rich Results Test before release.

## Sitemaps

The master sitemap is `/sitemap.xml` and indexes:

- `/sitemap-pages.xml`
- `/sitemap-reports.xml`
- `/sitemap-podcast.xml`

Report and guide URLs should use DB `updatedAt` or `publishedAt` as `lastmod`.

## Manual Google Search Console actions after merge

- Remove any submitted `https://www.realist.ca/sitemap.xml`.
- Submit `https://realist.ca/sitemap.xml`.
- Request indexing for the top fixed URLs: `/`, `/reports`, `/markets`, `/investing`, `/insights/cpi-march-2026`, `/insights/spring-economic-update-2026`, `/insights/market-report`, `/markets/toronto`, `/reports/cmhc-land-use-regulations-housing-canada-2026`, and `/insights/podcast`.
- Validate fixes for `Discovered - currently not indexed`.
- Validate fixes for `Crawled - currently not indexed`.
- Validate duplicate/canonical fixes after Google recrawls normalized URLs.
- Register/maintain Realist's brand entity signals for Knowledge Graph using official social profiles, logo, Organization schema, and consistent business information.

## Before/After Tracking Template

| Metric | Before | After |
| --- | ---: | ---: |
| Indexable routes in sitemap | 151 | Check `/sitemap-*.xml` after deploy |
| Pages with unique title + description | Partial | Server metadata for public route groups |
| Pages with JSON-LD | Homepage 0, reports partial | Sitewide Organization/WebSite, reports, breadcrumbs |
| Avg homepage HTML text length | ~1,400 chars | Target >5,000 chars |
| Avg report HTML text length | Good | Full content + related/latest links |
| Avg market page text length | Thin | Expanded fallback with methodology and update date |
