export interface ProgrammaticMarketPage {
  slug: string;
  city: string;
  province: string;
  title: string;
  description: string;
  intro: string;
  highlights: string[];
  relatedReportSlugs: string[];
  relatedStrategies: string[];
}

export interface ProgrammaticStrategyPage {
  slug: string;
  title: string;
  description: string;
  intro: string;
  bullets: string[];
  relatedMarkets: string[];
  relatedReports: string[];
}

export const PROGRAMMATIC_MARKETS: ProgrammaticMarketPage[] = [
  {
    slug: "toronto",
    city: "Toronto",
    province: "ON",
    title: "Toronto Real Estate Investment Market",
    description: "Toronto market intelligence for investors: pricing, yield context, multiplex policy direction, and related reports from Realist.",
    intro: "Toronto is Realist's highest-priority market for housing intelligence because it combines deep investor demand, policy-driven gentle-density upside, and meaningful variation between neighbourhoods, product types, and financing paths.",
    highlights: [
      "City-wide 4-unit multiplex permissions make low-rise screening more relevant than legacy detached-only assumptions.",
      "Condo and pre-construction weakness can create acquisition windows while low-rise land value stays resilient.",
      "Neighbourhood-level underwriting still matters because rents, land basis, and approval friction vary dramatically inside the city.",
    ],
    relatedReportSlugs: ["gta-precon-pricing"],
    relatedStrategies: ["multiplex", "buy-and-hold", "brrr"],
  },
  {
    slug: "hamilton",
    city: "Hamilton",
    province: "ON",
    title: "Hamilton Real Estate Investment Market",
    description: "Hamilton investment market overview for Canadian investors: rental demand, Ontario density upside, and related reports and tools.",
    intro: "Hamilton remains a core Ontario investor market because it sits at the intersection of GTA spillover demand, stronger cash-flow profiles than Toronto, and an ongoing appeal for small multifamily and value-add buyers.",
    highlights: [
      "Ontario baseline gentle-density permissions make small-lot intensification screening more relevant across older Hamilton housing stock.",
      "Buyer discipline still matters because basis, rent assumptions, and renovation scope can swing cash flow quickly.",
      "Hamilton works best when investors compare neighbourhood-level rents and renovation paths instead of underwriting the whole city as one market.",
    ],
    relatedReportSlugs: [],
    relatedStrategies: ["multiplex", "brrr", "buy-and-hold"],
  },
  {
    slug: "vancouver",
    city: "Vancouver",
    province: "BC",
    title: "Vancouver Real Estate Investment Market",
    description: "Vancouver market page for investors tracking pricing, small-scale density policy, and strategic underwriting context.",
    intro: "Vancouver is fundamentally a land-constrained market where investor returns depend on policy shifts, small-scale density permissions, financing discipline, and careful execution rather than easy cash flow.",
    highlights: [
      "BC small-scale multi-unit housing rules make density policy part of acquisition underwriting, not just long-term optionality.",
      "Land value and replacement cost matter more than headline cap rates in many submarkets.",
      "Investors need cleaner downside protection because entry prices leave less room for execution mistakes.",
    ],
    relatedReportSlugs: ["new-construction-canada"],
    relatedStrategies: ["multiplex", "buy-and-hold"],
  },
  {
    slug: "calgary",
    city: "Calgary",
    province: "AB",
    title: "Calgary Real Estate Investment Market",
    description: "Calgary investor market page with yield-oriented positioning, market intelligence links, and strategy entry points.",
    intro: "Calgary attracts investors when they want stronger in-place yields and cleaner affordability than gateway Ontario or BC markets, but it still requires real underwriting discipline around supply, rent sustainability, and submarket selection.",
    highlights: [
      "Cash-flow narratives are strongest when rent assumptions remain conservative and vacancy is treated realistically.",
      "Property type and neighbourhood selection matter more than broad province-level optimism.",
      "Calgary often works well for investors prioritizing stabilized buy-and-hold over complex entitlement upside.",
    ],
    relatedReportSlugs: ["new-construction-canada"],
    relatedStrategies: ["buy-and-hold", "distress"],
  },
  {
    slug: "ottawa",
    city: "Ottawa",
    province: "ON",
    title: "Ottawa Real Estate Investment Market",
    description: "Ottawa market page for investors following stable demand, Ontario policy baseline, and report-driven housing intelligence.",
    intro: "Ottawa tends to appeal to investors looking for steadier demand drivers, lower volatility than Toronto, and Ontario policy tailwinds that may improve the case for gentle-density housing over time.",
    highlights: [
      "The city's policy direction still needs to be checked at the municipal level even when Ontario baseline permissions apply.",
      "Stable employment and institutional demand can support long-duration underwriting assumptions better than boom-bust markets.",
      "Investors should still compare rent depth, neighbourhood liquidity, and renovation path before assuming a deal is defensive.",
    ],
    relatedReportSlugs: [],
    relatedStrategies: ["buy-and-hold", "multiplex"],
  },
];

export const PROGRAMMATIC_STRATEGIES: ProgrammaticStrategyPage[] = [
  {
    slug: "multiplex",
    title: "Multiplex Investing in Canada",
    description: "How Realist frames multiplex investing in Canada: acquisition, density upside, screening logic, and related markets and reports.",
    intro: "Multiplex investing is a flagship Realist strategy because it combines underwriting, policy interpretation, and development-adjacent upside in a way that is difficult to reduce to a simple listing search.",
    bullets: [
      "The highest-leverage question is often not just current rent, but what built form may be allowed over time.",
      "Ontario and Toronto policy changes have made low-rise density screening materially more important for investors.",
      "Multiplex deals only work when zoning, construction, financing, and exit assumptions are treated as separate risk layers.",
    ],
    relatedMarkets: ["toronto", "hamilton", "ottawa", "vancouver"],
    relatedReports: ["gta-precon-pricing", "new-construction-canada"],
  },
  {
    slug: "buy-and-hold",
    title: "Buy and Hold Real Estate Investing in Canada",
    description: "Buy-and-hold investing page with Realist's framing on income durability, financing, and market selection.",
    intro: "Buy-and-hold remains the core Canadian investor strategy when the property can support a durable rent thesis, financing remains manageable, and the market offers reasonable downside protection.",
    bullets: [
      "Good buy-and-hold underwriting starts with rent quality, operating expense realism, and financing resilience.",
      "The best opportunities often come from discipline on basis rather than aggressive growth assumptions.",
      "Realist treats market intelligence and deal underwriting as one workflow rather than separate research tasks.",
    ],
    relatedMarkets: ["calgary", "hamilton", "ottawa", "toronto"],
    relatedReports: ["new-construction-canada", "gta-precon-pricing"],
  },
  {
    slug: "brrr",
    title: "BRRR Real Estate Investing in Canada",
    description: "BRRR strategy page focused on value-add execution, refinance realism, and Canadian market selection.",
    intro: "BRRR works when the investor is buying below stabilized value, can actually execute the renovation scope, and has a refinance path that is realistic in the current lending environment.",
    bullets: [
      "The refinance is the real bottleneck in Canadian BRRR, not just the purchase discount.",
      "Renovation-heavy models need separate assumptions for scope, timeline, and final rent quality.",
      "Older Ontario housing stock can create BRRR opportunity, but only when zoning, code, and carrying costs are modeled properly.",
    ],
    relatedMarkets: ["hamilton", "toronto", "ottawa"],
    relatedReports: ["gta-precon-pricing"],
  },
  {
    slug: "distress",
    title: "Distress Property Investing in Canada",
    description: "Distress investing page connecting motivated listings, legal caution, and underwriting workflows.",
    intro: "Distress investing is attractive because it can create pricing dislocation, but it only becomes investable when the buyer understands provincial process, title risk, financing constraints, and property-level downside clearly.",
    bullets: [
      "Listing remarks alone are not enough; buyers need to validate process, occupancy, and execution risk.",
      "Distress signals are most useful when connected directly to underwriting and next-step diligence.",
      "Realist treats distress as a sourcing advantage, not a substitute for deal quality.",
    ],
    relatedMarkets: ["calgary", "hamilton", "toronto"],
    relatedReports: ["new-construction-canada"],
  },
];

export function getProgrammaticMarket(slug?: string | null) {
  if (!slug) return undefined;
  return PROGRAMMATIC_MARKETS.find((market) => market.slug === slug.toLowerCase());
}

export function getProgrammaticStrategy(slug?: string | null) {
  if (!slug) return undefined;
  return PROGRAMMATIC_STRATEGIES.find((strategy) => strategy.slug === slug.toLowerCase());
}
