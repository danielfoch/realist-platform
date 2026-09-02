import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame, Landmark, Save, Search, Target, TrendingUp } from "lucide-react";

/**
 * A stylised, static rendering of the deal analyzer inside a browser frame.
 * It is illustrative product UI (fixed sample numbers, no live data) so the
 * landing page never depends on the API being up to look finished.
 */

const METRICS = [
  { label: "Cap rate", value: "5.8%", tone: "good" },
  { label: "Cash flow", value: "+$420", unit: "/mo", tone: "good" },
  { label: "DSCR", value: "1.18x", tone: "warn" },
  { label: "Cash-on-cash", value: "7.9%", tone: "good" },
] as const;

const ASSUMPTIONS = [
  ["Price", "$749,000"],
  ["Rent", "$3,850 /mo"],
  ["Rate", "4.39% · 5-yr fixed"],
  ["Down", "20% · $149,800"],
  ["Vacancy", "3%"],
] as const;

/** 10-year equity build, in $k — a gently accelerating curve. */
const EQUITY = [150, 168, 188, 210, 234, 260, 289, 320, 354, 391];

export function ProductFrame({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(...EQUITY);

  return (
    <motion.div
      className={`relative mx-auto w-full max-w-5xl ${className}`}
      initial={reduce ? false : { opacity: 0, y: 48, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
      data-testid="landing-product-frame"
    >
      {/* Glow under the frame */}
      <div
        className="pointer-events-none absolute -inset-x-10 -bottom-10 top-10 -z-10 rounded-[40px] blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 40%, hsl(356 100% 62% / 0.28), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[hsl(222_40%_9%)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-black/60">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[hsl(222_38%_11%)] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center gap-1.5 rounded-md bg-black/30 text-[11px] text-white/50">
            <span className="h-2.5 w-2.5 rounded-sm border border-white/30" aria-hidden="true" />
            realist.ca/tools/analyzer
          </div>
          <span className="w-12" aria-hidden="true" />
        </div>

        <div className="grid gap-px bg-white/5 md:grid-cols-[1.35fr_1fr]">
          {/* Left: analysis */}
          <div className="bg-[hsl(222_40%_9%)] p-4 sm:p-6">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
              <span className="truncate text-sm text-white/85">24 Barton St E, Hamilton, ON</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                Analyze
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="font-semibold text-emerald-200">Strong buy-and-hold candidate</span>
              <span className="text-white/50">· duplex · investor score</span>
              <span className="ml-auto font-mono text-base font-bold tabular-nums text-emerald-200">84</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METRICS.map((m, i) => (
                <motion.div
                  key={m.label}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08, duration: 0.5 }}
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{m.label}</dt>
                  <dd
                    className={`mt-1 font-mono text-lg font-bold tabular-nums ${m.tone === "good" ? "text-white" : "text-amber-300"}`}
                  >
                    {m.value}
                    {"unit" in m && <span className="text-xs font-medium text-white/45">{m.unit}</span>}
                  </dd>
                </motion.div>
              ))}
            </dl>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">10-year equity</p>
                <p className="font-mono text-xs tabular-nums text-white/70">
                  $150k <span className="text-white/35">→</span> $391k
                </p>
              </div>
              <div className="mt-2 flex h-16 items-end gap-1" aria-hidden="true">
                {EQUITY.map((v, i) => (
                  <motion.span
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-primary/70 to-primary"
                    style={{ height: `${(v / max) * 100}%`, transformOrigin: "bottom" }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 1 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: assumptions + next steps */}
          <div className="bg-[hsl(222_40%_9%)] p-4 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Assumptions</p>
            <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
              {ASSUMPTIONS.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between py-1.5">
                  <span className="text-white/55">{k}</span>
                  <span className="font-mono text-xs tabular-nums text-white/85 sm:text-sm">{v}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Next steps</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[
                { icon: Target, label: "Send an inspector" },
                { icon: Landmark, label: "Get pre-approved with Nick" },
                { icon: Save, label: "Save to buy box" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-white/80">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-white/40">
              <Flame className="h-3 w-3 text-primary" aria-hidden="true" />
              Realist learned your buy box from 14 prior deals.
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
