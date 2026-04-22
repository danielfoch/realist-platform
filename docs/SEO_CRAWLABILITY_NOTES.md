## SEO Crawlability Notes

This sprint adds a content-first crawl layer on top of the existing SPA.

### What changed
- Added server-injected HTML fallback content for high-value routes before the React root mounts
- Added stable SEO routes:
  - `/reports`
  - `/reports/:slug`
  - `/markets`
  - `/markets/:city`
  - `/investing`
  - `/investing/:strategy`
- Added dynamic `robots.txt`
- Expanded `sitemap.xml` to include reports, markets, and strategy pages
- Added canonical consolidation for report-like blog content under `/reports/:slug`

### Important implementation detail
- The fallback HTML lives in `#seo-static-fallback`
- JavaScript hides that fallback immediately in browsers so product UX stays app-like
- Without JavaScript, crawlers and users still receive meaningful HTML content and links

### Current indexable surfaces
- Homepage
- Reports hub and report detail pages
- Blog hub
- Guides hub and guide detail pages
- Programmatic market pages
- Programmatic strategy pages
- Selected high-value data pages with content-first summaries

### Still mostly app-first
- Deal analyzer
- Distress browser interactive state
- Cap rates interactive state
- Listing-level property pages

### Next SEO opportunities
- Generate server-side summaries for more interactive data pages
- Create market-specific report archives
- Add parcel/property pages when data quality and deduplication are strong enough
- Move from injected fallback HTML to true route-level SSR if the app architecture shifts that way
