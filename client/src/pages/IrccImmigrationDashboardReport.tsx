import { useState } from "react";
import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, ArrowRightLeft, Globe2, MapPinned, ShieldCheck, Users2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportEndCta } from "@/components/ReportEndCta";
import { immigrationDashboardData } from "@/data/immigrationDashboardData";

const operationalColors = ["#b45309", "#d97706", "#ea580c", "#f59e0b", "#f97316", "#fb923c"];
const pieColors = ["#0f766e", "#2563eb", "#d97706", "#92400e"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-CA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function shortMonth(label: string) {
  const [year, month] = label.split("-");
  return `${year.slice(2)}-${month}`;
}

function yoyChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function tooltipSeries(value: unknown, label: string): [string, string] {
  return [formatNumber(Number(value ?? 0)), label];
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-stone-200 bg-white/90 shadow-sm">
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-stone-500">{title}</div>
        <div className="mt-3 text-3xl font-semibold text-stone-900">{value}</div>
        <div className="mt-2 text-sm text-stone-600">{detail}</div>
      </CardContent>
    </Card>
  );
}

export default function IrccImmigrationDashboardReport() {
  const [countryMode, setCountryMode] = useState<"2025" | "2026">("2025");

  const opsMonthly = immigrationDashboardData.operational.monthlyTotals;
  const ops2026Q1 = opsMonthly
    .filter((item) => item.label.startsWith("2026-"))
    .reduce((sum, item) => sum + item.value, 0);
  const ops2025Q1 = opsMonthly
    .filter((item) => item.label === "2025-01" || item.label === "2025-02" || item.label === "2025-03")
    .reduce((sum, item) => sum + item.value, 0);
  const opsQ1Change = yoyChange(ops2026Q1, ops2025Q1);

  const pr2025 = immigrationDashboardData.permanentResidents.yearlyTotals.find((item) => item.year === 2025)?.total ?? 0;
  const pr2024 = immigrationDashboardData.permanentResidents.yearlyTotals.find((item) => item.year === 2024)?.total ?? 0;
  const asylum2025 = immigrationDashboardData.asylum.yearlyTotals.find((item) => item.year === 2025)?.total ?? 0;
  const asylum2024 = immigrationDashboardData.asylum.yearlyTotals.find((item) => item.year === 2024)?.total ?? 0;

  const countryData: Array<{ country: string; value: number }> =
    countryMode === "2025"
      ? immigrationDashboardData.operational.topCountries2025.map((item) => ({
          country: item.country,
          value: item.total2025,
        }))
      : immigrationDashboardData.operational.topCountries2026Ytd.map((item) => ({
          country: item.country,
          value: item.ytd2026,
        }));

  const prMix = immigrationDashboardData.permanentResidents.categoryMix2025.map((item) => ({
    name: item.category,
    value: item.total,
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema,
      websiteSchema,
      {
        "@type": "Report",
        "@id": "https://realist.ca/reports/canada-immigration-dashboard-2026#report",
        headline: "Canada Immigration Dashboard 2026",
        description:
          "Interactive IRCC dashboard covering temporary resident approvals, permanent resident admissions, and asylum claimant secondary migration.",
        url: "https://realist.ca/reports/canada-immigration-dashboard-2026",
        datePublished: "2026-06-05",
        author: {
          "@type": "Organization",
          name: "Realist Research",
        },
        publisher: {
          "@id": "https://realist.ca/#organization",
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": "https://realist.ca/reports/canada-immigration-dashboard-2026",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf7f2_0%,#f5efe6_38%,#ffffff_100%)]">
      <SEO
        title="Canada Immigration Dashboard 2026"
        description="Interactive IRCC dashboard built from federal open data on temporary residents, permanent residents, and asylum claimant movement."
        canonicalUrl="/reports/canada-immigration-dashboard-2026"
        ogType="article"
        structuredData={structuredData}
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <Link href="/reports">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
        </Link>

        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_34%),linear-gradient(135deg,#1c1917_0%,#292524_58%,#44403c_100%)] p-8 text-stone-50 shadow-xl shadow-stone-300/30">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr]">
            <div>
              <Badge variant="outline" className="border-amber-200/40 bg-amber-100/10 text-amber-100">
                Report
              </Badge>
              <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-white md:text-5xl">
                Canada immigration flows, approvals, and claimant movement in one dashboard.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
                Built from three federal datasets updated on May 20, 2026: IRCC operational processing,
                permanent residents, and asylum secondary migration.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-200">
                <a
                  href="https://open.canada.ca/data/en/dataset/9b34e712-513f-44e9-babf-9df4f7256550"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-500/70 px-4 py-2 hover:border-amber-300 hover:text-amber-100"
                >
                  Operational processing
                </a>
                <a
                  href="https://open.canada.ca/data/en/dataset/f7e5498e-0ad8-4417-85c9-9b8aff9b9eda"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-500/70 px-4 py-2 hover:border-amber-300 hover:text-amber-100"
                >
                  Permanent residents
                </a>
                <a
                  href="https://open.canada.ca/data/en/dataset/b6cbcf4d-f763-4924-a2fb-8cc4a06e3de4"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-500/70 px-4 py-2 hover:border-amber-300 hover:text-amber-100"
                >
                  Asylum claimants
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-stone-600/80 bg-white/5 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <Users2 className="h-4 w-4 text-amber-300" />
                  Temporary residents approved
                </div>
                <div className="mt-3 text-4xl font-semibold text-white">{formatCompact(ops2026Q1)}</div>
                <div className="mt-2 text-sm text-stone-300">Q1 2026 total</div>
              </div>
              <div className="rounded-3xl border border-stone-600/80 bg-white/5 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <ShieldCheck className="h-4 w-4 text-amber-300" />
                  Permanent residents admitted
                </div>
                <div className="mt-3 text-4xl font-semibold text-white">{formatCompact(pr2025)}</div>
                <div className="mt-2 text-sm text-stone-300">2025 total</div>
              </div>
              <div className="rounded-3xl border border-stone-600/80 bg-white/5 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <MapPinned className="h-4 w-4 text-amber-300" />
                  Asylum claimants in table
                </div>
                <div className="mt-3 text-4xl font-semibold text-white">{formatCompact(asylum2025)}</div>
                <div className="mt-2 text-sm text-stone-300">2025 total</div>
              </div>
              <div className="rounded-3xl border border-stone-600/80 bg-white/5 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-stone-300">
                  <ArrowRightLeft className="h-4 w-4 text-amber-300" />
                  2026 Q1 vs 2025 Q1
                </div>
                <div className="mt-3 text-4xl font-semibold text-white">{formatPercent(opsQ1Change)}</div>
                <div className="mt-2 text-sm text-stone-300">temporary resident approvals</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Operational"
            value={formatNumber(ops2026Q1)}
            detail={`Q1 2026 approvals, ${formatPercent(opsQ1Change)} vs Q1 2025`}
          />
          <MetricCard
            title="Permanent Residents"
            value={formatNumber(pr2025)}
            detail={`2025 admissions, ${formatPercent(yoyChange(pr2025, pr2024))} vs 2024`}
          />
          <MetricCard
            title="Asylum"
            value={formatNumber(asylum2025)}
            detail={`2025 claimant records, ${formatPercent(yoyChange(asylum2025, asylum2024))} vs 2024`}
          />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-800">
                <Globe2 className="h-4 w-4" />
                Operational processing
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-stone-900">Temporary resident approvals by month</h2>
              <p className="mt-1 text-sm text-stone-600">
                Monthly approvals fall through 2025, then rebound in early 2026.
              </p>
              <div className="mt-6 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...opsMonthly]}>
                    <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickFormatter={shortMonth} minTickGap={28} stroke="#78716c" />
                    <YAxis tickFormatter={formatCompact} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Approvals")} labelFormatter={(label) => `Month: ${label}`} />
                    <Line type="monotone" dataKey="value" stroke="#b45309" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-stone-900">Top source countries</h2>
                  <p className="mt-1 text-sm text-stone-600">Compare the 2025 full-year ranking with 2026 year-to-date.</p>
                </div>
                <div className="inline-flex rounded-full bg-stone-100 p-1 text-sm">
                  <button
                    onClick={() => setCountryMode("2025")}
                    className={`rounded-full px-3 py-1.5 ${countryMode === "2025" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                  >
                    2025
                  </button>
                  <button
                    onClick={() => setCountryMode("2026")}
                    className={`rounded-full px-3 py-1.5 ${countryMode === "2026" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                  >
                    2026 YTD
                  </button>
                </div>
              </div>
              <div className="mt-6 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData} layout="vertical" margin={{ left: 12, right: 8 }}>
                    <CartesianGrid stroke="#f5f5f4" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatCompact} stroke="#78716c" />
                    <YAxis dataKey="country" type="category" width={130} tick={{ fontSize: 12 }} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Approvals")} />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                      {countryData.map((entry, index) => (
                        <Cell key={entry.country} fill={operationalColors[index % operationalColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_1.1fr]">
          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-teal-800">
                <ShieldCheck className="h-4 w-4" />
                Permanent residents
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-stone-900">Admissions by year</h2>
              <p className="mt-1 text-sm text-stone-600">2021 to 2024 surged, while 2025 sits below the recent peak.</p>
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...immigrationDashboardData.permanentResidents.yearlyTotals]}>
                    <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke="#78716c" />
                    <YAxis tickFormatter={formatCompact} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Admissions")} />
                    <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-stone-900">2025 category mix</h2>
              <p className="mt-1 text-sm text-stone-600">Economic admissions dominate the 2025 permanent resident intake mix.</p>
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={prMix} dataKey="value" nameKey="name" innerRadius={68} outerRadius={112} paddingAngle={2}>
                      {prMix.map((entry, index) => (
                        <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => tooltipSeries(value, "Admissions")} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-stone-900">Top provinces by category in 2025</h2>
              <p className="mt-1 text-sm text-stone-600">Stacked totals show where the economic, family, and refugee streams concentrate.</p>
              <div className="mt-6 h-[390px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...immigrationDashboardData.permanentResidents.provinceCategory2025]}>
                    <CartesianGrid stroke="#f5f5f4" strokeDasharray="3 3" />
                    <XAxis dataKey="province" tick={{ fontSize: 12 }} stroke="#78716c" />
                    <YAxis tickFormatter={formatCompact} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Admissions")} />
                    <Legend />
                    <Bar dataKey="Economic" stackId="a" fill="#0f766e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Sponsored Family" stackId="a" fill="#2563eb" />
                    <Bar dataKey="Resettled Refugee & Protected Person in Canada" stackId="a" fill="#d97706" />
                    <Bar dataKey="All Other Immigration" stackId="a" fill="#92400e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-800">
                <ArrowRightLeft className="h-4 w-4" />
                Asylum secondary migration
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-stone-900">Claimants by year</h2>
              <p className="mt-1 text-sm text-stone-600">The table rises sharply after 2021, peaks in 2024, then eases in 2025.</p>
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...immigrationDashboardData.asylum.yearlyTotals]}>
                    <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke="#78716c" />
                    <YAxis tickFormatter={formatCompact} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Claimants")} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-stone-900">2025 claim provinces</h2>
              <p className="mt-1 text-sm text-stone-600">Ontario and Quebec remain the main receiving provinces in this table.</p>
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...immigrationDashboardData.asylum.claimProvinces2025]}>
                    <CartesianGrid stroke="#f5f5f4" strokeDasharray="3 3" />
                    <XAxis dataKey="province" tick={{ fontSize: 12 }} stroke="#78716c" />
                    <YAxis tickFormatter={formatCompact} stroke="#78716c" />
                    <Tooltip formatter={(value) => tooltipSeries(value, "Claimants")} />
                    <Bar dataKey="total" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-stone-900">Largest interprovincial routes in 2025</h2>
              <p className="mt-1 text-sm text-stone-600">These are the biggest province-to-province movements after excluding same-province claims.</p>
              <div className="mt-6 space-y-3">
                {immigrationDashboardData.asylum.topRoutes2025.map((route, index) => (
                  <div key={`${route.from}-${route.to}`} className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.2em] text-stone-500">#{index + 1}</div>
                      <div className="truncate text-sm font-medium text-stone-900">{route.from} to {route.to}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-stone-900">{formatNumber(route.total)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-stone-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-stone-900">Net claimant gain or loss in 2025</h2>
              <p className="mt-1 text-sm text-stone-600">Positive net values mean more claims were filed there than last-known addresses recorded there.</p>
              <div className="mt-6 space-y-3">
                {immigrationDashboardData.asylum.netFlow2025.map((province) => (
                  <div key={province.province} className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-stone-900">{province.province}</div>
                      <div className="text-xs text-stone-500">
                        Claims {formatNumber(province.claims)} · Last known {formatNumber(province.lastKnown)}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${province.net > 0 ? "text-emerald-700" : province.net < 0 ? "text-rose-700" : "text-stone-700"}`}>
                      {province.net > 0 ? "+" : ""}
                      {formatNumber(province.net)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <ReportEndCta sourcePage="/reports/canada-immigration-dashboard-2026" />
      </main>
    </div>
  );
}
