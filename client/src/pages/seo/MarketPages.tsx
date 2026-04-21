import { SeoMarketLandingPage, type SeoMarketLandingConfig } from "../SeoMarketLanding";

const sharedFaqs = [
  {
    q: "Where does this data come from?",
    a: "Floorplan-level pricing data is aggregated from public new construction listings via Red Bricks Data and Valery.ca, then normalized and analyzed by Realist.ca. The window covers December 2025 through April 2026.",
  },
  {
    q: "What does a price 'cut' mean here?",
    a: "A cut means the developer's published price-per-square-foot for a specific floorplan is lower today than its earliest observed price in the window. We measure at the floorplan level — not the project level — to avoid false signals from mix shifts.",
  },
  {
    q: "Is this the same as resale market data?",
    a: "No. This dataset reflects pre-construction (new development) pricing only. Pre-construction tends to lead resale in stressed markets because builders cut to clear inventory before resale comps adjust.",
  },
];

const sharedLinks = [
  { href: "/insights/gta-precon-pricing", label: "Full GTA Pre-Construction Pricing Report" },
  { href: "/insights/new-construction-canada", label: "Canada New Construction Market Report" },
  { href: "/insights/mortgage-rates", label: "Live Canadian Mortgage Rates" },
  { href: "/tools/analyzer", label: "Free Canadian Deal Analyzer" },
];

const torontoConfig: SeoMarketLandingConfig = {
  routePath: "/toronto-housing-market",
  scopeQuery: "city=Toronto&label=Toronto",
  h1: "Toronto Housing Market — Live Data, Pre-Construction Pricing & Analysis",
  pageTitle: "Toronto Housing Market 2026 - Live Pre-Construction Data | Realist.ca",
  metaDescription: "Live Toronto housing market data: {{cuts}} pre-construction price cuts vs {{raises}} raises across active developments. Average PSF change, biggest discounts, by city.",
  intro: "Toronto's pre-construction housing market is showing clear price weakness. Across {{floorplans}} active floorplans in {{projects}} developments, price cuts are outnumbering raises {{ratio}} to 1, with the average cut at −{{avgCut}}% and the deepest hitting −{{biggestCut}}%. Below: the live data, biggest movers, and what it means for buyers, investors, and the resale market.",
  emphasis: "cuts",
  faqs: [
    {
      q: "Are condo prices dropping in Toronto?",
      a: "Yes — Toronto's pre-construction segment is in a clear price-cutting phase. The dataset shows cuts substantially outnumbering raises, and resale tends to follow pre-construction with a lag.",
    },
    ...sharedFaqs,
  ],
  internalLinks: [
    { href: "/toronto-condo-prices-dropping", label: "Are Toronto condo prices dropping?" },
    { href: "/biggest-price-drops-gta", label: "Biggest price drops in GTA pre-construction" },
    ...sharedLinks,
  ],
};

const torontoCondosDroppingConfig: SeoMarketLandingConfig = {
  routePath: "/toronto-condo-prices-dropping",
  scopeQuery: "city=Toronto&label=Toronto",
  h1: "Are Toronto Condo Prices Dropping? Live 2026 Data",
  pageTitle: "Are Toronto Condo Prices Dropping? Live 2026 Data | Realist.ca",
  metaDescription: "Yes — Toronto condo prices are dropping. Live floorplan-level data shows {{cuts}} price cuts vs {{raises}} raises in pre-construction. Avg cut −{{avgCut}}%, deepest −{{biggestCut}}%.",
  intro: "Yes — Toronto condo prices are dropping in 2026. Across {{floorplans}} active pre-construction floorplans, developers have cut prices on {{cuts}} units versus only {{raises}} raises — a ratio of {{ratio}} to 1. The average cut is −{{avgCut}}% per square foot, with the deepest at −{{biggestCut}}%. Pre-construction typically leads resale in declining markets, so resale weakness is likely to follow.",
  emphasis: "cuts",
  faqs: [
    {
      q: "How much are Toronto condos dropping?",
      a: "On a per-square-foot basis, the average pre-construction price cut in Toronto is roughly 7–8%, with the deepest individual floorplan cuts exceeding 20%. These are publisher-list movements, not closing prices — actual buyer concessions can be larger.",
    },
    {
      q: "Why are condo developers cutting prices?",
      a: "Pre-construction sales velocity collapsed through 2024 and 2025 as investor demand evaporated, financing tightened, and rents flattened in dense condo cores. Developers cut headline prices (and stack incentives) to hit minimum-pre-sale thresholds and maintain construction financing.",
    },
    {
      q: "Will Toronto resale condos drop too?",
      a: "Pre-construction is a leading indicator. Resale typically follows with a 6–18 month lag, especially in submarkets where new supply is delivering. The size of the lag depends on rates, listings, and absorption.",
    },
    ...sharedFaqs,
  ],
  internalLinks: [
    { href: "/toronto-housing-market", label: "Toronto housing market overview" },
    { href: "/biggest-price-drops-gta", label: "Biggest price drops in GTA pre-construction" },
    ...sharedLinks,
  ],
};

const biggestDropsGtaConfig: SeoMarketLandingConfig = {
  routePath: "/biggest-price-drops-gta",
  scopeQuery: "",
  h1: "Biggest Pre-Construction Price Drops in the GTA",
  pageTitle: "Biggest GTA Pre-Construction Price Drops 2026 - Floorplan Data | Realist.ca",
  metaDescription: "Live ranking of the biggest pre-construction price drops in the GTA. {{cuts}} active price cuts, deepest −{{biggestCut}}%. Updated daily from {{projects}} developments.",
  intro: "These are the biggest active pre-construction price drops in the Greater Toronto Area as of today. Out of {{floorplans}} live floorplans across {{projects}} developments, {{cuts}} are now priced below their earliest observed PSF. The deepest cut on the board is −{{biggestCut}}%. Below: the top 10 individual floorplan cuts, the projects with the most reductions, and the city-by-city averages.",
  emphasis: "cuts",
  faqs: [
    {
      q: "Where are the biggest pre-construction price cuts in the GTA?",
      a: "The deepest cuts cluster in suburban high-rise projects across Peel, York, and Halton, where investor-heavy launches priced into a stronger 2022–2023 market are now being repriced for end-user demand.",
    },
    {
      q: "Are these cuts the same as builder incentives?",
      a: "No. This dataset measures published price-per-square-foot only. Builder incentives — capped levies, deferred deposits, free upgrades, mortgage buy-downs — are stacked on top and can be worth another 5–15%.",
    },
    ...sharedFaqs,
  ],
  internalLinks: [
    { href: "/toronto-housing-market", label: "Toronto housing market" },
    { href: "/toronto-condo-prices-dropping", label: "Are Toronto condo prices dropping?" },
    { href: "/canada-housing-market", label: "Canada housing market overview" },
    ...sharedLinks,
  ],
};

const canadaConfig: SeoMarketLandingConfig = {
  routePath: "/canada-housing-market",
  scopeQuery: "",
  h1: "Canada Housing Market — Live Pre-Construction & New Build Data",
  pageTitle: "Canada Housing Market 2026 - Live Data & Analysis | Realist.ca",
  metaDescription: "Live Canada housing market data. New construction inventory, pre-construction price movement, and what it signals for the resale market across major Canadian cities.",
  intro: "Canada's housing market is recalibrating. The pre-construction segment — the cleanest leading indicator — shows {{cuts}} active price cuts versus {{raises}} raises across {{floorplans}} floorplans in {{projects}} GTA developments, with cuts averaging −{{avgCut}}%. The same pattern is showing up in active new construction listings across the country: rising inventory, softening prices, and a buyer's market in most major metros.",
  emphasis: "cuts",
  faqs: [
    {
      q: "Is the Canadian housing market crashing?",
      a: "Crashing is a strong word. The Canadian housing market is repricing — specifically the pre-construction and high-density investor segments. Detached resale in supply-constrained metros has held up better than condos and pre-construction. Watch new-construction price movement as the leading indicator.",
    },
    {
      q: "Where is the weakness concentrated?",
      a: "Weakness is concentrated in (1) GTA pre-construction condos, (2) suburban high-rise inventory in Ontario, and (3) over-supplied condo cores. Resilience is concentrated in supply-constrained low-rise housing in immigration-heavy metros.",
    },
    ...sharedFaqs,
  ],
  internalLinks: [
    { href: "/toronto-housing-market", label: "Toronto housing market" },
    { href: "/biggest-price-drops-gta", label: "Biggest GTA price drops" },
    ...sharedLinks,
  ],
};

export const TorontoHousingMarketPage = () => <SeoMarketLandingPage config={torontoConfig} />;
export const TorontoCondoPricesDroppingPage = () => <SeoMarketLandingPage config={torontoCondosDroppingConfig} />;
export const BiggestPriceDropsGtaPage = () => <SeoMarketLandingPage config={biggestDropsGtaConfig} />;
export const CanadaHousingMarketPage = () => <SeoMarketLandingPage config={canadaConfig} />;

export const seoLandingMeta = [
  { path: torontoConfig.routePath, title: torontoConfig.pageTitle, description: torontoConfig.metaDescription },
  { path: torontoCondosDroppingConfig.routePath, title: torontoCondosDroppingConfig.pageTitle, description: torontoCondosDroppingConfig.metaDescription },
  { path: biggestDropsGtaConfig.routePath, title: biggestDropsGtaConfig.pageTitle, description: biggestDropsGtaConfig.metaDescription },
  { path: canadaConfig.routePath, title: canadaConfig.pageTitle, description: canadaConfig.metaDescription },
];
