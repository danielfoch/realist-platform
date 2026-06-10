import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingDown, TrendingUp, ArrowLeft, Calendar,
  Users, DollarSign, GraduationCap, Briefcase, ChevronDown, ChevronUp,
  Building2, ExternalLink,
} from "lucide-react";
import { useState } from "react";

const TITLE = "The Canada-US Productivity Gap";
const SUBTITLE = "The Distributional Origins of the Canada-US GDP and Labour Productivity Gaps";
const AUTHORS = "James C. MacGee & Joel Rodrigue";
const PUBLISHED = "December 2024";
const SOURCE = "Bank of Canada Staff Working Paper 2024-49";
const PDF_URL = "https://www.bankofcanada.ca/wp-content/uploads/2024/12/swp2024-49.pdf";

const gdpRatioHistory = [
  { year: "1960", ratio: 78 },
  { year: "1965", ratio: 80 },
  { year: "1970", ratio: 82 },
  { year: "1975", ratio: 85 },
  { year: "1980", ratio: 88 },
  { year: "1985", ratio: 85 },
  { year: "1990", ratio: 83 },
  { year: "1995", ratio: 79 },
  { year: "2000", ratio: 76 },
  { year: "2005", ratio: 81 },
  { year: "2010", ratio: 78 },
  { year: "2015", ratio: 74 },
  { year: "2019", ratio: 76 },
  { year: "2020", ratio: 75 },
];

const gapContribution = [
  { group: "Top 1%", share: 37.5, label: "37.5%" },
  { group: "P90-P99", share: 37.5, label: "37.5%" },
  { group: "P50-P90", share: 15, label: "15%" },
  { group: "Bottom 50%", share: 10, label: "10%" },
];

const incomeGapByPercentile = [
  { percentile: "P10", canadaPctOfUS: 98 },
  { percentile: "P20", canadaPctOfUS: 95 },
  { percentile: "P30", canadaPctOfUS: 93 },
  { percentile: "P40", canadaPctOfUS: 91 },
  { percentile: "P50", canadaPctOfUS: 88 },
  { percentile: "P60", canadaPctOfUS: 85 },
  { percentile: "P70", canadaPctOfUS: 80 },
  { percentile: "P80", canadaPctOfUS: 75 },
  { percentile: "P90", canadaPctOfUS: 68 },
  { percentile: "P95", canadaPctOfUS: 60 },
  { percentile: "P99", canadaPctOfUS: 48 },
  { percentile: "Top 1%", canadaPctOfUS: 40 },
];

const educationGap = [
  { category: "No Degree", canadaPctOfUS: 85, gap: 15 },
  { category: "University Degree", canadaPctOfUS: 72, gap: 28 },
  { category: "Business Owners", canadaPctOfUS: 65, gap: 35 },
];

const productivityContribution = [
  { component: "Top 10% Income Gap", value: 67, color: "hsl(220, 70%, 50%)" },
  { component: "Hours Worked Shifts", value: 20, color: "hsl(35, 80%, 55%)" },
  { component: "Other Factors", value: 13, color: "hsl(160, 50%, 45%)" },
];

function StatCard({ title, value, subtitle, icon: Icon, accent }: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  accent?: string;
}) {
  return (
    <Card className="border-0 shadow-sm" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className={`text-2xl font-bold mb-1 ${accent || ""}`}>{value}</div>
        <div className="text-xs font-medium text-foreground mb-0.5">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-8">
      <button
        className="flex items-center gap-2 w-full text-left mb-4 group"
        onClick={() => setOpen(!open)}
        data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <h2 className="text-xl font-bold">{title}</h2>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && children}
    </div>
  );
}

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  },
};

export default function ProductivityGapReport() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canada-US Productivity Gap Report | Realist.ca"
        description="Bank of Canada research shows the top 10% of earners account for 75% of the Canada-US GDP gap. Analysis of implications for Canadian real estate investors."
        canonicalUrl="/insights/productivity-gap"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-2">
          <Link href="/insights/market-report" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Market Reports
          </Link>
        </div>

        <div className="mb-8">
          <Badge variant="outline" className="mb-3 text-xs">
            <Calendar className="h-3 w-3 mr-1" /> {PUBLISHED}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="report-title">
            {TITLE}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mb-1">
            {SUBTITLE}
          </p>
          <p className="text-sm text-muted-foreground">
            {AUTHORS} — {SOURCE}
            <a href={PDF_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-primary hover:underline">
              Read Full Paper <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            title="GDP Gap Driven by Top 10%"
            value="75%"
            subtitle="Three-quarters of the Canada-US GDP/adult gap"
            icon={TrendingDown}
          />
          <StatCard
            title="Top 1% Income vs US"
            value="~40%"
            subtitle="Canada's top 1% earn 40% of US top 1%"
            icon={DollarSign}
          />
          <StatCard
            title="Productivity Gap Share"
            value="67%"
            subtitle="Top 10% accounts for 2/3 of labour productivity gap"
            icon={Briefcase}
          />
          <StatCard
            title="Canada GDP/Adult vs US"
            value="70-90%"
            subtitle="Range from 1960 to 2020"
            icon={Users}
          />
        </div>

        <CollapsibleSection title="The Core Finding">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
            <CardContent className="p-6">
              <blockquote className="text-lg font-medium text-foreground border-l-4 border-primary pl-4 mb-4">
                "The top 10% of the income distribution accounts for three-quarters of the gap in GDP per adult between Canada and the United States, and up to two-thirds of the measured labour productivity gap."
              </blockquote>
              <p className="text-sm text-muted-foreground">
                Using data from the World Inequality Database (1960-2020), MacGee and Rodrigue show that
                the Canada-US productivity debate isn't about a broad economy-wide shortfall — it's
                concentrated at the top of the income distribution. The bottom half of Canadians have
                incomes comparable to their US counterparts. The gap lives almost entirely in how much
                the highest earners in each country make.
              </p>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection title="Canada-US GDP Ratio Over Time">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Canadian GDP per Adult as % of US Level (1960-2020)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gdpRatioHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[60, 100]} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v}%`, "Canada/US Ratio"]} />
                    <Area type="monotone" dataKey="ratio" stroke="hsl(220, 70%, 50%)" fill="hsl(220, 70%, 50%)" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Canada's GDP per adult peaked near 90% of US levels in the early 1980s and has trended lower since,
                reaching approximately 75% by 2020. The gap widened particularly from the mid-1990s onward.
              </p>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection title="Where the Gap Lives">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Who Drives the GDP Gap?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gapContribution} layout="vertical" barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 45]} />
                      <YAxis type="category" dataKey="group" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v}%`, "Share of GDP Gap"]} />
                      <Bar dataKey="share" fill="hsl(220, 70%, 50%)" radius={[0, 4, 4, 0]}>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>The top 1% alone</strong> contributes as much to the gap as the next 9% (P90-P99) combined.
                    The bottom 50% of the distribution accounts for only ~10% of the total GDP gap.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Canadian Income as % of US by Percentile (2019)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeGapByPercentile}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="percentile" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[30, 105]} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v}%`, "Canada/US"]} />
                      <Line type="monotone" dataKey="canadaPctOfUS" stroke="hsl(0, 70%, 50%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(0, 70%, 50%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  At the 10th percentile, Canadian incomes are ~98% of US levels. By the top 1%, they've fallen to just 40%.
                  The gap widens dramatically above the 70th percentile.
                </p>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Education & Business Ownership Gap">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Income Gap by Education & Employment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={educationGap} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`${v}%`, ""]} />
                      <Bar dataKey="canadaPctOfUS" name="Canada as % of US" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  University-educated Canadians earn ~72% of their US counterparts (vs 85% for non-degree holders) —
                  a 10-15 percentage point wider gap. Business owners face the largest shortfall at ~65%.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">What Drives the Productivity Gap?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  {productivityContribution.map((item) => (
                    <div key={item.component}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{item.component}</span>
                        <span className="text-sm font-bold">{item.value}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.value}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    <strong>Hours worked</strong> per working-age adult were similar in Canada and the US in both 1970 and 2019,
                    but persistent shifts in relative hours worked played a role in measured productivity differences during the period.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Possible Mechanisms">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3">
                    <Users className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-sm mb-2 text-blue-900 dark:text-blue-300">Brain Drain</h3>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Selective emigration of high-ability Canadian workers to the US, drawn by higher compensation
                    at the top of the distribution. This depletes Canada's high-earner pool.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
                    <Briefcase className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="font-bold text-sm mb-2 text-amber-900 dark:text-amber-300">Business Scale</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Canadian firms may face barriers to scaling — smaller domestic market, less venture capital,
                    and regulatory frictions — resulting in lower business incomes for owners.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-3">
                    <GraduationCap className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-sm mb-2 text-emerald-900 dark:text-emerald-300">Returns to Education</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    The wage premium for university education is significantly smaller in Canada.
                    This may reduce incentives for skills-intensive entrepreneurship and innovation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection title="Real Estate Investor Implications" defaultOpen={true}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-base mb-3">What This Means for Canadian RE</h3>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 font-bold">1.</span>
                      <span><strong className="text-foreground">Housing demand is resilient at the median.</strong> The bottom 50% of Canadian incomes are nearly at par with the US. Rental demand from average-income tenants remains structurally strong — this is the multiplex investor's core tenant pool.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 font-bold">2.</span>
                      <span><strong className="text-foreground">Luxury market risk is real.</strong> High-end condos and single-family homes targeting top-10% buyers face headwinds — Canadian high earners have less purchasing power than US equivalents. Avoid overexposure to luxury segments.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 font-bold">3.</span>
                      <span><strong className="text-foreground">Brain drain = rental demand.</strong> If high earners leave for the US, they free up higher-end rentals. But more importantly, the remaining workforce — still well-employed — sustains middle-market rental demand.</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-3">Investment Strategy Takeaways</h3>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">Multiplexes over luxury.</strong> The income distribution data favours workforce housing — 2-6 unit properties targeting median-income tenants where Canada tracks the US closely.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">Rent growth is capped.</strong> With Canadian median incomes at 85-90% of US levels, rent growth will be moderated vs US markets. Underwrite conservatively — 2-3% annual rent growth, not 5%.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">Cap rate compression unlikely.</strong> Lower high-end incomes mean less institutional capital chasing Canadian RE. Cap rates may hold or widen vs the US — good for entry-level investors buying yield.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <div className="text-xs text-muted-foreground border-t pt-6 mt-8 space-y-1">
          <p>
            Source: {SOURCE}. {AUTHORS}. Data from the World Inequality Database (1960-2020).
          </p>
          <p>
            Also published in <em>Canadian Public Policy</em>, Vol. 51, No. S1.
            <a href={PDF_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
              Read the full paper (PDF)
            </a>
          </p>
          <p>
            The views expressed in this report are those of the original authors and do not necessarily
            represent the views of the Bank of Canada. Realist.ca investor commentary is editorial in nature.
          </p>
        </div>
      </main>
    </div>
  );
}
