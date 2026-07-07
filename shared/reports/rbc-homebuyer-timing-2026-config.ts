import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const RBC_POLL_URL = "https://www.rbc.com/newsroom/news/article.html?article=126116";
const REALIST_REPORT_ROUTE = "/insights/reports/rbc-homebuyer-timing-2026";

export const rbcHomebuyerTiming2026ConfigReport: ReportContent = {
  slug: "rbc-homebuyer-timing-2026",
  title: "64% of Canadians Say There Is No Perfect Time to Buy a Home: RBC 2026 Poll",
  dek:
    "RBC's 2026 Home Ownership Poll shows buyers are not exactly bullish. They are tired of waiting. Active buyers see a window, first-time buyers see an opening, and the trade-offs required to buy keep getting heavier.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-07-07",
  kind: "market",
  tags: ["rbc", "homebuyers", "first-time-buyers", "housing-market", "affordability", "buyer-sentiment"],
  ogImage: "/og-image.png",
  metaTitle: "RBC 2026 Home Ownership Poll: Canadians Say There Is No Perfect Time to Buy | Realist",
  metaDescription:
    "Realist report on RBC's 2026 Home Ownership Poll: 64% of Canadians say there is no perfect time to buy, active buyers see a short window, and first-time buyers are stepping into a difficult market.",
  heroStat: {
    label: "Canadians who say you cannot know the right time to buy",
    value: "64%",
    detail: "RBC 2026 Home Ownership Poll, national respondents.",
  },
  sections: [
    {
      type: "statGrid",
      id: "headline-stats",
      heading: "The RBC read",
      stats: [
        {
          label: "No perfect time",
          value: "64%",
          detail: "Canadians who say you can never really know when the right time is to buy.",
          trend: "flat",
        },
        {
          label: "Active buyers say now",
          value: "45%",
          detail: "Prospective buyers planning to purchase within two years who say now is the right time.",
          trend: "up",
        },
        {
          label: "Small window fear",
          value: "53%",
          detail: "Active buyers who think there is only a small window before prices rise again.",
          trend: "up",
        },
        {
          label: "FTHB opening",
          value: "46%",
          detail: "Active buyers who agree current conditions give first-time buyers a chance to get in.",
          trend: "up",
        },
        {
          label: "Caution from uncertainty",
          value: "75%",
          detail: "Active buyers who say economic uncertainty makes them more cautious.",
          trend: "up",
        },
        {
          label: "Financial shock",
          value: "74%",
          detail: "Canadians who say most buyers experience financial shock when buying their first home.",
          trend: "up",
        },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line",
      body:
        "RBC's poll is not a clean bullish signal. It is a psychology signal.\n\nThe headline is that **64%** of Canadians say you can never really know when the right time is to buy a home. That sounds like people giving up on timing the market. But the buyer subset is more interesting: among people planning to buy within two years, **45%** say now is the right time to buy.\n\nThat is not normal confidence. Fewer than half of active buyers say they are confident making homebuying decisions in today's market. This looks more like capitulation into action: buyers who spent years feeling priced out are starting to accept that the perfect entry point may never arrive.\n\nFor first-time buyers, that matters. They are the group most eager to step into the knife-catching contest because they have been the most marginalized by the last few years.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "timing-gap",
      title: "Active buyers are more willing to act than the general population",
      caption:
        "Selected RBC Home Ownership Poll findings. Active buyers are respondents intending to purchase within two years.",
      xKey: "statement",
      yAxisLabel: "% agree",
      format: "percent",
      series: [
        { key: "activeBuyers", label: "Intend to purchase within 2 years", color: "#800000" },
        { key: "canada", label: "Canada", color: "#55565b" },
      ],
      data: [
        { statement: "Cannot know right time", activeBuyers: 67, canada: 64 },
        { statement: "Now is right time", activeBuyers: 45, canada: 27 },
        { statement: "Now is great time", activeBuyers: 42, canada: 26 },
        { statement: "Small price window", activeBuyers: 53, canada: 39 },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      id: "capitulation",
      heading: "This is not euphoria. It is buyer capitulation.",
      body:
        "The key tension is that active buyers are more likely to say now is the right time, but they are also more cautious, less confident, and more squeezed. That is not a clean demand boom. It is people deciding that waiting for perfect conditions may be a losing strategy.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "first-time-buyer-opening",
      title: "Where buyers think first-time buyers have an opening",
      caption:
        "Share agreeing that current market conditions are giving first-time buyers a chance to get into the market. Source: RBC 2026 Home Ownership Poll.",
      xKey: "region",
      yAxisLabel: "% agree",
      format: "percent",
      series: [{ key: "share", label: "Agree", color: "#800000" }],
      data: [
        { region: "Active buyers", share: 46 },
        { region: "Canada", share: 30 },
        { region: "BC", share: 30 },
        { region: "AB", share: 26 },
        { region: "MB/SK", share: 29 },
        { region: "ON", share: 37 },
        { region: "QC", share: 19 },
        { region: "ATL", share: 25 },
      ],
    },
    {
      type: "narrative",
      id: "first-time-buyers",
      heading: "First-time buyers are the eager knife catchers",
      body:
        "The first-time buyer number is the one I would not ignore. Among active buyers, **46%** say current conditions are giving first-time buyers a chance to get into the market. Ontario is above the national average at **37%**.\n\nThat lines up with the recent Teranet read that first-time buyers have become a larger force in Ontario's transaction mix. The psychology is simple: if you have already owned a home, you may be locked in, sitting on equity, or reluctant to trade one expensive payment for another. If you have never owned, you have been watching ownership move away from you for years.\n\nSo when prices soften, even a little, first-time buyers can be the group most tempted to step in. Not because the deal is easy. Because the alternative is another year of rent, uncertainty, and feeling like the train already left.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "market-perception-by-region",
      title: "Canada does not agree on whether this is a buyer's market",
      caption:
        "Regional perception of buyer's market versus seller's market. Source: RBC 2026 Home Ownership Poll.",
      xKey: "region",
      yAxisLabel: "% response",
      format: "percent",
      series: [
        { key: "buyersMarket", label: "Buyer's market", color: "#800000" },
        { key: "sellersMarket", label: "Seller's market", color: "#d04a06" },
      ],
      data: [
        { region: "Canada", buyersMarket: 27, sellersMarket: 36 },
        { region: "BC", buyersMarket: 39, sellersMarket: 26 },
        { region: "AB", buyersMarket: 19, sellersMarket: 37 },
        { region: "MB/SK", buyersMarket: 16, sellersMarket: 43 },
        { region: "ON", buyersMarket: 38, sellersMarket: 24 },
        { region: "QC", buyersMarket: 12, sellersMarket: 57 },
        { region: "ATL", buyersMarket: 9, sellersMarket: 52 },
      ],
    },
    {
      type: "narrative",
      id: "regional-split",
      heading: "There is no single Canadian housing market right now",
      body:
        "This is why national housing commentary keeps breaking. RBC's regional split is stark.\n\nIn Ontario, **38%** of respondents call it a buyer's market and **24%** call it a seller's market. In B.C., the buyer's-market read is also high at **39%**. But Quebec and Atlantic Canada are the opposite: **57%** in Quebec and **52%** in Atlantic Canada call it a seller's market.\n\nSo the national buyer is dealing with two things at once: a countrywide affordability problem and very different local market structure. That is how you can have a national mood of uncertainty while some buyers feel urgency and others feel like they are still bidding into tight supply.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "uncertainty-confidence-gap",
      title: "Buyers see opportunity, but confidence is weak",
      caption:
        "Economic uncertainty and decision-confidence measures from RBC's selected findings table.",
      xKey: "statement",
      yAxisLabel: "% agree",
      format: "percent",
      series: [
        { key: "activeBuyers", label: "Intend to purchase within 2 years", color: "#800000" },
        { key: "canada", label: "Canada", color: "#55565b" },
      ],
      data: [
        { statement: "Uncertainty is biggest challenge", activeBuyers: 72, canada: 66 },
        { statement: "Uncertainty makes me cautious", activeBuyers: 75, canada: 57 },
        { statement: "Worried plans affected", activeBuyers: 67, canada: 51 },
        { statement: "Have info needed", activeBuyers: 56, canada: 40 },
        { statement: "Confident deciding", activeBuyers: 49, canada: 28 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "tradeoffs-required",
      title: "The cost of buying is forcing bigger trade-offs",
      caption:
        "Trade-offs prospective buyers say are required to buy a home. Source: RBC 2026 Home Ownership Poll.",
      xKey: "tradeoff",
      yAxisLabel: "% agree",
      format: "percent",
      series: [
        { key: "activeBuyers", label: "Intend to purchase within 2 years", color: "#800000" },
        { key: "canada", label: "Canada", color: "#55565b" },
      ],
      data: [
        { tradeoff: "Delay major purchases", activeBuyers: 69, canada: 56 },
        { tradeoff: "Scale back vacations", activeBuyers: 62, canada: 51 },
        { tradeoff: "Overhaul saving habits", activeBuyers: 60, canada: 52 },
        { tradeoff: "Side hustle or 2nd job", activeBuyers: 57, canada: 53 },
        { tradeoff: "Use retirement savings", activeBuyers: 53, canada: 40 },
      ],
    },
    {
      type: "narrative",
      id: "tradeoffs",
      heading: "The opportunity window is expensive",
      body:
        "The harsh part of this poll is that even the buyers who see an opening are not saying the market became easy.\n\nAmong active buyers, **71%** say inflation is causing them to save less for a home. **69%** say they need to delay major purchases. **62%** are cutting back vacations. **60%** say they need to overhaul spending and saving habits. **53%** say retirement savings may be redirected toward a home purchase.\n\nThat last number is the quiet warning. If the new buyer pool has to cannibalize future security to buy present shelter, the market may clear more transactions, but that does not make affordability healthy.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "price-rate-expectations",
      title: "Buyers still fear prices and rates can move against them",
      caption:
        "RBC poll responses on 2026 home-price and interest-rate expectations.",
      xKey: "expectation",
      yAxisLabel: "% higher response",
      format: "percent",
      series: [
        { key: "activeBuyers", label: "Intend to purchase within 2 years", color: "#800000" },
        { key: "canada", label: "Canada", color: "#55565b" },
        { key: "ontario", label: "Ontario", color: "#d04a06" },
      ],
      data: [
        { expectation: "Home prices will rise", activeBuyers: 56, canada: 58, ontario: 49 },
        { expectation: "Interest rates will rise", activeBuyers: 49, canada: 50, ontario: 53 },
      ],
    },
    {
      type: "callout",
      tone: "info",
      id: "realist-read",
      heading: "The Realist read",
      body:
        "Buyers are realizing they cannot time the market perfectly. Some are accepting that the only useful question is whether the local deal works under today's payment, income and downside assumptions. That is a healthier question than trying to guess the bottom.",
    },
  ],
  sources: [
    {
      label: "When is the Perfect Time to Buy a Home? 64% of Canadians Say It Doesn't Exist",
      url: RBC_POLL_URL,
      publisher: "RBC Newsroom / RBC 2026 Home Ownership Poll",
    },
    {
      label: "Realist report route",
      url: REALIST_REPORT_ROUTE,
      publisher: "Realist.ca",
    },
  ],
  cta: {
    toolUrl: "/tools/analyzer",
    headline: "Stop trying to time the bottom. Underwrite the actual deal.",
    body:
      "Use Realist to pressure-test the property, rent, carrying costs and downside case before turning buyer anxiety into a purchase decision.",
  },
};
