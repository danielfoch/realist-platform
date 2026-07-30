import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Construction,
  ExternalLink,
  Factory,
  HardHat,
  Landmark,
  Layers,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportEndCta } from "@/components/ReportEndCta";

const REPORT_SLUG = "canada-construction-costs-2026";
const RELEASE_LABEL = "Published July 29, 2026";

const SOURCE_ALTUS =
  "https://image.hello.altusgroup.com/lib/fe2d11747364047a721170/m/1/Altus_2026_Canadian-Cost-Guide_ENG.pdf";
const SOURCE_TT =
  "https://marketintelligence.turnerandtownsend.com/canada-mi-q1-2026/escalation-forecast";
const SOURCE_BUILDFORCE = "https://www.buildforce.ca/en/lmi-2026/";
const SOURCE_BUILDFORCE_RELEASE =
  "https://www.globenewswire.com/news-release/2026/07/20/3329670/0/en/buildforce-canada-s-construction-and-maintenance-looking-forward-reports-for-2026-to-2035-project-renewed-residential-growth-and-sustained-high-levels-of-non-residential-activity.html";
const SOURCE_RENEW_TOP100 =
  "https://www.renewcanada.net/canadas-top100-infrastructure-projects-surge-to-343b-in-total-investment/";
const SOURCE_RENEW_NIAGARA =
  "https://www.renewcanada.net/the-projects/south-niagara-hospital/";
const SOURCE_URBANATION_Q1 =
  "https://www.urbanation.ca/news/standing-condo-inventory-hits-record-high-q1";
const SOURCE_URBANATION_SALES =
  "https://www.urbanation.ca/news/new-condo-sales-fall-4th-year-lowest-1991";

const heroSummary =
  "Altus Group's 2026 Canadian Cost Guide prices $573 billion of live construction across 6,652 projects. Turner & Townsend forecasts bid-price escalation rising from 2.5% in 2026 to 4.5% by 2028. BuildForce projects a 34,300-worker shortfall by 2034. Set those three against Urbanation's record condo cancellations and the conclusion is uncomfortable: costs have stopped rising quickly, but they have not fallen, and the revenue side has moved further than the cost side.";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const CITIES = [
  "Vancouver",
  "Calgary",
  "Edmonton",
  "Winnipeg",
  "GTA",
  "Ottawa",
  "Montreal",
  "Halifax",
  "St. John's",
] as const;

type Range = [number | null, number | null];

/** Altus Group 2026 Canadian Cost Guide, private-sector table (hard cost per sq ft). */
const CONDO_COSTS: Record<string, Record<(typeof CITIES)[number], Range>> = {
  "Up to 12 storeys": {
    Vancouver: [330, 400],
    Calgary: [305, 375],
    Edmonton: [305, 375],
    Winnipeg: [305, 375],
    GTA: [245, 390],
    Ottawa: [260, 320],
    Montreal: [275, 335],
    Halifax: [250, 345],
    "St. John's": [260, 360],
  },
  "13-39 storeys": {
    Vancouver: [340, 435],
    Calgary: [315, 385],
    Edmonton: [315, 385],
    Winnipeg: [315, 380],
    GTA: [280, 350],
    Ottawa: [300, 330],
    Montreal: [320, 330],
    Halifax: [305, 375],
    "St. John's": [null, null],
  },
  "40-60 storeys": {
    Vancouver: [350, 465],
    Calgary: [325, 395],
    Edmonton: [325, 395],
    Winnipeg: [325, 390],
    GTA: [320, 410],
    Ottawa: [310, 360],
    Montreal: [330, 375],
    Halifax: [null, null],
    "St. John's": [null, null],
  },
  "60+ storeys": {
    Vancouver: [370, 480],
    Calgary: [null, null],
    Edmonton: [null, null],
    Winnipeg: [null, null],
    GTA: [350, 480],
    Ottawa: [null, null],
    Montreal: [null, null],
    Halifax: [null, null],
    "St. John's": [null, null],
  },
};

/** Altus 2026 guide, selected asset classes (hard cost per sq ft). */
const ASSET_COSTS: Record<string, Record<(typeof CITIES)[number], Range>> = {
  "Condo 13-39 storeys": CONDO_COSTS["13-39 storeys"],
  "Office Class A (5-30)": {
    Vancouver: [345, 425],
    Calgary: [280, 395],
    Edmonton: [280, 395],
    Winnipeg: [275, 390],
    GTA: [305, 450],
    Ottawa: [290, 380],
    Montreal: [280, 375],
    Halifax: [230, 330],
    "St. John's": [225, 320],
  },
  "Industrial warehouse": {
    Vancouver: [120, 200],
    Calgary: [130, 175],
    Edmonton: [130, 175],
    Winnipeg: [125, 170],
    GTA: [75, 180],
    Ottawa: [120, 170],
    Montreal: [120, 185],
    Halifax: [125, 195],
    "St. John's": [115, 180],
  },
  "Wood-frame condo (to 6)": {
    Vancouver: [255, 360],
    Calgary: [245, 365],
    Edmonton: [240, 365],
    Winnipeg: [235, 360],
    GTA: [210, 330],
    Ottawa: [230, 290],
    Montreal: [225, 290],
    Halifax: [205, 255],
    "St. John's": [240, 310],
  },
  "Seniors: independent living": {
    Vancouver: [330, 430],
    Calgary: [270, 370],
    Edmonton: [270, 370],
    Winnipeg: [265, 365],
    GTA: [250, 385],
    Ottawa: [280, 340],
    Montreal: [225, 340],
    Halifax: [255, 335],
    "St. John's": [270, 350],
  },
  "Underground parking": {
    Vancouver: [195, 300],
    Calgary: [165, 230],
    Edmonton: [165, 230],
    Winnipeg: [160, 225],
    GTA: [165, 285],
    Ottawa: [200, 280],
    Montreal: [155, 205],
    Halifax: [150, 205],
    "St. John's": [155, 220],
  },
  "General hospital / acute": {
    Vancouver: [1000, 1550],
    Calgary: [1000, 1600],
    Edmonton: [1000, 1600],
    Winnipeg: [945, 1590],
    GTA: [1030, 1620],
    Ottawa: [1000, 1600],
    Montreal: [905, 1305],
    Halifax: [795, 1380],
    "St. John's": [850, 1300],
  },
};

/** Turner & Townsend Canada Market Intelligence Q1 2026, Figure 9. */
const escalationSeries = [
  { year: "2020", rate: 3.6, kind: "Actual" },
  { year: "2021", rate: 10.7, kind: "Actual" },
  { year: "2022", rate: 14.2, kind: "Actual" },
  { year: "2023", rate: 7.0, kind: "Actual" },
  { year: "2024", rate: 2.5, kind: "Actual" },
  { year: "2025", rate: 1.8, kind: "Actual" },
  { year: "2026", rate: 2.5, kind: "Forecast", low: 0.5, high: 4.5 },
  { year: "2027", rate: 4.0, kind: "Forecast", low: 2.0, high: 6.0 },
  { year: "2028", rate: 4.5, kind: "Forecast", low: 2.5, high: 6.5 },
] as const;

/** Turner & Townsend Canada Market Intelligence Q1 2026, Figure 10. */
const provincialEscalation = [
  { region: "Saskatchewan", rate: 4.0 },
  { region: "Manitoba", rate: 3.5 },
  { region: "Alberta", rate: 3.0 },
  { region: "Quebec", rate: 3.0 },
  { region: "Atlantic Canada", rate: 3.0 },
  { region: "British Columbia", rate: 2.0 },
  { region: "Ontario", rate: 1.5 },
];

/** Altus 2026 guide, dataset composition as at January 31, 2026. */
const pipelineComposition = [
  { segment: "Residential", value: 218, projects: 2911, sqft: 1056 },
  { segment: "Infrastructure", value: 200, projects: 475, sqft: null },
  { segment: "ICI", value: 155, projects: 3266, sqft: 576 },
];

/**
 * Urbanation, GTHA new condominium market. 2024 sales and starts are derived from
 * Urbanation's published year-over-year declines of 60% and 63% respectively;
 * 2025 onward are published figures. 2028 completions are not separately published.
 */
const gthaCondoCycle = [
  { year: "2024", sales: 3998, starts: 8843, completions: 29000 },
  { year: "2025", sales: 1599, starts: 3272, completions: 29291 },
  { year: "2026F", sales: null, starts: null, completions: 21850 },
  { year: "2027F", sales: null, starts: null, completions: 14366 },
  { year: "2028F", sales: null, starts: null, completions: null },
  { year: "2029F", sales: null, starts: null, completions: 0 },
];

/** Urbanation Q1 2026 pricing. */
const priceGap = [
  { label: "New, unsold standing inventory", value: 1189 },
  { label: "Resale, registered last 3 years", value: 859 },
];

/** BuildForce Canada, Construction and Maintenance Looking Forward 2026-2035. */
const labourNational = [
  { metric: "Retirements (residential)", value: 135000 },
  { metric: "Labour force growth needed", value: 32100 },
  { metric: "Total hiring requirement", value: 306200 },
  { metric: "Expected new entrants under 30", value: 271900 },
  { metric: "Projected shortfall by 2034", value: 34300 },
];

/** BuildForce Canada, Ontario report, employment change by 2035 vs 2025. */
const ontarioRegions = [
  { region: "Central Ontario", residential: 21, nonResidential: 11 },
  { region: "Eastern Ontario", residential: 10, nonResidential: 7 },
  { region: "Southwestern Ont.", residential: 10, nonResidential: -2 },
  { region: "Greater Toronto", residential: 5, nonResidential: 4 },
  { region: "Northwestern Ont.", residential: -2, nonResidential: -5 },
  { region: "Northeastern Ont.", residential: -3, nonResidential: 1 },
];

/** ReNew Canada, 2026 Top100 Projects Report. */
const top100Sectors = [
  { sector: "Transit", value: 123, projects: 25 },
  { sector: "Buildings", value: 81, projects: 36 },
  { sector: "Energy", value: 80, projects: 10 },
  { sector: "All other sectors", value: 59, projects: 29 },
];

/** Altus 2026 guide, infrastructure unit costs (millions). */
const INFRA_REGIONS = ["British Columbia", "Alberta", "Ontario (GTA)", "Ontario (Ottawa)"] as const;
const INFRA_COSTS: Record<string, Record<(typeof INFRA_REGIONS)[number], Range>> = {
  "LRT guideway, underground tunnel (per km)": {
    "British Columbia": [92.2, 214.2],
    Alberta: [80.7, 212.9],
    "Ontario (GTA)": [88.9, 206.6],
    "Ontario (Ottawa)": [84.0, 195.1],
  },
  "LRT station, underground (per station)": {
    "British Columbia": [55.8, 256.6],
    Alberta: [48.9, 222.35],
    "Ontario (GTA)": [53.8, 216.2],
    "Ontario (Ottawa)": [50.8, 204.3],
  },
  "LRT guideway, elevated (per km)": {
    "British Columbia": [18.8, 82.5],
    Alberta: [16.6, 71.5],
    "Ontario (GTA)": [17.4, 69.5],
    "Ontario (Ottawa)": [16.5, 65.7],
  },
  "LRT guideway, at grade (per km)": {
    "British Columbia": [2.6, 33.0],
    Alberta: [2.3, 34.4],
    "Ontario (GTA)": [2.5, 33.5],
    "Ontario (Ottawa)": [2.4, 31.8],
  },
  "Multi-lane highway (per lane km)": {
    "British Columbia": [2.5, 3.5],
    Alberta: [2.1, 4.935],
    "Ontario (GTA)": [2.5, 4.8],
    "Ontario (Ottawa)": [2.4, 3.6],
  },
};

const highlightStats = [
  { label: "Priced construction pipeline", value: "$573B", icon: Layers },
  { label: "Projects in the Altus dataset", value: "6,652", icon: Construction },
  { label: "National escalation, 2026", value: "2.5%", icon: TrendingUp },
  { label: "National escalation, 2028F", value: "4.5%", icon: TrendingUp },
  { label: "GTHA condo sales, 2025", value: "1,599", icon: TrendingDown },
  { label: "Projected labour shortfall", value: "34,300", icon: Users },
] as const;

const keyFindings = [
  {
    icon: TrendingUp,
    title: "The cost pause is temporary, not structural",
    bullets: [
      "National bid-price escalation fell from 14.2% in 2022 to 1.8% in 2025.",
      "Turner & Townsend forecasts 2.5% in 2026, 4.0% in 2027 and 4.5% in 2028.",
      "The current window is the softest pricing environment developers will see this decade.",
    ],
  },
  {
    icon: Building2,
    title: "Hard costs are only part of the problem",
    bullets: [
      "Altus prices a GTA tower of 40 to 60 storeys at $320 to $410 per square foot.",
      "Those figures exclude land, development charges, soft costs, financing and profit.",
      "Excluded items routinely add 40% to 60% on top of hard cost on a commercial project.",
    ],
  },
  {
    icon: TrendingDown,
    title: "Revenue has moved further than cost",
    bullets: [
      "Unsold GTA standing inventory was asking $1,189 per square foot in Q1 2026.",
      "Comparable resale product registered in the past three years averaged $859.",
      "The 38% spread is the single clearest explanation for why projects are not launching.",
    ],
  },
  {
    icon: HardHat,
    title: "Labour is the binding constraint after 2027",
    bullets: [
      "BuildForce projects 135,000 residential retirements by 2035.",
      "Expected new entrants under 30 fall roughly 34,300 short of the hiring requirement.",
      "Nearly 800 major projects worth over $500 billion compete for the same trades.",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toRangeSeries<T extends string>(
  table: Record<T, Range>,
  keys: readonly T[],
  keyName = "city",
) {
  return keys
    .map((key) => {
      const [low, high] = table[key];
      if (low === null || high === null) return null;
      return { [keyName]: key, low, span: high - low, high, mid: (low + high) / 2 };
    })
    .filter(Boolean) as Array<Record<string, string | number>>;
}

function RangeTooltip({
  active,
  payload,
  label,
  unit = "$",
  suffix = "/sq ft",
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, number> }>;
  label?: string;
  unit?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{label}</div>
      <div className="text-stone-600">
        {unit}
        {row.low.toLocaleString()} to {unit}
        {row.high.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-1 text-stone-500">
        Midpoint {unit}
        {Math.round(row.mid).toLocaleString()}
        {suffix} · spread {Math.round((row.high / row.low - 1) * 100)}%
      </div>
    </div>
  );
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "Does It Pencil? Canadian Construction Costs, Escalation and Feasibility in 2026",
  description: heroSummary,
  datePublished: "2026-07-29",
  author: { "@type": "Organization", name: "Realist" },
  publisher: {
    "@type": "Organization",
    name: "Realist",
    logo: { "@type": "ImageObject", url: "https://realist.ca/og-image.png" },
  },
  keywords:
    "Canadian construction costs 2026, Altus cost guide, construction cost per square foot Canada, bid price escalation Canada, condo feasibility Toronto, BuildForce labour shortage, Top100 infrastructure projects",
};

/* ------------------------------------------------------------------ */
/* Feasibility model                                                   */
/* ------------------------------------------------------------------ */

function FeasibilityModel() {
  const [land, setLand] = useState(280);
  const [hard, setHard] = useState(365);
  const [softPct, setSoftPct] = useState(22);
  const [dcPerSf, setDcPerSf] = useState(95);
  const [margin, setMargin] = useState(15);

  const model = useMemo(() => {
    const soft = Math.round((hard * softPct) / 100);
    const totalCost = land + hard + soft + dcPerSf;
    const required = Math.round(totalCost / (1 - margin / 100));
    return { soft, totalCost, required };
  }, [land, hard, softPct, dcPerSf, margin]);

  const chartData = [
    {
      name: "Cost stack",
      Land: land,
      "Hard cost": hard,
      "Soft cost": model.soft,
      "Development charges": dcPerSf,
      Profit: model.required - model.totalCost,
    },
  ];

  const verdictAgainstPresale = model.required <= 1189;
  const verdictAgainstResale = model.required <= 859;

  const controls = [
    {
      label: "Land, per buildable sq ft",
      value: land,
      set: setLand,
      min: 50,
      max: 450,
      step: 5,
    },
    {
      label: "Hard construction cost, per sq ft",
      value: hard,
      set: setHard,
      min: 200,
      max: 500,
      step: 5,
    },
    {
      label: "Development charges, per sq ft",
      value: dcPerSf,
      set: setDcPerSf,
      min: 0,
      max: 200,
      step: 5,
    },
  ];

  return (
    <Card className="mb-12 border-stone-200" data-testid="feasibility-model">
      <CardHeader>
        <CardTitle>Interactive: does it pencil?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Altus publishes hard cost only. This model layers the excluded items back on and solves for
          the revenue per square foot a project must achieve to hit a target margin. Defaults reflect a
          downtown Toronto concrete tower. Move the inputs to your own assumptions.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            {controls.map((control) => (
              <div key={control.label}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{control.label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    ${control.value.toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={[control.value]}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  onValueChange={([next]) => control.set(next)}
                  aria-label={control.label}
                />
              </div>
            ))}

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Soft cost, % of hard cost</span>
                <span className="text-sm font-semibold tabular-nums">
                  {softPct}% (${model.soft}/sq ft)
                </span>
              </div>
              <Slider
                value={[softPct]}
                min={5}
                max={60}
                step={1}
                onValueChange={([next]) => setSoftPct(next)}
                aria-label="Soft cost percentage"
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Target developer margin</span>
                <span className="text-sm font-semibold tabular-nums">{margin}%</span>
              </div>
              <Slider
                value={[margin]}
                min={0}
                max={30}
                step={1}
                onValueChange={([next]) => setMargin(next)}
                aria-label="Target developer margin"
              />
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Required revenue
              </div>
              <div className="text-3xl font-bold tabular-nums text-stone-900">
                ${model.required.toLocaleString()}
                <span className="ml-1 text-base font-normal text-muted-foreground">/sq ft</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                All-in cost of ${model.totalCost.toLocaleString()} per square foot before profit.
                Against Q1 2026 asking prices of $1,189, this project{" "}
                <strong className={verdictAgainstPresale ? "text-emerald-700" : "text-red-700"}>
                  {verdictAgainstPresale ? "clears" : "does not clear"}
                </strong>
                . Against resale comparables of $859, it{" "}
                <strong className={verdictAgainstResale ? "text-emerald-700" : "text-red-700"}>
                  {verdictAgainstResale ? "clears" : "does not clear"}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) => `$${value}`}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 1400]}
                />
                <Tooltip formatter={(value: number, name) => [`$${value.toLocaleString()}/sq ft`, name]} />
                <Legend />
                <Bar dataKey="Land" stackId="s" fill="hsl(215, 60%, 32%)" />
                <Bar dataKey="Hard cost" stackId="s" fill="hsl(205, 80%, 52%)" />
                <Bar dataKey="Soft cost" stackId="s" fill="hsl(35, 88%, 56%)" />
                <Bar dataKey="Development charges" stackId="s" fill="hsl(24, 80%, 55%)" />
                <Bar dataKey="Profit" stackId="s" fill="hsl(142, 60%, 45%)" radius={[8, 8, 0, 0]} />
                <ReferenceLine
                  y={1189}
                  stroke="hsl(6, 72%, 55%)"
                  strokeDasharray="5 5"
                  label={{ value: "New asking $1,189", position: "insideTopRight", fontSize: 11 }}
                />
                <ReferenceLine
                  y={859}
                  stroke="hsl(280, 60%, 58%)"
                  strokeDasharray="5 5"
                  label={{ value: "Resale $859", position: "insideBottomRight", fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ConstructionCosts2026Report() {
  const [condoBand, setCondoBand] = useState<keyof typeof CONDO_COSTS>("13-39 storeys");
  const [assetClass, setAssetClass] = useState<keyof typeof ASSET_COSTS>("Condo 13-39 storeys");
  const [infraItem, setInfraItem] = useState<keyof typeof INFRA_COSTS>(
    "LRT guideway, underground tunnel (per km)",
  );

  const condoSeries = useMemo(
    () => toRangeSeries(CONDO_COSTS[condoBand], CITIES),
    [condoBand],
  );
  const assetSeries = useMemo(
    () => toRangeSeries(ASSET_COSTS[assetClass], CITIES),
    [assetClass],
  );
  const infraSeries = useMemo(
    () => toRangeSeries(INFRA_COSTS[infraItem], INFRA_REGIONS, "region"),
    [infraItem],
  );

  return (
    <div className="min-h-screen bg-background" data-testid="page-construction-costs-2026">
      <SEO
        title="Does It Pencil? Canadian Construction Costs and Feasibility in 2026"
        description={heroSummary}
        keywords="Canadian construction costs 2026, Altus cost guide 2026, construction cost per square foot Canada, bid price escalation Canada, Toronto condo feasibility, BuildForce labour shortage, ReNew Top100 infrastructure"
        canonicalUrl={`/insights/${REPORT_SLUG}`}
        ogType="article"
        structuredData={structuredData}
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <Link
            href="/insights/market-report"
            className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Market Reports
          </Link>

          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-[radial-gradient(circle_at_top_left,#fbbf24,transparent_26%),radial-gradient(circle_at_bottom_right,#60a5fa,transparent_28%),linear-gradient(135deg,#0c1220_0%,#1f2937_50%,#111827_100%)] text-stone-50">
            <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-10">
              <div>
                <Badge
                  variant="outline"
                  className="mb-4 border-amber-200/40 bg-amber-100/10 text-amber-100"
                >
                  Research report
                </Badge>
                <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">
                  Does It Pencil? Canadian Construction Costs and Feasibility in 2026
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 md:text-lg">
                  {heroSummary}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
                  <span>{RELEASE_LABEL}</span>
                  <span>•</span>
                  <span>Companion to The Canadian Real Estate Investor Podcast</span>
                </div>
              </div>

              <Card className="border-white/15 bg-white/10 text-stone-50 shadow-none backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">The question this report answers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-slate-200">
                  <p>
                    Cost data is abundant. Cost data assembled into a feasibility position is not.
                  </p>
                  <p>
                    This report takes four independent 2026 datasets — Altus Group, Turner &amp;
                    Townsend, BuildForce Canada and ReNew Canada — and resolves them into a single
                    judgment on where development capital can still be deployed profitably.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="mb-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {highlightStats.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-stone-200">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
                <div className="text-xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-12 grid gap-4 lg:grid-cols-2">
          {keyFindings.map(({ icon: Icon, title, bullets }) => (
            <Card key={title} className="border-stone-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-900">
                    <Icon className="h-5 w-5" />
                  </span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
                {bullets.map((bullet) => (
                  <p key={bullet}>{bullet}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ---------------- Section 1: escalation ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">1. The escalation cycle has bottomed</h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          The defining feature of the 2026 cost environment is that escalation has decelerated to a
          rate below general inflation, and is forecast to reaccelerate. Turner &amp; Townsend records
          national bid-price escalation of 1.8% in 2025, the lowest reading since the pandemic, and
          projects 2.5% for 2026, 4.0% for 2027 and 4.5% for 2028. The material point for capital
          allocation is directional rather than absolute: the cost base is not falling, and the period
          of the softest contractor pricing in this cycle is the one currently underway.
        </p>

        <div className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>National bid-price escalation, 2020 to 2028</CardTitle>
              <p className="text-sm text-muted-foreground">
                Annual percentage change. Forecast years carry a stated variability band of plus or
                minus 2.0 percentage points.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={[...escalationSeries]} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number, name) =>
                      name === "rate" ? [`${value.toFixed(1)}%`, "Escalation"] : [`${value}%`, name]
                    }
                  />
                  <ReferenceLine y={2} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {escalationSeries.map((entry) => (
                      <Cell
                        key={entry.year}
                        fill={entry.kind === "Actual" ? "hsl(215, 60%, 32%)" : "hsl(200, 85%, 55%)"}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>2026 escalation forecast by province</CardTitle>
              <p className="text-sm text-muted-foreground">
                Provinces with the largest residential exposure and the highest tariff sensitivity have
                seen escalation ease furthest.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={provincialEscalation}
                  layout="vertical"
                  margin={{ top: 10, right: 24, left: 24, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 5]}
                  />
                  <YAxis type="category" dataKey="region" tickLine={false} axisLine={false} width={110} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "2026 forecast"]} />
                  <ReferenceLine
                    x={2.5}
                    stroke="hsl(6, 72%, 55%)"
                    strokeDasharray="5 5"
                    label={{
                      value: "National 2.5%",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "hsl(6, 72%, 45%)",
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 8, 8, 0]}>
                    {provincialEscalation.map((entry) => (
                      <Cell
                        key={entry.region}
                        fill={entry.rate >= 2.5 ? "hsl(24, 80%, 55%)" : "hsl(200, 85%, 55%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12 border-l-4 border-l-amber-500 border-stone-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realist commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-stone-700">
            <p>
              The provincial dispersion is more informative than the national average. Ontario, at
              1.5%, and British Columbia, at 2.0%, sit below the national rate not because those
              markets have become efficient, but because their residential pipelines have contracted
              far enough to leave contractors bidding for a shrinking volume of work. Saskatchewan at
              4.0% and Manitoba at 3.5% sit above the national rate for the opposite reason.
              Escalation, in this reading, is a demand indicator wearing the clothing of a cost
              indicator.
            </p>
            <p>
              The practical implication for a developer with a shovel-ready site in Ontario is that
              procurement conditions in 2026 are as favourable as they are likely to be before the end
              of the decade. A project tendered in 2026 and delivered over thirty-six months carries a
              materially lower blended escalation exposure than the same project tendered in 2028. That
              is a genuine argument for proceeding, and it is separate from — and frequently in tension
              with — the revenue argument examined in section three.
            </p>
          </CardContent>
        </Card>

        {/* ---------------- Section 2: what it costs ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">
          2. What it actually costs to build, city by city
        </h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          Altus Group's 2026 Canadian Cost Guide prices $573 billion of construction across 6,652
          projects and more than 1.6 billion square feet, as at January 31, 2026. Residential accounts
          for $218 billion across 2,911 projects, infrastructure for $200 billion across 475 projects,
          and the industrial, commercial and investment segment for $155 billion across 3,266 projects.
          Every figure below is a hard construction cost per square foot, above grade, complete with
          foundations, and excludes land, development charges, professional fees, financing, marketing,
          value-added taxes and developer profit.
        </p>

        <Card className="mb-6 border-stone-200">
          <CardHeader>
            <CardTitle>Composition of the priced pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Capital value in billions against project count. Infrastructure carries 42% of the value
              in 7% of the projects.
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pipelineComposition} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="segment" tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) => `$${value}B`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `${value.toLocaleString()}`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number, name) =>
                    name === "value"
                      ? [`$${value} billion`, "Capital value"]
                      : [`${value.toLocaleString()} projects`, "Project count"]
                  }
                />
                <Legend
                  formatter={(value) => (value === "value" ? "Capital value ($B)" : "Projects")}
                />
                <Bar yAxisId="left" dataKey="value" fill="hsl(215, 60%, 32%)" radius={[8, 8, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="projects"
                  stroke="hsl(35, 88%, 56%)"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="mb-6 border-stone-200">
          <CardHeader>
            <CardTitle>Condominium hard costs by height band</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each bar is the published low-to-high range. Select a height band to compare across the
              nine markets Altus prices. Missing bars indicate insufficient local data points.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={condoBand}
              onValueChange={(value) => setCondoBand(value as keyof typeof CONDO_COSTS)}
              className="w-full"
            >
              <TabsList className="mb-6 grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4">
                {Object.keys(CONDO_COSTS).map((band) => (
                  <TabsTrigger key={band} value={band} className="text-xs sm:text-sm">
                    {band}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.keys(CONDO_COSTS).map((band) => (
                <TabsContent key={band} value={band}>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={condoSeries} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="city" tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
                        <YAxis
                          tickFormatter={(value) => `$${value}`}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 520]}
                        />
                        <Tooltip content={<RangeTooltip />} cursor={{ fill: "hsl(0 0% 0% / 0.04)" }} />
                        <Bar dataKey="low" stackId="r" fill="transparent" />
                        <Bar dataKey="span" stackId="r" radius={[8, 8, 8, 8]} fill="hsl(205, 80%, 52%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mb-6 border-stone-200">
          <CardHeader>
            <CardTitle>Cross-asset cost comparison</CardTitle>
            <p className="text-sm text-muted-foreground">
              The cost hierarchy between cities is not constant across asset classes. Select an asset
              class to see where each market's advantage actually sits.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={assetClass}
              onValueChange={(value) => setAssetClass(value as keyof typeof ASSET_COSTS)}
              className="w-full"
            >
              <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
                {Object.keys(ASSET_COSTS).map((asset) => (
                  <TabsTrigger key={asset} value={asset} className="text-xs">
                    {asset}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.keys(ASSET_COSTS).map((asset) => (
                <TabsContent key={asset} value={asset}>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assetSeries} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="city" tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
                        <YAxis tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
                        <Tooltip content={<RangeTooltip />} cursor={{ fill: "hsl(0 0% 0% / 0.04)" }} />
                        <Bar dataKey="low" stackId="r" fill="transparent" />
                        <Bar dataKey="span" stackId="r" radius={[8, 8, 8, 8]} fill="hsl(24, 80%, 55%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mb-12 border-l-4 border-l-amber-500 border-stone-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realist commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-stone-700">
            <p>
              Three observations warrant emphasis. First, the intuition that Toronto is Canada's most
              expensive place to build is incorrect on hard cost. Vancouver is more expensive in every
              residential height band, and the gap widens with height: at 40 to 60 storeys, Vancouver
              runs $350 to $465 against the GTA's $320 to $410. Toronto's disadvantage is not
              construction; it is land, development charges and the sequencing risk that attaches to a
              longer approvals timeline.
            </p>
            <p>
              Second, the width of the published range carries information that the midpoint destroys.
              The GTA's range for buildings up to twelve storeys runs from $245 to $390, a spread of
              59%, which is the widest of any market for that product. That dispersion reflects a
              market in which specification, site conditions and procurement route determine cost to a
              greater degree than the city's underlying wage and material base. It also means a
              proponent quoting the low end of the Altus range in a pro forma is making an aggressive
              assumption, not a neutral one.
            </p>
            <p>
              Third, the cheapest market depends entirely on what is being built. Montreal is the least
              expensive market for a mid-rise condominium at $275 to $335 and for independent seniors
              living at $225 to $340, but Calgary and Edmonton price a 13 to 39 storey tower below
              Montreal's floor once the range narrows. In industrial, the GTA's $75 to $180 warehouse
              range undercuts every other market at the low end. There is no single national cost
              ranking; there is a matrix, and reading the matrix correctly is where site selection
              earns its return.
            </p>
          </CardContent>
        </Card>

        {/* ---------------- Section 3: feasibility ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">
          3. The feasibility gap in the GTA condominium market
        </h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          Altus is explicit that its figures exclude land, legal fees, architectural and engineering
          fees, permits and development charges, interest and lenders' fees, marketing, insurance,
          management costs, contingencies and developer profit. On a commercial development those
          exclusions routinely add 40% to 60% to the hard cost. The guide also cautions that applying
          municipal zoning floor areas to its rates, rather than the Canadian Institute of Quantity
          Surveyors' definition, can understate cost by as much as 12% before a single site-specific
          adjustment is made.
        </p>

        <FeasibilityModel />

        <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>The GTHA condominium cycle</CardTitle>
              <p className="text-sm text-muted-foreground">
                New sales and condominium starts against forecast completions. 2024 sales and starts
                are derived from Urbanation's published year-over-year declines; 2028 completions are
                not separately published.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={gthaCondoCycle} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number, name) => [`${value.toLocaleString()} units`, name]}
                  />
                  <Legend />
                  <Bar dataKey="completions" name="Completions" fill="hsl(215, 60%, 32%)" radius={[6, 6, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="New sales"
                    stroke="hsl(6, 72%, 55%)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="starts"
                    name="Condo starts"
                    stroke="hsl(35, 88%, 56%)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>The new-to-resale price gap</CardTitle>
              <p className="text-sm text-muted-foreground">
                Q1 2026 average asking price for unsold standing inventory against resale product
                registered within the past three years.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priceGap} layout="vertical" margin={{ top: 10, right: 40, left: 12, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `$${value}`}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 1300]}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}/sq ft`, "Average"]} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    <Cell fill="hsl(6, 72%, 55%)" />
                    <Cell fill="hsl(280, 60%, 58%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                A 38% premium for new product. In Q1 2026, 246 new units sold across the GTHA, down 52%
                year over year, and no new project launched for the first time in at least three
                decades.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12 border-l-4 border-l-amber-500 border-stone-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realist commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-stone-700">
            <p>
              The arithmetic is not close. A downtown Toronto tower carrying land at $280 per buildable
              square foot, hard cost at the midpoint of the Altus range for a 40 to 60 storey building,
              soft costs at 22% of hard, and development charges of approximately $95 per square foot
              arrives at an all-in cost before profit in the region of $820 per square foot. To earn a
              15% margin the project must clear roughly $965 per square foot. That is below the $1,189
              being asked on standing inventory and far above the $859 at which a buyer can acquire a
              three-year-old unit in a comparable building.
            </p>
            <p>
              This is the mechanism behind the cancellations. In 2025 a record 28 active projects
              comprising 7,243 units were cancelled in the GTA, eight of which, representing 2,189
              units, were converted to purpose-built rental. New condominium sales fell 60% to 1,599
              units, the lowest annual figure since 1991 and 91% below the ten-year average.
              Condominium starts fell 63% to 3,272 units while purpose-built rental starts rose 24% to
              8,545. Capital did not leave the sector; it changed tenure.
            </p>
            <p>
              The supply consequence is already fixed. Completions are projected at 21,850 units in
              2026 and 14,366 in 2027, against roughly 29,000 in each of the preceding two years, with
              Urbanation's stated expectation of effectively no new completions by the end of the
              decade. Construction lead times mean the 2029 and 2030 delivery picture is determined by
              decisions taken in 2025 and 2026, and those decisions have already been made. An investor
              underwriting GTA rental fundamentals for the back half of this decade is underwriting a
              supply vacuum that is now largely unavoidable.
            </p>
            <p>
              The appropriate caution is that a supply vacuum is a necessary but not sufficient
              condition for price appreciation. Demand must also be present, and demand is a function
              of employment, immigration policy and financing cost, none of which is currently
              supportive. The defensible position is that the supply side of the 2029 to 2031 equation
              carries unusually low uncertainty, and that the demand side does not.
            </p>
          </CardContent>
        </Card>

        {/* ---------------- Section 4: labour ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">4. Labour is the constraint that binds</h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          BuildForce Canada's Construction and Maintenance Looking Forward 2026-2035 series, released
          in July 2026, models an industry employing 1.6 million people, approximately one in thirteen
          working Canadians, and contributing 7% of national GDP. Residential employment is projected
          to contract 4% by 2035 against elevated 2025 levels, with the losses concentrated in new
          housing rather than renovation. Non-residential employment is projected to grow 6% over the
          same horizon.
        </p>

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>The national recruitment arithmetic</CardTitle>
              <p className="text-sm text-muted-foreground">
                Hiring requirement against expected supply of new entrants under thirty, 2026 to 2034.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={labourNational}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 12, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="metric"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString()} workers`, "Count"]} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {labourNational.map((entry) => (
                      <Cell
                        key={entry.metric}
                        fill={
                          entry.metric.includes("shortfall")
                            ? "hsl(6, 72%, 55%)"
                            : entry.metric.includes("entrants")
                              ? "hsl(142, 60%, 45%)"
                              : "hsl(215, 60%, 32%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Ontario employment change by region, 2035 against 2025</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ontario residential employment is forecast to grow 11% province-wide and
                non-residential 5%, but the distribution is markedly uneven.
              </p>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ontarioRegions} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="region"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number, name) => [`${value > 0 ? "+" : ""}${value}%`, name]} />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="residential" name="Residential" fill="hsl(205, 80%, 52%)" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="nonResidential"
                    name="Non-residential"
                    fill="hsl(35, 88%, 56%)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12 border-l-4 border-l-amber-500 border-stone-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realist commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-stone-700">
            <p>
              The headline shortfall of 34,300 workers by 2034 understates the operational difficulty,
              because the gap is not evenly distributed across trades, regions or years. Ontario alone
              faces 92,000 retirements against 98,800 expected new entrants, and a total recruitment
              requirement of 126,100, leaving a provincial shortfall of 27,300 — approximately
              four-fifths of the entire national gap concentrated in one province.
            </p>
            <p>
              Two features of the workforce composition deserve attention from anyone modelling
              long-run cost. Newcomers to Canada represent 20% of the construction workforce against
              28% of the overall workforce, meaning construction has historically been less effective
              than the broader economy at absorbing immigration. Women account for 215,300 workers but
              only 6% of on-site tradespeople. Both figures describe recruitment capacity that exists
              but has not been converted, which is a more tractable problem than a genuine absence of
              available labour, and a reason to treat the shortfall projection as a policy outcome
              rather than a demographic inevitability.
            </p>
            <p>
              For underwriting purposes the relevant translation is schedule. Labour constraints
              express themselves first as extended construction periods and only later as line-item
              wage inflation. A project that carried a thirty-month construction schedule in 2019 and
              carries thirty-six to forty months in 2026 has absorbed a twenty to thirty percent
              increase in interest-during-construction and a corresponding delay to first revenue.
              That effect is frequently absent from pro formas that have carefully indexed material
              costs.
            </p>
          </CardContent>
        </Card>

        {/* ---------------- Section 5: infrastructure ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">
          5. The infrastructure pipeline competes for the same capacity
        </h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          ReNew Canada's 2026 Top100 Projects Report values Canada's hundred largest public
          infrastructure projects at $343 billion, an increase of $43 billion year over year and the
          largest single-year rise in the report's twenty-year history. Nuclear accounts for the bulk
          of the increase, with the Pickering refurbishment and the Darlington New Nuclear Project
          together approaching $50 billion, and nuclear projects occupying four of the top six
          positions.
        </p>

        <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Top100 value by sector</CardTitle>
              <p className="text-sm text-muted-foreground">
                Transit remains the largest sector by value. Buildings carry the largest project count.
              </p>
            </CardHeader>
            <CardContent className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={top100Sectors} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => `$${value}B`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number, name) =>
                      name === "value" ? [`$${value} billion`, "Value"] : [`${value} projects`, "Count"]
                    }
                  />
                  <Legend formatter={(value) => (value === "value" ? "Value ($B)" : "Projects")} />
                  <Bar yAxisId="left" dataKey="value" fill="hsl(215, 60%, 32%)" radius={[8, 8, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="projects"
                    stroke="hsl(35, 88%, 56%)"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Infrastructure unit costs by province</CardTitle>
              <p className="text-sm text-muted-foreground">
                Published low-to-high ranges in millions of dollars. Select a component to compare.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs
                value={infraItem}
                onValueChange={(value) => setInfraItem(value as keyof typeof INFRA_COSTS)}
                className="w-full"
              >
                <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
                  {Object.keys(INFRA_COSTS).map((item) => (
                    <TabsTrigger key={item} value={item} className="text-[11px]">
                      {item.split("(")[0].trim()}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.keys(INFRA_COSTS).map((item) => (
                  <TabsContent key={item} value={item}>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={infraSeries} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="region"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            tickFormatter={(value) => `$${value}M`}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            content={<RangeTooltip unit="$" suffix="M" />}
                            cursor={{ fill: "hsl(0 0% 0% / 0.04)" }}
                          />
                          <Bar dataKey="low" stackId="r" fill="transparent" />
                          <Bar
                            dataKey="span"
                            stackId="r"
                            radius={[8, 8, 8, 8]}
                            fill="hsl(280, 55%, 55%)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-stone-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Case study: South Niagara Hospital
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              A single project that illustrates the scale, structure and labour draw of the current
              institutional cycle.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Capital value", value: "$3.6B" },
                { label: "Top100 rank", value: "#26" },
                { label: "Delivery model", value: "P3" },
                { label: "Target completion", value: "2028" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-stone-200 p-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-lg font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>
                Niagara Health's South Niagara site in Niagara Falls consolidates services from
                multiple existing facilities into a single LEED-certified campus, delivered by
                EllisDon Infrastructure Healthcare with EllisDon Capital and Plenary Americas, with
                Parkin Architects and Adamson Associates on design and Stantec and H.H. Angus on
                engineering. The final structural concrete pour completed in November 2025;
                curtainwall installation is underway on levels one through five with precast panels
                progressing from levels five to eight.
              </p>
              <p>
                Altus prices general hospital and acute care construction in Ontario at $1,030 to
                $1,620 per square foot, the highest rate in the entire private and public guide. A
                single project of this scale absorbs mechanical, electrical and structural trade
                capacity across an entire regional labour market for the duration of its build.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-12 border-l-4 border-l-amber-500 border-stone-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Realist commentary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-stone-700">
            <p>
              The infrastructure programme is frequently presented to real estate investors as an
              unambiguous positive, on the reasoning that transit and hospitals raise adjacent land
              values. That reasoning is sound but incomplete. The $343 billion Top100 programme, and
              the nearly 800 major projects worth over $500 billion that BuildForce tracks over the
              coming decade, draw on precisely the same trades, equipment and management capacity that
              private residential development requires. Public procurement generally pays promptly,
              carries sovereign or near-sovereign counterparty risk, and offers multi-year certainty of
              work. A private condominium developer competing for the same crane operator is
              structurally disadvantaged in that competition.
            </p>
            <p>
              This is the more precise explanation for Turner &amp; Townsend's forecast reacceleration
              to 4.0% in 2027 and 4.5% in 2028. It is not a general inflation forecast. It is a
              statement that public infrastructure demand will absorb slack capacity faster than
              private demand recovers, and that contractors will regain pricing power on that basis.
              Developers whose feasibility depends on 2026 cost levels persisting through a 2028
              tender should regard that assumption as the weakest line in the pro forma.
            </p>
            <p>
              The constructive position is locational rather than sectoral. Land assembled within the
              catchment of a funded, under-construction transit or hospital project captures the value
              uplift while the same programme suppresses competing supply through labour scarcity.
              That is a genuinely favourable combination, and it is available only to investors who
              are positioned before the delivery date rather than after it.
            </p>
          </CardContent>
        </Card>

        {/* ---------------- Section 6: what the guide excludes ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">
          6. What the cost data does not tell you
        </h2>

        <div className="mb-12 grid gap-4 lg:grid-cols-2">
          {[
            {
              icon: Factory,
              title: "Tariffs are outside the dataset",
              body: "Altus states that the 2026 figures do not account for potential tariff impacts, upcoming building code revisions, or labour agreement negotiations. Turner & Townsend, by contrast, explicitly incorporates tariff-driven risk allowances into its escalation forecast. The two sources are not contradictory; they are measuring different things, and the difference between them is approximately the size of the tariff and code risk that a proponent carries unhedged.",
            },
            {
              icon: Layers,
              title: "The rates assume an idealised site",
              body: "The published rates assume a level, open site with no restrictions from adjoining properties, stable soil conditions, and average-quality finishes. Altus separately quotes a premium for unusual circumstances on underground parking of up to $220 per square foot in Vancouver and the GTA, covering poor soil stability, bathtubbing, shoring, constrained sites and contaminated soil remediation. Few urban infill sites satisfy the base assumption.",
            },
            {
              icon: Building2,
              title: "Floor-area definition is a live source of error",
              body: "Rates are calculated on the Canadian Institute of Quantity Surveyors' method of measurement. Applying municipal zoning floor areas to those rates can understate cost by as much as 12%. Balconies are excluded, enclosed solariums are included, mezzanines are generally included, and no deduction is made for openings at stairs, elevators or vertical ducts.",
            },
            {
              icon: Construction,
              title: "Above grade and below grade price separately",
              body: "Published building rates cover the above-grade scope complete with foundations. Below-grade scope must be added at the underground parking rate. Altus's own worked example prices a 40-storey Toronto office building at $348 million for 800,000 square feet above grade plus $46 million for 200,000 square feet below, for a total of $394 million. Omitting the below-grade component understates that project by 12%.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-stone-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-900">
                    <Icon className="h-4 w-4" />
                  </span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">{body}</CardContent>
            </Card>
          ))}
        </div>

        {/* ---------------- Positions ---------------- */}

        <h2 className="mb-2 text-2xl font-bold text-stone-900">7. Positions</h2>
        <p className="mb-6 max-w-4xl text-sm leading-7 text-muted-foreground">
          The following are the conclusions Realist is prepared to defend on the evidence assembled
          above. They are stated as positions rather than predictions, and each identifies the
          condition under which it would be abandoned.
        </p>

        <div className="mb-12 grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "Cost relief in 2026 is a window, not a trend",
              body: "Escalation of 1.8% in 2025 and 2.5% in 2026 sits against forecasts of 4.0% and 4.5% for 2027 and 2028. A proponent with an approved site and committed financing has a defensible reason to tender now. Abandon this position if the infrastructure programme slips materially or if federal and provincial capital plans are deferred.",
            },
            {
              title: "GTA condominium development does not pencil at current pricing",
              body: "All-in cost before profit of approximately $820 per square foot against resale comparables of $859 leaves no margin for the risk taken. Abandon this position if development charges are reduced by half, if land resets by 30% or more, or if the new-to-resale spread compresses from the resale side.",
            },
            {
              title: "The 2029 to 2031 GTA supply shortfall is close to locked in",
              body: "Completions falling from roughly 29,000 to 14,366 by 2027 and to effectively zero by decade's end are the mechanical consequence of decisions already taken. Abandon this position only if purpose-built rental starts scale far beyond the 8,545 units recorded in 2025.",
            },
            {
              title: "Cost advantage is asset-specific, not city-specific",
              body: "Montreal leads on mid-rise residential and seniors housing, Calgary and Edmonton on towers, and the GTA on industrial at the low end of the range. Market selection conducted at the city level rather than the asset level discards most of the available advantage.",
            },
            {
              title: "Labour scarcity should be underwritten as schedule risk first",
              body: "The financial expression of a 34,300-worker shortfall is interest during construction and delayed revenue, not primarily wage line items. Any pro forma that indexes materials but holds the construction schedule constant is understating the exposure.",
            },
            {
              title: "Proximity to funded infrastructure is the clearest available edge",
              body: "The same programme that raises land values suppresses competing private supply by absorbing trade capacity. Positioning ahead of delivery captures both effects; positioning after delivery captures neither.",
            },
          ].map((item) => (
            <Card key={item.title} className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">{item.body}</CardContent>
            </Card>
          ))}
        </div>

        {/* ---------------- Sources ---------------- */}

        <Card className="mb-12 border-stone-200">
          <CardHeader>
            <CardTitle>Sources and methodology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              Cost tables are transcribed directly from the Altus Group 2026 Canadian Cost Guide,
              private-sector, public-sector and infrastructure tables, with data current as at January
              31, 2026. Escalation figures are taken from Turner &amp; Townsend's Canada Market
              Intelligence Q1 2026, Figures 9 and 10. Workforce projections are from BuildForce
              Canada's Construction and Maintenance Looking Forward 2026-2035 series released July 20,
              2026, and its Ontario report. Infrastructure programme totals are from ReNew Canada's
              2026 Top100 Projects Report. GTHA condominium market data is from Urbanation.
            </p>
            <p>
              The feasibility model is Realist's own construction. It is not sourced from any of the
              above publications and should be treated as an illustrative framework rather than a
              published benchmark. Land, soft cost and development charge defaults reflect downtown
              Toronto conditions as at mid-2026 and are user-adjustable. Altus explicitly advises
              against using its guide to measure year-over-year cost escalation, because building
              category definitions and specifications are revised between editions; no such comparison
              is made in this report.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { url: SOURCE_ALTUS, label: "Altus Group 2026 Canadian Cost Guide (PDF)" },
                { url: SOURCE_TT, label: "Turner & Townsend Canada MI Q1 2026, escalation forecast" },
                { url: SOURCE_BUILDFORCE, label: "BuildForce Canada LMI 2026-2035" },
                { url: SOURCE_BUILDFORCE_RELEASE, label: "BuildForce Canada July 2026 release" },
                { url: SOURCE_RENEW_TOP100, label: "ReNew Canada 2026 Top100 Projects" },
                { url: SOURCE_RENEW_NIAGARA, label: "ReNew Canada: South Niagara Hospital" },
                { url: SOURCE_URBANATION_Q1, label: "Urbanation: standing inventory hits record high" },
                { url: SOURCE_URBANATION_SALES, label: "Urbanation: new condo sales lowest since 1991" },
              ].map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{source.label}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <div>
            <div className="text-sm font-medium text-stone-900">Next step</div>
            <p className="text-sm text-muted-foreground">
              Take the cost stack into a live site and test it against real land pricing.
            </p>
          </div>
          <Link
            href="/tools/multiplex-feasibility"
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
          >
            Open the feasibility tool
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ReportEndCta sourcePage={`/insights/${REPORT_SLUG}`} />
      </main>
    </div>
  );
}
