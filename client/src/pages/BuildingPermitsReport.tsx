import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingDown, TrendingUp, Building2, ArrowLeft, Calendar,
  MapPin, DollarSign, Home, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";

const MONTH = "February 2026";
const RELEASE_DATE = "April 13, 2026";
const SOURCE = "Statistics Canada, Table 34-10-0292-01";

const totalPermitsHistory = [
  { month: "Mar 2025", total: 12.8, residential: 7.6, nonResidential: 5.2 },
  { month: "Apr 2025", total: 11.9, residential: 7.2, nonResidential: 4.7 },
  { month: "May 2025", total: 12.4, residential: 7.8, nonResidential: 4.6 },
  { month: "Jun 2025", total: 13.1, residential: 8.2, nonResidential: 4.9 },
  { month: "Jul 2025", total: 12.6, residential: 7.9, nonResidential: 4.7 },
  { month: "Aug 2025", total: 13.0, residential: 8.0, nonResidential: 5.0 },
  { month: "Sep 2025", total: 12.3, residential: 7.5, nonResidential: 4.8 },
  { month: "Oct 2025", total: 13.5, residential: 8.3, nonResidential: 5.2 },
  { month: "Nov 2025", total: 12.7, residential: 7.8, nonResidential: 4.9 },
  { month: "Dec 2025", total: 13.0, residential: 8.0, nonResidential: 5.0 },
  { month: "Jan 2026", total: 13.2, residential: 8.0, nonResidential: 5.2 },
  { month: "Feb 2026", total: 12.1, residential: 8.1, nonResidential: 4.0 },
];

const sectorBreakdown = [
  { name: "Multi-family", value: 5.4, color: "hsl(220, 70%, 50%)" },
  { name: "Single-family", value: 2.7, color: "hsl(200, 60%, 55%)" },
  { name: "Commercial", value: 2.0, color: "hsl(35, 80%, 55%)" },
  { name: "Industrial", value: 1.0, color: "hsl(160, 50%, 45%)" },
  { name: "Institutional", value: 0.9, color: "hsl(280, 50%, 55%)" },
];

const residentialUnitsHistory = [
  { month: "Mar 2025", multiFamily: 22500, singleFamily: 4200 },
  { month: "Apr 2025", multiFamily: 21200, singleFamily: 3800 },
  { month: "May 2025", multiFamily: 23100, singleFamily: 4100 },
  { month: "Jun 2025", multiFamily: 24000, singleFamily: 4300 },
  { month: "Jul 2025", multiFamily: 22800, singleFamily: 4000 },
  { month: "Aug 2025", multiFamily: 23500, singleFamily: 4200 },
  { month: "Sep 2025", multiFamily: 21800, singleFamily: 3900 },
  { month: "Oct 2025", multiFamily: 24200, singleFamily: 4400 },
  { month: "Nov 2025", multiFamily: 22600, singleFamily: 4100 },
  { month: "Dec 2025", multiFamily: 23000, singleFamily: 4000 },
  { month: "Jan 2026", total: 25100, multiFamily: 21200, singleFamily: 3900 },
  { month: "Feb 2026", total: 24900, multiFamily: 21000, singleFamily: 3900 },
];

const provincialData = [
  { province: "Ontario", residential: 320.6, nonResidential: -1080.9, net: -760.3 },
  { province: "British Columbia", residential: 164.8, nonResidential: 283.3, net: 448.1 },
  { province: "Alberta", residential: -66.3, nonResidential: -186.5, net: -252.8 },
  { province: "Quebec", residential: -188.1, nonResidential: -275.2, net: -463.3 },
  { province: "Nova Scotia", residential: -112.3, nonResidential: -51.9, net: -164.2 },
  { province: "Manitoba", residential: 15.2, nonResidential: -8.4, net: 6.8 },
  { province: "Saskatchewan", residential: 8.1, nonResidential: -12.0, net: -3.9 },
];

const nonResComponents = [
  { component: "Institutional", value: 929.1, change: -987.2, changePct: -51.5 },
  { component: "Commercial", value: 2000, change: -160.0, changePct: -7.4 },
  { component: "Industrial", value: 985.1, change: -104.7, changePct: -9.6 },
];

function formatBillions(val: number) {
  return `$${val.toFixed(1)}B`;
}

function formatMillions(val: number) {
  const abs = Math.abs(val);
  if (abs >= 1000) return `${val > 0 ? "+" : "-"}$${(abs / 1000).toFixed(1)}B`;
  return `${val > 0 ? "+" : ""}$${val.toFixed(0)}M`;
}

function StatCard({ title, value, change, changePct, icon: Icon, subtitle }: {
  title: string;
  value: string;
  change?: string;
  changePct?: number;
  icon: any;
  subtitle?: string;
}) {
  const isPositive = changePct != null && changePct > 0;
  const isNegative = changePct != null && changePct < 0;
  return (
    <Card className="border-0 shadow-sm" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          {changePct != null && (
            <Badge
              variant={isNegative ? "destructive" : "default"}
              className={`text-xs ${isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}`}
            >
              {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : isNegative ? <TrendingDown className="h-3 w-3 mr-0.5" /> : null}
              {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold mb-1" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{title}</div>
        {change && <div className="text-xs text-muted-foreground mt-1">{change} m/m</div>}
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
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

export default function BuildingPermitsReport() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Building Permits Report - February 2026 | Realist.ca"
        description="Canadian building permits declined 8.4% to $12.1B in February 2026. Analysis of residential vs non-residential construction intentions by province."
        canonicalUrl="/insights/building-permits"
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
            <Calendar className="h-3 w-3 mr-1" /> Released {RELEASE_DATE}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="report-title">
            Building Permits, {MONTH}
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            The total value of building permits issued in Canada decreased 8.4% to $12.1 billion,
            led by a steep decline in non-residential construction intentions.
          </p>
          <p className="text-xs text-muted-foreground mt-2">Source: {SOURCE}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            title="Total Permits"
            value="$12.1B"
            change="-$1.1B"
            changePct={-8.4}
            icon={DollarSign}
          />
          <StatCard
            title="Residential"
            value="$8.1B"
            change="+$135.6M"
            changePct={1.7}
            icon={Home}
          />
          <StatCard
            title="Non-Residential"
            value="$4.0B"
            change="-$1.3B"
            changePct={-24.0}
            icon={Building2}
          />
          <StatCard
            title="Units Authorized"
            value="24,900"
            changePct={-0.8}
            icon={Building2}
            subtitle="21,000 multi + 3,900 single"
          />
        </div>

        <CollapsibleSection title="Total Permits Trend">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Total Value of Building Permits (Seasonally Adjusted, $B)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={totalPermitsHistory} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}B`} domain={[0, 16]} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`$${v.toFixed(1)}B`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="residential" name="Residential" fill="hsl(220, 70%, 50%)" radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="nonResidential" name="Non-Residential" fill="hsl(35, 80%, 55%)" radius={[2, 2, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection title="Sector Breakdown">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Permits by Component ({MONTH})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: $${value}B`}
                      >
                        {sectorBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`$${v.toFixed(1)}B`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Non-Residential Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {nonResComponents.map((c) => (
                    <div key={c.component} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`nonres-${c.component.toLowerCase()}`}>
                      <div>
                        <div className="font-medium text-sm">{c.component}</div>
                        <div className="text-xs text-muted-foreground">{formatMillions(c.change)} m/m</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${(c.value / 1000).toFixed(1)}B</div>
                        <Badge variant={c.changePct < 0 ? "destructive" : "default"} className="text-[10px]">
                          {c.changePct > 0 ? "+" : ""}{c.changePct.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">
                    Institutional permits saw the steepest decline since April 2023, driven primarily by Ontario (-$827.1M).
                    Commercial permits marked their fourth consecutive decline.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Residential Construction">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Dwelling Units Authorized</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={residentialUnitsHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => [v.toLocaleString(), ""]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="multiFamily" name="Multi-family" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="singleFamily" name="Single-family" stroke="hsl(35, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Key Residential Takeaways</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                    <div className="font-medium text-sm text-blue-900 dark:text-blue-300 mb-1">Multi-family led gains</div>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      Multi-unit permits rose $180.3M to $5.4B, driven by Ontario (+$320.6M) and British Columbia (+$217.6M).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                    <div className="font-medium text-sm text-amber-900 dark:text-amber-300 mb-1">Single-family declined</div>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Single-family permits fell $44.7M to $2.7B, led by British Columbia (-$52.8M) and Ontario (-$28.4M).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-sm mb-1">12-Month Rolling Total</div>
                    <p className="text-xs text-muted-foreground">
                      255,500 multi-family units authorized (Mar 2025 – Feb 2026), up from 244,600 in the prior 12-month period.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Provincial Breakdown">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Month-over-Month Change by Province ($M)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provincialData} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
                    <YAxis type="category" dataKey="province" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip {...chartTooltipStyle} formatter={(v: number) => [`$${v.toFixed(0)}M`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="residential" name="Residential" fill="hsl(220, 70%, 50%)" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="nonResidential" name="Non-Residential" fill="hsl(35, 80%, 55%)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium text-sm text-emerald-900 dark:text-emerald-300">British Columbia</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Net +$448M — Vancouver wastewater treatment plant approval drove industrial gains (+$183.9M in Vancouver CMA).
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    <span className="font-medium text-sm text-red-900 dark:text-red-300">Ontario</span>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Net -$760M — Institutional permits plunged $827.1M, offsetting strong multi-family growth of $320.6M.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <CollapsibleSection title="Investor Implications" defaultOpen={true}>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-base mb-3">What This Means for Multiplex Investors</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">1.</span>
                      <span><strong className="text-foreground">Multi-family momentum continues.</strong> 255,500 units authorized over the past 12 months (up from 244,600) signals sustained builder confidence in density plays.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">2.</span>
                      <span><strong className="text-foreground">Ontario is the swing province.</strong> Residential permits surged while institutional cratered — capital is flowing into housing, not public buildings.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">3.</span>
                      <span><strong className="text-foreground">Single-family softness = opportunity.</strong> Declining single-family permits in BC and ON may tighten future supply, supporting existing asset values.</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-3">Markets to Watch</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">Vancouver CMA</strong> — $183.9M industrial boost from infrastructure; multi-family also strong.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">GTA / Ontario</strong> — Residential permits up $320.6M despite broader provincial decline. Strong multi-family pipeline.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong className="text-foreground">Alberta</strong> — Single-family holding (+$28.9M) while multi-family pulls back. Watch for value plays.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleSection>

        <div className="text-xs text-muted-foreground border-t pt-6 mt-8 space-y-1">
          <p>Source: {SOURCE}. Data are seasonally adjusted in current dollars unless otherwise noted.</p>
          <p>Constant dollar basis (2023=100): total permits decreased 8.6% m/m and 11.5% y/y.</p>
          <p>Next release: Building permits data for March 2026 will be released on May 19, 2026.</p>
        </div>
      </main>
    </div>
  );
}
