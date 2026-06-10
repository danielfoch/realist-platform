---
name: StatCan / macro report pattern
description: How to add a new Realist.ca market-report blog post and the data-accuracy rules for recreated charts.
---

Adding a new macro/news report blog post is three coordinated edits: a new report page under `client/src/pages`, a route + import registration in the app router, and a card in the "Canadian Macro Reports" grid on the market-report page. Copy the newest existing report page as the structural template rather than reinventing the layout.

**Why / accuracy rule (the durable part):** these are public, SEO-indexed data reports, so fabricated numbers are a real trust problem. When recreating charts from a source that publishes chart *images* (StatCan "Daily" releases, Bloomberg/news graphics — which are also copyrighted, so rebuild them, never embed): only the most-recent data point and any figure quoted in the source *text* are exact. Mark earlier trend points as illustrative. Do NOT invent per-region values when the source states only a national figure plus a range — show just the stated endpoints. Always add a provenance note under the charts, state in the chart intro that historical points are illustrative, and avoid absolute "all charts recreated" claims.
**How to apply:** kicks in for any `/insights/...` data-report page built from an external article or statistical release.
