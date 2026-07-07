import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const TERANET_REPORT_URL =
  "https://teraintelligence.teranet.ca/market_insights/market-insights-q1-2026/";

export const teranetQ12026OntarioBuyerResetConfigReport: ReportContent = {
  slug: "teranet-q1-2026-ontario-buyer-reset",
  title: "Teranet Q1 2026: First-Time Buyers Lead, Peak Buyers Take The Losses",
  dek:
    "Teranet's 2025 Ontario land registry data shows a market being reshaped by buyer composition, not a clean recovery. First-time buyers are now the largest buyer segment while the 2021-2022 cohort is showing the most visible loss pain.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-07-05",
  kind: "market",
  tags: ["teranet", "ontario", "first-time-buyers", "loss-sales", "housing-market"],
  ogImage: "/og-image.png",
  metaTitle: "Teranet Q1 2026 Ontario Housing Report: First-Time Buyers Lead The Market | Realist",
  metaDescription:
    "Realist analysis of Teranet's Q1 2026 Market Insight Report: first-time homebuyers became Ontario's largest buyer segment in 2025, movers stayed locked in, MPOs faded, and pandemic-peak buyers sold at elevated loss rates.",
  heroStat: {
    label: "Peak-buyer loss signal",
    value: "36.6%",
    detail: "Share of properties purchased in 2022 and sold in 2025 that registered a loss, according to Teranet.",
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
          detail: "Multi-property owners fell to third place by share.",
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
          detail: "Up from 2,123 in 2024.",
          trend: "up",
        },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line",
      body:
        "The lazy read is that first-time buyers are back, so the market must be healing. I think that is too clean.\n\nTeranet's Q1 2026 Market Insight Report shows a market where the mix of buyers changed because the old buyer base got squeezed. Multi-property owners were the dominant segment during the investment peak. By 2025, they had faded to third place. Movers are still locked in by replacement cost, financing, and the tax of trading up in an expensive market. First-time buyers became the largest segment because prices corrected enough in some pockets to clear transactions, not because housing suddenly became cheap.\n\nThat distinction matters. This is not a simple bull-case volume recovery. It is price discovery creating entry points for the buyer pool that was locked out during the peak.",
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
      heading: "First-time buyers leading is not the same thing as a healthy market",
      body:
        "First-time buyers leading the market sounds bullish until you ask what made the leadership possible.\n\nThe answer is not that ownership became easy. Teranet also reports that the average first-time homebuyer age reached 40 in 2025. For non-condo first-time purchases, nearly three-quarters involved two parties and the share with three or more parties was close to 19%. That is not a story about young buyers suddenly having a clean path into housing. It is a story about delayed entry, pooled incomes, family support, and price cuts finally making a small slice of the market transact.\n\nFor buyers, the signal is simple: patience has worked. For sellers, the signal is harsher: if the buyer pool is now more first-time-buyer-heavy, pricing has to clear against payment math, not against 2021 psychology.",
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
      heading: "Movers are locked in, investors got more selective",
      body:
        "Mover share fell to **13.0%** in 2025. That is the replacement-cost problem in one number. People may want to move, but selling one home and buying another at today's rates and prices is a different trade than it was in the cheap-money period.\n\nMulti-property owners are also not behaving like 2021 anymore. They remain active, but Teranet shows their share falling from the 2022 peak. The easy investor bid is gone. Financing costs, rental market weakness, and lower return expectations have made the buyer base more selective.\n\nThat leaves the market with a strange mix: first-time buyers stepping in later and with more support, locked-in owners not moving, older equity-rich capital still active in pockets, and peak buyers absorbing the most obvious losses.",
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
