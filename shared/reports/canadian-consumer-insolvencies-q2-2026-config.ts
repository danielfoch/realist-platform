import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const OSB_Q2_URL =
  "https://ised-isde.canada.ca/site/office-superintendent-bankruptcy/en/statistics-and-research/insolvency-statistics-canada-second-quarter-2026#TableSection";
const OSB_JUNE_URL =
  "https://ised-isde.canada.ca/site/office-superintendent-bankruptcy/en/statistics-and-research/insolvency-statistics-canada-june-2026#TableSection";
const GLOBE_URL =
  "https://www.theglobeandmail.com/business/article-consumer-insolvencies-climbed-in-second-quarter-putting-canada-on/";
const BETTER_DWELLING_URL =
  "https://betterdwelling.com/canadian-insolvencies-surge-to-second-highest-june-on-record/";
const CBC_VIDEO_URL = "https://www.cbc.ca/player/play/video/9.7304062";
const BOC_DELINQUENCY_URL =
  "https://www.bankofcanada.ca/2026/02/staff-analytical-paper-2026-3/";
const BOC_FSR_URL =
  "https://www.bankofcanada.ca/publications/financial-stability-report/financial-stability-report-2026/households/";

export const canadianConsumerInsolvenciesQ22026ConfigReport: ReportContent = {
  slug: "canadian-consumer-insolvencies-q2-2026",
  title: "Canadian Consumer Insolvencies Hit Their Highest Quarterly Level Since 2009",
  dek:
    "Canada recorded 37,523 consumer insolvencies in Q2 2026. Bankruptcies are accelerating, Ontario and British Columbia are carrying more of the increase, and the housing safety valve of easy refinancing is getting weaker.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-08-12",
  kind: "research",
  tags: [
    "canadian-consumer-insolvencies",
    "canada-bankruptcies",
    "consumer-proposals",
    "household-debt",
    "mortgage-stress",
    "housing-market",
    "ontario-real-estate",
    "british-columbia-real-estate",
  ],
  ogImage: "/reports/canadian-consumer-insolvencies-q2-2026/og.png",
  metaTitle: "Canadian Consumer Insolvencies Q2 2026: 17-Year High",
  metaDescription:
    "Canada recorded 37,523 consumer insolvencies in Q2 2026, up 6.9%. See bankruptcies, proposals, provincial trends and the housing-market risk.",
  heroStat: {
    label: "Consumer insolvencies filed in Canada, Q2 2026",
    value: "37,523",
    detail: "Up 6.9% from Q2 2025 and the highest quarterly volume since 2009.",
  },
  sections: [
    {
      type: "statGrid",
      id: "canada-insolvency-headlines",
      heading: "Canada's Q2 2026 insolvency stress test",
      stats: [
        {
          label: "Consumer filings",
          value: "37,523",
          detail: "Highest quarterly volume since 2009; up 1.1% from Q1 2026.",
          trend: "up",
        },
        {
          label: "Year over year",
          value: "+6.9%",
          detail: "Compared with 35,114 consumer filings in Q2 2025.",
          trend: "up",
        },
        {
          label: "Bankruptcies",
          value: "8,600",
          detail: "Up 13.5% quarter over quarter and 10.3% year over year.",
          trend: "up",
        },
        {
          label: "Consumer proposals",
          value: "28,923",
          detail: "Down 2.1% from Q1, but up 5.9% from a year earlier.",
          trend: "up",
        },
        {
          label: "June consumer filings",
          value: "12,812",
          detail: "Up 11.8% year over year and 5.6% from May.",
          trend: "up",
        },
        {
          label: "12-month consumer total",
          value: "145,762",
          detail: "Up 5.9% for the year ending June 30, 2026.",
          trend: "up",
        },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "The bottom line: this is no longer just a renter or credit-card story",
      body:
        "Canadian consumer insolvencies reached **37,523 in Q2 2026**, according to the [Office of the Superintendent of Bankruptcy](https://ised-isde.canada.ca/site/office-superintendent-bankruptcy/en/statistics-and-research/insolvency-statistics-canada-second-quarter-2026). That was **6.9% above Q2 2025**, **1.1% above the first quarter**, and the highest quarterly count since the 2009 recession. Canada has now recorded back-to-back quarters above 37,000 filings.\n\nThe total matters, but the composition matters more. Consumer proposals still account for most cases. Yet bankruptcies rose **13.5% in one quarter** while proposals fell **2.1%**. A proposal can let a borrower negotiate repayment while protecting assets; bankruptcy is the more severe legal reset and can require assets to be surrendered. A faster rise in bankruptcies is therefore a harder stress signal than a rising proposal count alone.\n\nThis is not proof that Canada is entering a foreclosure wave. National mortgage arrears remain low relative to past downturns, and insolvencies are a lagging measure. It does mean that the layer of household stress beneath the mortgage market is widening—and that fewer borrowers have room to absorb another job loss, renewal shock or decline in home equity.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "bankruptcies-versus-proposals",
      title: "Consumer proposals still dominate—but bankruptcies made the sharpest move",
      caption:
        "Canadian consumer insolvency filings by type. Q2 2026 bankruptcies rose 13.5% from Q1 and 10.3% from Q2 2025; proposals fell 2.1% quarter over quarter but rose 5.9% year over year. Source: OSB Table 2.",
      xKey: "period",
      xAxisLabel: "Quarter",
      yAxisLabel: "Filings",
      format: "number",
      series: [
        { key: "bankruptcies", label: "Bankruptcies", color: "#b91c1c" },
        { key: "proposals", label: "Consumer proposals", color: "#0f766e" },
      ],
      data: [
        { period: "Q2 2025", bankruptcies: 7800, proposals: 27314 },
        { period: "Q1 2026", bankruptcies: 7576, proposals: 29545 },
        { period: "Q2 2026", bankruptcies: 8600, proposals: 28923 },
      ],
    },
    {
      type: "narrative",
      id: "why-mix-matters",
      heading: "Why the bankruptcy-versus-proposal mix matters",
      body:
        "A consumer insolvency is a formal filing under Canada's Bankruptcy and Insolvency Act. It is not synonymous with bankruptcy. In Q2, **77.1% of consumer filings were proposals** and **22.9% were bankruptcies**. The proposal share remains dominant, but it fell from 79.6% in Q1.\n\nThat two-and-a-half-point shift is worth watching. It can mean that some households have less income available to support a multi-year proposal, less equity to protect, or debts that have progressed too far for a negotiated repayment plan to work. The national data does not tell us which explanation applies to each filer, so the mix is a signal—not a diagnosis.\n\nThe [Globe and Mail](https://www.theglobeandmail.com/business/article-consumer-insolvencies-climbed-in-second-quarter-putting-canada-on/) also reported that high credit-card and tax debt are feeding the increase. That fits the typical distress sequence: households defend housing payments first, lean on unsecured credit, miss other bills, and only later enter a formal insolvency process.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "provincial-insolvency-growth",
      title: "Ontario, British Columbia and Saskatchewan led the large-province increase",
      caption:
        "Year-over-year change in Q2 2026 consumer insolvency filings by province. Small territorial counts are excluded because one or two files can create extreme percentage swings. Source: OSB Table 2.",
      xKey: "province",
      xAxisLabel: "Province",
      yAxisLabel: "Year-over-year change",
      format: "percent",
      referenceLine: { value: 6.9, label: "Canada +6.9%" },
      series: [{ key: "change", label: "All consumer insolvencies", color: "#0f766e" }],
      data: [
        { province: "N.L.", change: -2.4 },
        { province: "P.E.I.", change: 14.7 },
        { province: "N.S.", change: 0.3 },
        { province: "N.B.", change: 8.8 },
        { province: "Que.", change: 3.9 },
        { province: "Ont.", change: 10.2 },
        { province: "Man.", change: 5.4 },
        { province: "Sask.", change: 11.1 },
        { province: "Alta.", change: 1.4 },
        { province: "B.C.", change: 10.9 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "provincial-filing-mix",
      title: "Bankruptcy growth is most pronounced in Ontario and the Prairies",
      caption:
        "Year-over-year change in Q2 2026 bankruptcies and consumer proposals. Ontario bankruptcies rose 24.8%; B.C. proposal growth was 12.1%. Source: OSB Table 2.",
      xKey: "province",
      xAxisLabel: "Province",
      yAxisLabel: "Year-over-year change",
      format: "percent",
      series: [
        { key: "bankruptcies", label: "Bankruptcies", color: "#b91c1c" },
        { key: "proposals", label: "Consumer proposals", color: "#0f766e" },
      ],
      data: [
        { province: "N.L.", bankruptcies: -7.7, proposals: -0.8 },
        { province: "P.E.I.", bankruptcies: -23.5, proposals: 37.6 },
        { province: "N.S.", bankruptcies: -7.9, proposals: 3.4 },
        { province: "N.B.", bankruptcies: -8.1, proposals: 15.0 },
        { province: "Que.", bankruptcies: 1.3, proposals: 5.1 },
        { province: "Ont.", bankruptcies: 24.8, proposals: 6.6 },
        { province: "Man.", bankruptcies: 16.1, proposals: 2.4 },
        { province: "Sask.", bankruptcies: 18.4, proposals: 9.1 },
        { province: "Alta.", bankruptcies: 11.3, proposals: -0.3 },
        { province: "B.C.", bankruptcies: 5.1, proposals: 12.1 },
      ],
    },
    {
      type: "narrative",
      id: "ontario-bc-housing-read",
      heading: "The housing read is clearest in Ontario and British Columbia",
      body:
        "Ontario recorded **14,642 consumer insolvencies** in Q2, up **10.2% year over year**. Its bankruptcy count climbed **24.8%**, the strongest increase among the four largest provinces. British Columbia recorded **4,207 filings**, up **10.9%**, led by **12.1% growth in proposals**.\n\nThose are also the two provinces where the housing correction has reduced a household's ability to refinance out of trouble. The Bank of Canada's 2026 Financial Stability Report says falling home prices can limit financial flexibility, with the largest declines concentrated in Ontario and British Columbia and the greatest pressure in Toronto and Vancouver condominium markets. Lower equity does not create the original debt problem, but it can remove the exit.\n\nFor investors, that distinction matters. A borrower with stable income and equity can often refinance, sell or restructure. A borrower with weak income, high unsecured debt and little saleable equity has fewer choices. Insolvency data therefore belongs beside listings, price cuts, arrears and labour-market data—not in a separate personal-finance box.",
    },
    {
      type: "callout",
      tone: "warning",
      id: "homeowner-insolvency-caveat",
      heading: "Homeowner insolvencies are rising—but the 8% figure is not a national OSB statistic",
      body:
        "The Globe cited a February 2026 report from Hoyes, Michalos & Associates showing homeowners at **8% of that firm's filings**, up from **5% in 2024**, while two-income households reached 23% of its cases. This is valuable directional evidence from a large Ontario trustee firm, but it should not be presented as the national homeowner share.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "june-insolvency-surge",
      title: "June accelerated across both total and consumer insolvencies",
      caption:
        "Monthly filings in Canada. June 2026 was the second-highest June on record for total insolvencies, behind June 2009. Source: OSB June 2026; historical ranking reported by Better Dwelling.",
      xKey: "period",
      xAxisLabel: "Period",
      yAxisLabel: "Filings",
      format: "number",
      series: [
        { key: "total", label: "Total insolvencies", color: "#111827" },
        { key: "consumer", label: "Consumer insolvencies", color: "#0f766e" },
      ],
      data: [
        { period: "June 2025", total: 11883, consumer: 11464 },
        { period: "May 2026", total: 12536, consumer: 12131 },
        { period: "June 2026", total: 13254, consumer: 12812 },
      ],
    },
    {
      type: "narrative",
      id: "not-one-month-blip",
      heading: "June was not a one-month blip",
      body:
        "Canada recorded **13,254 total insolvencies in June**, up **11.5% from a year earlier**. Consumer filings were **12,812**, up **11.8%**, while the month-over-month gain was 5.6%. Better Dwelling's historical comparison ranks June 2026 second only to June 2009.\n\nThe longer window confirms the pressure. The 12 months ending June contained **150,505 total insolvencies**, up 5.3% and only 670 filings below the comparable record identified by Better Dwelling. Consumer filings accounted for **96.8%** of the total.\n\nThe mix is deteriorating on that longer window too. Consumer bankruptcies rose **8.4%** year over year, faster than the **5.2%** increase in proposals. In other words, both the quarter and the trailing year show the same direction: formal debt relief is becoming more common, and the most severe form is growing faster.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "trailing-year-filing-mix",
      title: "Bankruptcies are growing faster than proposals over the trailing year",
      caption:
        "Consumer insolvency filings for the 12 months ending June 30. Bankruptcies increased 8.4%; proposals increased 5.2%. Source: OSB Table 2.",
      xKey: "period",
      xAxisLabel: "12-month period ending",
      yAxisLabel: "Filings",
      format: "number",
      series: [
        { key: "bankruptcies", label: "Bankruptcies", color: "#b91c1c" },
        { key: "proposals", label: "Consumer proposals", color: "#0f766e" },
      ],
      data: [
        { period: "June 2025", bankruptcies: 29230, proposals: 108437 },
        { period: "June 2026", bankruptcies: 31681, proposals: 114081 },
      ],
    },
    {
      type: "narrative",
      id: "credit-before-mortgage",
      heading: "Consumer credit usually breaks before the mortgage does",
      body:
        "The insolvency count is a lagging indicator: it records households after debt has accumulated and after informal coping strategies have failed. But the underlying credit behaviour can still be an early warning for housing.\n\n[Bank of Canada research](https://www.bankofcanada.ca/2026/02/staff-analytical-paper-2026-3/) using TransUnion data found that mortgage holders who later became delinquent typically increased credit utilization about two years before missing a mortgage payment. Non-mortgage arrears—especially credit cards—often appeared one to two years before mortgage delinquency and intensified in the final six months.\n\nThat makes the CBC interview useful context even though it discussed the first-quarter release. Blair Mantin of Sands & Associates described a recurring B.C. pattern: housing costs leave a small monthly budget gap, credit fills the gap, and the balance compounds until the household needs formal relief. He also said cost of living has replaced self-reported financial mismanagement as the leading cause cited by his firm's clients over the past two years. Those are practitioner observations, not national survey results, but they explain how macro pressure becomes a filing.",
    },
    {
      type: "callout",
      tone: "info",
      id: "realist-read",
      heading: "The Realist read: insolvency is a housing-liquidity signal before it is a foreclosure statistic",
      body:
        "The immediate effect is fewer households able to buy, refinance, renovate or carry an investment property through a weak market. The next effect is more motivated listings where income, unsecured debt and falling equity collide. That does **not** mean every insolvency becomes a forced sale; it means the market's financial margin of safety is shrinking.",
    },
    {
      type: "narrative",
      id: "housing-market-implications",
      heading: "What rising Canadian insolvencies mean for the housing market",
      body:
        "## Buyers\n\nMore insolvencies can reduce the pool of mortgage-qualified buyers and make lenders more conservative at the margin. That can keep transaction volumes soft even if mortgage rates decline. A lower rate does not repair damaged credit, replace lost income or restore a down payment used to service debt.\n\n## Sellers\n\nThe first pressure is usually not foreclosure. It is a seller who needs liquidity, cannot refinance and has less time to wait for an aspirational price. Watch stale listings, repeated price cuts, power-of-sale inventory and condo assignment distress in the same markets where bankruptcy growth is accelerating.\n\n## Rental investors\n\nTenant credit stress can show up as slower rent collection before it appears as mortgage arrears for the landlord. Underwrite vacancy and bad-debt reserves explicitly. If a rental only works when every payment arrives on time and refinancing remains available, it has no shock absorber.\n\n## Lenders and brokers\n\nThe borrower story is increasingly about unsecured debt and available equity, not just the headline mortgage payment. Credit-card utilization, tax debt, renewal payment shocks and loan-to-value should be read together. The [Realist mortgage-delinquency report](/reports/bank-of-canada-consumers-path-mortgage-delinquency-2026) shows why non-mortgage credit can reveal trouble well before a mortgage is 90 days past due.\n\n## Investors looking for opportunity\n\nRising distress does not make every discounted property a deal. It increases the number of situations where speed and certainty matter. Verify title, liens, property condition, tenancy, arrears, legal process and realistic resale value before treating a motivated seller as an automatic margin of safety.",
    },
    {
      type: "narrative",
      id: "canada-insolvency-faq",
      heading: "Canadian insolvency FAQ",
      body:
        "## What is a consumer insolvency in Canada?\n\nIt is a formal filing for debt relief under the Bankruptcy and Insolvency Act, administered through a Licensed Insolvency Trustee. OSB consumer data includes bankruptcies and proposals filed by individuals whose liabilities are primarily consumer-related.\n\n## Is insolvency the same as bankruptcy?\n\nNo. Bankruptcy is one form of insolvency filing. A consumer proposal is a legally binding offer to repay part or all of qualifying debt over time. In Q2 2026, proposals represented 77.1% of Canadian consumer insolvencies.\n\n## Are Canadian bankruptcies rising in 2026?\n\nYes. There were 8,600 consumer bankruptcies in Q2 2026, up 13.5% from Q1 and 10.3% from Q2 2025. The 12-month bankruptcy total rose 8.4%.\n\n## Are homeowner insolvencies rising?\n\nOne large Ontario trustee firm reported that homeowners represented 8% of its 2025 filings, up from 5% in 2024. The OSB quarterly table does not identify national filings by homeownership status, so firm-level evidence should be treated as directional.\n\n## Do rising insolvencies mean Canadian home prices must fall?\n\nNot by themselves. Home prices respond to employment, mortgage rates, listings, population, supply and local demand as well as credit stress. Rising insolvencies weaken household resilience and can add motivated supply, but they are one input—not a standalone price forecast.",
    },
    {
      type: "narrative",
      id: "methodology",
      heading: "Methodology and important limits",
      body:
        "This report uses non-seasonally adjusted filing counts from OSB's June and Q2 2026 releases. Quarter-over-quarter comparisons can contain seasonal effects, so the year-over-year and trailing-12-month measures should carry more weight.\n\nA filing is not a household survey and does not identify every distressed borrower. Many households manage debt without filing, refinance, sell assets or seek informal arrangements. The OSB data also does not identify whether a consumer owns a home. Homeowner and two-income figures cited by the Globe come from Hoyes, Michalos & Associates' client sample and are labelled accordingly.\n\nThis is market research, not legal, credit, mortgage or investment advice. Anyone considering a proposal or bankruptcy should get advice specific to their circumstances from a Licensed Insolvency Trustee or another qualified professional.",
    },
  ],
  sources: [
    {
      label: "Insolvency Statistics in Canada—Second quarter of 2026",
      url: OSB_Q2_URL,
      publisher: "Office of the Superintendent of Bankruptcy Canada",
    },
    {
      label: "Insolvency Statistics in Canada—June 2026",
      url: OSB_JUNE_URL,
      publisher: "Office of the Superintendent of Bankruptcy Canada",
    },
    {
      label: "Consumer insolvencies climbed in second quarter, putting Canada on track for worst year since 2009",
      url: GLOBE_URL,
      publisher: "The Globe and Mail",
    },
    {
      label: "Canadian Insolvencies Surge To Second-Highest June On Record",
      url: BETTER_DWELLING_URL,
      publisher: "Better Dwelling",
    },
    {
      label: "Canadians filing for insolvency at rates not seen in more than a decade",
      url: CBC_VIDEO_URL,
      publisher: "CBC / Hanomansing Tonight",
    },
    {
      label: "Consumers' Path to Mortgage Delinquency",
      url: BOC_DELINQUENCY_URL,
      publisher: "Bank of Canada Staff Analytical Paper 2026-3",
    },
    {
      label: "Financial Stability Report 2026: Households",
      url: BOC_FSR_URL,
      publisher: "Bank of Canada",
    },
  ],
  cta: {
    toolUrl: "/tools/analyzer",
    headline: "Do not buy a distressed story. Underwrite the actual property.",
    body:
      "Use Realist to test the mortgage, rent, vacancy, carrying costs and downside before deciding whether a motivated sale contains a real margin of safety.",
  },
};
