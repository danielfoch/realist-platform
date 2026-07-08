import { Link } from "wouter";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Info, Route, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  LabelList,
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
type ModelId = "fable-5" | "gpt-5.6-sol" | "grok-4.5" | "opus-4.8" | "gpt-5.5" | "gemini-3.1";

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
    id: "gpt-5.5",
    name: "GPT-5.5",
    vendor: "OpenAI",
    rawScore: 77.6,
    reliability: 0.84,
    agentic: 76,
    domainFit: 78,
    priceInPerMTok: 2,
    priceOutPerMTok: 8,
    color: "#22C55E",
    status: "validated",
    pricingStatus: "projected",
    bestUse: "Balanced everyday drafting and automation where cost still matters.",
    avoidUse: "The hardest valuation or negotiation problems.",
    routingRole: "Balanced utility layer",
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
  { work: "CRM follow-up, client replies, listing summaries, and everyday brokerage workflows", defaultModel: "gpt-5.6-sol", escalation: "Escalate to Fable when judgment, persuasion, or risk framing matters." },
  { work: "Complex offers, pricing strategy, seller memos, and investor underwriting judgment", defaultModel: "fable-5", escalation: "Human approval before anything goes to a client or counterparty." },
];

const SOURCES = [
  { label: "OpenAI GPT-5.6 Sol preview", href: "https://openai.com/index/previewing-gpt-5-6-sol/" },
  { label: "Axios Grok 4.5 / Cursor reporting", href: "https://www.axios.com/2026/07/08/spacexai-grok-new-model" },
  { label: "CursorBench ranking source", href: "https://www.cursor.com/" },
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

const SECTION_LABEL = "text-xs uppercase tracking-[0.18em] text-stone-500 font-semibold";

export default function RealBenchReport() {
  const cheapestModel = MODELS.reduce((best, model) => (averageCostPerJob(model) < averageCostPerJob(best) ? model : best), MODELS[0]);

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

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Trophy, label: "Raw score leader", value: "Fable 5", body: "Best projected judgment model when quality matters more than spend." },
            { icon: ShieldCheck, label: "Reliability leader", value: "GPT-5.6 Sol", body: "Projected to finish the most routine workflows without human rescue." },
            { icon: CircleDollarSign, label: "Cost-per-job leader", value: "Grok 4.5", body: "Third on projected capability, but the economics get hard to ignore." },
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
                The new Fable 5, GPT-5.6 Sol, and Grok 4.5 figures below are a Realist scenario,
                not a final public benchmark. They are here to show the routing and economics
                model we will validate in the next HomeBench run.
              </p>
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
                the cost curve. A smart brokerage should not blindly run everything through the most
                expensive model. Route the work, keep humans approving commitments, and measure cost
                per completed job.
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
                Fable 5, GPT-5.6 Sol, and Grok 4.5 figures in this update are Realist scenario
                projections pending validation. They are not vendor claims and not final HomeBench
                scores. Legacy model rows are carried forward from the earlier HomeBench v0.1 public
                scoring frame.
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
