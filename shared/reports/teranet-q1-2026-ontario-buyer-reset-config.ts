import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const TERANET_REPORT_URL =
  "https://teraintelligence.teranet.ca/market_insights/market-insights-q1-2026/";

export const teranetQ12026OntarioBuyerResetConfigReport: ReportContent = {
  slug: "teranet-q1-2026-ontario-buyer-reset",
  title: "Ontario First-Time Buyer Age Hits 40: Teranet Q1 2026",
  dek:
    "Teranet's 2025 Ontario land registry data shows a market being reshaped by buyer composition, not a clean recovery. First-time buyers are now the largest buyer segment, their average age has reached 40, and multi-property owners have fallen from the top buyer group to third place.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-07-05",
  kind: "market",
  tags: ["teranet", "ontario", "first-time-buyers", "multi-property-owners", "loss-sales", "housing-market"],
  ogImage: "/og-image.png",
  metaTitle: "Ontario First-Time Buyer Age Hits 40: Teranet Q1 2026 | Realist",
  metaDescription:
    "Teranet Q1 2026 report: Ontario first-time buyers are now the largest buyer segment, average age hit 40, and investors fell from 1st to 3rd.",
  heroStat: {
    label: "Average first-time buyer age",
    value: "40",
    detail: "Average age of an Ontario first-time homebuyer in 2025, up from 36 in 2015, according to Teranet.",
  },
  sections: [
    {
      type: "statGrid",
      id: "headline-stats",
      heading: "The Teranet read",
      stats: [
        {
          label: "Largest buyer segment",
          value: "FTHBs",
          detail: "First-time homebuyers became the largest buyer segment in 2025.",
          trend: "up",
        },
        {
          label: "FTHB market share",
          value: "24.8%",
          detail: "Share of Ontario property transfers in 2025.",
          trend: "up",
        },
        {
          label: "MPO market share",
          value: "21.5%",
          detail: "Multi-property owners fell from first place to third by share.",
          trend: "down",
        },
        {
          label: "Mover market share",
          value: "13.0%",
          detail: "Movers remain well below pre-2022 levels.",
          trend: "down",
        },
        {
          label: "FTHB average age",
          value: "40",
          detail: "Average first-time homebuyer age in 2025.",
          trend: "up",
        },
        {
          label: "Power of sale transfers",
          value: "2,979",
          detail: "Up about 40% from 2,123 in 2024.",
          trend: "up",
        },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line",
      body:
        "The lazy read is that first-time buyers are back, so the Ontario housing market must be healing. I think that is too clean.\n\nTeranet's Q1 2026 Market Insight Report shows a market where the buyer mix changed because the old buyer base got squeezed. First-time homebuyers became Ontario's largest buyer segment in 2025. The average age of a first-time homebuyer reached **40**. Multi-property owners, the investor-heavy group that led during the 2022 peak, fell from first place to third.\n\nThat is not a simple bull-case volume recovery. It is price discovery creating entry points for buyers who were locked out, while investors and movers deal with financing costs, replacement costs, and weaker exit math.",
    },
    {
      type: "chart",
      chartType: "line",
      id: "first-time-buyer-age",
      title: "How old is the average first-time homebuyer in Ontario?",
      caption:
        "Average first-time homebuyer age in Ontario. Source: Teranet Q1 2026 Market Insight Report, Figure 9.",
      xKey: "year",
      yAxisLabel: "Average age",
      format: "number",
      series: [{ key: "avgAge", label: "Average first-time buyer age", color: "#800000" }],
      data: [
        { year: "2015", avgAge: 36 },
        { year: "2020", avgAge: 38 },
        { year: "2025", avgAge: 40 },
      ],
    },
    {
      type: "chart",
      chartType: "line",
      id: "buyer-segment-share",
      title: "Ontario buyer mix: first-time buyers now lead",
      caption:
        "Property transfers by buyer segment as a percentage of total Ontario transactions. Source: Teranet Q1 2026 Market Insight Report, Figure 5.",
      xKey: "year",
      yAxisLabel: "% of total transfers",
      format: "percent",
      series: [
        { key: "fthb", label: "First-time homebuyer", color: "#800000" },
        { key: "mpo", label: "Multi-property owner", color: "#d04a06" },
        { key: "mover", label: "Mover", color: "#55565b" },
        { key: "lifeEvent", label: "Life event", color: "#0076bf" },
        { key: "other", label: "Other", color: "#4c7a15" },
      ],
      data: [
        { year: "2011", fthb: 23.6, mpo: 15.3, mover: 17.0, lifeEvent: 17.6, other: 26.5 },
        { year: "2012", fthb: 22.6, mpo: 16.2, mover: 17.7, lifeEvent: 17.5, other: 26.0 },
        { year: "2013", fthb: 22.6, mpo: 17.6, mover: 17.3, lifeEvent: 17.0, other: 25.5 },
        { year: "2014", fthb: 23.0, mpo: 18.0, mover: 17.7, lifeEvent: 16.3, other: 25.0 },
        { year: "2015", fthb: 22.8, mpo: 18.7, mover: 17.9, lifeEvent: 16.0, other: 24.6 },
        { year: "2016", fthb: 21.7, mpo: 19.7, mover: 18.2, lifeEvent: 15.9, other: 24.5 },
        { year: "2017", fthb: 20.0, mpo: 22.0, mover: 17.1, lifeEvent: 16.5, other: 24.3 },
        { year: "2018", fthb: 20.9, mpo: 21.5, mover: 16.2, lifeEvent: 18.0, other: 23.5 },
        { year: "2019", fthb: 21.5, mpo: 21.6, mover: 16.8, lifeEvent: 18.1, other: 22.0 },
        { year: "2020", fthb: 22.8, mpo: 21.8, mover: 17.3, lifeEvent: 17.7, other: 20.4 },
        { year: "2021", fthb: 21.9, mpo: 23.8, mover: 17.9, lifeEvent: 17.5, other: 19.0 },
        { year: "2022", fthb: 20.8, mpo: 25.2, mover: 14.9, lifeEvent: 20.4, other: 18.6 },
        { year: "2023", fthb: 21.8, mpo: 23.5, mover: 14.0, lifeEvent: 21.3, other: 19.4 },
        { year: "2024", fthb: 22.8, mpo: 23.3, mover: 13.4, lifeEvent: 21.7, other: 18.7 },
        { year: "2025", fthb: 24.8, mpo: 21.5, mover: 13.0, lifeEvent: 22.8, other: 17.9 },
      ],
    },
    {
      type: "narrative",
      id: "first-time-buyer-read",
      heading: "First-time buyers leading is not the same thing as easy ownership",
      body:
        "First-time buyers leading the market sounds bullish until you ask what made the leadership possible.\n\nThe answer is not that ownership became easy. Teranet reports that the average first-time homebuyer age reached **40** in 2025. For non-condo first-time purchases, nearly three-quarters involved two parties and the share with three or more parties was close to **19%**. That is not a story about young buyers suddenly having a clean path into housing. It is a story about delayed entry, pooled incomes, family support, and price cuts finally making a small slice of the market transact.\n\nFor buyers, the signal is simple: patience has worked. For sellers, the signal is harsher: if the buyer pool is now more first-time-buyer-heavy, pricing has to clear against payment math, not against 2021 psychology.",
    },
    {
      type: "statGrid",
      id: "shared-ownership-stats",
      heading: "Affordability is showing up as shared ownership",
      stats: [
        {
          label: "Non-condo FTHB with 2 parties",
          value: "~75%",
          detail: "Nearly three-quarters of non-condo first-time purchases involved two parties in 2025.",
          trend: "up",
        },
        {
          label: "Non-condo FTHB with 3+ parties",
          value: "~19%",
          detail: "Teranet says the three-or-more-party share has grown meaningfully.",
          trend: "up",
        },
        {
          label: "New solo MPO purchases",
          value: "~30%",
          detail: "A new group of solo multi-property owners is emerging despite the broader investor pullback.",
          trend: "up",
        },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "power-of-sale-transfers",
      title: "Power of sale transfers rose in 2025",
      caption:
        "Ontario power of sale transfer volumes. Source: Teranet Q1 2026 Market Insight Report, Figure 4A.",
      xKey: "year",
      yAxisLabel: "Transfers",
      format: "number",
      series: [{ key: "transfers", label: "Power of sale transfers", color: "#d04a06" }],
      data: [
        { year: "2024", transfers: 2123 },
        { year: "2025", transfers: 2979 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "sold-at-loss-2025",
      title: "The 2022 buyer is where the loss pain shows up",
      caption:
        "Percentage of properties sold in 2025 at a loss, grouped by purchase year. Source: Teranet Q1 2026 Market Insight Report, Figure 18.",
      xKey: "purchaseYear",
      yAxisLabel: "% sold at a loss",
      format: "percent",
      referenceLine: { value: 10, label: "10% loss-sale rate" },
      series: [{ key: "lossRate", label: "Sold in 2025 at a loss", color: "#800000" }],
      data: [
        { purchaseYear: "2018", lossRate: 2.3 },
        { purchaseYear: "2019", lossRate: 2.9 },
        { purchaseYear: "2020", lossRate: 5.0 },
        { purchaseYear: "2021", lossRate: 21.9 },
        { purchaseYear: "2022", lossRate: 36.6 },
        { purchaseYear: "2023", lossRate: 24.6 },
        { purchaseYear: "2024", lossRate: 19.2 },
        { purchaseYear: "2025", lossRate: 16.1 },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      id: "loss-sales-callout",
      heading: "The loss matrix is the real price-discovery chart",
      body:
        "The biggest number in the report is not first-time buyers leading the market. It is that **36.6%** of properties purchased in 2022 and sold in 2025 registered a loss. That is the price-discovery cycle showing up in the land registry, not just in anecdotes.",
    },
    {
      type: "narrative",
      id: "loss-sales-read",
      heading: "Loss sales are still concentrated in the people who bought the peak",
      body:
        "This is the part the industry usually wants to soften. Some sellers are not just making less than they hoped. They are selling below their purchase price.\n\nTeranet shows that 2022 purchases resold in 2025 had the highest loss-sale rate in the matrix at **36.6%**. The 2021 cohort was not clean either, at **21.9%** when sold in 2025. That is what happens when a low-rate price level meets a high-rate carrying-cost environment.\n\nIt does not mean every homeowner is distressed. It does mean the marginal forced or motivated seller matters more than the comfortable owner. If you bought before the boom and can sit, you probably sit. If you bought the peak, carried the wrong asset, and now need liquidity, you may be the comp that resets the market.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "loss-rate-by-value",
      title: "Loss exposure is not limited to one price tier",
      caption:
        "Loss rate for properties purchased in 2022 and sold in 2025, by sold value range. Source: Teranet Q1 2026 Market Insight Report, Figure 20.",
      xKey: "valueRange",
      yAxisLabel: "% sold at a loss",
      format: "percent",
      series: [{ key: "lossRate", label: "2022 purchase, 2025 sale", color: "#d04a06" }],
      data: [
        { valueRange: "$500K-$1M", lossRate: 37.9 },
        { valueRange: "$1M-$3M", lossRate: 33.7 },
        { valueRange: "$3M-$5M", lossRate: 27.4 },
      ],
    },
    {
      type: "narrative",
      id: "mover-mpo-read",
      heading: "Movers are locked in, investors fell to third",
      body:
        "Mover share fell to **13.0%** in 2025. That is the replacement-cost problem in one number. People may want to move, but selling one home and buying another at today's rates and prices is a different trade than it was in the cheap-money period.\n\nMulti-property owners are also not behaving like 2021 anymore. Teranet says they were the largest buyer segment during the investment-driven 2022 peak. By 2025, they had fallen to **third place**, with a **21.5%** share of Ontario property transfers. The easy investor bid is gone. Financing costs, rental market weakness, and lower return expectations have made the buyer base more selective.\n\nThat leaves the market with a strange mix: first-time buyers stepping in later and with more support, locked-in owners not moving, older equity-rich capital still active in pockets, and peak buyers absorbing the most obvious losses.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "mpo-property-count",
      title: "Most multi-property owners are not giant landlords",
      caption:
        "Number of properties held by Ontario multi-property owners as of December 31, 2025. Source: Teranet Q1 2026 Market Insight Report, Figure 11.",
      xKey: "portfolio",
      yAxisLabel: "Share of multi-property owners",
      format: "percent",
      series: [{ key: "share", label: "Share of MPOs", color: "#55565b" }],
      data: [
        { portfolio: "2 properties", share: 55 },
        { portfolio: "3 properties", share: 20 },
        { portfolio: "10+ properties", share: 7.5 },
      ],
    },
    {
      type: "callout",
      tone: "info",
      id: "buyer-seller-playbook",
      heading: "Buyer and seller playbook",
      body:
        "Buyers should not treat this as a runaway market. The buyer base is price-sensitive and sellers who need liquidity are still setting comps. Sellers should not confuse fewer listings or slightly better activity with a market where they can ignore the payment math. If your buyer is a first-time buyer, the price has to work against income, down payment, debt service, and fear of catching a falling knife.",
    },
  ],
  sources: [
    {
      label: "Market Insights Q1 2026: An Overview of Ontario's Housing Market in 2025",
      url: TERANET_REPORT_URL,
      publisher: "TeraIntelligence / Teranet",
    },
  ],
  cta: {
    toolUrl: "/tools/cap-rates",
    headline: "Run the numbers before you believe the recovery story",
    body:
      "Buyer composition, loss-sale rates and carrying costs matter more than a clean bull-case headline. Use Realist to pressure-test the deal before the narrative gets ahead of the math.",
  },
};
