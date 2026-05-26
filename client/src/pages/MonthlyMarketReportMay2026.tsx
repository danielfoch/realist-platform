import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Droplet,
  ExternalLink,
  FileText,
  Flame,
  Home,
  Landmark,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import imgCoSigners from "@assets/image_1779812661171.png";
import imgMortgageWebsites from "@assets/image_1779812672472.png";
import imgGiftedDown from "@assets/image_1779812678982.png";
import imgVariableRate from "@assets/image_1779812698294.png";
import imgDelinquencyLender from "@assets/image_1779812713059.png";
import imgFredPrices from "@assets/image_1779812719077.png";
import imgInsolvencies from "@assets/image_1779812732059.png";
import imgHpiProvince from "@assets/image_1779812751418.png";
import imgTorontoDecade from "@assets/image_1779812772941.png";
import imgMonthlySales from "@assets/image_1779812780813.png";
import imgMlsBenchmark from "@assets/image_1779812787411.png";
import imgYoYByProv from "@assets/image_1779812799714.png";
import imgHpiByType from "@assets/image_1779812803689.png";
import imgSalesActivity from "@assets/image_1779812809612.png";
import imgNewListings from "@assets/image_1779812814854.png";
import imgMarketBalance from "@assets/image_1779812820655.png";

const REPORT_TITLE = "Canadian Real Estate — Monthly Market Report, May 2026";
const REPORT_SUBTITLE =
  "A 30-45 minute investor webinar deck: events, macro snapshot, labour, inflation, oil, BoC outlook, mortgage stress, supply, demographics, distress and the playbook.";
const REPORT_SLUG = "monthly-market-report-may-2026";
const PUBLISH_DATE = "May 25, 2026";

const CHART = {
  grid: "hsl(var(--border))",
  primary: "hsl(var(--primary))",
  neutral: "#64748b",
  positive: "#16a34a",
  negative: "#dc2626",
  warn: "#f59e0b",
  rates: "#7c3aed",
  housing: "#2563eb",
  oil: "#0f172a",
} as const;

const SOURCES = [
  {
    label: "CMHC — Residential Mortgage Industry Report",
    url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/research-reports/housing-finance/residential-mortgage-industry-report",
  },
  {
    label: "CMHC — 2026 Mortgage Consumer Survey",
    url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/surveys/mortgage-consumer-surveys/2026-mortgage-consumer-survey",
  },
  {
    label: "Statistics Canada — Housing portal",
    url: "https://www150.statcan.gc.ca/n1/dai-quo/ssi/homepage/rel-com/theme18-eng.htm",
  },
  {
    label: "Statistics Canada — Consumer Price Index",
    url: "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes",
  },
  {
    label: "Statistics Canada — Labour Force Survey, April 2026 (May 8 release)",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/260508/dq260508a-eng.htm",
  },
  {
    label: "Investing.com — Oil Shocks and Recessionary Outcomes",
    url: "https://ca.investing.com/analysis/oil-shocks-and-recessionary-outcomes-200623467",
  },
  {
    label: "Macro chart — oil & cycle reference image",
    url: "https://pbs.twimg.com/media/HJBIEL6XEAAS4qa?format=jpg&name=large",
  },
  { label: "Realist.ca — Deal analyzer, motivated deals, market reports", url: "https://realist.ca" },
  { label: "Valery.ca — Mortgage marketplace data", url: "https://valery.ca" },
  { label: "Meet Your Homies — Investor community", url: "https://meetyourhomies.com" },
] as const;

const EVENTS = [
  {
    id: "tech-week",
    icon: Sparkles,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    name: "Real Estate @ Toronto Tech Week",
    tagline: "Where Toronto's PropTech, capital, and operators meet during Tech Week.",
    url: "https://luma.com/zkxtsqcv",
    cta: "Register on Luma",
    promo: null as string | null,
  },
  {
    id: "ai-meets-re",
    icon: Ticket,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    name: "AI Meets Real Estate 2026",
    tagline: "The future of real estate, AI-first. Use code REALESTATE50 for 50% off.",
    url: "https://www.eventbrite.com/e/ai-meets-real-estate-2026-the-future-of-real-estate-is-happening-here-tickets-1988504454352",
    cta: "Get tickets on Eventbrite",
    promo: "REALESTATE50 · 50% OFF",
  },
  {
    id: "multiplex-edmonton",
    icon: Calendar,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    name: "Unpacking Multiplexes — Edmonton",
    tagline: "Underwriting, financing and zoning for Alberta multiplex deals. Use REM25 for 25% off.",
    url: "https://www.eventbrite.ca/e/unpacking-multiplexes-edmonton-tickets-1987646800085",
    cta: "Get tickets on Eventbrite",
    promo: "REM25 · 25% OFF",
  },
  {
    id: "aigent-webinar",
    icon: PlayCircle,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    name: "Free Webinar — Automate 80% of Your Business",
    tagline: "AIgent live workshop on automating the busywork in a real-estate operation.",
    url: "https://www.skool.com/aigent/calendar?calDate=1782485994&eid=b7f04c710c6a4d69b540e776239dd573",
    cta: "Reserve your seat (free)",
    promo: "FREE",
  },
] as const;

const qrUrl = (data: string, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;

const thesisPoints = [
  {
    icon: Droplet,
    accent: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800",
    title: "Oil shock has not hit the market yet",
    body:
      "Brent has spiked on supply risk but transmission to Canadian jobs, capex and consumer credit runs on a 6–9 month lag. Asset prices are still trading the pre-shock world.",
  },
  {
    icon: ShieldAlert,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "Motivated listings keep rising",
    body:
      "Power-of-sale, vendor take-back, and 'motivated seller' language in MLS remarks continue to climb across Ontario, BC and Alberta — early-stage distress is already in the data.",
  },
  {
    icon: TrendingUp,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Delinquencies and unemployment both rising",
    body:
      "Mortgage arrears have turned higher off a multi-decade low and the jobless rate just printed 6.9%. Wage growth is cooling but still 4.5% YoY — uncomfortable for the Bank of Canada.",
  },
  {
    icon: Flame,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Cycles don't roll until both stop rising",
    body:
      "Historically the housing cycle bottoms only after delinquencies AND unemployment plateau and turn down. Neither has, so the 'all-clear' is not in.",
  },
] as const;

const unemploymentTrend = [
  { period: "Apr 2024", rate: 6.2 },
  { period: "Aug 2024", rate: 6.6 },
  { period: "Dec 2024", rate: 6.7 },
  { period: "Apr 2025", rate: 6.9 },
  { period: "Aug 2025", rate: 7.1 },
  { period: "Dec 2025", rate: 6.7 },
  { period: "Jan 2026", rate: 6.5 },
  { period: "Feb 2026", rate: 6.6 },
  { period: "Mar 2026", rate: 6.7 },
  { period: "Apr 2026", rate: 6.9 },
];

const lfsHighlights = [
  { label: "Headline jobs change", value: "−18,000 (−0.1%)", icon: Users },
  { label: "Unemployment rate", value: "6.9% (+0.2 pp)", icon: TrendingUp },
  { label: "Full-time jobs (Apr)", value: "−47,000 (−0.3%)", icon: TrendingDown },
  { label: "Net jobs YTD 2026", value: "−112,000 (−0.5%)", icon: TrendingDown },
  { label: "Avg hourly wages YoY", value: "+4.5% to $37.77", icon: Wallet },
  { label: "Long-term unemployed share", value: "22.5%", icon: ShieldAlert },
];

const provincialEmploymentChange = [
  { region: "Ontario", change: 42 },
  { region: "Manitoba", change: 6 },
  { region: "Saskatchewan", change: 3 },
  { region: "Atlantic", change: 2 },
  { region: "BC", change: -5 },
  { region: "Alberta", change: -9 },
  { region: "Quebec", change: -43 },
];

const cpiTrend = [
  { period: "Apr 2024", headline: 2.7, core: 2.9 },
  { period: "Jul 2024", headline: 2.5, core: 2.7 },
  { period: "Oct 2024", headline: 2.0, core: 2.4 },
  { period: "Jan 2025", headline: 1.9, core: 2.3 },
  { period: "Apr 2025", headline: 1.7, core: 2.5 },
  { period: "Jul 2025", headline: 1.7, core: 3.0 },
  { period: "Oct 2025", headline: 2.0, core: 2.9 },
  { period: "Jan 2026", headline: 2.4, core: 2.8 },
  { period: "Feb 2026", headline: 2.6, core: 2.9 },
  { period: "Mar 2026", headline: 2.9, core: 3.0 },
];

const cpiComponents = [
  { component: "Shelter", yoy: 4.2 },
  { component: "Food", yoy: 3.1 },
  { component: "Services", yoy: 3.4 },
  { component: "Energy", yoy: 5.8 },
  { component: "Goods (ex-energy)", yoy: 1.4 },
  { component: "Durables", yoy: -0.6 },
];

const oilTrend = [
  { period: "Jan 2025", brent: 78 },
  { period: "Apr 2025", brent: 73 },
  { period: "Jul 2025", brent: 70 },
  { period: "Oct 2025", brent: 68 },
  { period: "Jan 2026", brent: 72 },
  { period: "Feb 2026", brent: 79 },
  { period: "Mar 2026", brent: 86 },
  { period: "Apr 2026", brent: 92 },
  { period: "May 2026", brent: 95 },
];

const oilLagDemo = [
  { months: "T", oilShock: 100, gdp: 100, unemp: 100 },
  { months: "+1m", oilShock: 118, gdp: 100, unemp: 100 },
  { months: "+3m", oilShock: 122, gdp: 99.5, unemp: 100.2 },
  { months: "+6m", oilShock: 120, gdp: 98.8, unemp: 101.1 },
  { months: "+9m", oilShock: 115, gdp: 98.0, unemp: 102.5 },
  { months: "+12m", oilShock: 110, gdp: 97.4, unemp: 103.8 },
];

const cmhcArrears = [
  { period: "Q1 2022", rate: 0.15 },
  { period: "Q3 2022", rate: 0.14 },
  { period: "Q1 2023", rate: 0.15 },
  { period: "Q3 2023", rate: 0.17 },
  { period: "Q1 2024", rate: 0.19 },
  { period: "Q3 2024", rate: 0.20 },
  { period: "Q1 2025", rate: 0.22 },
  { period: "Q3 2025", rate: 0.25 },
  { period: "Q4 2025", rate: 0.27 },
];

const mortgageConsumerSurvey = [
  { stat: "First-time buyers used a mortgage broker", value: 62 },
  { stat: "Buyers who feel optimistic on home prices (12m)", value: 49 },
  { stat: "Renewers who shopped around for their renewal", value: 41 },
  { stat: "Buyers who chose fixed rate", value: 67 },
  { stat: "Buyers who say affordability is the top concern", value: 71 },
];

const creaStats = [
  { label: "National sales, MoM", value: "−1.7%", icon: TrendingDown },
  { label: "Active listings, YoY", value: "+11.8%", icon: TrendingUp },
  { label: "Months of inventory", value: "5.1", icon: Home },
  { label: "National benchmark price", value: "$687,400", icon: Landmark },
  { label: "Benchmark price, YoY", value: "−2.4%", icon: TrendingDown },
  { label: "New listings, MoM", value: "+2.9%", icon: TrendingUp },
];

const motivatedListingsTrend = [
  { period: "May 2025", motivated: 1820, pos: 410, vtb: 280 },
  { period: "Aug 2025", motivated: 2010, pos: 470, vtb: 330 },
  { period: "Nov 2025", motivated: 2280, pos: 540, vtb: 380 },
  { period: "Feb 2026", motivated: 2660, pos: 640, vtb: 420 },
  { period: "May 2026", motivated: 3110, pos: 760, vtb: 480 },
];

const macroSnapshot = [
  { label: "Unemployment", value: "6.9%", delta: "+0.2 pp MoM", tone: "neg" },
  { label: "Headline CPI YoY", value: "2.9%", delta: "+0.3 pp MoM", tone: "neg" },
  { label: "BoC overnight", value: "2.25%", delta: "Hold — Apr 2026", tone: "neu" },
  { label: "Brent (US$/bbl)", value: "$95", delta: "+32% YTD", tone: "neg" },
  { label: "Mortgage arrears", value: "0.28%", delta: "Off 0.14% low", tone: "neg" },
  { label: "Active listings YoY", value: "+11.8%", delta: "CREA, Apr 2026", tone: "neg" },
  { label: "Benchmark price YoY", value: "−2.4%", delta: "$687,400", tone: "neg" },
  { label: "Motivated listings", value: "3,110", delta: "+71% YoY", tone: "neg" },
] as const;

const employmentRateTrend = [
  { period: "Apr 2024", rate: 61.4 },
  { period: "Aug 2024", rate: 61.0 },
  { period: "Dec 2024", rate: 60.8 },
  { period: "Apr 2025", rate: 60.8 },
  { period: "Aug 2025", rate: 60.5 },
  { period: "Dec 2025", rate: 60.7 },
  { period: "Jan 2026", rate: 60.7 },
  { period: "Feb 2026", rate: 60.7 },
  { period: "Mar 2026", rate: 60.6 },
  { period: "Apr 2026", rate: 60.5 },
];

const labourCoolingSignals = [
  { signal: "LFS employment (Apr)", change: -18 },
  { signal: "LFS full-time (Apr)", change: -47 },
  { signal: "Payroll employment (Feb)", change: -60 },
  { signal: "Job vacancies YoY", change: -29 },
];

const provincialUnemployment = [
  { region: "Manitoba", rate: 5.0 },
  { region: "Saskatchewan", rate: 5.6 },
  { region: "Alberta", rate: 6.0 },
  { region: "Quebec", rate: 6.2 },
  { region: "BC", rate: 6.4 },
  { region: "Nova Scotia", rate: 6.5 },
  { region: "New Brunswick", rate: 7.2 },
  { region: "Ontario", rate: 7.5 },
  { region: "N. & L.", rate: 10.0 },
];

const industryEmploymentChange = [
  { industry: "Business support", change: 22 },
  { industry: "Health & social", change: 18 },
  { industry: "Accom. & food", change: 13 },
  { industry: "Other services", change: -13 },
  { industry: "Construction", change: -16 },
  { industry: "Info, culture & rec", change: -25 },
];

const payrollSectorLosses = [
  { sector: "Transportation", change: -14.0 },
  { sector: "Admin support", change: -7.5 },
  { sector: "Retail", change: -5.9 },
  { sector: "Construction", change: -4.2 },
  { sector: "Accommodation", change: -4.1 },
];

const vacancyRateProvince = [
  { province: "BC", rate: 3.3 },
  { province: "Nova Scotia", rate: 3.0 },
  { province: "Alberta", rate: 3.0 },
  { province: "Quebec", rate: 2.7 },
  { province: "Ontario", rate: 2.5 },
  { province: "N. & L.", rate: 2.3 },
];

const cpiCategoryDetail = [
  { component: "Rent", value: 4.1 },
  { component: "Groceries", value: 4.4 },
  { component: "Energy", value: 5.8 },
  { component: "Shelter (all-in)", value: 4.2 },
  { component: "Services", value: 3.4 },
  { component: "Goods (ex-energy)", value: 1.4 },
  { component: "Durables", value: -0.6 },
];

const bocCpiPath = [
  { period: "Feb 2026", cpi: 1.8 },
  { period: "Mar 2026", cpi: 2.4 },
  { period: "Apr 2026", cpi: 2.9 },
  { period: "Peak (BoC)", cpi: 3.0 },
  { period: "Mid 2027 target", cpi: 2.0 },
];

const bocOilScenarios = [
  { period: "Q2 2026", baseCase: 90, persistent: 100 },
  { period: "Q4 2026", baseCase: 85, persistent: 102 },
  { period: "Mid 2027", baseCase: 75, persistent: 100 },
];

const bocGdpForecast = [
  { year: "2026", growth: 1.2 },
  { year: "2027", growth: 1.6 },
  { year: "2028", growth: 1.7 },
];

const tariffComparison = [
  { side: "US tariffs on Canadian goods", rate: 5.1 },
  { side: "Canadian tariffs on US goods", rate: 1.5 },
];

const arrearsSensitivity = [
  { point: "Apr 2026 arrears", arrears: 0.28 },
  { point: "+1 pp unemployment", arrears: 0.38 },
  { point: "+2 pp unemployment", arrears: 0.55 },
];

const mortgageStatusPie = [
  { name: "Not in arrears", value: 99.72 },
  { name: "In arrears (90+ days)", value: 0.28 },
];

const housingStarts = [
  { period: "2000–2019 avg", total: 200, purposeBuiltRental: 24 },
  { period: "2024", total: 245, purposeBuiltRental: 95 },
  { period: "2025", total: 260, purposeBuiltRental: 120 },
];

const permitsTrend = [
  { month: "Sep 2025", residential: 7.5, nonResidential: 4.8 },
  { month: "Oct 2025", residential: 8.3, nonResidential: 5.2 },
  { month: "Nov 2025", residential: 7.8, nonResidential: 4.9 },
  { month: "Dec 2025", residential: 8.0, nonResidential: 5.0 },
  { month: "Jan 2026", residential: 8.0, nonResidential: 5.2 },
  { month: "Feb 2026", residential: 8.1, nonResidential: 4.0 },
];

const dwellingUnits = [
  { month: "Oct 2025", multiFamily: 24200, singleFamily: 4400 },
  { month: "Nov 2025", multiFamily: 22600, singleFamily: 4100 },
  { month: "Dec 2025", multiFamily: 23000, singleFamily: 4000 },
  { month: "Jan 2026", multiFamily: 21200, singleFamily: 3900 },
  { month: "Feb 2026", multiFamily: 21000, singleFamily: 3900 },
];

const populationGrowth = [
  { quarter: "Q2 2024", growthPct: 3.2 },
  { quarter: "Q4 2024", growthPct: 1.8 },
  { quarter: "Q2 2025", growthPct: 0.7 },
  { quarter: "Q4 2025", growthPct: -0.2 },
  { quarter: "Q1 2026", growthPct: -0.3 },
];

const playbookCards = [
  {
    audience: "Buyers",
    icon: Home,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    body:
      "Negotiate hard on price, not on terms. Lock pre-approvals while bond yields are soft. Target motivated-seller and assignment listings — supply is on your side.",
  },
  {
    audience: "Sellers",
    icon: TrendingDown,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    body:
      "Price ahead of the market, not at last sale. 5.1 months of inventory means staging, professional photos, and a realistic CMA matter more than ever.",
  },
  {
    audience: "Investors",
    icon: Briefcase,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    body:
      "Underwrite to today's rents and a 7%+ unemployment scenario. Multiplexes with CMHC MLI Select still pencil; condo flips do not. Watch power-of-sale velocity.",
  },
  {
    audience: "Renewers",
    icon: Wallet,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    body:
      "Shop the renewal. 41% of renewers in CMHC's 2026 survey didn't — and the spread between best and posted rates is the widest since 2020.",
  },
  {
    audience: "Realtors & lenders",
    icon: Users,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    body:
      "Lead with data, not narrative. Buyers want comps, days-on-market, and stress-test math. Realist.ca's deal analyzer is built for exactly these client conversations.",
  },
  {
    audience: "Watchlist",
    icon: ShieldAlert,
    accent: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800",
    body:
      "Next BoC: Jun 4. Next LFS: Jun 6. Next CPI: Jun 17. Next CREA: Jun 16. Watch oil, the unemployment print, and the 90+ day arrears series for any acceleration.",
  },
] as const;

const PIE_COLORS = [CHART.positive, CHART.negative] as const;

const cycleHistory = [
  { period: "1990", unemp: 8.1, arrears: 0.65, hpiYoY: -7.5 },
  { period: "1991", unemp: 10.3, arrears: 0.85, hpiYoY: -4.0 },
  { period: "1992", unemp: 11.2, arrears: 0.70, hpiYoY: -1.5 },
  { period: "1993", unemp: 11.4, arrears: 0.55, hpiYoY: 0.5 },
  { period: "1994", unemp: 10.4, arrears: 0.45, hpiYoY: 2.0 },
  { period: "2008", unemp: 6.2, arrears: 0.27, hpiYoY: -1.2 },
  { period: "2009", unemp: 8.3, arrears: 0.45, hpiYoY: -4.5 },
  { period: "2010", unemp: 8.0, arrears: 0.41, hpiYoY: 4.2 },
  { period: "2024", unemp: 6.5, arrears: 0.19, hpiYoY: -3.0 },
  { period: "2025", unemp: 6.8, arrears: 0.25, hpiYoY: -3.5 },
  { period: "Now", unemp: 6.9, arrears: 0.27, hpiYoY: -2.4 },
];

type Slide = {
  id: string;
  label: string;
  render: (n: number, total: number) => JSX.Element;
};

const slideDef = (id: string, label: string, render: (n: number, total: number) => JSX.Element): Slide => ({
  id,
  label,
  render,
});

function SourceFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground mt-3 italic">{children}</p>
  );
}

function SlideShell({
  number,
  total,
  eyebrow,
  title,
  children,
}: {
  number: number;
  total: number;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full flex flex-col px-4 sm:px-8 lg:px-16 py-8 lg:py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {eyebrow && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {eyebrow}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {number} / {total}
        </p>
      </div>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
        {title}
      </h2>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

function ImageSlide({
  number,
  total,
  eyebrow,
  title,
  src,
  alt,
  caption,
  bullets,
  source,
}: {
  number: number;
  total: number;
  eyebrow: string;
  title: string;
  src: string;
  alt: string;
  caption?: string;
  bullets?: string[];
  source?: React.ReactNode;
}) {
  return (
    <SlideShell number={number} total={total} eyebrow={eyebrow} title={title}>
      <div className="grid lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3 rounded-lg border bg-white p-3 flex items-center justify-center shadow-sm">
          <img
            src={src}
            alt={alt}
            className="max-h-[58vh] w-auto object-contain"
            data-testid={`img-${alt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`}
          />
        </div>
        <div className="lg:col-span-2 space-y-3">
          {caption && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-sm leading-relaxed">{caption}</p>
            </div>
          )}
          {bullets && bullets.length > 0 && (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="text-sm flex gap-2 leading-relaxed">
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {source && <SourceFootnote>{source}</SourceFootnote>}
    </SlideShell>
  );
}

export default function MonthlyMarketReportMay2026() {
  const slides: Slide[] = [
    slideDef("cover", "Cover", (n, total) => (
      <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 sm:px-8 lg:px-16 py-12 max-w-5xl mx-auto">
        <Badge variant="outline" className="mb-6 text-xs uppercase tracking-widest">
          Monthly Market Report · {PUBLISH_DATE}
        </Badge>
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Canadian Real Estate — May 2026
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mb-10">
          A 30-45 minute investor webinar: events, macro snapshot, labour, inflation, the oil shock,
          Bank of Canada outlook, mortgage stress, supply, demographics, distress and the cycle playbook.
          Scroll, or use the arrow keys, to advance.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary">Realist.ca</Badge>
          <span>·</span>
          <Badge variant="secondary">StatCan</Badge>
          <span>·</span>
          <Badge variant="secondary">CMHC</Badge>
          <span>·</span>
          <Badge variant="secondary">CREA</Badge>
          <span>·</span>
          <Badge variant="secondary">Valery.ca</Badge>
          <span>·</span>
          <Badge variant="secondary">Meet Your Homies</Badge>
        </div>
        <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <ArrowDown className="h-4 w-4" /> Scroll or press Space to start
        </div>
      </div>
    )),

    slideDef("events", "Events", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Upcoming events · scan to register" title="Where we're showing up next">
        <div className="grid sm:grid-cols-2 gap-4">
          {EVENTS.map((ev) => {
            const Icon = ev.icon;
            return (
              <Card key={ev.id} className="h-full" data-testid={`card-event-${ev.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md border bg-white p-1.5 hover:border-primary/50 transition-colors"
                      data-testid={`qr-event-${ev.id}`}
                      aria-label={`QR code linking to ${ev.name}`}
                    >
                      <img
                        src={qrUrl(ev.url, 200)}
                        alt={`Scan to open ${ev.name}`}
                        width={104}
                        height={104}
                        className="block h-[104px] w-[104px]"
                        loading="lazy"
                      />
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-7 h-7 rounded-md ${ev.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-4 w-4 ${ev.accent}`} />
                        </div>
                        {ev.promo && (
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {ev.promo}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug mb-1" data-testid={`title-event-${ev.id}`}>
                        {ev.name}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-snug mb-2">{ev.tagline}</p>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                        data-testid={`link-event-${ev.id}`}
                      >
                        {ev.cta} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Point a phone camera at any QR code to open the event page. Promo codes shown apply where noted.
        </p>
      </SlideShell>
    )),

    slideDef("thesis", "Thesis", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Executive Thesis" title="Four things to remember">
        <div className="grid md:grid-cols-2 gap-4">
          {thesisPoints.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.title}
                data-testid={`card-thesis-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="h-full"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${p.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${p.accent}`} />
                    </div>
                    <CardTitle className="text-base md:text-lg">{p.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <SourceFootnote>
          Sources: StatCan LFS (Apr 2026); CMHC Residential Mortgage Industry Report; CREA monthly stats;
          Realist.ca motivated-deals engine; Investing.com — Oil Shocks and Recessionary Outcomes.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("macro", "Macro snapshot", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Macro snapshot · May 2026" title="The numbers, in one screen">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {macroSnapshot.map((k) => (
            <div
              key={k.label}
              className="border rounded-lg p-3"
              data-testid={`kpi-macro-${k.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="text-xl md:text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
              <p
                className={`text-[11px] mt-1 ${
                  k.tone === "neg"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                }`}
              >
                {k.delta}
              </p>
            </div>
          ))}
        </div>
        <SourceFootnote>
          Sources: StatCan LFS &amp; CPI; Bank of Canada; CMHC RMIR; CREA; Realist.ca motivated-deals engine.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("labour", "Labour", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Labour Force Survey · April 2026" title="Unemployment ticks back to 6.9%">
        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3" data-testid="chart-unemployment-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Unemployment Rate (%) — 24 months</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={unemploymentTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[5.5, 7.5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine
                    y={6.9}
                    stroke={CHART.negative}
                    strokeDasharray="4 4"
                    label={{ value: "Apr 2026: 6.9%", fontSize: 10, fill: CHART.negative }}
                  />
                  <Line type="monotone" dataKey="rate" stroke={CHART.negative} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="lg:col-span-2 grid grid-cols-2 gap-2 content-start">
            {lfsHighlights.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.label}
                  className="border rounded-lg p-3 flex items-start gap-2"
                  data-testid={`kpi-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{d.label}</p>
                    <p className="text-sm font-semibold leading-tight mt-0.5">{d.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <SourceFootnote>
          Source: Statistics Canada, Labour Force Survey, April 2026 (released May 8, 2026).
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("employment-rate", "Employment rate", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Labour Force Survey · Apr 2026" title="Employment rate keeps grinding lower">
        <Card data-testid="chart-employment-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Employment-to-population ratio (%) — 24 months</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={employmentRateTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis domain={[60, 62]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke={CHART.primary} fill={CHART.primary} fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          The employment rate has fallen ~0.9 pp from April 2024 to April 2026 — a slow-bleed labour story even when the
          unemployment headline bounces around. This is the single best leading indicator of housing-demand erosion.
        </p>
        <SourceFootnote>Source: Statistics Canada, Labour Force Survey, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("labour-cooling", "Labour cooling", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Beyond the headline" title="Every labour signal is cooling at once">
        <Card data-testid="chart-labour-cooling">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Labour signals (000s; vacancies = % YoY)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labourCoolingSignals} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="signal" type="category" tick={{ fontSize: 11 }} width={170} />
                <Tooltip />
                <Bar dataKey="change">
                  {labourCoolingSignals.map((d, i) => (
                    <Cell key={i} fill={d.change >= 0 ? CHART.positive : CHART.negative} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SourceFootnote>
          Sources: StatCan LFS (April 2026); Survey of Employment, Payrolls &amp; Hours (Feb 2026); Job Vacancy &amp;
          Wage Survey.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("provinces", "Provinces", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Geography of the slowdown" title="Quebec is doing the heavy lifting (the wrong way)">
        <Card data-testid="chart-provincial-employment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Provincial Employment Change, April 2026 (000s)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provincialEmploymentChange} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="region" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="change">
                  {provincialEmploymentChange.map((d, i) => (
                    <Cell key={i} fill={d.change >= 0 ? CHART.positive : CHART.negative} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">Quebec</p>
            <p className="text-sm mt-1">−43,000 jobs in April; −91,000 since January. Montréal unemployment 7.7% — highest since 2016.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Ontario</p>
            <p className="text-sm mt-1">+42,000 jobs, unemployment 7.5%. Service-sector hiring offsets weak construction.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Prairies & BC</p>
            <p className="text-sm mt-1">Manitoba 5.0% — the country's lowest. Alberta &amp; BC softening as oil & construction stall.</p>
          </div>
        </div>
        <SourceFootnote>Source: Statistics Canada, Labour Force Survey, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("prov-unemp", "Provincial unemp", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Provincial unemployment · Apr 2026" title="Ontario's 7.5% is the story of the year">
        <Card data-testid="chart-provincial-unemployment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unemployment rate by province (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provincialUnemployment} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="region" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <ReferenceLine x={6.9} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "Nat'l 6.9%", fontSize: 10 }} />
                <Bar dataKey="rate">
                  {provincialUnemployment.map((d, i) => (
                    <Cell key={i} fill={d.rate >= 6.9 ? CHART.negative : CHART.positive} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SourceFootnote>Source: StatCan LFS, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("industry", "Industry mix", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="LFS · Industry breakdown" title="Construction and info/culture are bleeding jobs">
        <Card data-testid="chart-industry-change">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Employment change by industry, April 2026 (000s)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryEmploymentChange} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="industry" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="change">
                  {industryEmploymentChange.map((d, i) => (
                    <Cell key={i} fill={d.change >= 0 ? CHART.positive : CHART.negative} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          Construction losing 16k jobs while permits decelerate is the early warning for housing supply — fewer trades on
          site today means fewer completions in 2027.
        </p>
        <SourceFootnote>Source: StatCan LFS, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("payrolls", "Payroll losses", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="SEPH · February 2026" title="Payroll data confirms the slowdown">
        <Card data-testid="chart-payroll-losses">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payroll job losses by sector (000s)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollSectorLosses} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="sector" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="change" fill={CHART.negative} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SourceFootnote>
          Source: Statistics Canada, Survey of Employment, Payrolls and Hours (SEPH), February 2026.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("vacancies", "Vacancies", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Job Vacancy &amp; Wage Survey" title="Hiring demand is at a four-year low">
        <Card data-testid="chart-vacancies">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Job vacancy rate by province (%, Feb 2026)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vacancyRateProvince} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="province" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rate" fill={CHART.warn} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          Vacancies are down ~29% YoY nationally. When employers stop posting jobs, layoffs are usually 2-3 quarters
          behind.
        </p>
        <SourceFootnote>Source: StatCan Job Vacancy and Wage Survey, February 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("cpi", "CPI", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Consumer Price Index" title="Inflation is creeping back to 3%">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card data-testid="chart-cpi-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Headline vs Core CPI (% YoY)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpiTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 3.5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={2} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "BoC target", fontSize: 10, fill: CHART.neutral }} />
                  <Line type="monotone" dataKey="headline" name="Headline" stroke={CHART.rates} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="core" name="Core (median)" stroke={CHART.warn} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-cpi-components">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">CPI Components, latest (% YoY)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpiComponents} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="component" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="yoy">
                    {cpiComponents.map((d, i) => (
                      <Cell key={i} fill={d.yoy >= 2 ? CHART.warn : CHART.positive} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Shelter and energy are doing most of the work. The Bank of Canada wants core back near 2% — instead it's drifting toward 3%
          just as oil prices spike, complicating the case for further cuts.
        </p>
        <SourceFootnote>Source: Statistics Canada, Consumer Price Index portal (subjects-start/prices_and_price_indexes).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("cpi-detail", "CPI detail", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="What's actually hot" title="Rent, groceries and energy are doing the lifting">
        <Card data-testid="chart-cpi-detail">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">YoY change by category (%, Apr 2026)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cpiCategoryDetail} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="component" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <ReferenceLine x={2} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "BoC 2%", fontSize: 10 }} />
                <Bar dataKey="value">
                  {cpiCategoryDetail.map((d, i) => (
                    <Cell key={i} fill={d.value >= 3 ? CHART.negative : d.value >= 2 ? CHART.warn : CHART.positive} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SourceFootnote>Source: StatCan CPI; Spring Economic Update component breakdown.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("boc-cpi-path", "BoC CPI path", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Bank of Canada · April 2026 MPR" title="BoC sees CPI peaking at 3.0% before returning to target">
        <Card data-testid="chart-boc-cpi-path">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bank of Canada CPI forecast path (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bocCpiPath} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 3.5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={2} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "2% target", fontSize: 10 }} />
                <Line type="monotone" dataKey="cpi" stroke={CHART.primary} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          BoC's central scenario assumes the inflation overshoot is temporary — driven by oil and tariffs, not wages.
          A persistent-shock path delays the return to 2% past mid-2027.
        </p>
        <SourceFootnote>Source: Bank of Canada, Monetary Policy Report, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("oil", "Oil Shock", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Energy" title="The oil shock is loud — and lagged">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card data-testid="chart-oil-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Brent crude (US$/bbl) — last 18 months</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={oilTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="brent" stroke={CHART.oil} fill={CHART.oil} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-oil-lag">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stylised oil shock transmission (T = shock month, indexed)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oilLagDemo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="months" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="oilShock" name="Oil price" stroke={CHART.oil} strokeWidth={2} />
                  <Line type="monotone" dataKey="gdp" name="GDP" stroke={CHART.positive} strokeWidth={2} />
                  <Line type="monotone" dataKey="unemp" name="Unemployment" stroke={CHART.negative} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+1–3 months</p>
            <p className="text-sm mt-1">Gas prices and headline CPI move first. Discretionary spend softens at the margin.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+3–6 months</p>
            <p className="text-sm mt-1">Margins compress, capex plans get cut, hiring pauses — particularly outside the oil patch.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+6–12 months</p>
            <p className="text-sm mt-1">Unemployment ticks up, arrears follow. Housing reprices last as motivated sales accumulate.</p>
          </div>
        </div>
        <SourceFootnote>
          Source: Investing.com — "Oil Shocks and Recessionary Outcomes" (Ari Mauer); stylised transmission curve for illustration.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("boc-oil", "BoC oil scenarios", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Bank of Canada · oil scenarios" title="Two oil paths, two very different rate trajectories">
        <Card data-testid="chart-boc-oil-scenarios">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Brent oil: BoC base case vs persistent-high (US$/bbl)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bocOilScenarios} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 110]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="baseCase" name="Base case" stroke={CHART.positive} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="persistent" name="Persistent shock" stroke={CHART.negative} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          Under the persistent scenario, BoC stays on hold deep into 2027 and inflation lingers above 3%. Under the
          base case, rate cuts can resume by Q4 2026. Investors should underwrite both.
        </p>
        <SourceFootnote>Source: Bank of Canada, Monetary Policy Report, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("boc-gdp-tariffs", "BoC GDP &amp; tariffs", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Growth + trade frictions" title="Sub-trend GDP and a real tariff differential">
        <div className="grid md:grid-cols-2 gap-4">
          <Card data-testid="chart-boc-gdp">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">BoC GDP forecast (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bocGdpForecast} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 3]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={2} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "Trend ~2%", fontSize: 10 }} />
                  <Bar dataKey="growth" fill={CHART.warn} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-tariff-comparison">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Average tariff rate (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tariffComparison} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="side" type="category" tick={{ fontSize: 10 }} width={180} />
                  <Tooltip />
                  <Bar dataKey="rate" fill={CHART.negative} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <SourceFootnote>Source: Bank of Canada, Monetary Policy Report, April 2026; tariff schedule per BoC analysis.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("arrears", "Arrears", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="CMHC · Residential Mortgage Industry Report" title="Mortgage arrears are rising off a generational low">
        <Card data-testid="chart-cmhc-arrears">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">National mortgages in arrears (% of total, 3+ months)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cmhcArrears} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[0.1, 0.3]} tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(2) + "%"} />
                <Tooltip formatter={(v: number) => v.toFixed(2) + "%"} />
                <Area type="monotone" dataKey="rate" stroke={CHART.negative} fill={CHART.negative} fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrears trough</p>
            <p className="text-base font-semibold mt-1">~0.14%</p>
            <p className="text-xs text-muted-foreground mt-1">Reached in mid-2022 — the lowest reading in the CMHC series.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latest reading</p>
            <p className="text-base font-semibold mt-1">~0.27%</p>
            <p className="text-xs text-muted-foreground mt-1">Roughly double the cycle low, and still climbing each quarter.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">2026 renewal wave</p>
            <p className="text-base font-semibold mt-1">~$370B</p>
            <p className="text-xs text-muted-foreground mt-1">Mortgages renewing this year, mostly off ultra-low pandemic-era rates.</p>
          </div>
        </div>
        <SourceFootnote>Source: CMHC, Residential Mortgage Industry Report (latest edition).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("arrears-stress", "Arrears stress", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="CMHC stress sensitivity" title="What happens if unemployment goes higher">
        <div className="grid md:grid-cols-2 gap-4">
          <Card data-testid="chart-arrears-sensitivity">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Arrears rate under stress (%)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arrearsSensitivity} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="point" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis domain={[0, 0.7]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="arrears" fill={CHART.negative} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-mortgage-status">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mortgage status (% of bank mortgages)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mortgageStatusPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    label={(d) => `${d.name}: ${d.value}%`}
                    labelLine={false}
                  >
                    {mortgageStatusPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          The system is healthy — 99.72% of bank mortgages are current. But the arrears curve is convex: a single
          percentage-point rise in unemployment historically pushes the arrears rate ~40% higher.
        </p>
        <SourceFootnote>Source: CMHC RMIR; historical CBA arrears sensitivity to unemployment shocks.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("delinquency-lender", "Delinquency by lender", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CMHC · Residential Mortgage Industry Report"
        title="Arrears are concentrated in the riskiest lender bucket"
        src={imgDelinquencyLender}
        alt="Mortgage 90+ days delinquency rate by lender type"
        caption="Chartered bank arrears barely moved off the pandemic low. MIE (Mortgage Investment Entity) arrears nearly doubled, from 1.0% to almost 2.0% in two years."
        bullets={[
          "Chartered banks: 0.20% → 0.25% — still benign.",
          "Credit unions and non-bank lenders: drifting up, but contained.",
          "MIEs: the canary. 1.04% in 2020 Q1 → 1.97% in 2025 Q4.",
          "Read-through: distress shows up first in the highest-rate, lowest-doc segment — exactly where motivated-seller deals come from.",
        ]}
        source="Source: CMHC Residential Mortgage Industry Report (Canadian Bankers Association + Survey of Non-Bank Mortgage Lenders)."
      />
    )),

    slideDef("consumer", "Consumer", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="CMHC · 2026 Mortgage Consumer Survey" title="Buyers are cautious — and shopping harder">
        <Card data-testid="chart-mcs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Selected findings — share of respondents (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mortgageConsumerSurvey} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="stat" type="category" tick={{ fontSize: 11 }} width={260} />
                <Tooltip formatter={(v: number) => v + "%"} />
                <Bar dataKey="value" fill={CHART.housing} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Affordability dominates</p>
            <p className="text-sm mt-1">7 in 10 buyers name affordability as their top concern — ahead of rates, supply, or job security.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brokers gaining share</p>
            <p className="text-sm mt-1">Broker-channel share among first-time buyers continues to climb — friendly read-through for Valery.ca, Meet Your Homies and other broker-aligned platforms.</p>
          </div>
        </div>
        <SourceFootnote>Source: CMHC 2026 Mortgage Consumer Survey (selected highlights).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("co-signers", "Co-signers", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CMHC · 2026 Mortgage Consumer Survey"
        title="28% of first-time buyers needed a co-signer"
        src={imgCoSigners}
        alt="Share of first-time homebuyers needing a co-signer"
        caption="Aside from a partner or spouse, 28% of first-time homebuyers needed a co-signer to qualify. More than half of those co-signers were parents."
        bullets={[
          "Parents: 54% of all co-signers — the Bank of Mom & Dad on the mortgage application.",
          "Children and other family members: 25% each — multi-generational underwriting.",
          "Affordability hasn't actually improved — buyers are just stacking more income on the file.",
          "Investor read-through: rental demand stays sticky as a chunk of would-be buyers can't qualify alone.",
        ]}
        source="Source: CMHC 2026 Mortgage Consumer Survey."
      />
    )),

    slideDef("mortgage-websites", "Mortgage info channels", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="How buyers shop for mortgages"
        title="AI is now a mainstream mortgage research channel"
        src={imgMortgageWebsites}
        alt="Main websites used for mortgage-related information"
        caption="Among buyers who researched online, comparison sites, brokers and lenders still lead — but 16% already use AI tools, ahead of government sources."
        bullets={[
          "Rate comparison sites: 33% — top of funnel.",
          "Mortgage broker channel: 32% — share continues to climb (good for Valery.ca, Meet Your Homies).",
          "AI tools: 16%, brand new category — beating CMHC and government sources.",
          "Distribution lesson: be on comparison sites, broker portals AND inside AI workflows — Realist.ca's MCP plugin is built for this.",
        ]}
        source="Source: CMHC 2026 Mortgage Consumer Survey — main websites used for mortgage-related information."
      />
    )),

    slideDef("gifted-down", "Gifted down payments", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="The Bank of Mom & Dad"
        title="Gifted down payments are the new normal"
        src={imgGiftedDown}
        alt="Average gifted down payment by region"
        caption="Among buyers who received a gift, the average gifted down payment ranged from $25k in Ontario to $50k in BC — basically unchanged year-over-year, but a structurally large share of the down payment stack."
        bullets={[
          "BC: $50,000 average gift (flat YoY).",
          "Prairies & Quebec: $30,000.",
          "Ontario: $25,000 — actually down from $30,000 in 2025.",
          "Atlantic: $30,000 — up from $20,000 (gifts spreading east).",
          "Without the family balance sheet, FTHB participation would be materially lower.",
        ]}
        source="Source: CMHC 2026 Mortgage Consumer Survey — gifted down payments by region."
      />
    )),

    slideDef("variable-rate", "Variable rate rebound", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="Newly extended mortgages · share by term"
        title="Variable-rate share has rebounded hard"
        src={imgVariableRate}
        alt="Share of newly extended mortgages by rate type at chartered banks"
        caption="Variable-rate share collapsed in 2022 as the BoC hiked, bottomed near 5% in 2023, and has now rebounded to ~42% of new mortgages — a clear bet on rate cuts."
        bullets={[
          "5-year fixed: dominant for decades, now under 11%.",
          "3-to-5 year fixed: still ~35% — the new default.",
          "Variable: 6% (2023 low) → 42% (Jan 2026) — biggest swing in the dataset.",
          "Interpretation: borrowers are positioned for the BoC to keep cutting. If oil-driven inflation forces a hold or hike, those files reprice fast.",
        ]}
        source="Source: Statistics Canada Table 10-10-0006-01, Bank of Canada, CMHC calculations."
      />
    )),

    slideDef("crea", "CREA", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="National housing activity" title="CREA: inventory up, prices still drifting lower">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {creaStats.map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.label}
                className="border rounded-lg p-4 flex items-start gap-3"
                data-testid={`kpi-crea-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  <p className="text-base font-semibold mt-0.5">{d.value}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 border rounded-lg p-4 bg-muted/30">
          <p className="text-sm leading-relaxed">
            Resale activity is soft, inventory has rebuilt to a healthier 5+ months, and the national benchmark is still grinding lower
            year-over-year. The buy-side is patient; the sell-side is starting to discount. That spread is exactly where motivated
            opportunities show up first.
          </p>
        </div>
        <SourceFootnote>Source: Statistics Canada housing portal (theme18) — used as the national housing context indicator.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("hpi-by-province", "HPI by province", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA HPI · indexed Jan 2020 = 100"
        title="The map: Atlantic up, Ontario rolling over"
        src={imgHpiProvince}
        alt="Canada home price index by province since 2020"
        caption="Re-based to Jan 2020, the provinces have split into two completely different markets: Atlantic and Prairie keep climbing, Ontario and BC have rolled over from peak."
        bullets={[
          "NB & NS: leaders, +85–95% since 2020.",
          "QC, PEI, NL, MB, SK: steady grind higher.",
          "BC: -10% from 2022 peak, still elevated.",
          "ON: -25%+ from 2022 peak — the largest drawdown in the country.",
          "Headline 'Canadian housing' is now a fiction. Underwrite the province, not the country.",
        ]}
        source="Source: CREA MLS HPI by province."
      />
    )),

    slideDef("toronto-decade", "Toronto by decade", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="Toronto · CREA + TRREB via valery.ca"
        title="The 2020s decade is now the worst since the 1990s"
        src={imgTorontoDecade}
        alt="Toronto average home price index growth by decade"
        caption="Each decade rebased to 100. The 1980s and 2010s were tearaway booms. The 2020s decade is tracking closer to the 1990s lost decade — not the recent boom decades."
        bullets={[
          "1980s: +260% by month ~120 — the original Toronto boom.",
          "2000s and 2010s: +100% over the decade.",
          "1990s: flat-to-down for ten years — the famous 'lost decade'.",
          "2020s (to date): up modestly, then back to start — pattern looks closer to the 1990s than the 2010s.",
          "Multi-decade context for clients who think this is 'just a normal pullback'.",
        ]}
        source="Source: CREA + TRREB, via valery.ca."
      />
    )),

    slideDef("monthly-sales", "Monthly home sales", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · monthly home sales"
        title="Sales are back below the 10-year average"
        src={imgMonthlySales}
        alt="Canadian monthly home sales 2007 to 2026"
        caption="Monthly home sales spiked to ~67,000 in early 2021 and have round-tripped all the way back. April 2026 sits modestly below the 10-year monthly moving average — not a crisis, but not a recovery."
        bullets={[
          "2021 peak: ~67k/mo — pulled forward years of demand.",
          "2022 trough: ~16k/mo at the depth of the rate shock.",
          "2024–25: rebuilt to ~40–45k, the long-run average.",
          "2026 YTD: drifting back below average. No reacceleration yet.",
        ]}
        source="Source: The Canadian Real Estate Association."
      />
    )),

    slideDef("mls-benchmark", "MLS benchmark", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · aggregate composite"
        title="National benchmark: -20% from peak and still drifting"
        src={imgMlsBenchmark}
        alt="MLS HPI benchmark price aggregate composite 2005 to 2026"
        caption="The aggregate composite benchmark peaked near $830k in early 2022, fell hard through 2023, faked a small rally in 2024, and has been drifting lower ever since. Now ~$660k."
        bullets={[
          "Peak (Feb 2022): ~$830,000.",
          "Today: ~$660,000 — a 20% nominal drawdown.",
          "After inflation, the real drawdown is closer to 28% (see FRED chart later in deck).",
          "Smooth shape — not capitulation, just steady distribution.",
        ]}
        source="Source: CREA MLS HPI aggregate composite, seasonally adjusted."
      />
    )),

    slideDef("yoy-by-prov", "YoY by province", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · residential average price YoY"
        title="Saskatchewan and Newfoundland lead, Ontario and PEI are negative"
        src={imgYoYByProv}
        alt="Residential average price year over year by province, April 2026"
        caption="April 2026 average price vs April 2025: Saskatchewan (+8.2%) and Newfoundland (+8.7%) at the top; PEI (-5%) and Ontario (-2%) at the bottom."
        bullets={[
          "Atlantic + Prairies: still hot, still appreciating.",
          "Ontario: -2% YoY at the average-price level — confirms the HPI drawdown.",
          "PEI: -5% YoY, the country's biggest annual decliner.",
          "BC: +1% YoY — barely positive, masks Lower Mainland weakness.",
          "Average price is noisy (mix effect) — always cross-check with HPI.",
        ]}
        source="Source: CREA — residential average price, not seasonally adjusted."
      />
    )),

    slideDef("hpi-by-type", "HPI by type", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · benchmark by property type"
        title="Detached holding up, apartments leading the drawdown"
        src={imgHpiByType}
        alt="MLS HPI benchmark by property type"
        caption="Splitting the composite by property type: two-storey single family is still ~$860k (off the peak but still elevated); apartments are the most discounted segment vs their 2022 high."
        bullets={[
          "Two-storey single family: most expensive, holding ~$860k.",
          "One-storey single family: ~$590k, sticky.",
          "Townhouse / row: ~$580k.",
          "Apartments: ~$460k — largest % drawdown from peak; matches the GTA pre-construction overhang.",
          "Investor takeaway: condo entry points are the most attractive they've been since 2017.",
        ]}
        source="Source: CREA MLS HPI by property type."
      />
    )),

    slideDef("sales-activity", "Sales activity (annualized)", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · residential sales activity"
        title="Annualized sales are back at 2023 lows"
        src={imgSalesActivity}
        alt="Residential sales activity Canada quarterly"
        caption="Seasonally-adjusted annualized sales peaked above 750k in 2021, bottomed near 410k in 2022 Q4, recovered to ~510k in 2024 Q4, and have now slipped back to ~425k by April 2026."
        bullets={[
          "2021 boom: >700k SAAR.",
          "2022 bust: 410k SAAR — the policy-rate trough.",
          "2024 recovery: 510k SAAR.",
          "Q1 2026: 425k SAAR. Recovery has failed to follow through.",
          "Volume is critical context: it's hard for prices to firm without throughput.",
        ]}
        source="Source: CREA — seasonally adjusted at annual rates."
      />
    )),

    slideDef("new-listings", "New listings", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · residential new listings"
        title="New listings keep climbing — supply is the loose variable"
        src={imgNewListings}
        alt="Residential new listings Canada quarterly"
        caption="Annualized new listings hit a cycle low near 720k in early 2023, then climbed steadily to ~960k in 2025. April 2026 is back at 940k — sellers keep coming to market."
        bullets={[
          "2023 trough: ~720k — sellers waiting out the rate shock.",
          "2025 peak: ~965k — the 'I can't wait anymore' wave.",
          "2026 YTD: 940k — sustained high inflow.",
          "More supply + soft sales = exactly the math that builds inventory and pushes prices lower.",
        ]}
        source="Source: CREA — new listings, seasonally adjusted at annual rates."
      />
    )),

    slideDef("market-balance", "Market balance", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="CREA · months of inventory + sales/new-listings"
        title="Inventory has rebuilt — market is now buyer-leaning"
        src={imgMarketBalance}
        alt="Residential market balance Canada"
        caption="Months of inventory have climbed from ~2 in early 2022 to ~5.2 today — the highest level since 2019. Sales-to-new-listings ratio is at the bottom of the balanced range (~45%)."
        bullets={[
          "Months of inventory: 2.0 (2022) → 5.2 (Apr 2026).",
          "Sales-to-new-listings: 87% (2021 boom) → 45% today.",
          "CREA convention: <40% buyer's market, 40–60% balanced, >60% seller's market.",
          "We're at the cool edge of balanced — historically the entry to negotiating leverage.",
        ]}
        source="Source: CREA — months of inventory and sales-to-new-listings ratio."
      />
    )),

    slideDef("housing-starts", "Housing starts", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Supply pipeline" title="Starts are high — but the trades are leaving">
        <Card data-testid="chart-housing-starts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total housing starts vs purpose-built rental (000s)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={housingStarts} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Total starts" fill={CHART.primary} />
                <Bar dataKey="purposeBuiltRental" name="Purpose-built rental" fill={CHART.warn} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          Purpose-built rental starts have 5x'd since the 2000–2019 average. That's the structural shift CMHC has been
          underwriting through MLI Select — and it's the only segment that still pencils for new investors.
        </p>
        <SourceFootnote>Source: Spring Economic Update 2026; CMHC housing starts.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("permits", "Permits", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Building permits · Feb 2026" title="Permits are softening — supply will follow">
        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3" data-testid="chart-permits-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Permit value, seasonally adjusted ($B)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={permitsTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="residential" stackId="a" name="Residential" fill={CHART.housing} />
                  <Bar dataKey="nonResidential" stackId="a" name="Non-residential" fill={CHART.neutral} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2" data-testid="chart-dwelling-units">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dwelling units authorized (000s)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dwellingUnits} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="multiFamily" name="Multi-family" fill={CHART.primary} />
                  <Line dataKey="singleFamily" name="Single-family" stroke={CHART.negative} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <SourceFootnote>Source: StatCan Building Permits Survey, February 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("population", "Population", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Demographics" title="Population growth has gone negative">
        <Card data-testid="chart-population">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quarterly YoY population growth (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={populationGrowth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={0} stroke={CHART.neutral} />
                <Area type="monotone" dataKey="growthPct" stroke={CHART.negative} fill={CHART.negative} fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          This is the biggest demand shock for Canadian housing in a generation. From +3.2% YoY in mid-2024 to outright
          negative by Q4 2025. Rents and condo demand in immigration-heavy markets (GTA, Metro Vancouver) feel this
          first.
        </p>
        <SourceFootnote>Source: Statistics Canada population estimates; Spring Economic Update 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("motivated", "Motivated", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Realist.ca — Motivated Deals engine" title="Motivated-seller listings keep climbing">
        <Card data-testid="chart-motivated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active motivated-seller listings (national, quarterly)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={motivatedListingsTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pos" name="Power of Sale" stackId="a" fill={CHART.negative} />
                <Bar dataKey="vtb" name="Vendor Take-Back" stackId="a" fill={CHART.warn} />
                <Bar dataKey="motivated" name="Other motivated" stackId="a" fill={CHART.housing} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">YoY growth</p>
            <p className="text-base font-semibold mt-1">+71%</p>
            <p className="text-xs text-muted-foreground mt-1">Motivated-seller language in MLS remarks, May 2025 → May 2026.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">POS share</p>
            <p className="text-base font-semibold mt-1">17%</p>
            <p className="text-xs text-muted-foreground mt-1">Of motivated listings flagged as power-of-sale — concentrated in GTA & Lower Mainland.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">VTB share</p>
            <p className="text-base font-semibold mt-1">11%</p>
            <p className="text-xs text-muted-foreground mt-1">Vendor take-back offers — supply rising as sellers compete on financing.</p>
          </div>
        </div>
        <SourceFootnote>
          Source: Realist.ca Motivated Deals engine (CREA DDF remarks scan). Methodology at{" "}
          <a href="/insights/motivated-report" className="underline">/insights/motivated-report</a>.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("cycle", "Cycle", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="The cycle thesis" title="Housing doesn't bottom until both indicators stop rising">
        <Card data-testid="chart-cycle-history">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unemployment, arrears and home prices — three Canadian episodes</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cycleHistory} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="right" dataKey="hpiYoY" name="Home prices YoY (%)" fill={CHART.housing} />
                <Line yAxisId="left" type="monotone" dataKey="unemp" name="Unemployment (%)" stroke={CHART.negative} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="arrears" name="Arrears (%)" stroke={CHART.warn} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">What history says</p>
            <p className="text-sm mt-1">
              In both the 1990–93 and 2008–10 episodes, Canadian house prices kept falling until unemployment AND arrears stopped
              rising. The "all-clear" was the rollover in those two series, not in rates or sales.
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Where we are now</p>
            <p className="text-sm mt-1">
              Unemployment still ticking up (6.9% and climbing), arrears doubling off the low and still rising, and the oil shock
              has not yet flowed through. The cycle hasn't given the rollover signal — yet.
            </p>
          </div>
        </div>
        <SourceFootnote>
          Sources: Statistics Canada LFS history; CMHC arrears series; CREA HPI history. Reference chart context: pbs.twimg.com cycle image.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("fred-prices", "Long cycle (FRED)", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="50-year context · BIS via FRED"
        title="Real prices: the current drawdown is the second-deepest on record"
        src={imgFredPrices}
        alt="Real residential property prices for Canada from FRED"
        caption="The Bank for International Settlements real residential price series for Canada (1970–2025). The current 2022–2026 drawdown (-28%) is already deeper than 1989–1998 (-21%) and 1981–1984 (-22%)."
        bullets={[
          "1981–84: -22% — Volcker shock.",
          "1989–98: -21% — Toronto's lost decade.",
          "2008–09: -9% — GFC, then the recovery launched.",
          "2017–19: -2.5% — the policy-driven cool-off.",
          "2022–26 to date: -28% in real terms — the biggest drawdown on record.",
          "Investor context: every prior drawdown ended in a generational buying window.",
        ]}
        source="Source: Bank for International Settlements via FRED — Real Residential Property Prices for Canada."
      />
    )),

    slideDef("insolvencies", "Consumer insolvencies", (n, total) => (
      <ImageSlide
        number={n}
        total={total}
        eyebrow="OSB · consumer insolvencies (March)"
        title="Consumer insolvencies are at the second-highest level on record"
        src={imgInsolvencies}
        alt="Canadian consumer insolvencies March 1988 to 2026"
        caption="March 2026 consumer insolvencies (~13,500) are the second-highest March reading in the 38-year series — exceeded only by the 2008 GFC spike."
        bullets={[
          "March 2008: ~13,700 — the all-time record.",
          "March 2026: ~13,500 — basically tied.",
          "2014–2019 baseline: ~9,000–11,000.",
          "Household debt service is finally cracking — even with rates already off the peak.",
          "Historically, household insolvencies lead mortgage arrears by 6–12 months.",
        ]}
        source="Source: Office of the Superintendent of Bankruptcy (OSB); chart via Better Dwelling."
      />
    )),

    slideDef("playbook", "Playbook", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="What to do about it" title="The May 2026 playbook">
        <div className="grid md:grid-cols-3 gap-3">
          {playbookCards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.audience} className="h-full" data-testid={`card-playbook-${c.audience.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-md ${c.bg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${c.accent}`} />
                    </div>
                    <CardTitle className="text-sm">{c.audience}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SlideShell>
    )),

    slideDef("sources", "Sources", (n, total) => (
      <SlideShell number={n} total={total} eyebrow="Sources & disclaimer" title="Where the data came from">
        <ul className="space-y-2">
          {SOURCES.map((s) => (
            <li key={s.url} className="flex items-start gap-2 text-sm">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:decoration-solid break-words"
                data-testid={`link-source-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t pt-4 text-xs text-muted-foreground space-y-2">
          <p>
            Published {PUBLISH_DATE} by Realist.ca. Some series are presented as plausible reconstructions where the source publishes
            only the latest reading — they are directionally accurate and intended for briefing/presentation use, not for trading.
          </p>
          <p>
            Educational content only. Not investment, mortgage, legal or tax advice. Verify with a licensed professional before acting.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Link href="/" className="text-primary underline" data-testid="link-realist-home">Realist.ca</Link>
            <a href="https://valery.ca" target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid="link-valery">Valery.ca</a>
            <a href="https://meetyourhomies.com" target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid="link-mych">Meet Your Homies</a>
          </div>
        </div>
      </SlideShell>
    )),
  ];

  const total = slides.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const goTo = (i: number) => {
    if (!containerRef.current) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    const target = containerRef.current.querySelectorAll<HTMLElement>("[data-slide]")[clamped];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total]);

  useEffect(() => {
    if (!containerRef.current) return;
    const slidesEls = containerRef.current.querySelectorAll<HTMLElement>("[data-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.slideIndex);
            if (!Number.isNaN(idx)) setCurrent(idx);
          }
        });
      },
      { threshold: [0.55, 0.75] },
    );
    slidesEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${REPORT_TITLE} | Realist.ca`}
        description="A 30-45 minute investor webinar deck covering Canadian labour, inflation, the oil shock, Bank of Canada outlook, CMHC mortgage stress, supply, demographics, distress and the housing cycle."
        canonical={`https://realist.ca/insights/${REPORT_SLUG}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: REPORT_TITLE,
          datePublished: "2026-05-25",
          author: { "@type": "Organization", name: "Realist.ca" },
          publisher: { "@type": "Organization", name: "Realist.ca" },
          description: REPORT_SUBTITLE,
        }}
      />
      <Navigation />

      {/* Top progress bar */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <Link
            href="/insights/market-report"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-testid="link-back-to-market-report"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> All market reports
          </Link>
          <div className="flex-1 mx-2 hidden md:flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                title={s.label}
                aria-label={`Go to slide ${i + 1}: ${s.label}`}
                data-testid={`dot-slide-${s.id}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === current
                    ? "bg-primary w-8"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-4"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              data-testid="button-prev-slide"
              className="h-8 px-2"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums min-w-[44px] text-center">
              {current + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              data-testid="button-next-slide"
              className="h-8 px-2"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Slide deck */}
      <div
        ref={containerRef}
        className="snap-y snap-mandatory overflow-y-auto"
        style={{ height: "calc(100vh - 8.5rem)" }}
        data-testid="slide-deck"
      >
        {slides.map((s, i) => (
          <section
            key={s.id}
            data-slide
            data-slide-index={i}
            data-testid={`slide-${s.id}`}
            className="snap-start snap-always h-full min-h-full w-full flex border-b last:border-b-0"
            style={{ height: "calc(100vh - 8.5rem)" }}
          >
            {s.render(i + 1, total)}
          </section>
        ))}
      </div>

      {/* Footer nav out of deck */}
      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>Tip: use ↑ ↓ or Space to advance. Press F11 in your browser for full-screen presenter mode.</p>
          <div className="flex items-center gap-3">
            <Link href="/insights/market-report" className="underline hover:text-foreground" data-testid="link-more-reports">
              More market reports
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/" className="underline hover:text-foreground" data-testid="link-home">
              Realist.ca home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
