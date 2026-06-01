---
name: StatCan / macro report pattern
description: How to add a new Realist.ca market-report blog post and the data-accuracy rules for recreated charts.
---

Adding a new macro/StatCan report blog post requires three coordinated edits:
1. New page `client/src/pages/<Name>Report.tsx` — copy the structure of `LabourForceSurveyApril2026Report.tsx` (default export, Navigation, SEO with NewsArticle structuredData, back-link to `/insights/market-report`, hero, Four Key Takeaways, Numbers at a Glance, "The Data, Visualized" recharts grid, narrative, 5-tab Real Estate Implications, Put-This-to-Work CTAs, footer with source). Greens `#16a34a`, reds `#dc2626`, primary `hsl(var(--primary))`. data-testid everywhere.
2. Register route + import in `client/src/App.tsx` (insight routes block; import near the other report imports).
3. Add a card in `client/src/pages/MarketReport.tsx` "Canadian Macro Reports" grid (grid starts ~line 435). Only use lucide icons already imported there (e.g. BarChart3, FileText, AlertTriangle, Landmark, Users) or add the import.

**Why / accuracy rule:** these are public, SEO-indexed data reports, so fabricated numbers are a real trust problem. When recreating charts from a StatCan "Daily" release (which publishes images, not raw series): only the most-recent quarter and any figure quoted in the release *text* are exact. Mark earlier trend-chart quarters as illustrative. Do NOT invent per-province values when the source states only a range — show just the stated endpoints + national. Add a provenance note under the charts and avoid absolute "all charts recreated" claims.
