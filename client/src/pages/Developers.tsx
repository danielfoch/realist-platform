/**
 * /developers — how to plug an AI agent into Realist.
 *
 * The pitch: bring your own harness (Claude, Codex, Cursor, Grok, ChatGPT, or
 * plain HTTP), call Realist's tools, and get back JSON for the agent plus a
 * hosted page for the human. The tool catalog on this page is fetched live from
 * /api/v1/tools — the same registry the server runs — so it cannot go stale.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, FileSpreadsheet, Gauge, KeyRound, LineChart, Lock, MousePointerClick, Plug, ShieldCheck, Table2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectGuide, REALIST_API_BASE, REALIST_MCP_URL } from "@/components/agent-views/ConnectGuide";
import { SHARED_ROUTE_META } from "@shared/routeMeta";

interface ToolDescriptor {
  name: string;
  title: string;
  description: string;
  scope: string;
  readOnly: boolean;
}

const STEPS = [
  { icon: KeyRound, title: "Sign in, or create an API key", body: "In the Claude and ChatGPT apps you just sign in to Realist and approve what the app may do. Developer tools use an API key — free with a Realist account, scoped to what you allow." },
  { icon: Plug, title: "Connect your harness", body: "Point Claude, Codex, Cursor, Grok or ChatGPT at one URL. Nothing to install, and the same key works over REST." },
  { icon: MousePointerClick, title: "Ask, then open the link", body: "Your agent gets structured numbers. You get a link to the interactive version — edit assumptions, read the pro forma, download the Excel model." },
];

const VIEWS = [
  { icon: FileSpreadsheet, title: "Underwriting → a live spreadsheet", body: "Every underwriting opens as an editable pro forma: change rent, rate or down payment and the 10-year projection, charts and bear/base/bull stress test recalculate instantly. Download it as an Excel workbook with working formulas." },
  { icon: Table2, title: "Deal searches → a sortable shortlist", body: "Search results land as a ranked table with cap rate, cash-on-cash and deal score for each listing, linked through to the full listing pages." },
  { icon: LineChart, title: "Market data → a chart report", body: "Market reports and rent estimates open as charts with the underlying monthly history, method and confidence — ready to share with a partner or lender." },
];

function ToolCatalog() {
  const { data, isLoading, isError } = useQuery<{ tools: ToolDescriptor[] }>({ queryKey: ["/api/v1/tools"] });
  if (isLoading) {
    return <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        The catalog is served from <code className="font-mono text-xs">{REALIST_API_BASE}/tools</code>.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="tool-catalog">
      {data.tools.map((tool) => (
        <Card key={tool.name} data-testid={`tool-${tool.name}`}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm font-semibold">{tool.name}</code>
              <Badge variant="outline" className="font-normal text-xs">{tool.scope}</Badge>
              {!tool.readOnly && <Badge variant="secondary" className="font-normal text-xs">acts for you</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-6 line-clamp-4">{tool.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Developers() {
  const meta = SHARED_ROUTE_META["/developers"];
  return (
    <div className="min-h-screen bg-background">
      <SEO title={meta.title} description={meta.description} canonicalUrl="/developers" />
      <Navigation />

      <section className="border-b">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-14 md:py-20">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <Bot className="h-3.5 w-3.5" />
            Realist API &amp; MCP server
          </Badge>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Bring your own AI. Realist does the underwriting.</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground leading-8">
            Connect Claude, Codex, Cursor, Grok, ChatGPT — or your own code — to the same engines that run realist.ca: live Canadian MLS®
            deal search, buy &amp; hold underwriting, rent estimates, Toronto multiplex modelling and market data. Your agent gets structured
            results. You get a link to an interactive spreadsheet, model or report in your browser.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/account/api-keys" data-testid="link-get-api-key">
                Get an API key
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" data-testid="link-openapi">OpenAPI spec</a>
            </Button>
          </div>
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">MCP endpoint (Streamable HTTP)</dt>
              <dd className="mt-1 font-mono break-all" data-testid="text-mcp-url">{REALIST_MCP_URL}</dd>
            </div>
            <div className="rounded-lg border p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">REST base URL</dt>
              <dd className="mt-1 font-mono break-all">{REALIST_API_BASE}</dd>
            </div>
          </dl>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-12 space-y-16">
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl md:text-3xl font-semibold">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {index + 1}</span>
                  </div>
                  <CardTitle className="text-base pt-2">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">{step.body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="connect">
          <h2 id="connect" className="text-2xl md:text-3xl font-semibold">Connect your agent</h2>
          <p className="mt-2 text-muted-foreground">
            Replace <code className="font-mono text-xs">realist_live_YOUR_KEY</code> with a key from{" "}
            <Link href="/account/api-keys" className="underline underline-offset-2">your account</Link> — that page shows these snippets with your key already filled in.
          </p>
          <div className="mt-6">
            <ConnectGuide />
          </div>
        </section>

        <section aria-labelledby="hosted-results">
          <h2 id="hosted-results" className="text-2xl md:text-3xl font-semibold">Results you can open, not just read</h2>
          <p className="mt-2 max-w-3xl text-muted-foreground leading-7">
            A chat window is a poor place for a 10-year pro forma. So tools that produce something worth seeing also return a{" "}
            <code className="font-mono text-xs">view.url</code> — a page on realist.ca your agent hands to you, the way a deploy tool hands
            you a preview link.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {VIEWS.map((view) => (
              <Card key={view.title}>
                <CardHeader className="pb-2">
                  <view.icon className="h-6 w-6 text-primary" />
                  <CardTitle className="text-base pt-2">{view.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">{view.body}</CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-6">
            View links are unlisted and unguessable: anyone you share one with can open it, nobody can discover it, and search engines are told
            not to index it. Delete one any time with <code className="font-mono text-xs">DELETE /api/v1/views/{"{token}"}</code>.
          </p>
        </section>

        <section aria-labelledby="tools">
          <h2 id="tools" className="text-2xl md:text-3xl font-semibold">Tools</h2>
          <p className="mt-2 text-muted-foreground">
            Served live from the registry the API runs on. Your agent only ever sees the tools your key's scopes allow.
          </p>
          <div className="mt-6">
            <ToolCatalog />
          </div>
        </section>

        <section aria-labelledby="rules" className="grid gap-4 md:grid-cols-3">
          <h2 id="rules" className="sr-only">Limits and safeguards</h2>
          <Card>
            <CardHeader className="pb-2">
              <Gauge className="h-6 w-6 text-primary" />
              <CardTitle className="text-base pt-2">Fair-use limits</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              60 calls a minute and 2,000 a day per key, shared across MCP and REST. Over the limit you get a{" "}
              <code className="font-mono text-xs">rate_limited</code> error with <code className="font-mono text-xs">retry_after_seconds</code>. Usage per key is on your API keys page.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Lock className="h-6 w-6 text-primary" />
              <CardTitle className="text-base pt-2">You stay in control</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Apps you sign in from never see your password or a key, and you can disconnect them any time. Keys and tokens are stored
              hashed. Posting to the community feed or contacting the Deal Desk needs explicit permission, and the tools tell your agent to ask you first.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-base pt-2">Honest numbers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-6">
              Every result lists which assumptions were estimated — especially rent — and rent estimates carry a confidence level. Outputs are
              screening estimates, not an appraisal or legal, tax or investment advice.
            </CardContent>
          </Card>
        </section>

        <section className="rounded-xl border border-primary/30 bg-primary/5 p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Ready when your agent is</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a key, paste one snippet, and ask for your first underwriting.</p>
          </div>
          <Button asChild size="lg" className="gap-2 shrink-0">
            <Link href="/account/api-keys">
              Get an API key
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
