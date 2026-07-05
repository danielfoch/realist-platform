/**
 * Example config report: Interprovincial Migration (Fraser Institute 1995-2024).
 *
 * This is a CONFIG reproduction of the bespoke
 * client/src/pages/InterprovincialMigrationCanada2026Report.tsx — same genuine
 * Fraser Institute data, expressed as a typed ReportContent object with NO
 * React. It proves parity: the bespoke original stays untouched at
 * /insights/canada-interprovincial-migration-2026; this config version renders
 * at /insights/reports/interprovincial-migration-fraser-1995-2024 through
 * ReportRenderer.
 *
 * To publish a new report, copy this file, edit the data, and add it to the
 * `reports` array in shared/reports/index.ts. No React, no route, no bespoke
 * registry entry — the index auto-maps it into shared/reportsRegistry.ts.
 */
import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const FRASER_STUDY_URL =
  "https://www.fraserinstitute.org/studies/interprovincial-migration-in-canada-1995-2024-what-do-the-numbers-tell-us";
const FRASER_PDF_URL =
  "https://www.fraserinstitute.org/sites/default/files/2026-06/interprovincial-migration-in-canada-1995-2024.pdf";
const HUB_ARTICLE_URL =
  "https://thehub.ca/2026/06/11/alberta-gained-539000-residents-ontario-lost-168000-from-canadian-residents-moving-provinces-over-the-past-3-decades/";

export const interprovincialMigrationConfigReport: ReportContent = {
  slug: "interprovincial-migration-fraser-1995-2024",
  title: "Interprovincial Migration 1995-2024: Alberta Wins, Ontario Bleeds",
  dek: "A new Fraser Institute study on interprovincial migration from 1995/96 to 2024/25 shows Alberta as Canada's clear long-run winner for domestic migration, while Ontario and Quebec posted the largest net losses. For housing investors, the signal is straightforward: people keep moving toward provinces that still offer some combination of jobs, affordability, and room to build.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-06-12",
  kind: "research",
  tags: ["migration", "alberta", "ontario", "demographics", "config-report"],
  ogImage: "/og-image.png",
  metaTitle: "Interprovincial Migration 1995-2024: Alberta Wins, Ontario Loses | Realist",
  metaDescription:
    "Fraser Institute's 1995/96-2024/25 interprovincial migration study as an investor report: 30-year net flows by province, age-group breakdowns, the biggest corridors, and housing implications.",
  heroStat: {
    label: "Alberta net interprovincial gain, 1995/96-2024/25",
    value: "+538,824",
    detail: "More than double British Columbia's +214,883 — and the only province with net inflows from every other province.",
  },
  sections: [
    {
      type: "narrative",
      id: "overview",
      heading: "Three decades of domestic migration in one chart",
      body:
        "Statistics Canada tracks where Canadians move **between provinces** — not immigration, but the internal reshuffling of people who already live here. The Fraser Institute added up 30 years of those flows (1995/96 through 2024/25) and the pattern is stark.\n\nAlberta is the runaway winner: a net gain of 538,824 residents from the rest of Canada. British Columbia is a distant second. Every other large province — Ontario, Quebec, Manitoba, Saskatchewan — was a net donor over the period, sending more people out than they took in.\n\nFor real estate investors, domestic migration is one of the cleanest demand-side signals available: people move at their own expense, toward jobs and affordability, and those decisions show up in rents and prices with a lag.",
    },
    {
      type: "statGrid",
      id: "headline-stats",
      heading: "The 30-year scoreboard",
      stats: [
        { label: "Alberta net gain", value: "+538,824", trend: "up" },
        { label: "BC net gain", value: "+214,883", trend: "up" },
        { label: "Ontario net loss", value: "-168,166", trend: "down" },
        { label: "Quebec net loss", value: "-255,988", trend: "down" },
        { label: "Alberta 18-24 gain", value: "+192,329", trend: "up", detail: "Young adults moved west" },
        { label: "NL 18-24 net loss", value: "-97.3%", trend: "down", detail: "vs. its 2025 population aged 18-24" },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "net-by-province",
      title: "Net interprovincial migration by province, 1995/96-2024/25",
      caption:
        "Net migrants (in-migrants minus out-migrants) summed over 30 years. Positive = the province gained residents from the rest of Canada. Source: Statistics Canada / Fraser Institute.",
      xKey: "province",
      yAxisLabel: "Net migrants",
      format: "number",
      series: [{ key: "net", label: "Net migrants" }],
      referenceLine: { value: 0, label: "Break-even" },
      data: [
        { province: "AB", net: 538824 },
        { province: "BC", net: 214883 },
        { province: "NS", net: 23299 },
        { province: "PE", net: 4335 },
        { province: "NB", net: -5862 },
        { province: "NL", net: -58319 },
        { province: "SK", net: -123603 },
        { province: "MB", net: -155919 },
        { province: "ON", net: -168166 },
        { province: "QC", net: -255988 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "age-profile",
      title: "Net migration by age group, by province",
      caption:
        "Who moved. British Columbia and Alberta were the only provinces with positive net migration in every age group. Quebec and Ontario lost across the board.",
      xKey: "province",
      yAxisLabel: "Net migrants",
      format: "number",
      referenceLine: { value: 0, label: "Break-even" },
      series: [
        { key: "age18to24", label: "18-24" },
        { key: "age25to44", label: "25-44" },
        { key: "age45to64", label: "45-64" },
        { key: "age65plus", label: "65+" },
      ],
      data: [
        { province: "AB", age18to24: 192329, age25to44: 216679, age45to64: 5058, age65plus: 22728 },
        { province: "BC", age18to24: 20766, age25to44: 84014, age45to64: 80522, age65plus: 18446 },
        { province: "NS", age18to24: -11124, age25to44: 1183, age45to64: 21585, age65plus: 6533 },
        { province: "NB", age18to24: -23104, age25to44: -7380, age45to64: 13922, age65plus: 4729 },
        { province: "ON", age18to24: -63063, age25to44: -34328, age45to64: -55646, age65plus: -16924 },
        { province: "QC", age18to24: -29297, age25to44: -119658, age45to64: -29517, age65plus: -17357 },
        { province: "MB", age18to24: -18637, age25to44: -69723, age45to64: -26134, age65plus: -7369 },
        { province: "SK", age18to24: -26146, age25to44: -47589, age45to64: -14404, age65plus: -11839 },
        { province: "NL", age18to24: -37163, age25to44: -13125, age45to64: 77, age65plus: 1892 },
        { province: "PE", age18to24: -3800, age25to44: -474, age45to64: 4571, age65plus: 1974 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "major-corridors",
      title: "The biggest corridors: net flows between province pairs",
      caption:
        "Net migrants along the seven largest province-to-province corridors over 30 years. Ontario to Alberta is the single biggest domestic corridor in the country.",
      xKey: "corridor",
      yAxisLabel: "Net migrants",
      format: "number",
      series: [{ key: "net", label: "Net migrants" }],
      data: [
        { corridor: "ON -> AB", net: 195236 },
        { corridor: "QC -> ON", net: 168466 },
        { corridor: "ON -> BC", net: 114092 },
        { corridor: "SK -> AB", net: 95949 },
        { corridor: "MB -> AB", net: 73025 },
        { corridor: "QC -> AB", net: 51472 },
        { corridor: "BC -> AB", net: 12780 },
      ],
    },
    {
      type: "chart",
      chartType: "line",
      id: "alberta-vs-ontario-rate",
      title: "Net migration rate: Alberta vs. Ontario, selected years",
      caption:
        "Net interprovincial migration per 1,000 residents. Alberta's flows are cyclical (they track the oil economy) but net positive over time; Ontario's turned sharply negative in the most recent years, hitting its worst outflow rate of the full period in 2023/24.",
      xKey: "period",
      yAxisLabel: "Per 1,000 residents",
      format: "number",
      referenceLine: { value: 0, label: "Break-even" },
      series: [
        { key: "alberta", label: "Alberta" },
        { key: "ontario", label: "Ontario" },
      ],
      data: [
        { period: "1997/98", alberta: 15.2, ontario: -0.4 },
        { period: "2005/06", alberta: 13.8, ontario: -1.2 },
        { period: "2009/10", alberta: -0.9, ontario: -0.8 },
        { period: "2012/13", alberta: 10.0, ontario: -1.0 },
        { period: "2016/17", alberta: -3.7, ontario: 0.9 },
        { period: "2019/20", alberta: -0.6, ontario: 0.2 },
        { period: "2023/24", alberta: 10.3, ontario: -2.7 },
      ],
    },
    {
      type: "callout",
      tone: "info",
      id: "young-adults",
      heading: "Young adults moved west",
      body:
        "Alberta gained 192,329 net migrants aged 18 to 24 — the household-formation and first-home-buying cohort. Newfoundland and Labrador, at the other extreme, lost the equivalent of **97.3% of its 2025 population aged 18-24** on a net basis over the period. Migration at these life stages is tied to education, jobs, and the ability to still afford to form a household.",
    },
    {
      type: "narrative",
      id: "implications",
      heading: "What it means for real estate investors",
      body:
        "## Alberta rental demand still has the strongest domestic tailwind\nA 538,824-person net gain does not guarantee every Alberta submarket performs, but it keeps demand pressure structurally higher than in most provinces. Underwrite Calgary and Edmonton with migration as a durable support, not a headline.\n\n## Ontario volume risk is rising before price relief fully arrives\nOntario's domestic outflow does not stop the province growing overall, but marginal demand is leaking to lower-cost provinces. That shows up first in transaction volume, condo liquidity, and rent resilience at the affordability margin.\n\n## Domestic migration is not just a jobs story\nThe age breakdown shows people moving at life stages tied to education, household formation, and retirement — relevant for entry-level ownership, suburban rental demand, and markets with room to add family housing.\n\n## Housing policy credibility shows up in migration over time\nPeople do not move provinces lightly. Over 30 years, net flows are a rough scoreboard for labour opportunity, taxes, and the ability to still buy or rent acceptable housing. Watch where domestic migrants go before watching where institutions issue press releases.",
    },
  ],
  sources: [
    {
      label: "Interprovincial Migration in Canada, 1995-2024 — What Do the Numbers Tell Us?",
      url: FRASER_STUDY_URL,
      publisher: "Fraser Institute (study page)",
    },
    {
      label: "Full study PDF",
      url: FRASER_PDF_URL,
      publisher: "Fraser Institute",
    },
    {
      label: "Alberta gained 539,000 residents, Ontario lost 168,000 (coverage)",
      url: HUB_ARTICLE_URL,
      publisher: "The Hub",
    },
  ],
  cta: {
    toolUrl: "/tools/analyzer",
    headline: "Underwrite a deal in a growth market",
    body: "Migration is a demand signal, not a deal. Take an Alberta or lower-cost-province property into the free analyzer and see whether the numbers survive conservative rent and financing assumptions.",
  },
};
