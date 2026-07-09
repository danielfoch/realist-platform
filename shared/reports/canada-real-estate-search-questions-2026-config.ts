import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const GSC_URL =
  "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Arealist.ca";
const NOTION_EPISODE_URL =
  "https://app.notion.com/p/The-9-Most-Googled-Real-Estate-Questions-of-2026-39577b52a03d80448b09f66d61945539";
const REALIST_REPORT_ROUTE = "/insights/reports/canada-real-estate-search-questions-2026";

export const canadaRealEstateSearchQuestions2026ConfigReport: ReportContent = {
  slug: "canada-real-estate-search-questions-2026",
  title: "The Real Estate Questions Canadians Are Googling in 2026",
  dek:
    "A Search Console companion to the Realist podcast episode on the nine real estate questions buyers, owners, and investors keep asking. The data shows where Realist already has demand, where Canadians are searching, and where the next useful tools should be built.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-07-09",
  kind: "research",
  tags: [
    "google-search-console",
    "seo",
    "canadian-real-estate",
    "mortgage-renewals",
    "rent-vs-buy",
    "real-estate-investing",
  ],
  ogImage: "/og-image.png",
  metaTitle: "The Real Estate Questions Canadians Are Googling in 2026 | Realist",
  metaDescription:
    "Realist Search Console report mapping Canada's real estate search demand to the nine most asked housing questions of 2026, with interactive charts for prices, rent-vs-buy, cap rates, renewals, and investor tax topics.",
  heroStat: {
    label: "Realist.ca clicks from Canada",
    value: "95%",
    detail:
      "543 of 570 Google Search Console clicks came from Canada in the Apr. 21 to Jul. 6, 2026 export window.",
  },
  sections: [
    {
      type: "statGrid",
      id: "headline-stats",
      heading: "The Search Console read",
      stats: [
        {
          label: "Canada clicks",
          value: "543",
          detail: "Out of 570 total clicks in the exported Search Console window.",
          trend: "up",
        },
        {
          label: "Canada impressions",
          value: "8.7K",
          detail: "Canada generated 8,748 of 13,738 impressions.",
          trend: "up",
        },
        {
          label: "Query rows",
          value: "650",
          detail: "Queries exported from Google Search Console for realist.ca.",
          trend: "flat",
        },
        {
          label: "Branded/tool clicks",
          value: "277",
          detail: "Realist and deal-tool queries still drive most captured search traffic.",
          trend: "up",
        },
        {
          label: "Home-price impressions",
          value: "185",
          detail: "Largest non-branded episode theme visible in Realist's current query data.",
          trend: "up",
        },
        {
          label: "Current content gap",
          value: "0 clicks",
          detail: "Rent-vs-buy, cap-rate, tax, and renewal themes show impressions but no captured clicks yet.",
          trend: "down",
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      id: "method-note",
      heading: "Method note",
      body:
        "This is not a national Google Trends dataset. It is Realist.ca's own Google Search Console export for Apr. 21 to Jul. 6, 2026. Because Canada accounts for **95% of clicks** and **64% of impressions** in the export, it is useful as a Canada-heavy demand signal. Low or missing query counts mean Realist does not yet have visibility for that topic, not that Canadians are not searching for it.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "country-mix",
      title: "Realist's organic search traffic is overwhelmingly Canadian",
      caption:
        "Google Search Console country tab for realist.ca, Apr. 21 to Jul. 6, 2026. Rest of world is total export minus the visible top country rows.",
      xKey: "country",
      yAxisLabel: "Search Console count",
      format: "number",
      series: [
        { key: "clicks", label: "Clicks", color: "#800000" },
        { key: "impressions", label: "Impressions", color: "#55565b" },
      ],
      data: [
        { country: "Canada", clicks: 543, impressions: 8748 },
        { country: "United States", clicks: 13, impressions: 3325 },
        { country: "India", clicks: 2, impressions: 130 },
        { country: "Italy", clicks: 2, impressions: 31 },
        { country: "Rest of world", clicks: 10, impressions: 1504 },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line",
      body:
        "The episode is asking the right questions. Search Console says Realist already has two things working: a brand/search-navigation base and early product demand around deal analysis.\n\nThe opportunity is the gap between what Canadians are asking and what Realist currently ranks for. The clearest non-branded surface is home prices and market direction. The more valuable product surfaces are rent-vs-buy, cap rates, cash-flow cities, mortgage renewal stress, principal residence tax, incorporation, Airbnb rules, and 30-year amortization.\n\nThat is the strategy: answer the episode questions in public, attach them to calculators and deal tools, then let the search demand feed back into product decisions.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "episode-theme-demand",
      title: "Episode themes mapped to Realist search visibility",
      caption:
        "Queries were grouped manually from the 650 exported Search Console rows. Realist/tool queries are included as a control to show the difference between existing demand and content whitespace.",
      xKey: "theme",
      yAxisLabel: "Impressions",
      format: "number",
      series: [
        { key: "impressions", label: "Impressions", color: "#800000" },
        { key: "clicks", label: "Clicks", color: "#d04a06" },
      ],
      data: [
        { theme: "Realist / deal tools", impressions: 3941, clicks: 277 },
        { theme: "Home prices", impressions: 185, clicks: 0 },
        { theme: "Cash flow / cap rates", impressions: 48, clicks: 0 },
        { theme: "Rent vs buy", impressions: 33, clicks: 0 },
        { theme: "Rates / renewals", impressions: 4, clicks: 0 },
        { theme: "PRE / capital gains", impressions: 4, clicks: 0 },
        { theme: "Rental incorporation", impressions: 0, clicks: 0 },
        { theme: "Airbnb / STR rules", impressions: 0, clicks: 0 },
        { theme: "30-year amortization", impressions: 0, clicks: 0 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "average-position-by-theme",
      title: "Average position by theme: lower is better",
      caption:
        "Mortgage/rate queries rank well but have tiny volume in the current export. Home-price queries have the cleanest visible non-branded opportunity.",
      xKey: "theme",
      yAxisLabel: "Average Google position",
      format: "number",
      referenceLine: { value: 10, label: "First-page cutoff" },
      series: [{ key: "position", label: "Average position", color: "#800000" }],
      data: [
        { theme: "Rates / renewals", position: 1.2 },
        { theme: "Realist / deal tools", position: 4.2 },
        { theme: "Home prices", position: 7.2 },
        { theme: "Rent vs buy", position: 28.2 },
        { theme: "Cash flow / cap rates", position: 31.7 },
        { theme: "PRE / capital gains", position: 45.5 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "query-examples",
      title: "The query examples behind the content roadmap",
      caption:
        "Selected exported queries that map to the episode. Branded queries are excluded here so the content gaps are easier to see.",
      xKey: "query",
      yAxisLabel: "Impressions",
      format: "number",
      series: [
        { key: "impressions", label: "Impressions", color: "#800000" },
        { key: "position", label: "Average position", color: "#55565b" },
      ],
      data: [
        { query: "CREA MLS HPI Mar 2026 Canada", impressions: 61, position: 4.8 },
        { query: "Real estate deal analyzer", impressions: 56, position: 25.9 },
        { query: "Toronto rental yield", impressions: 31, position: 34.8 },
        { query: "Rent vs buy calculator", impressions: 16, position: 9.3 },
        { query: "Cap rates by city", impressions: 4, position: 14.3 },
        { query: "Mortgage rate predictions 2026", impressions: 1, position: 1 },
        { query: "Principal residence tax exemption", impressions: 1, position: 50 },
      ],
    },
    {
      type: "narrative",
      id: "nine-questions",
      heading: "The nine questions and what Realist should answer",
      body:
        "## 1. Fixed or variable in 2026?\nThe search signal is small in this export, but the user intent is high value. This should be handled as a renewal and payment-risk guide, not a generic rate forecast. The useful answer is scenario math: fixed payment certainty, variable flexibility, break penalties, renewal timing, and downside cash-flow stress.\n\n## 2. I cannot afford my renewal. What do I do?\nThis is a homeowner distress workflow, not an article. Realist should give people a renewal triage path: refinance, extend amortization where available, sell, rent out part of the home, cut debt, or talk to a broker before missing payments. The content should route into tools and expert help.\n\n## 3. Will house prices go down in 2026?\nThis is the clearest existing non-branded opportunity. Realist already appears around CREA home-price-index queries. The answer should separate national headlines from local bid-ask spreads, inventory, buyer payment capacity, and forced-seller pressure.\n\n## 4. Which Canadian city has the best cash flow right now?\nThe current visibility is weak, but the intent is exactly Realist's lane. Searchers do not need a vibes list. They need cap rate, rent, price, tax, insurance, vacancy, rent-control, and liquidity side by side.\n\n## 5. Should I incorporate my rental properties?\nNo visibility showed up in the current export. That is a greenfield investor SEO page. The correct answer is not always yes: legal liability, financing friction, accounting costs, passive investment income rules, tax integration, estate planning, and scale all matter.\n\n## 6. Can I still Airbnb my secondary property?\nNo visibility showed up in the current export, but this is a rules-and-by-law topic that changes by municipality. The Realist angle should be a local rules screen: zoning, licensing, principal-residence rules, condo rules, insurance, and enforcement risk.\n\n## 7. How do I maximize the principal residence exemption?\nRealist has almost no current visibility here. The opportunity is a plain-English guide that does not pretend to be tax advice: designation years, change-in-use, cottages, rental suites, record keeping, spouse/partner planning, and when to call an accountant.\n\n## 8. Is it cheaper to rent or buy right now?\nThis already shows up through rent-vs-buy calculator queries. The page should be a tool first, article second. Searchers need a payment comparison, unrecoverable cost comparison, investment return assumption, closing costs, maintenance, and time horizon.\n\n## 9. What is the deal with 30-year amortization for first-time buyers?\nNo current visibility appeared in this export, which means Realist should create the explainer before the search surface gets crowded. The useful answer is monthly-payment relief versus more interest, price support for sellers, and who actually qualifies.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "content-priority",
      title: "Content priority score",
      caption:
        "Operator score based on current Search Console visibility, commercial value, and fit with Realist tools. A high score means build or refresh the page first.",
      xKey: "topic",
      yAxisLabel: "Priority score / 100",
      format: "number",
      referenceLine: { value: 75, label: "Build now" },
      series: [{ key: "score", label: "Priority score", color: "#800000" }],
      data: [
        { topic: "Home prices 2026", score: 92 },
        { topic: "Rent vs buy calculator", score: 88 },
        { topic: "Cash-flow cities", score: 84 },
        { topic: "Renewal triage", score: 80 },
        { topic: "30-year amortization", score: 74 },
        { topic: "PRE / capital gains", score: 70 },
        { topic: "Airbnb rules", score: 66 },
        { topic: "Rental incorporation", score: 62 },
      ],
    },
    {
      type: "callout",
      tone: "info",
      id: "realist-read",
      heading: "The Realist read",
      body:
        "The audience is not asking one question. They are trying to make a decision under uncertainty: renew, buy, rent, sell, incorporate, Airbnb, hold, or invest somewhere else. The winning Realist page is not the page with the most keywords. It is the page that answers the question and then gives the user a tool to finish the decision.",
    },
    {
      type: "narrative",
      id: "build-plan",
      heading: "The companion content plan",
      body:
        "The next version of this episode companion should become a hub.\n\n- Create one permanent hub page for the nine questions.\n- Turn rent-vs-buy into an embedded calculator path.\n- Attach cash-flow-city questions to cap-rate and rental-yield data.\n- Build a renewal triage tool that starts with payment shock.\n- Add local Airbnb rule screens where data is available.\n- Build a principal-residence-exemption checklist with accountant referral prompts.\n- Refresh the page monthly with new Search Console query examples.\n\nThat is the feedback loop: podcast creates demand, search data shows the questions, tools answer the questions, and user behaviour tells Realist what to build next.",
    },
  ],
  sources: [
    {
      label: "Google Search Console export for realist.ca, Apr. 21 to Jul. 6, 2026",
      url: GSC_URL,
      publisher: "Google Search Console",
    },
    {
      label: "The 9 Most Googled Real Estate Questions of 2026",
      url: NOTION_EPISODE_URL,
      publisher: "Realist podcast draft",
    },
    {
      label: "Realist report route",
      url: REALIST_REPORT_ROUTE,
      publisher: "Realist.ca",
    },
  ],
  cta: {
    toolUrl: "/tools/analyzer",
    headline: "Turn the question into an underwriting decision.",
    body:
      "Use Realist to test the deal, compare the rent-vs-buy math, pressure-check cash flow, and route the question to the right expert before making a real estate decision.",
  },
};
