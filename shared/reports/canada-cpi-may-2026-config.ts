import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";

const STATCAN_DAILY_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260622/dq260622a-eng.htm";
const STATCAN_TABLE_URL =
  "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401";
const REALIST_RATES_TOOL_URL = "/tools/mortgage-rates";

export const canadaCpiMay2026ConfigReport: ReportContent = {
  slug: "canada-cpi-may-2026-rates-hold",
  title: "Canada CPI May 2026: Inflation Is Up, But The Rate Story Is Still Weak Demand",
  dek:
    "Canada's headline CPI accelerated to 3.2% in May, but the real estate read is not a clean higher-for-longer story. Gasoline, food and travel pushed the print higher while shelter kept cooling.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-07-05",
  kind: "macro",
  tags: ["inflation", "cpi", "statcan", "bank-of-canada", "rates", "housing"],
  ogImage: "/og-image.png",
  metaTitle: "Canada CPI May 2026: Inflation Up, But Bank of Canada Still Likely Holds | Realist",
  metaDescription:
    "Realist analysis of Statistics Canada's May 2026 CPI release: headline inflation rose to 3.2%, gasoline drove the acceleration, shelter cooled, and the Bank of Canada likely waits for weaker economic data.",
  heroStat: {
    label: "Canada headline CPI, May 2026",
    value: "3.2%",
    detail: "Up from 2.8% in April. Excluding gasoline, CPI was 2.2%.",
  },
  sections: [
    {
      type: "statGrid",
      id: "headline-stats",
      heading: "The May CPI print",
      stats: [
        { label: "Headline CPI", value: "3.2%", detail: "Year over year, up from 2.8%", trend: "up" },
        { label: "CPI excluding gasoline", value: "2.2%", detail: "Up from 2.0%", trend: "up" },
        { label: "Month over month", value: "1.0%", detail: "0.5% seasonally adjusted", trend: "up" },
        { label: "Gasoline", value: "33.2%", detail: "Year over year", trend: "up" },
        { label: "Shelter", value: "1.7%", detail: "Down from 1.8%", trend: "down" },
        { label: "Rent", value: "3.5%", detail: "Lowest since January 2022", trend: "down" },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line",
      body:
        "Inflation moved the wrong way in May. Headline CPI rose to **3.2%**, up from **2.8%** in April. That is not nothing, and it gives the Bank of Canada less room to sound dovish.\n\nBut this is also not a clean story where the Bank immediately needs to chase inflation higher. The print was heavily affected by gasoline, travel and food. Strip out gasoline and inflation was **2.2%**, up from **2.0%**. Shelter kept decelerating. Rent inflation slowed to its lowest pace since January 2022. Owned accommodation and mortgage-interest pressure are not acting like the 2022-2024 inflation problem anymore.\n\nMy read: the Bank of Canada probably holds unless the US Federal Reserve forces their hand through the currency and import-price channel. The market seems to be pricing a world where the Fed may need to hike, but the Bank of Canada cannot really follow without breaking an already weak domestic economy.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "major-components",
      title: "Major CPI components, May 2026",
      caption:
        "Year-over-year change by major component or reported driver. Gasoline and transportation explain the heat; shelter is not the problem it was earlier in the cycle. Source: Statistics Canada, The Daily, June 22, 2026.",
      xKey: "component",
      yAxisLabel: "Year-over-year change",
      format: "percent",
      referenceLine: { value: 3.2, label: "Headline CPI" },
      series: [{ key: "yoy", label: "YoY change" }],
      data: [
        { component: "Gasoline", yoy: 33.2 },
        { component: "Transportation", yoy: 9.0 },
        { component: "Fresh vegetables", yoy: 9.0 },
        { component: "Air transportation", yoy: 7.4 },
        { component: "Fresh fruit", yoy: 5.3 },
        { component: "Store food", yoy: 4.3 },
        { component: "Headline CPI", yoy: 3.2 },
        { component: "Ex gasoline", yoy: 2.2 },
        { component: "Shelter", yoy: 1.7 },
      ],
    },
    {
      type: "chart",
      chartType: "bar",
      id: "april-to-may",
      title: "What accelerated from April to May",
      caption:
        "Selected StatCan values comparing April and May year-over-year inflation. The headline rose, but the composition matters.",
      xKey: "series",
      yAxisLabel: "Year-over-year change",
      format: "percent",
      series: [
        { key: "april", label: "April 2026" },
        { key: "may", label: "May 2026" },
      ],
      data: [
        { series: "Headline CPI", april: 2.8, may: 3.2 },
        { series: "Ex gasoline", april: 2.0, may: 2.2 },
        { series: "Gasoline", april: 28.6, may: 33.2 },
        { series: "Store food", april: 3.8, may: 4.3 },
        { series: "Fresh vegetables", april: 4.1, may: 9.0 },
        { series: "Shelter", april: 1.8, may: 1.7 },
        { series: "Rent", april: 3.6, may: 3.5 },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      id: "rates-callout",
      heading: "The rate risk is not simple",
      body:
        "If the Fed hikes and the Bank of Canada does not, the Canadian dollar can weaken and import inflation can get worse. If the Bank follows the Fed into hikes, it risks tightening into a weak Canadian economy. That is the trap: external inflation pressure meets domestic demand destruction.",
    },
    {
      type: "narrative",
      id: "bank-of-canada-read",
      heading: "Why I still think the Bank of Canada holds",
      body:
        "The headline print gives people an easy higher-rates take. Inflation is up, so rates should go up. That is too simple.\n\nThe Bank of Canada has to care about the source of inflation. A gasoline shock is not the same thing as a broad demand boom. Fresh vegetables jumping because of weather, tariffs and fuel costs is not the same thing as households suddenly having too much purchasing power. Airfares rising because airlines face higher fuel costs is not the same thing as a domestic credit impulse.\n\nRates work by destroying demand. They do not make tomatoes easier to grow, reopen a shipping route, or produce more crude oil. If the inflation problem is mainly supply, energy and imported-cost pressure, the Bank can crush demand and still not solve the source of the price increase.\n\nThat is why I think the more likely sequence is hold, wait, then cut when the weaker economic data becomes harder to ignore. I do not see much real upside in Canadian rates from here. The cleaner setup is inflation pressure causing demand destruction, demand destruction turning into recession risk, and recession risk eventually pulling rates down.",
    },
    {
      type: "narrative",
      id: "housing-read-through",
      heading: "The housing read-through",
      body:
        "For real estate, the important part is shelter. Shelter inflation slowed to **1.7%**. Homeowners' replacement cost was down **2.5%** year over year for the 13th consecutive month. Other owned accommodation expenses were down **2.1%**. Mortgage interest cost kept decelerating and was slightly negative year over year. Rent inflation slowed to **3.5%**, the lowest since January 2022.\n\nThat does not mean housing is affordable. It means the inflation engine has moved away from the housing components that did so much damage earlier in the cycle.\n\nFor buyers, this argues against panic. A hotter CPI headline can keep fixed-rate sentiment cautious, but the domestic housing data still points to weak demand, improving affordability from the peak, and sellers who increasingly have to meet the market. For sellers, it is a warning against assuming rate cuts will rescue pricing quickly. The Bank can hold longer than people want, even if the eventual direction is down.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "shelter-breakdown",
      title: "Shelter is cooling, not re-accelerating",
      caption:
        "Selected shelter-related StatCan signals from the May 2026 CPI release. The headline accelerated, but shelter did not.",
      xKey: "item",
      yAxisLabel: "Year-over-year change",
      format: "percent",
      referenceLine: { value: 0, label: "Zero" },
      series: [{ key: "yoy", label: "YoY change" }],
      data: [
        { item: "Rent", yoy: 3.5 },
        { item: "Shelter", yoy: 1.7 },
        { item: "Mortgage interest cost", yoy: -0.2 },
        { item: "Other owned accommodation", yoy: -2.1 },
        { item: "Homeowners' replacement cost", yoy: -2.5 },
      ],
    },
    {
      type: "narrative",
      id: "market-pricing",
      heading: "What the market seems to be saying",
      body:
        "The market is trying to price two things at the same time. One is a US inflation/rates problem. The other is a Canadian growth problem.\n\nIf the Fed has to hike, Canada imports some of that pressure through the dollar and global rate markets. But the Bank of Canada is dealing with a much weaker domestic setup: stretched households, soft housing activity, slower rent inflation, weaker confidence, and an economy where more rate pressure can turn caution into contraction.\n\nThat is why the Canada-US split matters. The Fed may be able to talk tougher if US demand remains resilient. The Bank of Canada has less room. It can hold. It can warn. It can wait for the data. But chasing the Fed higher would be a very different bet when Canadian households are already acting like they have had enough.",
    },
    {
      type: "callout",
      tone: "info",
      id: "investor-playbook",
      heading: "Investor playbook",
      body:
        "Do not underwrite off a simple rate-cut story. Underwrite the hold. Assume relief is slower than buyers want, but also assume the upside risk in Canadian rates is limited by weak demand. The opportunity is not speculative duration. It is buying assets where the math works before the eventual recession/rate-cut story becomes consensus.",
    },
  ],
  sources: [
    {
      label: "Consumer Price Index, May 2026",
      url: STATCAN_DAILY_URL,
      publisher: "Statistics Canada, The Daily",
    },
    {
      label: "Consumer Price Index, monthly, not seasonally adjusted",
      url: STATCAN_TABLE_URL,
      publisher: "Statistics Canada Table 18-10-0004-01",
    },
  ],
  cta: {
    toolUrl: REALIST_RATES_TOOL_URL,
    headline: "Stress-test the rate path before you buy",
    body:
      "A hotter CPI print does not automatically mean higher Canadian mortgage rates, but it does mean buyers and investors should run the numbers with a longer hold period and less immediate rate relief.",
  },
};
