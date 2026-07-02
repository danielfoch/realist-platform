import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  ArrowLeft,
  Trophy,
  FileText,
  Calendar,
  Users,
  Mail,
  Search,
  Megaphone,
  Home as HomeIcon,
  ExternalLink,
  Sparkles,
  Info,
  Bot,
  Layers,
  Building2,
} from "lucide-react";

type ModelKey = "fable" | "gpt" | "opus" | "gemini";

interface ModelMeta {
  key: ModelKey;
  name: string;
  vendor: string;
  color: string;
  badge: string;
}

interface CostMeta {
  runCost: number;
  access: string;
  rationale: string;
}

const MODELS: ModelMeta[] = [
  { key: "fable", name: "Fable 5", vendor: "Homies", color: "#0F0F0F", badge: "House" },
  { key: "opus", name: "Opus 4.8", vendor: "Anthropic", color: "#D97757", badge: "Frontier" },
  { key: "gpt", name: "GPT 5.5", vendor: "OpenAI", color: "#10A37F", badge: "Frontier" },
  { key: "gemini", name: "Gemini 3.1", vendor: "Google", color: "#5B8DEF", badge: "Frontier" },
];

const COST_ASSUMPTIONS: Record<ModelKey, CostMeta> = {
  fable: {
    runCost: 14,
    access: "API",
    rationale: "Highest cost in this set; best raw output, but the priciest to run repeatedly.",
  },
  opus: {
    runCost: 9,
    access: "API",
    rationale: "Strong writing and research, but still metered per run through API usage.",
  },
  gpt: {
    runCost: 2,
    access: "OAuth via OpenClaw",
    rationale: "Lower effective cost because it can run through OpenClaw with OAuth instead of pure API metering.",
  },
  gemini: {
    runCost: 6,
    access: "API",
    rationale: "Mid-pack on cost, but still billed as an API model in this setup.",
  },
};

const VA_HOURLY_WAGE = 10;
const LOCAL_ADMIN_HOURLY_WAGE = 20;

interface Category {
  key: string;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  example: string;
  scores: Record<ModelKey, number>;
}

const CATEGORIES: Category[] = [
  {
    key: "offers",
    label: "Offers",
    short: "OfferBench",
    icon: FileText,
    description:
      "Drafting competitive buyer offers, comparing seller offers, counteroffer strategy, and deadline math.",
    example:
      "Buyer is preapproved to $875K. List price $849K. Low inventory. Seller wants 30-day close. Draft terms, EMD, financing & inspection contingencies, plus a buyer-facing explanation.",
    scores: { fable: 89, opus: 82, gpt: 78, gemini: 74 },
  },
  {
    key: "showing",
    label: "Showing",
    short: "ShowBench",
    icon: Calendar,
    description:
      "Scheduling tours, routing for drive time, listing-agent outreach, and rebuilding plans after cancellations.",
    example:
      "Buyer free Sat 10a-2p. 5 homes, two are 25 min apart, one listing agent needs 2-hour notice. Plan the route, send showing requests, and produce the buyer itinerary.",
    scores: { fable: 91, opus: 77, gpt: 73, gemini: 71 },
  },
  {
    key: "crm",
    label: "CRM Management",
    short: "CRMBench",
    icon: Users,
    description:
      "Lead classification, dedup, next-best-action, follow-up sequences, and pipeline summarization.",
    example:
      "50 messy leads from Zillow, open houses, referrals and past clients. Classify, dedup, assign next action, draft personalized follow-ups.",
    scores: { fable: 87, opus: 80, gpt: 76, gemini: 72 },
  },
  {
    key: "email",
    label: "Email Response",
    short: "EmailBench",
    icon: Mail,
    description:
      "Drafting client-ready replies with the right tone, polish, and risk-aware language.",
    example:
      "Past client emails asking whether to refinance into a variable. Draft a response that is helpful, calibrated, and avoids unauthorized financial advice.",
    scores: { fable: 92, opus: 87, gpt: 84, gemini: 78 },
  },
  {
    key: "research",
    label: "Property Research",
    short: "ResearchBench",
    icon: Search,
    description:
      "Pulling listing facts, summarizing disclosures, spotting red flags, and contextualizing neighborhoods.",
    example:
      "Buyer sends a listing URL and a disclosure PDF. Summarize key facts, flag red flags (foundation, knob-and-tube, prior insurance claims) and prep a tour brief.",
    scores: { fable: 85, opus: 83, gpt: 79, gemini: 81 },
  },
  {
    key: "marketing",
    label: "Property Marketing",
    short: "MarketingBench",
    icon: Megaphone,
    description:
      "Compliant MLS remarks, social captions, listing decks, and rewriting risky fair-housing copy.",
    example:
      "Rewrite \"perfect for young families near the best schools, safe quiet Christian neighborhood\" into compliant copy. Explain the changes for the agent.",
    scores: { fable: 88, opus: 85, gpt: 81, gemini: 76 },
  },
  {
    key: "valuation",
    label: "Property Valuation",
    short: "ValBench",
    icon: HomeIcon,
    description:
      "Comp selection, adjustments, list-price range, and seller-ready CMA narratives with appropriate uncertainty.",
    example:
      "3-bed/2-bath, 1,850 sqft, renovated kitchen, no pool, 0.18 acre. From 10 sold comps, pick the top 4, adjust, and recommend a price range with confidence.",
    scores: { fable: 84, opus: 76, gpt: 72, gemini: 70 },
  },
];

const HARD_FAILS = [
  "Invents a comp, listing fact, or client instruction",
  "Discriminatory recommendation against a protected class",
  "Sends or claims to send something without authorization",
  "Provides legal advice without limitation language",
  "Misses a critical deadline calculation",
  "Exposes private client info unnecessarily",
];

function overallAcrossCategories(modelKey: ModelKey) {
  const total = CATEGORIES.reduce((acc, c) => acc + c.scores[modelKey], 0);
  return total / CATEGORIES.length;
}

const SECTION_TITLE = "text-xs uppercase tracking-[0.18em] text-stone-500 font-medium";

export default function HomeBenchReport() {
  const [activeCategory, setActiveCategory] = useState<string>("offers");

  const ranked = useMemo(() => {
    return [...MODELS]
      .map((m) => ({ ...m, score: overallAcrossCategories(m.key) }))
      .sort((a, b) => b.score - a.score)
      .map((m, i) => ({ ...m, rank: i + 1 }));
  }, []);

  const valueRanked = useMemo(() => {
    return [...MODELS]
      .map((m) => {
        const score = overallAcrossCategories(m.key);
        const cost = COST_ASSUMPTIONS[m.key].runCost;

        return {
          ...m,
          score,
          cost,
          access: COST_ASSUMPTIONS[m.key].access,
          rationale: COST_ASSUMPTIONS[m.key].rationale,
          valueIndex: score / cost,
          vaMinutes: (cost / VA_HOURLY_WAGE) * 60,
          adminMinutes: (cost / LOCAL_ADMIN_HOURLY_WAGE) * 60,
        };
      })
      .sort((a, b) => b.valueIndex - a.valueIndex);
  }, []);

  const groupedData = useMemo(() => {
    return CATEGORIES.map((c) => ({
      label: c.label,
      fable: c.scores.fable,
      opus: c.scores.opus,
      gpt: c.scores.gpt,
      gemini: c.scores.gemini,
    }));
  }, []);

  const radarData = useMemo(() => {
    return CATEGORIES.map((c) => ({
      category: c.label,
      "Fable 5": c.scores.fable,
      "Opus 4.8": c.scores.opus,
      "GPT 5.5": c.scores.gpt,
      "Gemini 3.1": c.scores.gemini,
    }));
  }, []);

  const active = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <SEO
        title="HomeBench v0.1 — AI Benchmark for Realtors"
        description="An independent benchmark of frontier AI models on the actual work real estate agents do: offers, showings, CRM, email, property research, marketing, and valuation."
        canonicalUrl="/insights/market-report/homebench-ai-realtor-benchmark"
      />
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <Link
          href="/insights/market-report"
          className="inline-flex items-center text-sm text-stone-500 hover:text-stone-900 mb-6"
          data-testid="link-back-market-report"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Market Report
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Badge
              variant="outline"
              className="border-stone-900/20 bg-stone-900 text-[#FAF7F2] hover:bg-stone-900"
            >
              <Sparkles className="h-3 w-3 mr-1" /> HomeBench v0.1
            </Badge>
            <Badge variant="outline" className="border-stone-300 bg-white text-stone-700">
              Powered by Homies × Realist
            </Badge>
            <Badge variant="outline" className="border-stone-300 bg-white text-stone-700">
              June 2026 run
            </Badge>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-stone-950 mb-4">
            Which AI is actually good at being a realtor?
          </h1>
          <p className="text-lg text-stone-600 max-w-3xl leading-relaxed">
            HomeBench tests frontier models on the work real estate agents do every day: writing
            offers, booking showings, managing CRMs, responding to clients, researching properties,
            marketing listings, and valuing homes. No generic benchmarks. No vanity tasks. Just
            client-ready output, scored by working agents.
          </p>
          <p className="mt-4 text-sm text-stone-500">
            Published in collaboration with{" "}
            <a
              href="https://homiesAI.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-700 underline underline-offset-2 hover:text-stone-950"
            >
              Homies AI for Realtors
            </a>
          </p>
        </div>

        {/* How we ran it — methodology + light promo */}
        <Card className="mb-10 overflow-hidden border-stone-200 bg-white">
          <CardContent className="p-0">
            <div className="grid md:grid-cols-[1.05fr_1fr]">
              <div className="p-7 md:p-8 border-b md:border-b-0 md:border-r border-stone-100">
                <div className={SECTION_TITLE}>How we ran it</div>
                <h2 className="text-2xl md:text-3xl font-bold text-stone-950 mt-1 leading-tight">
                  Same harness. Same tasks. Same properties.
                </h2>
                <p className="text-sm md:text-base text-stone-600 mt-3 leading-relaxed">
                  Every model in this report was plugged into the{" "}
                  <a
                    href="https://meetyourhomies.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-950 underline decoration-amber-400 decoration-2 underline-offset-4 hover:decoration-stone-950"
                  >
                    Homies AI harness
                  </a>
                  {" "}— the same assistant runtime that real estate agents use every day for
                  offers, showings, CRM, email, research, marketing, and valuations. Fable 5, GPT
                  5.5, Opus 4.8, and Gemini 3.1 each ran the identical task list against the
                  identical case files, with the same tools and the same buyer/seller/property
                  data. Only the underlying model was swapped.
                </p>
                <p className="text-sm md:text-base text-stone-600 mt-3 leading-relaxed">
                  No model got a custom prompt. No model got extra context. Every output was graded
                  side-by-side by working agents on the same rubric.
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-stone-500">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>
                    The Homies harness is the assistants-for-realtors product the benchmark runs on.
                  </span>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-6 md:p-8 grid grid-cols-1 gap-3">
                {[
                  {
                    icon: Bot,
                    label: "01 · The harness",
                    title: "Homies assistants for realtors",
                    body: "Same tool set, memory, and tool-use scaffolding for every model — calendar, CRM, MLS reader, doc parser, calculator.",
                  },
                  {
                    icon: Layers,
                    label: "02 · The tasks",
                    title: "60 realtor workflows, 7 categories",
                    body: "Offers, showings, CRM, email, property research, marketing, and valuation. Tasks held out of training data.",
                  },
                  {
                    icon: Building2,
                    label: "03 · The properties",
                    title: "Identical case files",
                    body: "Same mock buyers, sellers, listings, comps, and message threads. Same disclosures and MLS records, every run.",
                  },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.label}
                      className="flex gap-3 rounded-lg border border-stone-200 bg-white p-4"
                      data-testid={`harness-step-${step.label.slice(0, 2)}`}
                    >
                      <div className="h-9 w-9 rounded-md bg-stone-950 text-amber-300 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
                          {step.label}
                        </div>
                        <div className="text-sm font-semibold text-stone-950 mt-0.5">
                          {step.title}
                        </div>
                        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          {ranked.map((m) => (
            <Card
              key={m.key}
              className={`relative overflow-hidden border ${
                m.rank === 1
                  ? "border-stone-900 bg-stone-950 text-[#FAF7F2]"
                  : "border-stone-200 bg-white"
              }`}
              data-testid={`card-rank-${m.key}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`text-xs uppercase tracking-wider ${
                      m.rank === 1 ? "text-amber-300" : "text-stone-500"
                    }`}
                  >
                    Rank #{m.rank}
                  </div>
                  {m.rank === 1 && <Trophy className="h-4 w-4 text-amber-300" />}
                </div>
                <div className="font-semibold text-lg leading-tight">{m.name}</div>
                <div
                  className={`text-xs ${
                    m.rank === 1 ? "text-stone-400" : "text-stone-500"
                  }`}
                >
                  {m.vendor}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {m.score.toFixed(1)}
                  </span>
                  <span
                    className={`text-xs ${
                      m.rank === 1 ? "text-stone-400" : "text-stone-500"
                    }`}
                  >
                    / 100
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main benchmark visualization */}
        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
            <div className={SECTION_TITLE}>Benchmark</div>
            <CardTitle className="text-2xl mt-1 text-stone-950">
              Overall Performance by Task Category
            </CardTitle>
            <p className="text-sm text-stone-500 mt-1">
              Higher is better. Scored across 60 tasks · 7 categories · graded by working agents.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {MODELS.map((m) => (
              <div key={m.key} className="flex items-center gap-2 text-xs text-stone-700">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: m.color }}
                />
                {m.name}
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={620}>
          <BarChart
            data={groupedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            barCategoryGap={8}
            barGap={2}
          >
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#78716C" }}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#1C1917" }}
                  width={150}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FAF7F2",
                    border: "1px solid #E7E2DA",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => `${v} / 100`}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                />
                <Bar dataKey="fable" name="Fable 5" fill={MODELS[0].color} radius={[0, 3, 3, 0]} />
                <Bar dataKey="opus" name="Opus 4.8" fill={MODELS[1].color} radius={[0, 3, 3, 0]} />
                <Bar dataKey="gpt" name="GPT 5.5" fill={MODELS[2].color} radius={[0, 3, 3, 0]} />
                <Bar
                  dataKey="gemini"
                  name="Gemini 3.1"
                  fill={MODELS[3].color}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar + Best-at */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_TITLE}>Shape</div>
              <CardTitle className="text-xl mt-1 text-stone-950">Model fingerprints</CardTitle>
              <p className="text-sm text-stone-500 mt-1">
                Each model's strengths across the seven categories.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E7E2DA" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "#44403C" }}
                  />
                  <PolarRadiusAxis
                    domain={[60, 100]}
                    tick={{ fontSize: 10, fill: "#A8A29E" }}
                    angle={90}
                  />
                  <Radar
                    name="Fable 5"
                    dataKey="Fable 5"
                    stroke={MODELS[0].color}
                    fill={MODELS[0].color}
                    fillOpacity={0.18}
                  />
                  <Radar
                    name="Opus 4.8"
                    dataKey="Opus 4.8"
                    stroke={MODELS[1].color}
                    fill={MODELS[1].color}
                    fillOpacity={0.12}
                  />
                  <Radar
                    name="GPT 5.5"
                    dataKey="GPT 5.5"
                    stroke={MODELS[2].color}
                    fill={MODELS[2].color}
                    fillOpacity={0.10}
                  />
                  <Radar
                    name="Gemini 3.1"
                    dataKey="Gemini 3.1"
                    stroke={MODELS[3].color}
                    fill={MODELS[3].color}
                    fillOpacity={0.10}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FAF7F2",
                      border: "1px solid #E7E2DA",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_TITLE}>Best at</div>
              <CardTitle className="text-xl mt-1 text-stone-950">
                Category leaders
              </CardTitle>
              <p className="text-sm text-stone-500 mt-1">
                The model with the highest score in each category.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="divide-y divide-stone-100">
                {CATEGORIES.map((c) => {
                  const winnerEntry = (Object.entries(c.scores) as [
                    ModelKey,
                    number
                  ][]).sort((a, b) => b[1] - a[1])[0];
                  const winner = MODELS.find((m) => m.key === winnerEntry[0])!;
                  const Icon = c.icon;
                  return (
                    <li
                      key={c.key}
                      className="flex items-center justify-between py-3"
                      data-testid={`row-leader-${c.key}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-stone-100 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-stone-700" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-stone-900">{c.label}</div>
                          <div className="text-xs text-stone-500">{c.short}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center gap-2 text-sm font-medium text-stone-900"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: winner.color }}
                          />
                          {winner.name}
                        </span>
                        <span className="text-sm tabular-nums font-semibold text-stone-900">
                          {winnerEntry[1]}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Cost / benefit */}
        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_TITLE}>Cost / benefit</div>
            <CardTitle className="text-2xl mt-1 text-stone-950">
              Best model is not the same as best value
            </CardTitle>
            <p className="text-sm text-stone-500 mt-1 max-w-3xl">
              Fable 5 wins on raw score, but it is also the most expensive model in the stack.
              When we compare effective cost for the same 60-task HomeBench run, GPT 5.5 comes
              out as the best value because it can run through OpenClaw with OAuth, while Opus
              4.8, Gemini 3.1, and Fable 5 are all metered on API usage.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="pb-3 pr-4 font-medium">Model</th>
                      <th className="pb-3 pr-4 font-medium">Score</th>
                      <th className="pb-3 pr-4 font-medium">Access</th>
                      <th className="pb-3 pr-4 font-medium">Est. run cost</th>
                      <th className="pb-3 pr-4 font-medium">Value index</th>
                      <th className="pb-3 pr-4 font-medium">VA equiv.</th>
                      <th className="pb-3 font-medium">Admin equiv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valueRanked.map((m, idx) => (
                      <tr
                        key={m.key}
                        className="border-b border-stone-100 align-top"
                        data-testid={`row-value-${m.key}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: m.color }}
                            />
                            <span className="font-medium text-stone-950">{m.name}</span>
                            {idx === 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 border-emerald-300 bg-emerald-50 text-emerald-800"
                              >
                                Best value
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 mt-1">{m.rationale}</p>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-stone-900">
                          {m.score.toFixed(1)}
                        </td>
                        <td className="py-3 pr-4 text-stone-700">{m.access}</td>
                        <td className="py-3 pr-4 font-medium text-stone-900">
                          ${m.cost.toFixed(0)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-stone-900">
                          {m.valueIndex.toFixed(1)}
                        </td>
                        <td className="py-3 pr-4 text-stone-700">
                          {m.vaMinutes.toFixed(0)} min @ ${VA_HOURLY_WAGE}/hr
                        </td>
                        <td className="py-3 text-stone-700">
                          {m.adminMinutes.toFixed(0)} min @ ${LOCAL_ADMIN_HOURLY_WAGE}/hr
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-5">
                  <div className="flex items-center gap-2 text-stone-950">
                    <Bot className="h-4 w-4" />
                    <div className="text-sm font-semibold">Operational takeaway</div>
                  </div>
                  <p className="text-sm text-stone-600 mt-3 leading-relaxed">
                    If you want the absolute best draft quality regardless of spend, Fable 5 still
                    leads. If you care about output per dollar, GPT 5.5 is the practical default
                    for most brokerages and lean realtor teams.
                  </p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-stone-950">
                    <Building2 className="h-4 w-4" />
                    <div className="text-sm font-semibold">Human labor lens</div>
                  </div>
                  <p className="text-sm text-stone-600 mt-3 leading-relaxed">
                    On these assumptions, one benchmark-sized GPT 5.5 run is about 12 minutes of a
                    $10/hr VA or 6 minutes of a $20/hr local admin. Fable 5 is closer to 84
                    minutes of VA time or 42 minutes of local admin time, so its quality premium
                    needs to matter enough to justify the spend.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category deep-dive */}
        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_TITLE}>Deep dive</div>
            <CardTitle className="text-2xl mt-1 text-stone-950">
              How each task is scored
            </CardTitle>
            <p className="text-sm text-stone-500 mt-1">
              Pick a category to see the task, a sample prompt, and per-model scores.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const isActive = c.key === activeCategory;
                return (
                  <button
                    key={c.key}
                    onClick={() => setActiveCategory(c.key)}
                    data-testid={`tab-category-${c.key}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? "bg-stone-950 text-[#FAF7F2] border-stone-950"
                        : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div className="grid md:grid-cols-[1.1fr_1fr] gap-6">
              <div>
                <div className={SECTION_TITLE}>{active.short}</div>
                <h3 className="text-xl font-semibold text-stone-950 mt-1 mb-3">
                  {active.label}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed mb-5">
                  {active.description}
                </p>
                <div className="rounded-lg border border-stone-200 bg-[#FAF7F2] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-stone-500 mb-1">
                    Sample task
                  </div>
                  <p className="text-sm text-stone-800 leading-relaxed">{active.example}</p>
                </div>
              </div>

              <div>
                <div className={SECTION_TITLE}>Per-model score</div>
                <div className="mt-3 space-y-3">
                  {([...MODELS]
                    .map((m) => ({ ...m, score: active.scores[m.key] }))
                    .sort((a, b) => b.score - a.score)
                  ).map((m, idx) => (
                    <div key={m.key} data-testid={`score-${active.key}-${m.key}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: m.color }}
                          />
                          <span
                            className={`font-medium ${
                              idx === 0 ? "text-stone-950" : "text-stone-700"
                            }`}
                          >
                            {m.name}
                          </span>
                          {idx === 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 border-amber-400 bg-amber-50 text-amber-800"
                            >
                              Best
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-stone-900">
                          {m.score}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${m.score}%`,
                            background: m.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Methodology */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <Card className="border-stone-200 bg-white md:col-span-2">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_TITLE}>Methodology</div>
              <CardTitle className="text-xl mt-1 text-stone-950">
                How HomeBench scores
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5 text-sm text-stone-700 leading-relaxed">
              <p>
                Each task gives the model a controlled case file: buyer/seller profiles, listing
                data, mock comps, CRM records, message threads, and any documents. We grade the
                model's output across seven weighted dimensions:
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Task completion", 25],
                  ["Factual accuracy", 20],
                  ["Real estate judgment", 15],
                  ["Client-readiness", 10],
                  ["Compliance & risk", 15],
                  ["Tool use", 10],
                  ["Speed & cost", 5],
                ].map(([label, weight]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between rounded-md border border-stone-200 bg-[#FAF7F2] px-3 py-2"
                  >
                    <span className="text-stone-700">{label}</span>
                    <span className="font-semibold text-stone-900">{weight} pts</span>
                  </div>
                ))}
              </div>
              <p>
                Tasks are graded in three layers: deterministic checks for math, dates, tool calls,
                and required fields; LLM-judge first-pass scoring; and final review by working
                realtors. Outputs from each model run side-by-side on identical inputs.
              </p>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_TITLE}>Auto-fail</div>
              <CardTitle className="text-xl mt-1 text-stone-950">
                Hard fails
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm text-stone-700">
                {HARD_FAILS.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Footer / CTA */}
        <Card className="border-stone-200 bg-gradient-to-br from-stone-950 to-stone-900 text-[#FAF7F2] mb-10">
          <CardContent className="grid md:grid-cols-[1.4fr_0.6fr] gap-6 p-8 md:items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-amber-200/80 mb-2">
                What's next
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold leading-tight">
                v0.5 expands to 75 tasks and adds tool-use & multimodal docs.
              </h3>
              <p className="text-stone-300 mt-3 text-sm max-w-2xl">
                We re-run HomeBench every time a frontier model ships. Want to suggest a task,
                contribute as a grader, or get the raw scorecards? We're opening the private beta.
              </p>
            </div>
            <div className="md:text-right flex md:justify-end gap-3 flex-wrap">
              <a
                href="https://meetyourhomies.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="border-stone-700 bg-transparent text-[#FAF7F2] hover:bg-stone-800"
                >
                  Homies <ExternalLink className="h-3 w-3 ml-1.5" />
                </Button>
              </a>
              <a
                href="https://meetyourhomies.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-amber-400 text-stone-950 hover:bg-amber-300">
                  Join the beta
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Fine print */}
        <div className="flex items-start gap-2 text-xs text-stone-500 leading-relaxed">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            HomeBench v0.1 · 60 tasks · scored June 2026. Scores shown are an illustrative public
            run; the private scored set is held out to prevent overfitting. Model names are
            placeholders for the latest publicly available checkpoint at run time.
          </p>
        </div>
      </main>
    </div>
  );
}
