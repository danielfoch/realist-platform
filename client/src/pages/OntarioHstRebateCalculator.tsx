import { FormEvent, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { NextStepBlock } from "@/components/NextStepBlock";
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
    <div className="border border-[#E6E2DC] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-normal ${accent ? "text-[#D71920]" : "text-[#050505]"}`}
        style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}
      >
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
    <aside className="border border-[#E6E2DC] bg-[#F6F4F1] p-6 md:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#737373]">Who collects the rebate?</p>
      <h2 className="mt-3 text-2xl font-semibold text-[#050505]">
        {buyer ? "If the buyer collects the rebate" : "If the builder collects or credits the rebate"}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-[#363636]">
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
      <h3 className="mt-6 text-sm font-semibold text-[#050505]">Likely next steps</h3>
      <ol className="mt-3 space-y-2 text-sm leading-6 text-[#363636]">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="text-[#737373]" style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}>
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-[#E6E2DC] pt-4 text-xs leading-5 text-[#737373]">
        This section is informational only and based on the current FTHB / GST-HST rebate framework. It is not legal or tax advice.
      </p>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <a className="font-medium text-[#050505] underline underline-offset-4" href={POLICY_URL} target="_blank" rel="noreferrer">
          Read the policy announcement
        </a>
        <a className="font-medium text-[#050505] underline underline-offset-4" href={CRA_URL} target="_blank" rel="noreferrer">
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
    <div className="min-h-screen bg-white text-[#050505]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <SEO
        title="Ontario New Home HST Rebate Calculator"
        description="Estimate Ontario new home HST rebate savings under the proposed 2026 relief policy. Calculate buyer savings and register for updates."
        canonicalUrl="/tools/hst-rebate"
      />

      <Navigation />
      <header className="border-b border-[#E6E2DC] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-5 py-4 md:px-8">
          <img
            src="/ohba-logo.png"
            alt="Ontario Home Builders' Association"
            className="h-9 w-auto grayscale contrast-200 brightness-0"
          />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D71920]">Ontario new homes</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-[#050505] md:text-6xl">
              Ontario New Home HST Rebate Calculator
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4a4a4a]">
              Estimate how much a buyer could save under the proposed Ontario HST relief policy for new homes.
            </p>
            <div className="mt-6 border border-[#E6E2DC] bg-[#F6F4F1] px-4 py-3 text-sm leading-6 text-[#363636]">
              Prototype only. Based on the March 30, 2026 federal/Ontario announcement and current CRA rebate mechanics.
              Final rules may change pending royal assent and formal implementation guidance.
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-12 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] md:px-8">
          <div className="border border-[#E6E2DC] bg-white p-5 shadow-[0_10px_30px_rgba(5,5,5,0.04)] md:p-7">
            <div className="flex flex-col justify-between gap-3 border-b border-[#E6E2DC] pb-5 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-semibold">Calculate estimated buyer savings</h2>
                <p className="mt-2 text-sm text-[#737373]">Default example uses a $550,000 current sale price.</p>
              </div>
              <button
                type="button"
                onClick={() => setSalePrice("550000")}
                className="self-start border border-[#E6E2DC] px-3 py-2 text-sm font-medium text-[#050505] hover:bg-[#F6F4F1]"
              >
                Reset example
              </button>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-sm font-medium text-[#050505]">Current sale price</span>
                <span className="mt-2 flex items-center border border-[#E6E2DC] bg-white px-4 py-3 focus-within:border-[#050505]">
                  <span className="mr-2 text-[#737373]" style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}>
                    $
                  </span>
                  <input
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    inputMode="decimal"
                    className="w-full bg-transparent text-xl outline-none"
                    style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}
                    aria-describedby="sale-price-help"
                  />
                </span>
                <span id="sale-price-help" className="mt-2 block text-xs text-[#737373]">
                  Enter the purchaser-facing price or the pre-HST home value, then choose the price mode.
                </span>
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-[#050505]">Price mode</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ["includes_hst", "Entered price includes HST"],
                    ["excludes_hst", "Entered price excludes HST"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-sm ${
                        priceMode === value ? "border-[#050505] bg-[#F6F4F1]" : "border-[#E6E2DC] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="priceMode"
                        value={value}
                        checked={priceMode === value}
                        onChange={() => setPriceMode(value as PriceMode)}
                        className="h-4 w-4 accent-[#D71920]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-[#050505]">Who collects the rebate?</legend>
                <div className="mt-2 grid grid-cols-2 border border-[#E6E2DC]">
                  {[
                    ["buyer", "Buyer"],
                    ["builder", "Builder"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCollector(value as RebateCollector)}
                      className={`px-4 py-3 text-sm font-medium ${
                        collector === value ? "bg-[#050505] text-white" : "bg-white text-[#050505] hover:bg-[#F6F4F1]"
                      }`}
                      aria-pressed={collector === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={() => setSalePrice(String(parsePrice(salePrice)))}
                className="bg-[#D71920] px-5 py-3 text-sm font-semibold text-white hover:bg-[#b9151b] focus:outline-none focus:ring-2 focus:ring-[#D71920] focus:ring-offset-2"
              >
                Calculate
              </button>
            </div>

            <section className="mt-7 border-t border-[#E6E2DC] pt-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Estimated buyer savings" value={formatCad(result.rebate)} accent />
                <Metric label="Effective purchaser price" value={formatCad(result.effectivePurchaserPrice)} />
                <Metric label="Home value used for calculation" value={formatCad(result.basePrice)} />
                <Metric label="Estimated HST before rebate" value={formatCad(result.estimatedHst)} />
              </div>
              <div className="mt-4 border border-[#E6E2DC] bg-[#F6F4F1] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#737373]">Rebate path / policy band</p>
                <p className="mt-2 text-lg font-semibold">{result.policyBand}</p>
                <p className="mt-3 text-sm leading-6 text-[#363636]">{summary}</p>
                <p className="mt-2 text-xs text-[#737373]">This estimate is based on public policy announcements and may change.</p>
                <button
                  type="button"
                  onClick={copyResult}
                  className="mt-4 border border-[#050505] px-3 py-2 text-sm font-medium text-[#050505] hover:bg-white"
                >
                  {copied ? "Copied" : "Copy result"}
                </button>
              </div>
            </section>
          </div>

          <CollectorPanel collector={collector} />
        </section>

        <div className="mx-auto max-w-6xl px-5 pb-12 md:px-8">
          <NextStepBlock sourcePage="/tools/hst-rebate" className="mt-8" />
        </div>

        <section className="border-y border-[#E6E2DC] bg-[#F6F4F1]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[0.8fr_1.2fr] md:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D71920]">Updates</p>
              <h2 className="mt-3 text-3xl font-semibold">Register for the HST Info Session</h2>
              <p className="mt-4 text-sm leading-6 text-[#4a4a4a]">
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
                    className="border border-[#E6E2DC] bg-white px-3 py-3 outline-none focus:border-[#050505]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Last name
                  <input
                    required
                    value={form.lastName}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    className="border border-[#E6E2DC] bg-white px-3 py-3 outline-none focus:border-[#050505]"
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
                    className="border border-[#E6E2DC] bg-white px-3 py-3 outline-none focus:border-[#050505]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Company <span className="text-[#737373]">(optional)</span>
                  <input
                    value={form.company}
                    onChange={(event) => setForm({ ...form, company: event.target.value })}
                    className="border border-[#E6E2DC] bg-white px-3 py-3 outline-none focus:border-[#050505]"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Role
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="border border-[#E6E2DC] bg-white px-3 py-3 outline-none focus:border-[#050505]"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={formStatus === "submitting" || formStatus === "success"}
                className="bg-[#D71920] px-5 py-3 text-sm font-semibold text-white hover:bg-[#b9151b] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formStatus === "submitting" ? "Registering..." : "Register for HST Info Session"}
              </button>
              {formStatus === "success" && (
                <p className="border border-[#E6E2DC] bg-white px-4 py-3 text-sm text-[#050505]">
                  You're registered. We'll send the HST info session details once available.
                </p>
              )}
              {formStatus === "error" && (
                <p className="border border-[#D71920] bg-white px-4 py-3 text-sm text-[#D71920]">{errorMessage}</p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs leading-5 text-[#737373] md:px-8">
        <p>
          This calculator is a prototype for public education and planning. It is not tax, legal, accounting, or
          financial advice. Eligibility, application mechanics, builder credit treatment, and final rebate amounts may
          change after royal assent and formal government guidance.
        </p>
      </footer>
    </div>
  );
}
