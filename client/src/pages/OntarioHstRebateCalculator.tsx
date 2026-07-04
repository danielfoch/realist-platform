import { FormEvent, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { NextStepBlock } from "@/components/NextStepBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  calculateHstRebate,
  formatCad,
  type PriceMode,
  type RebateCollector,
} from "@/lib/hstRebateCalculator";

const POLICY_URL =
  "https://www.pm.gc.ca/en/news/news-releases/2026/03/30/prime-minister-carney-secures-new-partnership-ontario-cut-taxes";
const CRA_URL =
  "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-rebates/first-time-home-buyers-gst-hst-rebate.html";

const roles = ["Buyer", "Realtor", "Builder", "Mortgage Broker", "Lawyer", "Other"];

function parsePrice(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tracking-normal ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function CollectorPanel({ collector }: { collector: RebateCollector }) {
  const buyer = collector === "buyer";
  const steps = buyer
    ? [
        "Save your agreement of purchase and sale",
        "Save your closing / adjustment documents",
        "Review final government guidance once released",
        "Complete the rebate application process when available",
      ]
    : [
        "Decide whether pricing is shown gross or net of expected rebate",
        "Collect any purchaser authorization/assignment documents if required",
        "Coordinate closing adjustments with legal/accounting teams",
        "Review final government guidance before standardizing process",
      ];

  return (
    <aside className="rounded-lg border bg-muted/50 p-6 md:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Who collects the rebate?</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">
        {buyer ? "If the buyer collects the rebate" : "If the builder collects or credits the rebate"}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
        {buyer ? (
          <>
            <p>Confirm final eligibility once legislation receives royal assent.</p>
            <p>Keep the APS, statement of adjustments, and closing documents.</p>
            <p>
              Expect the process to likely resemble the current GST/HST rebate workflow for homes purchased from a builder.
            </p>
            <p>
              The buyer may need to complete applicable CRA / Ontario forms after closing or as directed by their lawyer or builder.
            </p>
            <p>Watch for final published instructions before relying on this.</p>
          </>
        ) : (
          <>
            <p>Some builders may choose to price homes assuming the rebate is credited at closing.</p>
            <p>Others may leave pricing unchanged until final rules are confirmed.</p>
            <p>
              If builder-credit mechanics are allowed, the purchaser may need to sign forms or assign the rebate to the builder.
            </p>
            <p>
              Builders should coordinate with legal/accounting teams and use protective language if the policy changes before implementation.
            </p>
          </>
        )}
      </div>
      <h3 className="mt-6 text-sm font-semibold text-foreground">Likely next steps</h3>
      <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="font-mono text-muted-foreground">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
        This section is informational only and based on the current FTHB / GST-HST rebate framework. It is not legal or tax advice.
      </p>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <a className="font-medium text-foreground underline underline-offset-4" href={POLICY_URL} target="_blank" rel="noreferrer">
          Read the policy announcement
        </a>
        <a className="font-medium text-foreground underline underline-offset-4" href={CRA_URL} target="_blank" rel="noreferrer">
          Review the current CRA GST/HST rebate guidance
        </a>
      </div>
    </aside>
  );
}

export default function OntarioHstRebateCalculator() {
  const [salePrice, setSalePrice] = useState("550000");
  const [priceMode, setPriceMode] = useState<PriceMode>("includes_hst");
  const [collector, setCollector] = useState<RebateCollector>("buyer");
  const [copied, setCopied] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "Buyer",
  });

  const result = useMemo(
    () => calculateHstRebate(parsePrice(salePrice), priceMode),
    [priceMode, salePrice],
  );

  const summary = `Based on an estimated pre-HST home value of ${formatCad(result.basePrice)}, the projected rebate is ${formatCad(result.rebate)}, bringing the purchaser's effective price to ${formatCad(result.effectivePurchaserPrice)}.`;

  async function copyResult() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus("submitting");
    setErrorMessage("");

    try {
      await apiRequest("POST", "/api/hst-info-session/register", {
        tag: "HST info session",
        source: "OHBA x Realist HST Rebate Calculator",
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        company: form.company,
        role: form.role,
        currentSalePrice: result.enteredPrice,
        priceMode,
        rebateCollector: collector,
        estimatedSavings: Math.round(result.rebate),
        effectivePurchaserPrice: Math.round(result.effectivePurchaserPrice),
        timestamp: new Date().toISOString(),
      });
      setFormStatus("success");
    } catch (error) {
      setFormStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Submission failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Ontario New Home HST Rebate Calculator"
        description="Estimate Ontario new home HST rebate savings under the proposed 2026 relief policy. Calculate buyer savings and register for updates."
        canonicalUrl="/tools/hst-rebate"
      />

      <Navigation />

      <main>
        <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 gap-1.5 py-1">
              <img
                src="/ohba-logo.png"
                alt="Ontario Home Builders' Association"
                className="h-4 w-auto grayscale contrast-200 brightness-0 dark:invert"
              />
              OHBA × Realist
            </Badge>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ontario new homes</p>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">
              Ontario New Home HST Rebate Calculator
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Estimate how much a buyer could save under the proposed Ontario HST relief policy for new homes.
            </p>
            <div className="mt-6 rounded-md border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
              Prototype only. Based on the March 30, 2026 federal/Ontario announcement and current CRA rebate mechanics.
              Final rules may change pending royal assent and formal implementation guidance.
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-12 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] md:px-8">
          <div className="rounded-lg border bg-card p-5 shadow-sm md:p-7">
            <div className="flex flex-col justify-between gap-3 border-b pb-5 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-semibold">Calculate estimated buyer savings</h2>
                <p className="mt-2 text-sm text-muted-foreground">Default example uses a $550,000 current sale price.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setSalePrice("550000")}
              >
                Reset example
              </Button>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Current sale price</span>
                <span className="mt-2 flex items-center rounded-md border border-input bg-background px-4 py-3 focus-within:border-ring">
                  <span className="mr-2 font-mono text-muted-foreground">$</span>
                  <input
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    inputMode="decimal"
                    className="w-full bg-transparent font-mono text-xl outline-none"
                    aria-describedby="sale-price-help"
                  />
                </span>
                <span id="sale-price-help" className="mt-2 block text-xs text-muted-foreground">
                  Enter the purchaser-facing price or the pre-HST home value, then choose the price mode.
                </span>
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-foreground">Price mode</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ["includes_hst", "Entered price includes HST"],
                    ["excludes_hst", "Entered price excludes HST"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm ${
                        priceMode === value ? "border-primary bg-muted" : "bg-card"
                      }`}
                    >
                      <input
                        type="radio"
                        name="priceMode"
                        value={value}
                        checked={priceMode === value}
                        onChange={() => setPriceMode(value as PriceMode)}
                        className="h-4 w-4 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-foreground">Who collects the rebate?</legend>
                <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-md border">
                  {[
                    ["buyer", "Buyer"],
                    ["builder", "Builder"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCollector(value as RebateCollector)}
                      className={`px-4 py-3 text-sm font-medium ${
                        collector === value ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"
                      }`}
                      aria-pressed={collector === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Button type="button" onClick={() => setSalePrice(String(parsePrice(salePrice)))}>
                Calculate
              </Button>
            </div>

            <section className="mt-7 border-t pt-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Estimated buyer savings" value={formatCad(result.rebate)} accent />
                <Metric label="Effective purchaser price" value={formatCad(result.effectivePurchaserPrice)} />
                <Metric label="Home value used for calculation" value={formatCad(result.basePrice)} />
                <Metric label="Estimated HST before rebate" value={formatCad(result.estimatedHst)} />
              </div>
              <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Rebate path / policy band</p>
                <p className="mt-2 text-lg font-semibold">{result.policyBand}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">This estimate is based on public policy announcements and may change.</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={copyResult}>
                  {copied ? "Copied" : "Copy result"}
                </Button>
              </div>
            </section>
          </div>

          <CollectorPanel collector={collector} />
        </section>

        <div className="mx-auto max-w-6xl px-5 pb-12 md:px-8">
          <NextStepBlock sourcePage="/tools/hst-rebate" className="mt-8" />
        </div>

        <section className="border-y bg-muted/50">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[0.8fr_1.2fr] md:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Updates</p>
              <h2 className="mt-3 text-3xl font-semibold">Register for the HST Info Session</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Want updates when the final rules and process are confirmed? Register for the HST info session and we'll send you the details.
              </p>
            </div>

            <form onSubmit={handleRegistration} className="grid gap-4" aria-label="HST info session registration">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  First name
                  <input
                    required
                    value={form.firstName}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-3 outline-none focus:border-ring"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Last name
                  <input
                    required
                    value={form.lastName}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-3 outline-none focus:border-ring"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Email
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-3 outline-none focus:border-ring"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Company <span className="text-muted-foreground">(optional)</span>
                  <input
                    value={form.company}
                    onChange={(event) => setForm({ ...form, company: event.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-3 outline-none focus:border-ring"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Role
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-3 outline-none focus:border-ring"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={formStatus === "submitting" || formStatus === "success"}>
                {formStatus === "submitting" ? "Registering..." : "Register for HST Info Session"}
              </Button>
              {formStatus === "success" && (
                <p className="rounded-md border bg-card px-4 py-3 text-sm text-foreground">
                  You're registered. We'll send the HST info session details once available.
                </p>
              )}
              {formStatus === "error" && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs leading-5 text-muted-foreground md:px-8">
        <p>
          This calculator is a prototype for public education and planning. It is not tax, legal, accounting, or
          financial advice. Eligibility, application mechanics, builder credit treatment, and final rebate amounts may
          change after royal assent and formal government guidance.
        </p>
      </footer>
    </div>
  );
}
