import { DEFAULT_AUTHOR, type ReportContent } from "../reportContent";
import {
  cmaPermitLeaders,
  dwellingUnitHistory,
  nonResidentialMixHistory,
  provincePermitSnapshot,
  residentialMixHistory,
  sectorPermitHistory,
  totalPermitHistory,
} from "./canada-building-permits-june-2026-data";

const STATCAN_DAILY_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260812/dq260812a-eng.htm";
const STATCAN_DATA_TABLE_URL =
  "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410029201";
const STATCAN_TABLE_1_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260812/t001a-eng.htm";
const STATCAN_TABLE_2_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260812/t002a-eng.htm";
const STATCAN_TABLE_3_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260812/t003a-eng.htm";
const STATCAN_CHART_BASE =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260812";
const STATCAN_DASHBOARD_URL =
  "https://www150.statcan.gc.ca/n1/en/catalogue/71-607-X2021005";

const juneContributionData = [
  { component: "Residential", change: 0.4797 },
  { component: "Industrial", change: 0.2688 },
  { component: "Commercial", change: 0.0679 },
  { component: "Institutional", change: 1.51 },
];

export const canadaBuildingPermitsJune2026ConfigReport: ReportContent = {
  slug: "canada-building-permits-june-2026-housing-outlook",
  title: "Canada Building Permits Jump 18.5%—But the Housing Pipeline Is Softer Than the Headline",
  dek:
    "Canadian building permits reached $14.9 billion in June 2026. Most of the rebound came from institutional projects, while second-quarter residential intentions fell 4.3% and authorized units remained below last year.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-08-12",
  kind: "market",
  tags: [
    "Canada building permits June 2026",
    "Canadian housing construction",
    "housing supply Canada",
    "multi-unit housing permits",
    "Ontario building permits",
    "Toronto building permits",
    "Statistics Canada building permits",
    "real estate development Canada",
    "Canadian housing market outlook",
  ],
  metaTitle: "Canada Building Permits June 2026: Housing Outlook",
  metaDescription:
    "Canada building permits jumped 18.5% to $14.9B in June 2026, but institutional projects drove the gain as the quarterly housing pipeline weakened.",
  ogImage: "/reports/canada-building-permits-june-2026-housing-outlook/og.png",
  heroStat: {
    label: "Total Canadian building permits, June 2026",
    value: "$14.9B",
    detail:
      "Up 18.5% from May and 22.4% from June 2025 in current dollars. Institutional permits generated almost two-thirds of the monthly increase.",
  },
  sections: [
    {
      type: "statGrid",
      id: "june-building-permit-headlines",
      heading: "Canada building permits: June 2026 at a glance",
      stats: [
        { label: "Total permits", value: "$14.9B", detail: "+18.5% month over month", trend: "up" },
        { label: "Residential", value: "$8.1B", detail: "+6.3% month over month", trend: "up" },
        { label: "Non-residential", value: "$6.8B", detail: "+37.5% month over month", trend: "up" },
        { label: "Authorized dwellings", value: "26,106", detail: "+8.4% month over month", trend: "up" },
        { label: "Q2 residential permits", value: "−4.3%", detail: "Constant-dollar quarterly change", trend: "down" },
        { label: "Q2 authorized units", value: "80,000", detail: "Down 2.7% from Q2 2025", trend: "down" },
      ],
    },
    {
      type: "narrative",
      id: "bottom-line",
      heading: "Bottom line: a spectacular permit headline is not the same thing as a housing boom",
      body:
        "Statistics Canada reported an **18.5% monthly jump** in the value of Canadian building permits in June, taking the total to **$14.9 billion**. That erased the declines recorded in April and May and lifted the current-dollar total 22.4% above June 2025.\n\nThe composition is the story. Non-residential permits produced **$1.85 billion**, or roughly 79%, of the $2.33 billion national monthly increase. A surge in institutional permits—concentrated in an Ontario medical project in the Toronto census metropolitan area—accounted for **$1.51 billion**, or almost 65%, of the entire increase. Residential permits contributed a much smaller **$480 million**.\n\nFor housing, the June direction is positive but the quarterly trend is not. In inflation-adjusted terms, residential construction intentions fell **4.3% in the second quarter**, multi-unit intentions fell by $873.7 million, and the 80,000 dwellings authorized during the quarter were below the 82,200 authorized one year earlier. The clean read is: **June bounced, but Canada's near-term housing pipeline has not decisively re-accelerated.**",
    },
    {
      type: "chart",
      chartType: "line",
      id: "total-building-permits-history",
      title: "The June permit total is a five-year high in current dollars",
      caption:
        "Monthly value of Canadian building permits, seasonally adjusted, June 2021 to June 2026. Values are billions of dollars. The constant-dollar series uses 2023 prices and shows that part of the nominal record reflects higher construction costs. Source: Statistics Canada Chart 1 and Table 34-10-0292-01.",
      xKey: "month",
      yAxisLabel: "$ billions",
      format: "currency",
      series: [
        { key: "current", label: "Current dollars", color: "#0f766e" },
        { key: "constant", label: "2023 constant dollars", color: "#f97316" },
      ],
      data: totalPermitHistory,
    },
    {
      type: "narrative",
      id: "nominal-versus-real",
      heading: "The nominal record overstates how much physical construction momentum improved",
      body:
        "The current-dollar permit total reached **$14.886 billion**, while the inflation-adjusted total was **$13.429 billion in 2023 dollars**. Real permits still rose sharply—18.0% month over month and 18.6% year over year—so this is not merely an inflation story. But the gap between the two lines matters when comparing today's development pipeline with earlier years.\n\nPermit values measure the estimated construction value authorized by municipalities. They can jump when one hospital, factory or large apartment project is approved. That makes the monthly series useful for identifying pipeline events, but noisy as a broad economic signal. The trend-cycle lines below are better for judging whether momentum is persistent.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "june-permit-contributions",
      title: "Institutional projects generated almost two-thirds of June's national increase",
      caption:
        "Contribution to the May-to-June change in total permit value, billions of current dollars. Industrial, commercial and institutional are the three non-residential components; together with residential they reconcile to the $2.326 billion total increase. Source: Statistics Canada.",
      xKey: "component",
      yAxisLabel: "$ billions added in June",
      format: "currency",
      series: [{ key: "change", label: "Monthly contribution", color: "#2563eb" }],
      data: juneContributionData,
    },
    {
      type: "callout",
      tone: "warning",
      id: "headline-distortion",
      heading: "The investor read",
      body:
        "Do not translate the 18.5% headline into 18.5% more housing supply. **Institutional permits rose 90.2% in one month**, mainly because of a Toronto-area medical institution. The residential increase was 6.3%, and Ontario residential permits actually fell 6.1%.",
    },
    {
      type: "chart",
      chartType: "line",
      id: "residential-versus-non-residential",
      title: "Residential permit values remain larger, but non-residential activity caused the June spike",
      caption:
        "Monthly value of building permits, seasonally adjusted, in billions of current dollars. The interactive tooltip exposes every monthly observation from June 2021. Source: Statistics Canada Chart 3.",
      xKey: "month",
      yAxisLabel: "$ billions",
      format: "currency",
      series: [
        { key: "residential", label: "Residential", color: "#0f766e" },
        { key: "nonResidential", label: "Non-residential", color: "#7c3aed" },
      ],
      data: sectorPermitHistory,
    },
    {
      type: "narrative",
      id: "quarterly-pipeline",
      heading: "The second-quarter housing pipeline weakened beneath the June rebound",
      body:
        "The quarterly numbers strip away some of the monthly noise. Total permit value rose 2.7% in inflation-adjusted terms in Q2 2026, but the entire gain came from non-residential construction. Constant-dollar non-residential permits rose by **$1.9 billion to $15.4 billion**, the largest quarterly increase in the series.\n\nResidential permits moved the other way, falling by **$944.2 million to $21.1 billion**. Multi-unit construction accounted for $873.7 million of that decline, led by Ontario (**−$582.4 million**) and British Columbia (**−$386.2 million**). Alberta added $180.1 million and partially offset the weakness.\n\nThis matters because housing completions arrive with long lags. A weaker permit quarter does not reduce today's supply, but it can reduce the volume of projects available to start, finance and complete later—especially if pre-sales, construction lending or project economics remain difficult.",
    },
    {
      type: "chart",
      chartType: "line",
      id: "authorized-dwelling-units",
      title: "Multi-family projects now account for 84% of monthly authorized dwellings",
      caption:
        "Number of dwelling units authorized, seasonally adjusted. June's 26,106 total consisted of 21,924 multi-family units and 4,182 single-family units. Source: Statistics Canada Chart 2 and Daily Table 1.",
      xKey: "month",
      yAxisLabel: "Authorized dwelling units",
      format: "number",
      series: [
        { key: "total", label: "Total residential", color: "#0f172a" },
        { key: "multi", label: "Multi-family", color: "#2563eb" },
        { key: "single", label: "Single-family", color: "#f97316" },
      ],
      data: dwellingUnitHistory,
    },
    {
      type: "narrative",
      id: "units-versus-value",
      heading: "Canada is authorizing units—but increasingly through large, lumpy multi-unit projects",
      body:
        "June authorized **26,106 dwellings**, up 8.4% from May and 6.5% from June 2025. Multi-family projects supplied **21,924 units**, equal to 84% of the national total. Single-family permits supplied 4,182 units.\n\nMulti-family dominance is necessary for high-volume urban supply, but it makes the pipeline more sensitive to project financing and absorption. One permit can represent hundreds of units, and permission does not guarantee an immediate construction start. Projects can be redesigned, delayed, phased or cancelled after approval.\n\nFor investors, the practical implication is local: a large authorized condo or rental project matters most where it competes for the same tenants, resale buyers and trades. National permit totals should inform the macro view, then be checked against the actual project pipeline around the property being underwritten.",
    },
    {
      type: "chart",
      chartType: "line",
      id: "single-versus-multi-value",
      title: "Multi-unit permit values have separated from single-family construction",
      caption:
        "Seasonally adjusted permit value in billions of current dollars. June multi-family value was $5.307 billion versus $2.805 billion for single-family dwellings. Source: Statistics Canada Chart 4.",
      xKey: "month",
      yAxisLabel: "$ billions",
      format: "currency",
      series: [
        { key: "multi", label: "Multi-family", color: "#2563eb" },
        { key: "single", label: "Single-family", color: "#f97316" },
      ],
      data: residentialMixHistory,
    },
    {
      type: "chart",
      chartType: "bar",
      id: "province-sector-change",
      title: "Provincial momentum split sharply between housing and non-residential projects",
      caption:
        "May-to-June percentage change in seasonally adjusted permit value. Small jurisdictions can post extreme rates from a low base; use the tooltip and the accompanying narrative with care. Source: Statistics Canada Daily Table 2.",
      xKey: "region",
      yAxisLabel: "Monthly change",
      format: "percent",
      referenceLine: { value: 0, label: "No change" },
      series: [
        { key: "resMom", label: "Residential", color: "#0f766e" },
        { key: "nonResMom", label: "Non-residential", color: "#7c3aed" },
      ],
      data: provincePermitSnapshot,
    },
    {
      type: "narrative",
      id: "provincial-divergence",
      heading: "Alberta and Quebec carried the cleaner housing signal; Ontario carried the institutional headline",
      body:
        "**Alberta** posted the strongest large-province residential gain: permit value rose 24.9% in June and 13.5% year over year. It led the single-family increase and also added to multi-unit value. **Quebec** residential permits rose 16.3% in June and 24.7% year over year, with a $201.3 million monthly gain in multi-unit construction.\n\n**Ontario's** total permit value jumped 28.5%, but residential permits fell 6.1%. Non-residential value rose 73.0%, reflecting the Toronto-area medical institution. This is why Ontario's headline should not be treated as a synchronized construction upturn.\n\n**British Columbia** fell 9.5% overall in June, with residential down 4.6% and non-residential down 16.1%. Yet both were still above June 2025, illustrating how volatile month-to-month approvals can be. **Saskatchewan's** 101.6% total jump was driven largely by industrial permits and a much smaller base.",
    },
    {
      type: "chart",
      chartType: "bar",
      id: "largest-cma-permit-markets",
      title: "Toronto represented more than one-quarter of Canada's June permit value",
      caption:
        "June 2026 permit value for the 12 largest census metropolitan areas in the Daily's selected table, seasonally adjusted, millions of current dollars. Toronto's $4.013 billion total includes the major medical institution. Source: Statistics Canada Daily Table 3.",
      xKey: "cma",
      yAxisLabel: "$ millions",
      format: "currency",
      series: [{ key: "june", label: "June permit value", color: "#2563eb" }],
      data: cmaPermitLeaders,
    },
    {
      type: "narrative",
      id: "cma-implications",
      heading: "The city rankings show concentration—not a uniform national expansion",
      body:
        "Toronto's permit value rose **73.3% in one month to $4.013 billion** and represented about 27% of Canada's total. Montréal rose 43.1% to $1.403 billion, Calgary rose 38.5% to $863 million and Hamilton rose 39.9% to $257 million.\n\nThe declines were equally important. Vancouver fell 17.5% from May, London fell 30.3%, and Ottawa–Gatineau fell 5.8%. Oshawa, outside the 12 largest values shown in the chart, fell 59.2% in the month and 82.0% year over year.\n\nA national housing thesis therefore needs a local second pass. Compare permit momentum with housing starts, completions, unsold inventory, rents and resale listings. A city can have a large permit month without creating immediate supply, and it can have a weak permit month while still completing projects approved years earlier.",
    },
    {
      type: "chart",
      chartType: "line",
      id: "non-residential-components",
      title: "Institutional permits broke away from commercial and industrial activity in June",
      caption:
        "Seasonally adjusted permit value in billions of current dollars. The sharp institutional move is the clearest evidence that June's national total was project-driven. Source: Statistics Canada Chart 5.",
      xKey: "month",
      yAxisLabel: "$ billions",
      format: "currency",
      series: [
        { key: "institutional", label: "Institutional", color: "#7c3aed" },
        { key: "commercial", label: "Commercial", color: "#0f766e" },
        { key: "industrial", label: "Industrial", color: "#f97316" },
      ],
      data: nonResidentialMixHistory,
    },
    {
      type: "narrative",
      id: "housing-market-implications",
      heading: "What the June building-permit report means for Canadian real estate",
      body:
        "## Homebuyers\n\nThe report does not imply that a wave of finished homes is arriving immediately. The monthly residential rebound is constructive, but Q2 permit value and authorized units were weaker than the preceding quarter or year. Near-term resale conditions will still be driven more directly by employment, mortgage rates and listings. Read this alongside the [July Labour Force Survey report](/insights/reports/canada-labour-force-survey-july-2026-housing).\n\n## Rental and condo investors\n\nMulti-family units dominate the pipeline. Identify the actual projects within the tenant and resale catchment area, then stress-test rent, vacancy and exit assumptions for their likely completion windows. A permit is an early supply signal, not a delivery date.\n\n## Developers and land investors\n\nJune shows approvals can still happen at scale, but Q2 residential weakness is consistent with difficult project economics. Land value should be based on financeable density, realistic absorption and current construction costs—not merely maximum planning permission.\n\n## Construction and renovation businesses\n\nThe public-infrastructure pipeline is stronger than the residential headline. Firms exposed to institutional work may see a different opportunity set from trades tied mainly to condos or detached housing. Geography and project type matter more than the national total.\n\n## Policymakers\n\nA permit is only one handoff in the supply chain. Faster approvals help, but permitted units still require serviced land, financing, labour, materials and sufficient end demand. The weaker quarterly residential figures show why permit counts alone cannot establish that housing targets are on track.",
    },
    {
      type: "callout",
      tone: "info",
      id: "explore-source-data",
      heading: "Explore every attached Statistics Canada table",
      body:
        "The source links below include the full monthly Table 34-10-0292-01 dataset, Canada's detailed residential/non-residential table, the province and territory table, the CMA table, and each of the five visual data tables reproduced interactively in this report.",
    },
    {
      type: "narrative",
      id: "building-permits-faq",
      heading: "Canada building permits FAQ",
      body:
        "## What were Canadian building permits in June 2026?\n\nThe seasonally adjusted value was $14.886 billion, up 18.5% from May and 22.4% from June 2025 in current dollars.\n\n## Did housing permits rise in June 2026?\n\nYes. Residential permit value rose 6.3% to $8.111 billion. Multi-family value rose 5.6% and single-family value rose 7.5%.\n\n## Why did total Canadian building permits rise so much?\n\nNon-residential permits rose 37.5%. Institutional permits rose 90.2% to $3.185 billion, mainly because of a newly approved medical institution in the Toronto CMA.\n\n## Are Canadian housing permits strengthening?\n\nJune strengthened, but Q2 weakened. In constant dollars, residential permits fell 4.3% in the second quarter and authorized dwelling units were 2.7% below Q2 2025. One month is not yet a durable trend.\n\n## Is a building permit the same as a housing start?\n\nNo. A permit records construction authorized by a municipality. Work may begin later, be phased, redesigned or not proceed. Housing starts measure when construction has actually begun.\n\n## Which provinces had the strongest residential permit growth?\n\nAmong the largest provinces, Alberta rose 24.9% month over month, Quebec rose 16.3%, and Manitoba rose 17.0%. Ontario fell 6.1% and British Columbia fell 4.6%.",
    },
    {
      type: "narrative",
      id: "methodology",
      heading: "Methodology and limits",
      body:
        "This report recreates all five visuals attached to Statistics Canada's August 12 Daily release using the underlying HTML data tables and adds interactive province and CMA comparisons from the three selected release tables. Historical charts cover June 2021 through June 2026. Unless stated otherwise, figures are seasonally adjusted and expressed in current dollars.\n\nCurrent-dollar values are appropriate for month-to-month project comparisons but combine changes in intended construction volume, project mix and prices. Constant-dollar figures use 2023 prices. Trend-cycle estimates can change as later observations are added, and Statistics Canada marks April and May 2026 values as revised and June as preliminary. Data may not add exactly because of rounding.\n\nPermit values are construction intentions, not actual investment, starts or completions. Small provinces and territories can show very large percentage changes from small dollar bases. This is market research, not a forecast or investment recommendation.",
    },
  ],
  sources: [
    {
      label: "Building permits, June 2026",
      url: STATCAN_DAILY_URL,
      publisher: "Statistics Canada, The Daily",
    },
    {
      label: "Building permits, by type of structure and type of work",
      url: STATCAN_DATA_TABLE_URL,
      publisher: "Statistics Canada Table 34-10-0292-01",
    },
    {
      label: "Dwelling units and value of residential and non-residential permits—Canada",
      url: STATCAN_TABLE_1_URL,
      publisher: "Statistics Canada Daily Table 1",
    },
    {
      label: "Value of building permits by province and territory",
      url: STATCAN_TABLE_2_URL,
      publisher: "Statistics Canada Daily Table 2",
    },
    {
      label: "Value of building permits by census metropolitan area",
      url: STATCAN_TABLE_3_URL,
      publisher: "Statistics Canada Daily Table 3",
    },
    {
      label: "Total value of building permits, seasonally adjusted",
      url: `${STATCAN_CHART_BASE}/cg-a001-eng.htm`,
      publisher: "Statistics Canada Chart 1",
    },
    {
      label: "Number of residential units authorized",
      url: `${STATCAN_CHART_BASE}/cg-a002-eng.htm`,
      publisher: "Statistics Canada Chart 2",
    },
    {
      label: "Residential and non-residential permit value",
      url: `${STATCAN_CHART_BASE}/cg-a003-eng.htm`,
      publisher: "Statistics Canada Chart 3",
    },
    {
      label: "Single-family and multi-family permit value",
      url: `${STATCAN_CHART_BASE}/cg-a004-eng.htm`,
      publisher: "Statistics Canada Chart 4",
    },
    {
      label: "Industrial, commercial and institutional permit value",
      url: `${STATCAN_CHART_BASE}/cg-a005-eng.htm`,
      publisher: "Statistics Canada Chart 5",
    },
    {
      label: "Building permits: Interactive Dashboard",
      url: STATCAN_DASHBOARD_URL,
      publisher: "Statistics Canada",
    },
  ],
  cta: {
    toolUrl: "/tools/analyzer",
    headline: "Translate the construction pipeline into property-level risk",
    body:
      "Use Realist to stress-test rent, vacancy, financing and exit assumptions before deciding whether new supply strengthens—or threatens—the deal.",
  },
};
