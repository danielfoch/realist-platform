import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Home,
  MapPin,
  Mountain,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportEndCta } from "@/components/ReportEndCta";

const SOURCE_STUDY_URL =
  "https://www.fraserinstitute.org/studies/interprovincial-migration-in-canada-1995-2024-what-do-the-numbers-tell-us";
const SOURCE_PDF_URL =
  "https://www.fraserinstitute.org/sites/default/files/2026-06/interprovincial-migration-in-canada-1995-2024.pdf";
const SOURCE_ARTICLE_URL =
  "https://thehub.ca/2026/06/11/alberta-gained-539000-residents-ontario-lost-168000-from-canadian-residents-moving-provinces-over-the-past-3-decades/";
const REPORT_SLUG = "canada-interprovincial-migration-2026";
const RELEASE_LABEL = "Fraser Institute study published June 2, 2026";

const heroSummary =
  "A new Fraser Institute study on interprovincial migration from 1995/96 to 2024/25 shows Alberta as Canada's clear long-run winner for domestic migration, while Ontario and Quebec posted the largest net losses in absolute terms. For housing investors, the signal is straightforward: people keep moving toward provinces that still offer some combination of jobs, affordability, and room to build.";

const keyTakeaways = [
  {
    icon: TrendingUp,
    title: "Alberta Was The Standout Magnet",
    bullets: [
      "Alberta posted net interprovincial in-migration of 538,824 over the last three decades.",
      "That is more than double British Columbia's gain of 214,883.",
      "Alberta was also the only province with net inflows from every other province.",
    ],
  },
  {
    icon: TrendingDown,
    title: "Ontario Lost The Most In Recent Years",
    bullets: [
      "Ontario's 30-year net loss was 168,166 residents to other provinces.",
      "The study says the province's highest out-migration rates were in the most recent five years.",
      "Its 2023/24 outflow rate was the worst in the full 1995/96-2024/25 period.",
    ],
  },
  {
    icon: Users,
    title: "Young Adults Moved West",
    bullets: [
      "Alberta gained 192,329 net migrants aged 18 to 24.",
      "British Columbia and Alberta were the only provinces with positive net migration in every age group.",
      "Newfoundland and Labrador lost the equivalent of 97.3% of its 2025 population aged 18 to 24 on a net basis.",
    ],
  },
  {
    icon: Home,
    title: "Housing Still Sits Under The Story",
    bullets: [
      "The pattern is consistent with migrants chasing cheaper ownership and better labour-market odds.",
      "Ontario and BC remain huge economic centres, but affordability is pushing marginal households elsewhere.",
      "For real estate investors, migration remains one of the cleanest demand-side signals available.",
    ],
  },
] as const;

const highlightStats = [
  { label: "Alberta net gain", value: "538,824", icon: TrendingUp },
  { label: "BC net gain", value: "214,883", icon: Mountain },
  { label: "Ontario net loss", value: "-168,166", icon: TrendingDown },
  { label: "Quebec net loss", value: "-255,988", icon: TrendingDown },
  { label: "Alberta 18-24 gain", value: "192,329", icon: Users },
  { label: "NL 18-24 loss vs 2025 population", value: "-97.3%", icon: MapPin },
] as const;

const provinceTotals = [
  { province: "AB", name: "Alberta", net: 538824, popShare: 10.7 },
  { province: "BC", name: "British Columbia", net: 214883, popShare: 3.8 },
  { province: "NS", name: "Nova Scotia", net: 23299, popShare: 2.1 },
  { province: "PE", name: "Prince Edward Island", net: 4335, popShare: 2.4 },
  { province: "NB", name: "New Brunswick", net: -5862, popShare: -0.7 },
  { province: "NL", name: "Newfoundland and Labrador", net: -58319, popShare: -10.6 },
  { province: "SK", name: "Saskatchewan", net: -123603, popShare: -9.8 },
  { province: "MB", name: "Manitoba", net: -155919, popShare: -10.3 },
  { province: "ON", name: "Ontario", net: -168166, popShare: -1.0 },
  { province: "QC", name: "Quebec", net: -255988, popShare: -2.8 },
];

const ageProfile = [
  { province: "NL", age18to24: -37163, age25to44: -13125, age45to64: 77, age65plus: 1892 },
  { province: "PE", age18to24: -3800, age25to44: -474, age45to64: 4571, age65plus: 1974 },
  { province: "NS", age18to24: -11124, age25to44: 1183, age45to64: 21585, age65plus: 6533 },
  { province: "NB", age18to24: -23104, age25to44: -7380, age45to64: 13922, age65plus: 4729 },
  { province: "QC", age18to24: -29297, age25to44: -119658, age45to64: -29517, age65plus: -17357 },
  { province: "ON", age18to24: -63063, age25to44: -34328, age45to64: -55646, age65plus: -16924 },
  { province: "MB", age18to24: -18637, age25to44: -69723, age45to64: -26134, age65plus: -7369 },
  { province: "SK", age18to24: -26146, age25to44: -47589, age45to64: -14404, age65plus: -11839 },
  { province: "AB", age18to24: 192329, age25to44: 216679, age45to64: 5058, age65plus: 22728 },
  { province: "BC", age18to24: 20766, age25to44: 84014, age45to64: 80522, age65plus: 18446 },
];

const majorFlows = [
  { label: "Ontario -> Alberta", net: 195236, fill: "hsl(142, 70%, 42%)" },
  { label: "Saskatchewan -> Alberta", net: 95949, fill: "hsl(142, 65%, 48%)" },
  { label: "Manitoba -> Alberta", net: 73025, fill: "hsl(142, 60%, 55%)" },
  { label: "Ontario -> BC", net: 114092, fill: "hsl(205, 80%, 50%)" },
  { label: "Quebec -> Ontario", net: 168466, fill: "hsl(12, 82%, 56%)" },
  { label: "Quebec -> Alberta", net: 51472, fill: "hsl(28, 85%, 56%)" },
  { label: "BC -> Alberta", net: 12780, fill: "hsl(165, 60%, 44%)" },
];

const annualNarrativeSeries = [
  { period: "1997/98", alberta: 15.2, ontario: -0.4 },
  { period: "2005/06", alberta: 13.8, ontario: -1.2 },
  { period: "2009/10", alberta: -0.9, ontario: -0.8 },
  { period: "2012/13", alberta: 10.0, ontario: -1.0 },
  { period: "2016/17", alberta: -3.7, ontario: 0.9 },
  { period: "2019/20", alberta: -0.6, ontario: 0.2 },
  { period: "2023/24", alberta: 10.3, ontario: -2.7 },
];

const implications = [
  {
    title: "Alberta rental demand still has the strongest domestic tailwind",
    body:
      "A 538,824-person net gain from the rest of Canada does not guarantee every Alberta submarket performs, but it does keep demand pressure structurally higher than in most provinces. Investors underwriting Calgary and Edmonton should treat migration as a durable support, not a short-term headline.",
  },
  {
    title: "Ontario volume risk is rising before price relief fully arrives",
    body:
      "Ontario's domestic outflow does not mean the province stops growing overall, but it does mean marginal demand is leaking to lower-cost provinces. That matters first in transaction volume, condo liquidity, and rent resilience at the affordability margin.",
  },
  {
    title: "Domestic migration is not just a jobs story",
    body:
      "The age breakdown suggests people are moving at life stages tied to education, household formation, and retirement. That makes the data especially relevant for entry-level ownership, suburban rental demand, and markets with room to add family-oriented housing stock.",
  },
  {
    title: "Housing policy credibility shows up in migration over time",
    body:
      "People do not move provinces lightly. Over a 30-year period, net flows become a rough scoreboard for labour opportunity, taxes, and the ability to still buy or rent acceptable housing. Real estate investors should watch where domestic migrants go before watching where institutions issue press releases.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline:
    "Canada Interprovincial Migration 2026: Alberta Wins, Ontario Loses - Housing And Investor Implications",
  datePublished: "2026-06-12",
  dateModified: "2026-06-12",
  author: { "@type": "Organization", name: "Realist.ca" },
  publisher: {
    "@type": "Organization",
    name: "Realist.ca",
    logo: { "@type": "ImageObject", url: "https://realist.ca/og-image.png" },
  },
  description: heroSummary,
  mainEntityOfPage: `https://realist.ca/insights/${REPORT_SLUG}`,
  isBasedOn: [SOURCE_STUDY_URL, SOURCE_PDF_URL, SOURCE_ARTICLE_URL],
  keywords:
    "interprovincial migration Canada, Alberta migration, Ontario out migration, Fraser Institute migration report, Canadian housing demand, Canadian real estate market report",
};

function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function InterprovincialMigrationCanada2026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-interprovincial-migration-2026">
      <SEO
        title="Canada Interprovincial Migration 2026: Alberta Wins, Ontario Loses"
        description={heroSummary}
        keywords="Canada interprovincial migration report 2026, Alberta gained residents, Ontario lost residents, Fraser Institute interprovincial migration, Canadian housing demand, Alberta real estate, Ontario housing market"
        canonicalUrl={`/insights/${REPORT_SLUG}`}
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

          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-[radial-gradient(circle_at_top_left,#fde68a,transparent_24%),radial-gradient(circle_at_bottom_right,#bfdbfe,transparent_26%),linear-gradient(135deg,#0f172a_0%,#172554_48%,#1e293b_100%)] text-stone-50">
            <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-10">
              <div>
                <Badge variant="outline" className="mb-4 border-amber-200/40 bg-amber-100/10 text-amber-100">
                  New report
                </Badge>
                <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">
                  Canada Interprovincial Migration 2026: Alberta Wins, Ontario Bleeds
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 md:text-lg">
                  {heroSummary}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
                  <span>{RELEASE_LABEL}</span>
                  <span>•</span>
                  <span>Coverage updated June 12, 2026</span>
                </div>
              </div>

              <Card className="border-white/15 bg-white/10 text-stone-50 shadow-none backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Why this matters to housing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-slate-200">
                  <p>
                    Domestic migration is one of the cleanest leading signals for where households think they can still build a life inside Canada.
                  </p>
                  <p>
                    Alberta's gain and Ontario's loss are not abstract demographic trivia. They shape rental demand, absorption, resale depth, and the politics of supply.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
          {keyTakeaways.map(({ icon: Icon, title, bullets }) => (
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

        <div className="mb-12 grid gap-6 xl:grid-cols-2">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>30-year net migration by province</CardTitle>
              <p className="text-sm text-muted-foreground">
                Absolute domestic migration balance from 1995/96 to 2024/25.
              </p>
            </CardHeader>
            <CardContent className="h-[390px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceTotals} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="province" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [formatSignedNumber(value), "Net migrants"]}
                    labelFormatter={(label) => provinceTotals.find((item) => item.province === label)?.name ?? label}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                    {provinceTotals.map((entry) => (
                      <Cell
                        key={entry.province}
                        fill={entry.net >= 0 ? "hsl(142, 70%, 42%)" : "hsl(6, 72%, 55%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Net migration as share of 2025 population</CardTitle>
              <p className="text-sm text-muted-foreground">
                Absolute winners can differ from relative winners. Alberta and BC gained, while NL, Manitoba, and Saskatchewan were hit hardest on a population basis.
              </p>
            </CardHeader>
            <CardContent className="h-[390px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceTotals} layout="vertical" margin={{ top: 10, right: 20, left: 24, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="province" tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    formatter={(value: number) => [formatSignedPercent(value), "Share of 2025 population"]}
                    labelFormatter={(label) => provinceTotals.find((item) => item.province === label)?.name ?? label}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="popShare" radius={[0, 8, 8, 0]}>
                    {provinceTotals.map((entry) => (
                      <Cell
                        key={entry.province}
                        fill={entry.popShare >= 0 ? "hsl(210, 80%, 52%)" : "hsl(24, 80%, 55%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12 border-stone-200">
          <CardHeader>
            <CardTitle>Age-group profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              The report&apos;s strongest demographic signal is that Alberta and BC were the only provinces with positive net migration across every age band.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="young" className="w-full">
              <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="young">Younger movers</TabsTrigger>
                <TabsTrigger value="older">Older movers</TabsTrigger>
              </TabsList>

              <TabsContent value="young">
                <div className="h-[390px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageProfile} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="province" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [formatSignedNumber(value), "Net migrants"]} />
                      <Legend />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                      <Bar dataKey="age18to24" name="18-24" fill="hsl(142, 70%, 42%)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="age25to44" name="25-44" fill="hsl(205, 80%, 52%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="older">
                <div className="h-[390px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageProfile} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="province" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [formatSignedNumber(value), "Net migrants"]} />
                      <Legend />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                      <Bar dataKey="age45to64" name="45-64" fill="hsl(35, 88%, 56%)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="age65plus" name="65+" fill="hsl(280, 60%, 58%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mb-12 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Major migration corridors</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alberta&apos;s biggest net gains came from Ontario, Saskatchewan, and Manitoba. Ontario also supplied BC with a large positive flow.
              </p>
            </CardHeader>
            <CardContent className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={majorFlows} layout="vertical" margin={{ top: 10, right: 20, left: 12, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={130} />
                  <Tooltip formatter={(value: number) => [formatSignedNumber(value), "Net migrants"]} />
                  <Bar dataKey="net" radius={[0, 8, 8, 0]}>
                    {majorFlows.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader>
              <CardTitle>Alberta vs Ontario migration cycle</CardTitle>
              <p className="text-sm text-muted-foreground">
                Narrative anchor points from the Fraser report show Alberta repeatedly reasserting itself as the top destination while Ontario&apos;s recent losses deepened.
              </p>
            </CardHeader>
            <CardContent className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={annualNarrativeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${value}`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [`${value > 0 ? "+" : ""}${value.toFixed(1)} per 1,000`, "Rate"]} />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Line
                    type="monotone"
                    dataKey="alberta"
                    name="Alberta"
                    stroke="hsl(142, 70%, 42%)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ontario"
                    name="Ontario"
                    stroke="hsl(6, 72%, 55%)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12 grid gap-4 lg:grid-cols-2">
          {implications.map((item) => (
            <Card key={item.title} className="border-stone-200">
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {item.body}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-12 border-stone-200">
          <CardHeader>
            <CardTitle>Sources and methodology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              All chart data above is drawn from the Fraser Institute&apos;s study and PDF on interprovincial migration in Canada from 1995/96 to 2024/25. The Hub article is linked as secondary coverage because it surfaced the same findings to a broader audience.
            </p>
            <div className="space-y-2">
              <a
                href={SOURCE_STUDY_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Fraser Institute study page
              </a>
              <a
                href={SOURCE_PDF_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Fraser Institute PDF report
              </a>
              <a
                href={SOURCE_ARTICLE_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                The Hub article
              </a>
            </div>
            <p>
              Source notes: province totals use the report&apos;s cumulative net migration table for 1995/96 to 2024/25; age-group values use the report&apos;s age breakdown table; major corridor values use the report&apos;s origin-and-destination discussion for Alberta, Ontario, BC, and Quebec; the Alberta and Ontario line chart uses explicit narrative anchor points and peaks quoted in the report rather than every annual observation.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <div>
            <div className="text-sm font-medium text-stone-900">Next step</div>
            <p className="text-sm text-muted-foreground">
              Pair migration with local rent, inventory, and yield data before making a city-level bet.
            </p>
          </div>
          <Link
            href="/insights/market-report"
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
          >
            Browse more reports
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ReportEndCta sourcePage="/insights/canada-interprovincial-migration-2026" />
      </main>
    </div>
  );
}
