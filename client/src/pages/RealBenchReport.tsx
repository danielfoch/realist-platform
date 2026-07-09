import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BriefcaseBusiness, Calendar, CheckCircle2, CircleDollarSign, FileText, Home as HomeIcon, Info, Mail, Megaphone, Route, Search, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ValidationStatus = "validated" | "projected";
type ModelId = "fable-5" | "gpt-5.6-sol" | "grok-4.5" | "glm-5.2" | "opus-4.8" | "gemini-3.1";

interface BenchModel {
  id: ModelId;
  name: string;
  vendor: string;
  rawScore: number;
  reliability: number;
  agentic: number;
  domainFit: number;
  priceInPerMTok: number;
  priceOutPerMTok: number;
  color: string;
  status: ValidationStatus;
  pricingStatus: ValidationStatus;
  bestUse: string;
  avoidUse: string;
  routingRole: string;
}

interface JobSpec {
  job: string;
  description: string;
  tokensIn: number;
  tokensOut: number;
}

interface RoutingRow {
  work: string;
  defaultModel: ModelId;
  escalation: string;
}

interface Category {
  key: string;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  example: string;
  scores: Record<ModelId, number>;
}

// Projected figures are Realist scenario estimates pending validation. They are
// not vendor-published benchmarks. Cost per completed job =
// ((tokensIn * input price) + (tokensOut * output price)) / 1M / reliability.
const MODELS: BenchModel[] = [
  {
    id: "fable-5",
    name: "Fable 5",
    vendor: "Homies",
    rawScore: 94,
    reliability: 0.9,
    agentic: 91,
    domainFit: 95,
    priceInPerMTok: 5,
    priceOutPerMTok: 15,
    color: "#111827",
    status: "projected",
    pricingStatus: "projected",
    bestUse: "Premium strategy, hard judgment, complex offers, and work where one bad answer is expensive.",
    avoidUse: "High-volume routine admin where a cheaper model can finish the job.",
    routingRole: "Premium judgment layer",
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    vendor: "OpenAI",
    rawScore: 91,
    reliability: 0.96,
    agentic: 88,
    domainFit: 90,
    priceInPerMTok: 3,
    priceOutPerMTok: 12,
    color: "#0F766E",
    status: "projected",
    pricingStatus: "projected",
    bestUse: "Reliable day-to-day realtor workflows: CRM, email, listing summaries, and client-ready first drafts.",
    avoidUse: "Jobs where style, persuasion, or high-stakes negotiation strategy matters more than throughput.",
    routingRole: "Reliable workflow layer",
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    vendor: "SpaceXAI / xAI",
    rawScore: 87,
    reliability: 0.92,
    agentic: 82,
    domainFit: 84,
    priceInPerMTok: 0.5,
    priceOutPerMTok: 1.5,
    color: "#7C3AED",
    status: "projected",
    pricingStatus: "projected",
    bestUse: "Cheap background agentic work: booking steps, draft assembly, code-adjacent workflows, and bulk task execution.",
    avoidUse: "Final client advice, sensitive legal language, or anything that needs top-end judgment without review.",
    routingRole: "Low-cost agentic layer",
  },
  {
    id: "glm-5.2",
    name: "GLM 5.2",
    vendor: "Zhipu AI",
    rawScore: 84,
    reliability: 0.88,
    agentic: 79,
    domainFit: 81,
    priceInPerMTok: 0.25,
    priceOutPerMTok: 0.75,
    color: "#DC2626",
    status: "projected",
    pricingStatus: "projected",
    bestUse: "Open-weight experimentation, private/on-prem workflow tests, sovereign-AI pilots, and low-cost batch jobs where data control matters.",
    avoidUse: "Sensitive client workflows unless the deployment, hosting, privacy, and legal posture are explicitly approved.",
    routingRole: "Open-weight cost hedge",
  },
  {
    id: "opus-4.8",
    name: "Opus 4.8",
    vendor: "Anthropic",
    rawScore: 81.4,
    reliability: 0.85,
    agentic: 80,
    domainFit: 82,
    priceInPerMTok: 3,
    priceOutPerMTok: 15,
    color: "#D97757",
    status: "validated",
    pricingStatus: "projected",
    bestUse: "Research-heavy writing, synthesis, and thoughtful first drafts.",
    avoidUse: "Cheap repetitive job execution at high volume.",
    routingRole: "Research and synthesis layer",
  },
  {
    id: "gemini-3.1",
    name: "Gemini 3.1",
    vendor: "Google",
    rawScore: 74.6,
    reliability: 0.81,
    agentic: 73,
    domainFit: 76,
    priceInPerMTok: 1.5,
    priceOutPerMTok: 6,
    color: "#2563EB",
    status: "validated",
    pricingStatus: "projected",
    bestUse: "Quick summaries, research sweeps, and lower-risk support work.",
    avoidUse: "Agent-of-record workflows without human review.",
    routingRole: "Low-risk support layer",
  },
];

const JOBS: JobSpec[] = [
  { job: "Offer written", description: "Terms, clauses, conditions, deposit, closing, and buyer-facing explanation.", tokensIn: 120_000, tokensOut: 40_000 },
  { job: "Showing booked", description: "Request parsing, availability logic, message drafting, schedule confirmation, and CRM note.", tokensIn: 60_000, tokensOut: 15_000 },
  { job: "Home evaluation done", description: "Listing scan, comps, adjustment logic, valuation range, and seller/buyer memo.", tokensIn: 250_000, tokensOut: 60_000 },
  { job: "Listing presentation done", description: "Market read, pricing strategy, seller objections, CMA story, and deck copy.", tokensIn: 200_000, tokensOut: 80_000 },
  { job: "Marketing brochure completed", description: "Property narrative, room highlights, social copy, brochure text, and compliance cleanup.", tokensIn: 100_000, tokensOut: 50_000 },
];

const ROUTING_ROWS: RoutingRow[] = [
  { work: "Routine showing coordination, brochure assembly, and background agent tasks", defaultModel: "grok-4.5", escalation: "Escalate if the message creates a binding commitment or touches legal advice." },
  { work: "Private batch jobs, open-weight tests, and cost-sensitive workflows where you want leverage against vendor pricing", defaultModel: "glm-5.2", escalation: "Escalate to hosted frontier models when reliability, support, or compliance risk matters more than cost control." },
  { work: "CRM follow-up, client replies, listing summaries, and everyday brokerage workflows", defaultModel: "gpt-5.6-sol", escalation: "Escalate to Fable when judgment, persuasion, or risk framing matters." },
  { work: "Complex offers, pricing strategy, seller memos, and investor underwriting judgment", defaultModel: "fable-5", escalation: "Human approval before anything goes to a client or counterparty." },
];

const SOURCES = [
  { label: "OpenAI GPT-5.6 Sol preview", href: "https://openai.com/index/previewing-gpt-5-6-sol/" },
  { label: "Axios Grok 4.5 / Cursor reporting", href: "https://www.axios.com/2026/07/08/spacexai-grok-new-model" },
  { label: "CursorBench ranking source", href: "https://www.cursor.com/" },
  { label: "Zhipu AI / GLM model family", href: "https://www.zhipuai.cn/" },
];

const BENCH_CATEGORIES: Category[] = [
  {
    key: "offers",
    label: "Offers",
    short: "OfferBench",
    icon: FileText,
    description: "Drafting competitive buyer offers, comparing seller offers, counteroffer strategy, and deadline math.",
    example: "Buyer is preapproved to $875K. List price is $849K. Seller wants a 30-day close. Draft terms, deposit, conditions, and a buyer-facing explanation.",
    scores: { "fable-5": 95, "gpt-5.6-sol": 91, "grok-4.5": 86, "glm-5.2": 83, "opus-4.8": 82, "gemini-3.1": 74 },
  },
  {
    key: "showing",
    label: "Showing",
    short: "ShowBench",
    icon: Calendar,
    description: "Scheduling tours, routing for drive time, listing-agent outreach, reschedules, and confirmation notes.",
    example: "Buyer is free Saturday 10-2. Five homes, two are 25 minutes apart, one listing agent needs two hours notice. Plan the route and draft the showing requests.",
    scores: { "fable-5": 92, "gpt-5.6-sol": 93, "grok-4.5": 88, "glm-5.2": 84, "opus-4.8": 77, "gemini-3.1": 71 },
  },
  {
    key: "crm",
    label: "CRM Management",
    short: "CRMBench",
    icon: Users,
    description: "Lead classification, dedupe, next-best-action, follow-up sequences, and pipeline summarization.",
    example: "Fifty messy leads from Realtor.ca, open houses, referrals, and past clients. Classify, dedupe, assign next action, and draft the first follow-up.",
    scores: { "fable-5": 92, "gpt-5.6-sol": 94, "grok-4.5": 87, "glm-5.2": 84, "opus-4.8": 80, "gemini-3.1": 72 },
  },
  {
    key: "email",
    label: "Email Response",
    short: "EmailBench",
    icon: Mail,
    description: "Client-ready replies with useful tone, compliance guardrails, and no hallucinated commitments.",
    example: "Past client asks whether to refinance into a variable mortgage. Draft a helpful, calibrated reply without pretending to be their mortgage broker.",
    scores: { "fable-5": 96, "gpt-5.6-sol": 93, "grok-4.5": 86, "glm-5.2": 83, "opus-4.8": 87, "gemini-3.1": 78 },
  },
  {
    key: "research",
    label: "Property Research",
    short: "ResearchBench",
    icon: Search,
    description: "Pulling listing facts, summarizing disclosures, spotting red flags, and contextualizing neighbourhoods.",
    example: "Buyer sends a listing and disclosure package. Summarize facts, flag red flags, and prepare a showing brief for the agent.",
    scores: { "fable-5": 93, "gpt-5.6-sol": 89, "grok-4.5": 85, "glm-5.2": 82, "opus-4.8": 83, "gemini-3.1": 81 },
  },
  {
    key: "marketing",
    label: "Property Marketing",
    short: "MarketingBench",
    icon: Megaphone,
    description: "MLS remarks, social captions, listing decks, property brochures, and compliance cleanup.",
    example: "Rewrite risky listing copy into compliant copy, then produce brochure text, room highlights, and five social captions.",
    scores: { "fable-5": 94, "gpt-5.6-sol": 91, "grok-4.5": 87, "glm-5.2": 84, "opus-4.8": 85, "gemini-3.1": 76 },
  },
  {
    key: "valuation",
    label: "Property Valuation",
    short: "ValBench",
    icon: HomeIcon,
    description: "Comp selection, adjustments, list-price range, uncertainty, and seller-ready CMA narratives.",
    example: "From ten sold comps, pick the best four, adjust for condition and size, and recommend a price range with confidence level.",
    scores: { "fable-5": 96, "gpt-5.6-sol": 86, "grok-4.5": 82, "glm-5.2": 78, "opus-4.8": 76, "gemini-3.1": 70 },
  },
];

function costPerJob(model: BenchModel, job: JobSpec) {
  return ((job.tokensIn * model.priceInPerMTok + job.tokensOut * model.priceOutPerMTok) / 1_000_000) / model.reliability;
}

function averageCostPerJob(model: BenchModel) {
  return JOBS.reduce((sum, job) => sum + costPerJob(model, job), 0) / JOBS.length;
}

function money(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 3)}`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function statusText(status: ValidationStatus) {
  return status === "validated" ? "HomeBench score" : "Realist projection - pending validation";
}

function priceStatusText(status: ValidationStatus) {
  return status === "validated" ? "Published pricing" : "Projected pricing";
}

function modelById(id: ModelId) {
  return MODELS.find((model) => model.id === id)!;
}

function categoryAverage(modelId: ModelId) {
  return BENCH_CATEGORIES.reduce((sum, category) => sum + category.scores[modelId], 0) / BENCH_CATEGORIES.length;
}

const rankedModels = [...MODELS].sort((a, b) => b.rawScore - a.rawScore);
const avgJobCostData = rankedModels.map((model) => ({
  ...model,
  avgCost: averageCostPerJob(model),
  reliabilityPct: model.reliability * 100,
}));

const jobCostRows = JOBS.map((job) => ({
  ...job,
  costs: MODELS.map((model) => ({
    modelId: model.id,
    value: costPerJob(model, job),
    status: model.status,
  })),
}));

const categoryPerformanceData = BENCH_CATEGORIES.map((category) => ({
  label: category.label,
  "Fable 5": category.scores["fable-5"],
  "GPT-5.6 Sol": category.scores["gpt-5.6-sol"],
  "Grok 4.5": category.scores["grok-4.5"],
  "GLM 5.2": category.scores["glm-5.2"],
  "Opus 4.8": category.scores["opus-4.8"],
  "Gemini 3.1": category.scores["gemini-3.1"],
}));

const radarData = BENCH_CATEGORIES.map((category) => ({
  category: category.label,
  "Fable 5": category.scores["fable-5"],
  "GPT-5.6 Sol": category.scores["gpt-5.6-sol"],
  "Grok 4.5": category.scores["grok-4.5"],
  "GLM 5.2": category.scores["glm-5.2"],
  "Opus 4.8": category.scores["opus-4.8"],
  "Gemini 3.1": category.scores["gemini-3.1"],
}));

const SECTION_LABEL = "text-xs uppercase tracking-[0.18em] text-stone-500 font-semibold";

export default function RealBenchReport() {
  const [activeCategory, setActiveCategory] = useState("offers");
  const cheapestModel = MODELS.reduce((best, model) => (averageCostPerJob(model) < averageCostPerJob(best) ? model : best), MODELS[0]);
  const categoryRanked = useMemo(
    () =>
      [...MODELS]
        .map((model) => ({ ...model, score: categoryAverage(model.id) }))
        .sort((a, b) => b.score - a.score)
        .map((model, index) => ({ ...model, rank: index + 1 })),
    [],
  );
  const activeBenchCategory = BENCH_CATEGORIES.find((category) => category.key === activeCategory) || BENCH_CATEGORIES[0];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <SEO
        title="HomeBench AI Realtor Benchmark | Realist.ca"
        description="Realist.ca HomeBench ranks AI models on real realtor workflows: offers, showings, CRM, evaluations, listing presentations, marketing, reliability, and cost per completed job."
        canonicalUrl="/reports/realbench-ai-realtor-benchmark"
        noIndex={false}
      />
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <Link href="/insights" className="mb-6 inline-flex items-center text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Insights
        </Link>

        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-stone-950 text-[#FAF7F2] hover:bg-stone-950">
              <Sparkles className="mr-1 h-3 w-3" />
              HomeBench scenario update
            </Badge>
            <Badge variant="outline" className="border-stone-300 bg-white text-stone-700">
              Updated July 2026
            </Badge>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              New model data pending validation
            </Badge>
          </div>

          <h1 className="max-w-5xl text-4xl font-bold tracking-tight text-stone-950 md:text-6xl">
            The best AI model is not the one you use for every job.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-600">
            HomeBench tests models on the work realtors and investor teams actually need done:
            offers, showings, CRM, home evaluations, listing presentations, marketing packages,
            referral routing, and client follow-up. We stopped measuring theoretical hours saved.
            The useful unit is simpler: completed real estate jobs, and what each job costs.
          </p>
        </section>

        <section className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Trophy, label: "Raw score leader", value: "Fable 5", body: "Best projected judgment model when quality matters more than spend." },
            { icon: ShieldCheck, label: "Reliability leader", value: "GPT-5.6 Sol", body: "Projected to finish the most routine workflows without human rescue." },
            { icon: CircleDollarSign, label: "Cost-per-job leader", value: "Grok 4.5", body: "Third on projected capability, but the economics get hard to ignore." },
            { icon: Sparkles, label: "Open-weight hedge", value: "GLM 5.2", body: "The China/open-weight lane matters if model access, data control, and inference cost become strategic risks." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-stone-200 bg-white">
                <CardContent className="p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-stone-950 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className={SECTION_LABEL}>{item.label}</div>
                  <div className="mt-1 text-2xl font-bold text-stone-950">{item.value}</div>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Executive summary</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">Model score is only half the decision.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_0.85fr]">
            <div className="space-y-4 text-sm leading-relaxed text-stone-600">
              <p>
                Fable 5 still wins the premium-quality lane. GPT-5.6 Sol is the interesting
                reliability story: not necessarily more soulful, but projected to complete more
                normal brokerage work cleanly. Grok 4.5 is the new economics problem for everyone
                else. If the cost curve holds, a model can be third-best and still be the right
                default for a lot of background work.
              </p>
              <p>
                GLM 5.2 adds a different pressure point. Open-weight Chinese models are not just
                cheaper alternatives. They are a hedge against closed-model pricing, vendor lock-in,
                and the uncomfortable reality that every frontier lab wants the same inference
                data its customers use to build their businesses.
              </p>
              <p>
                That is the real shift for real estate AI. Brokerages do not need one magical
                model. They need routing: cheap models for repetitive jobs, reliable models for
                client workflow, premium models for judgment, and humans approving commitments.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                <Info className="h-4 w-4" />
                Caveat up front
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                The new Fable 5, GPT-5.6 Sol, Grok 4.5, and GLM 5.2 figures below are a Realist
                scenario, not a final public benchmark. They are here to show the routing,
                sovereignty, and economics model we will validate in the next HomeBench run.
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className={SECTION_LABEL}>Original benchmark view</div>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-stone-950">Same sexy scorecard, new models.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
                The earlier HomeBench page worked because it looked like a real benchmark, not a spreadsheet.
                This brings back the leaderboard, task-category bars, model fingerprints, category leaders,
                and deep-dive scorecards while keeping the new cost-per-job economics.
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {categoryRanked.map((model) => (
              <Card
                key={model.id}
                className={`relative overflow-hidden border ${model.rank === 1 ? "border-stone-900 bg-stone-950 text-[#FAF7F2]" : "border-stone-200 bg-white"}`}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`text-xs uppercase tracking-wider ${model.rank === 1 ? "text-amber-300" : "text-stone-500"}`}>
                      Rank #{model.rank}
                    </div>
                    {model.rank === 1 && <Trophy className="h-4 w-4 text-amber-300" />}
                  </div>
                  <div className="text-base font-semibold leading-tight">{model.name}</div>
                  <div className={`text-xs ${model.rank === 1 ? "text-stone-400" : "text-stone-500"}`}>{model.vendor}</div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">{model.score.toFixed(1)}</span>
                    <span className={`text-xs ${model.rank === 1 ? "text-stone-400" : "text-stone-500"}`}>/ 100</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
                    <div className="h-full rounded-full" style={{ width: `${model.score}%`, backgroundColor: model.color }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-6 overflow-hidden border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className={SECTION_LABEL}>Task category benchmark</div>
                  <CardTitle className="mt-1 text-2xl text-stone-950">Overall performance by task category</CardTitle>
                  <p className="mt-1 text-sm text-stone-500">
                    Higher is better. This is the original benchmark-style chart, now carrying the July model scenario.
                  </p>
                </div>
                <div className="flex max-w-xl flex-wrap gap-3">
                  {MODELS.map((model) => (
                    <div key={model.id} className="flex items-center gap-2 text-xs text-stone-700">
                      <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: model.color }} />
                      {model.name}
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={620}>
                <BarChart data={categoryPerformanceData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }} barCategoryGap={8} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#78716C" }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#1C1917" }} width={150} />
                  <Tooltip
                    contentStyle={{ background: "#FAF7F2", border: "1px solid #E7E2DA", borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => `${Number(value).toFixed(0)} / 100`}
                  />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  {MODELS.map((model) => (
                    <Bar key={model.id} dataKey={model.name} name={model.name} fill={model.color} radius={[0, 3, 3, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-stone-200 bg-white">
              <CardHeader className="border-b border-stone-100">
                <div className={SECTION_LABEL}>Model fingerprints</div>
                <CardTitle className="mt-1 text-xl text-stone-950">Shape of each model</CardTitle>
                <p className="mt-1 text-sm text-stone-500">This brings back the original radar read: which models are balanced vs spiky.</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={360}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E7E2DA" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "#44403C" }} />
                    <PolarRadiusAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#A8A29E" }} angle={90} />
                    {MODELS.map((model, index) => (
                      <Radar
                        key={model.id}
                        name={model.name}
                        dataKey={model.name}
                        stroke={model.color}
                        fill={model.color}
                        fillOpacity={index === 0 ? 0.16 : 0.08}
                      />
                    ))}
                    <Tooltip contentStyle={{ background: "#FAF7F2", border: "1px solid #E7E2DA", borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white">
              <CardHeader className="border-b border-stone-100">
                <div className={SECTION_LABEL}>Category leaders</div>
                <CardTitle className="mt-1 text-xl text-stone-950">Best at each realtor job</CardTitle>
                <p className="mt-1 text-sm text-stone-500">The original report made this easy to scan. It is back.</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="divide-y divide-stone-100">
                  {BENCH_CATEGORIES.map((category) => {
                    const winnerEntry = (Object.entries(category.scores) as [ModelId, number][]).sort((a, b) => b[1] - a[1])[0];
                    const winner = modelById(winnerEntry[0]);
                    const Icon = category.icon;
                    return (
                      <li key={category.key} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-stone-100">
                            <Icon className="h-4 w-4 text-stone-700" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-stone-900">{category.label}</div>
                            <div className="text-xs text-stone-500">{category.short}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-stone-900">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: winner.color }} />
                            {winner.name}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-stone-900">{winnerEntry[1]}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Original deep dive</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">How each task gets scored</CardTitle>
            <p className="mt-1 text-sm text-stone-500">
              Pick a category to see the task, sample prompt, and per-model scorecard.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6 flex flex-wrap gap-2">
              {BENCH_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isActive = category.key === activeCategory;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setActiveCategory(category.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-stone-950 bg-stone-950 text-[#FAF7F2]"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {category.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
              <div>
                <div className={SECTION_LABEL}>{activeBenchCategory.short}</div>
                <h3 className="mb-3 mt-1 text-xl font-semibold text-stone-950">{activeBenchCategory.label}</h3>
                <p className="mb-5 text-sm leading-relaxed text-stone-600">{activeBenchCategory.description}</p>
                <div className="rounded-lg border border-stone-200 bg-[#FAF7F2] p-4">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-stone-500">Sample task</div>
                  <p className="text-sm leading-relaxed text-stone-800">{activeBenchCategory.example}</p>
                </div>
              </div>

              <div>
                <div className={SECTION_LABEL}>Per-model score</div>
                <div className="mt-3 space-y-3">
                  {([...MODELS]
                    .map((model) => ({ ...model, score: activeBenchCategory.scores[model.id] }))
                    .sort((a, b) => b.score - a.score)
                  ).map((model, index) => (
                    <div key={model.id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: model.color }} />
                          <span className={`font-medium ${index === 0 ? "text-stone-950" : "text-stone-700"}`}>{model.name}</span>
                          {index === 0 && (
                            <Badge variant="outline" className="border-amber-400 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800">
                              Best
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-stone-900">{model.score}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full" style={{ width: `${model.score}%`, backgroundColor: model.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Comparison table</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">HomeBench model routing view</CardTitle>
            <p className="mt-1 text-sm text-stone-500">
              Scores are 0-100. Cost is estimated per completed job after reliability/retry drag.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-5 py-3 font-medium">Model</th>
                    <th className="px-5 py-3 font-medium">HomeBench rank</th>
                    <th className="px-5 py-3 font-medium">Overall score</th>
                    <th className="px-5 py-3 font-medium">Reliability</th>
                    <th className="px-5 py-3 font-medium">Agentic ability</th>
                    <th className="px-5 py-3 font-medium">RE domain fit</th>
                    <th className="px-5 py-3 font-medium">Pricing in/out</th>
                    <th className="px-5 py-3 font-medium">Avg. cost/job</th>
                    <th className="px-5 py-3 font-medium">Best use case</th>
                    <th className="px-5 py-3 font-medium">Avoid using for</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedModels.map((model, index) => (
                    <tr key={model.id} className="border-b border-stone-100 align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: model.color }} />
                          <div>
                            <div className="font-semibold text-stone-950">{model.name}</div>
                            <div className="text-xs text-stone-500">{model.vendor}</div>
                            <Badge
                              variant="outline"
                              className={`mt-2 ${model.status === "projected" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
                            >
                              {statusText(model.status)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`mt-2 ml-1 ${model.pricingStatus === "projected" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
                            >
                              {priceStatusText(model.pricingStatus)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-stone-950">#{index + 1}</td>
                      <td className="px-5 py-4 tabular-nums font-semibold text-stone-950">{model.rawScore.toFixed(1)}</td>
                      <td className="px-5 py-4 tabular-nums text-stone-700">{percent(model.reliability)}</td>
                      <td className="px-5 py-4 tabular-nums text-stone-700">{model.agentic}</td>
                      <td className="px-5 py-4 tabular-nums text-stone-700">{model.domainFit}</td>
                      <td className="px-5 py-4 text-stone-700">
                        {money(model.priceInPerMTok)} / {money(model.priceOutPerMTok)}
                        <div className="text-xs text-stone-500">per 1M tokens</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-stone-950">{money(averageCostPerJob(model))}</td>
                      <td className="px-5 py-4 text-stone-700">{model.bestUse}</td>
                      <td className="px-5 py-4 text-stone-700">{model.avoidUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <section className="mb-10 grid gap-6 lg:grid-cols-2">
          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_LABEL}>Score vs cost</div>
              <CardTitle className="mt-1 text-xl text-stone-950">Raw capability is not the same as value.</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 25, bottom: 30, left: 5 }}>
                    <CartesianGrid stroke="#E7E2DA" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="avgCost"
                      name="Average cost per job"
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      tickFormatter={(value) => money(Number(value))}
                      label={{ value: "Avg. cost per completed job", position: "insideBottom", offset: -12, fontSize: 12, fill: "#57534E" }}
                    />
                    <YAxis
                      dataKey="rawScore"
                      name="Overall score"
                      domain={[70, 98]}
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      label={{ value: "Overall score", angle: -90, position: "insideLeft", fontSize: 12, fill: "#57534E" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ background: "#FAF7F2", border: "1px solid #E7E2DA", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => (name === "Average cost per job" ? money(Number(value)) : Number(value).toFixed(1))}
                    />
                    <Scatter data={avgJobCostData}>
                      {avgJobCostData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                      <LabelList dataKey="name" position="top" fontSize={11} fill="#1C1917" />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_LABEL}>Reliability vs agentic tasking</div>
              <CardTitle className="mt-1 text-xl text-stone-950">Workflows need finishers, not just smart talkers.</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 25, bottom: 30, left: 5 }}>
                    <CartesianGrid stroke="#E7E2DA" strokeDasharray="3 3" />
                    <ReferenceLine y={90} stroke="#A8A29E" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="agentic"
                      name="Agentic ability"
                      domain={[70, 95]}
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      label={{ value: "Agentic task score", position: "insideBottom", offset: -12, fontSize: 12, fill: "#57534E" }}
                    />
                    <YAxis
                      dataKey="reliabilityPct"
                      name="Reliability"
                      domain={[78, 100]}
                      tick={{ fontSize: 11, fill: "#78716C" }}
                      tickFormatter={(value) => `${value}%`}
                      label={{ value: "Completed without rescue", angle: -90, position: "insideLeft", fontSize: 12, fill: "#57534E" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ background: "#FAF7F2", border: "1px solid #E7E2DA", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => (name === "Reliability" ? `${Number(value).toFixed(0)}%` : Number(value).toFixed(1))}
                    />
                    <Scatter data={avgJobCostData}>
                      {avgJobCostData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                      <LabelList dataKey="name" position="top" fontSize={11} fill="#1C1917" />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Cost per real estate job</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">The unit is not tokens. The unit is finished work.</CardTitle>
            <p className="mt-1 text-sm text-stone-500">
              Estimates include a full agentic run with tool calls and retry drag from reliability.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-5 py-3 font-medium">Job</th>
                    {MODELS.map((model) => (
                      <th key={model.id} className="px-5 py-3 font-medium">{model.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobCostRows.map((row) => {
                    const cheapest = row.costs.reduce((best, current) => (current.value < best.value ? current : best), row.costs[0]);
                    return (
                      <tr key={row.job} className="border-b border-stone-100 align-top">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-stone-950">{row.job}</div>
                          <div className="mt-1 max-w-sm text-xs leading-relaxed text-stone-500">{row.description}</div>
                        </td>
                        {row.costs.map((cost) => {
                          const model = modelById(cost.modelId);
                          const isCheapest = cost.modelId === cheapest.modelId;
                          return (
                            <td key={cost.modelId} className="px-5 py-4">
                              <div className={`font-semibold tabular-nums ${isCheapest ? "text-emerald-700" : "text-stone-950"}`}>
                                {money(cost.value)}
                              </div>
                              {isCheapest && (
                                <Badge variant="outline" className="mt-2 border-emerald-300 bg-emerald-50 text-emerald-800">
                                  Cheapest
                                </Badge>
                              )}
                              {model.pricingStatus === "projected" && (
                                <div className="mt-1 text-[11px] text-stone-500">Projected pricing</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-stone-100 bg-[#FAF7F2] p-5">
              <div className="flex items-start gap-3">
                <CircleDollarSign className="mt-0.5 h-5 w-5 text-emerald-700" />
                <p className="text-sm leading-relaxed text-stone-700">
                  On this projected pricing curve, <strong>{cheapestModel.name}</strong> is not the
                  best model. It is the cheapest model per completed job by a wide margin. That
                  matters for showing coordination, marketing drafts, first-pass offers, and any
                  background workflow you run hundreds of times.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>The Reliability Shift</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">Most real estate work does not need superintelligence.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 md:grid-cols-3">
            {[
              { title: "The old question", body: "Which model is smartest? That is useful for demos and benchmark debates. It is not enough for brokerage operations." },
              { title: "The better question", body: "Which model finishes the job without making the agent rescue it? Reliability is the bridge from AI demo to actual labour leverage." },
              { title: "The practical result", body: "A cheaper model that completes ordinary work reliably can beat a smarter model on ROI, even if it loses on raw score." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-5">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-700" />
                <div className="font-semibold text-stone-950">{item.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Open weights and sovereign AI</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">The next cost curve may come from models you can run yourself.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 md:grid-cols-3">
            {[
              {
                title: "Open source is the full recipe",
                body: "Code, training method, and permission to inspect or modify the system. In AI, true open source is rare because training data and recipes are often missing.",
              },
              {
                title: "Open weight is the useful middle",
                body: "The model weights are available to run, host, fine-tune, or inspect more directly. You may still not get the full training data or recipe.",
              },
              {
                title: "Why GLM 5.2 matters",
                body: "Chinese open-weight models create a second supply chain for capable AI. That gives companies leverage against rising inference costs and closed-lab data capture.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-5">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-700" />
                <div className="font-semibold text-stone-950">{item.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.body}</p>
              </div>
            ))}
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 md:col-span-3">
              <div className="font-semibold text-stone-950">The adoption shift</div>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">
                A year ago, many North American companies were nervous about putting proprietary
                workflow data into Chinese models. That concern is still real. But the counter-risk
                is now obvious too: closed Western labs see the inference data, learn the workflows,
                raise prices, and may eventually compete with the same customers using the model.
                For real estate AI, the answer is not blind trust in any vendor. It is routing:
                hosted frontier models where they are worth it, open-weight models where cost and
                control matter, and private data kept inside the Realist ledger.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-10 border-stone-200 bg-white">
          <CardHeader className="border-b border-stone-100">
            <div className={SECTION_LABEL}>Model Routing Strategy</div>
            <CardTitle className="mt-1 text-2xl text-stone-950">Pay for the model the job needs.</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-stone-100">
              {ROUTING_ROWS.map((row) => {
                const model = modelById(row.defaultModel);
                return (
                  <div key={row.work} className="grid gap-4 p-5 md:grid-cols-[1fr_220px_1fr] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-stone-950">
                        <BriefcaseBusiness className="h-4 w-4 text-stone-500" />
                        {row.work}
                      </div>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-[#FAF7F2] px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Default route</div>
                      <div className="mt-1 flex items-center gap-2 font-semibold text-stone-950">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: model.color }} />
                        {model.name}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-stone-600">{row.escalation}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <section className="mb-10 grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-stone-200 bg-stone-950 text-[#FAF7F2]">
            <CardContent className="p-6">
              <Route className="mb-4 h-6 w-6 text-amber-300" />
              <div className={SECTION_LABEL.replace("text-stone-500", "text-stone-400")}>Plain-English takeaway</div>
              <p className="mt-3 text-lg leading-relaxed">
                Fable is still the premium model. GPT-5.6 Sol is the reliability layer. Grok 4.5 is
                the cost curve. GLM 5.2 is the open-weight hedge. A smart brokerage should not
                blindly run everything through the most expensive closed model. Route the work, keep
                humans approving commitments, protect the private ledger, and measure cost per
                completed job.
              </p>
            </CardContent>
          </Card>

          <Card className="border-stone-200 bg-white">
            <CardHeader className="border-b border-stone-100">
              <div className={SECTION_LABEL}>Caveats & sources</div>
              <CardTitle className="mt-1 text-xl text-stone-950">Do not turn early signals into fake certainty.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6 text-sm leading-relaxed text-stone-600">
              <p>
                Fable 5, GPT-5.6 Sol, Grok 4.5, and GLM 5.2 figures in this update are Realist
                scenario projections pending validation. They are not vendor claims and not final
                HomeBench scores. Legacy model rows are carried forward from the earlier HomeBench
                v0.1 public scoring frame.
              </p>
              <p>
                Cost-per-job uses token estimates for full agentic runs, placeholder pricing, and
                reliability-adjusted completion rates. When real pricing, CursorBench data, or
                HomeBench runs change, the constants should be updated and the page will recalculate.
              </p>
              <div className="space-y-2">
                {SOURCES.map((source) => (
                  <a
                    key={source.href}
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-stone-900 underline decoration-amber-400 decoration-2 underline-offset-4 hover:decoration-stone-950"
                  >
                    {source.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
