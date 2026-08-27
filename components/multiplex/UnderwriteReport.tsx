"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtMoney, fmtNum, fmtPct, fmtSqft } from "./format";

/**
 * Renders the merged underwrite payload from POST /api/multiplex/underwrite
 * (status: "complete"). Typed structurally against the wire shape rather than
 * importing server modules — keep field names in sync with
 * lib/multiplex/underwriter.ts.
 */

type Prov<T> = { value: T; source: string; certainty: string };

interface RiskFlagWire {
  severity: string;
  message: string;
}

interface ConfigWire {
  config: {
    key: string;
    label: string;
    units: number;
    unitMix: Array<{ type: string; count: number }>;
    grossGfaSqft: number;
    netSqft: number;
    includesSuite: boolean;
    approvalPath: string;
    approvalCertainty: string;
    constraints: string[];
    flags: RiskFlagWire[];
  };
  varianceRisk: { level: string; score: number; factors: Array<{ reason: string }> };
  costs: {
    land: number;
    landTransferTax: number;
    hardCosts: number;
    softCosts: number;
    contingency: number;
    developmentCharges: number;
    financingCarry: number;
    totalDevCost: number;
    costPerUnit: number;
  };
  condoExit: { grossSellout: number; profit: number; marginOnCost: number };
  rentalHold: {
    noi: number;
    stabilizedValue: number;
    yieldOnCost: number;
    monthlyRentRoll: Array<{ type: string; count: number; rentEach: number }>;
  };
  residualLandValue: { condoPath: number; rentalPath: number };
  mli: {
    eligible: boolean;
    reason?: string;
    points: number;
    maxLoan: number;
    bindingConstraint: string;
    actualLtv: number;
    actualDscr: number;
    premiumPct: number;
    amortYears: number;
  };
  comparison: {
    condoProfit: number;
    holdAnnualCashFlow: number;
    holdCashOnCash: number | null;
    recommendedExit: string;
  };
  takeout: {
    condo: { form: string; profit: number; monthsToExit: number };
    hold: { eligible: boolean; equityLeftIn: number; annualCashFlow: number; cashOnCash: number | null; horizonProfit: number };
    decision: { recommended: string; reasons: string[] };
  };
}

interface ConceptWire {
  conceptId: string;
  title: string;
  form: string;
  summary: string;
  totalUnits: number;
  includesRearSuite: boolean;
  rearSuiteType: string | null;
  asOfRightStoreys: number;
  policyUpsideNote: string | null;
  sitePlan: {
    lotFrontageFt: number;
    lotDepthFt: number;
    laneDepthFt: number;
    setbacks: { frontFt: number; rearFt: number; sideFt: number };
    buildings: Array<{
      id: string;
      label: string;
      units: number;
      storeys: number;
      widthFt: number;
      depthFt: number;
      offsetLeftFt: number;
      offsetTopFt: number;
    }>;
  };
  sampleDrawing: { id: string; imagePath: string; altText: string; caption: string };
  caveats: string[];
}

interface DevelopmentReportWire {
  concepts: ConceptWire[];
  lotOutcomes?: LotOutcomeWire[];
  lot_outcomes?: LotOutcomeWire[];
  sampleProForma?: unknown;
  timeline?: TimelineWire;
}

interface LotOutcomeWire {
  frontageFt: number;
  typicalForm: string;
  noLaneUnits: number;
  laneUnits: number;
  depthRead: string;
  policyUpside: string;
  isCurrentBand: boolean;
}

interface TimelineWire {
  phases: Array<{ id?: string; label?: string; name?: string; months?: number; durationMonths?: number; category?: string; note?: string }>;
  totalMonths?: number;
}

export interface UnderwritePayload {
  status: "complete";
  id?: string;
  shareToken?: string;
  site: {
    address?: string;
    lat: number | null;
    lng: number | null;
    zoning: { zoneCode?: string; category?: string } | null;
    heritage: { listed: boolean };
    trca: { regulated: boolean };
    notes?: string[];
  };
  underwrite: {
    sixplex: { eligible: boolean; status: string; certainty: string };
    maxUnitsAsOfRight: number;
    envelope: {
      lotAreaSqft: Prov<number>;
      footprintSqft: Prov<number>;
      storeys: Prov<number>;
      maxHeightM: Prov<number>;
      theoreticalGfaSqft: Prov<number>;
      practicalGfaSqft: Prov<number>;
      haircutsApplied: Array<{ key: string; pct: number; reason: string }>;
      flags: RiskFlagWire[];
    };
    configs: ConfigWire[];
    winner: { flip: string | null; hold: string | null };
    recommendedTakeout: {
      configKey: string | null;
      takeout: string;
      score: number;
      formPreferenceApplied: boolean;
      reasons: string[];
    };
    assumptionNotes: string[];
    feasibility?: {
      quickRead: {
        headline: string;
        confidence: string;
        confidence_score: number;
        key_facts: string[];
        key_blockers: string[];
      };
      permissions: {
        effective_baseline_units: number;
        likely_range_label: string;
        approval_path: string;
        approval_notes: string[];
        garden_suite_possible: boolean;
        laneway_suite_possible: boolean;
      };
      transit: { status: string; summary: string };
      developmentReport: DevelopmentReportWire | null;
    };
    report: {
      siteSummary: string;
      zoningSummary: string;
      varianceNarrative: string;
      riskNarrative: string;
      recommendation: {
        bestPath: string;
        dealKillers: string[];
        verifyWithProfessionals: string[];
        nextSteps: string[];
      };
    };
    reportSource: "ai" | "template";
  };
  disclaimer: string;
}

const TAKEOUT_LABEL: Record<string, string> = {
  condo: "Condo exit",
  hold: "MLI Select hold",
  neither: "Needs work",
};

function RiskBadge({ level }: { level: string }) {
  const tone =
    level === "low"
      ? "bg-brand-wash text-brand-deep"
      : level === "medium"
        ? "bg-signal-wash text-signal"
        : "bg-red-100 text-bad";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
      {level} variance risk
    </span>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="tnum font-display mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

function mixLabel(mix: Array<{ type: string; count: number }>): string {
  return mix
    .map((m) => `${m.count}×${m.type.replace("bed", "BR").replace("bachelor", "Studio")}`)
    .join(" · ");
}

function SitePlanSvg({ plan }: { plan: ConceptWire["sitePlan"] }) {
  const scale = 220 / Math.max(plan.lotDepthFt, 1);
  const width = plan.lotFrontageFt * scale;
  const height = plan.lotDepthFt * scale;
  return (
    <svg
      viewBox={`-8 -8 ${width + 16} ${height + 30}`}
      className="h-auto w-full max-w-[220px]"
      role="img"
      aria-label="Site plan diagram"
    >
      <rect x={0} y={0} width={width} height={height} fill="var(--color-paper)" stroke="var(--color-hairline-strong)" strokeWidth="1.5" />
      {plan.buildings.map((b) => (
        <g key={b.id}>
          <rect
            x={b.offsetLeftFt * scale}
            y={b.offsetTopFt * scale}
            width={b.widthFt * scale}
            height={b.depthFt * scale}
            fill="var(--color-brand-wash)"
            stroke="var(--color-brand)"
            strokeWidth="1.5"
          />
          <text
            x={(b.offsetLeftFt + b.widthFt / 2) * scale}
            y={(b.offsetTopFt + b.depthFt / 2) * scale}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="var(--color-brand-deep)"
            fontWeight="600"
          >
            {b.units}u·{b.storeys}st
          </text>
        </g>
      ))}
      <text x={width / 2} y={height + 14} textAnchor="middle" fontSize="8.5" fill="var(--color-ink-faint)">
        {Math.round(plan.lotFrontageFt)} ft × {Math.round(plan.lotDepthFt)} ft · street at top
      </text>
    </svg>
  );
}

function ConceptBoard({ concept }: { concept: ConceptWire }) {
  const [imageBroken, setImageBroken] = useState(false);
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-lg font-semibold">{concept.title}</h4>
          <p className="mt-1 text-sm text-ink-soft">{concept.summary}</p>
        </div>
        <span className="tnum shrink-0 rounded-lg bg-brand px-2.5 py-1 text-sm font-bold text-white">
          {concept.totalUnits} units
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_220px]">
        {!imageBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={concept.sampleDrawing.imagePath}
            alt={concept.sampleDrawing.altText}
            className="w-full rounded-lg border border-hairline object-cover"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-paper p-4 text-center">
            <p className="text-xs font-semibold text-ink-faint">
              {concept.form} · {concept.asOfRightStoreys} storeys
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Sample board rendering coming soon
            </p>
          </div>
        )}
        <SitePlanSvg plan={concept.sitePlan} />
      </div>
      {concept.policyUpsideNote && (
        <p className="mt-3 rounded-md bg-brand-wash/60 px-3 py-2 text-xs text-brand-deep">
          {concept.policyUpsideNote}
        </p>
      )}
      {concept.caveats.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-faint">
          {concept.caveats.slice(0, 3).map((caveat) => (
            <li key={caveat}>· {caveat}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfigCard({
  item,
  isFlipWinner,
  isHoldWinner,
  isRecommended,
}: {
  item: ConfigWire;
  isFlipWinner: boolean;
  isHoldWinner: boolean;
  isRecommended: boolean;
}) {
  const [open, setOpen] = useState(isRecommended);
  const decision = item.takeout.decision.recommended;
  return (
    <div
      className={`rounded-xl border p-5 ${
        isRecommended ? "border-brand/50 bg-brand-wash/30" : "border-hairline bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display text-lg font-semibold">{item.config.label}</h4>
            {isRecommended && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Recommended
              </span>
            )}
            {isFlipWinner && !isRecommended && (
              <span className="rounded-full bg-signal-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-signal">
                Best flip
              </span>
            )}
            {isHoldWinner && !isRecommended && (
              <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-deep">
                Best hold
              </span>
            )}
          </div>
          <p className="tnum mt-1 text-sm text-ink-soft">
            {item.config.units} units · {mixLabel(item.config.unitMix)} ·{" "}
            {fmtSqft(item.config.netSqft)} net
          </p>
        </div>
        <RiskBadge level={item.varianceRisk.level} />
      </div>

      <div className="tnum mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">All-in cost</p>
          <p className="font-semibold">{fmtMoney(item.costs.totalDevCost, true)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Condo profit</p>
          <p className={`font-semibold ${item.condoExit.profit >= 0 ? "text-good" : "text-bad"}`}>
            {fmtMoney(item.condoExit.profit, true)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">NOI / yield-on-cost</p>
          <p className="font-semibold">
            {fmtMoney(item.rentalHold.noi, true)} · {fmtPct(item.rentalHold.yieldOnCost)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">MLI Select</p>
          <p className="font-semibold">
            {item.mli.eligible
              ? `${fmtMoney(item.mli.maxLoan, true)} loan · DSCR ${item.mli.actualDscr.toFixed(2)}`
              : "Under 5 units"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-ink-faint">
          Exit call: <span className="font-semibold text-ink-soft">{TAKEOUT_LABEL[decision] ?? decision}</span>
          {item.takeout.decision.reasons[0] ? ` — ${item.takeout.decision.reasons[0]}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-semibold text-brand hover:text-brand-deep"
        >
          {open ? "Hide detail" : "Full detail"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-5 border-t border-hairline pt-4 md:grid-cols-2">
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Cost stack</h5>
            <table className="tnum mt-2 w-full text-sm">
              <tbody>
                {([
                  ["Land", item.costs.land],
                  ["Land transfer tax", item.costs.landTransferTax],
                  ["Hard costs", item.costs.hardCosts],
                  ["Soft costs", item.costs.softCosts],
                  ["Contingency", item.costs.contingency],
                  ["Development charges", item.costs.developmentCharges],
                  ["Financing carry", item.costs.financingCarry],
                ] as const).map(([label, value]) => (
                  <tr key={label} className="border-b border-hairline/60">
                    <td className="py-1 pr-2 text-ink-soft">{label}</td>
                    <td className="py-1 text-right">{fmtMoney(value)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 pr-2 font-semibold">Total ({fmtMoney(item.costs.costPerUnit, true)}/unit)</td>
                  <td className="py-1.5 text-right font-semibold">{fmtMoney(item.costs.totalDevCost)}</td>
                </tr>
              </tbody>
            </table>
            <h5 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Residual land value
            </h5>
            <p className="tnum mt-1 text-sm text-ink-soft">
              Condo path {fmtMoney(item.residualLandValue.condoPath, true)} · rental path{" "}
              {fmtMoney(item.residualLandValue.rentalPath, true)}
            </p>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Rent roll</h5>
            <table className="tnum mt-2 w-full text-sm">
              <tbody>
                {item.rentalHold.monthlyRentRoll.map((row) => (
                  <tr key={row.type} className="border-b border-hairline/60">
                    <td className="py-1 pr-2 text-ink-soft">
                      {row.count}× {row.type}
                    </td>
                    <td className="py-1 text-right">{fmtMoney(row.rentEach)}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h5 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Hold economics
            </h5>
            <dl className="tnum mt-1 space-y-1 text-sm text-ink-soft">
              <div className="flex justify-between">
                <dt>Stabilized value</dt>
                <dd>{fmtMoney(item.rentalHold.stabilizedValue, true)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Annual cash flow</dt>
                <dd className={item.comparison.holdAnnualCashFlow >= 0 ? "text-good" : "text-bad"}>
                  {fmtMoney(item.comparison.holdAnnualCashFlow)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Cash-on-cash</dt>
                <dd>{item.comparison.holdCashOnCash != null ? fmtPct(item.comparison.holdCashOnCash) : "—"}</dd>
              </div>
              {item.mli.eligible && (
                <>
                  <div className="flex justify-between">
                    <dt>MLI points / amort</dt>
                    <dd>
                      {item.mli.points} pts · {item.mli.amortYears} yr
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>CMHC premium</dt>
                    <dd>{fmtPct(item.mli.premiumPct / 100, 2)}</dd>
                  </div>
                </>
              )}
            </dl>
            {item.config.flags.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ink-faint">
                {item.config.flags.slice(0, 4).map((flag) => (
                  <li key={flag.message}>⚠ {flag.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function UnderwriteReport({ payload }: { payload: UnderwritePayload }) {
  const { underwrite: u, site } = payload;
  const feasibility = u.feasibility;
  const devReport = feasibility?.developmentReport ?? null;
  const recommendedConfig = u.configs.find(
    (c) => c.config.key === u.recommendedTakeout.configKey,
  );
  const [copied, setCopied] = useState(false);

  const shareUrl =
    payload.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/multiplex/r/${payload.shareToken}`
      : null;

  return (
    <div className="space-y-8">
      {/* Verdict band */}
      <section className="rounded-xl border border-brand/40 bg-brand-wash/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Verdict</p>
            <h3 className="font-display mt-1 text-2xl font-semibold">
              {recommendedConfig
                ? `${recommendedConfig.config.label} · ${TAKEOUT_LABEL[u.recommendedTakeout.takeout] ?? u.recommendedTakeout.takeout}`
                : feasibility?.quickRead.headline ?? "Screening complete"}
            </h3>
            {u.recommendedTakeout.reasons[0] && (
              <p className="mt-1 max-w-2xl text-sm text-ink-soft">{u.recommendedTakeout.reasons[0]}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="tnum rounded-lg bg-ink px-3 py-1.5 text-lg font-bold text-paper">
              {fmtMoney(u.recommendedTakeout.score, true)}
            </span>
            <span className="text-[11px] text-ink-faint">projected profit, recommended path</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-surface px-2.5 py-1 text-ink-soft">
            Up to {u.maxUnitsAsOfRight} units as-of-right
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${
              u.sixplex.eligible ? "bg-brand text-white" : "bg-surface text-ink-soft"
            }`}
          >
            Sixplex {u.sixplex.eligible ? "eligible" : "not as-of-right"} · {u.sixplex.certainty}
          </span>
          {site.heritage.listed && (
            <span className="rounded-full bg-signal-wash px-2.5 py-1 text-signal">Heritage listed</span>
          )}
          {site.trca.regulated && (
            <span className="rounded-full bg-signal-wash px-2.5 py-1 text-signal">TRCA regulated</span>
          )}
          {feasibility && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-ink-soft">
              Confidence: {feasibility.quickRead.confidence}
            </span>
          )}
        </div>
      </section>

      {/* Narrative */}
      <section>
        <h3 className="font-display text-xl font-semibold">The read</h3>
        <div className="prose-notes mt-2 max-w-3xl text-[15px]">
          <p>{u.report.siteSummary}</p>
          <p>{u.report.zoningSummary}</p>
          <p>{u.report.varianceNarrative}</p>
          <p>{u.report.riskNarrative}</p>
        </div>
        {u.reportSource === "template" && (
          <p className="mt-1 text-xs text-ink-faint">Deterministic narrative (AI writer unavailable).</p>
        )}
      </section>

      {/* Envelope stats */}
      <section>
        <h3 className="font-display text-xl font-semibold">Buildable envelope</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCell label="Lot area" value={fmtSqft(u.envelope.lotAreaSqft.value)} sub={u.envelope.lotAreaSqft.source} />
          <StatCell
            label="Footprint"
            value={fmtSqft(u.envelope.footprintSqft.value)}
            sub={`${u.envelope.storeys.value} storeys · ${fmtNum(u.envelope.maxHeightM.value, 1)} m`}
          />
          <StatCell label="Theoretical GFA" value={fmtSqft(u.envelope.theoreticalGfaSqft.value)} />
          <StatCell
            label="Practical GFA"
            value={fmtSqft(u.envelope.practicalGfaSqft.value)}
            sub={u.envelope.haircutsApplied.map((h) => h.key).join(", ") || undefined}
          />
        </div>
      </section>

      {/* Configurations */}
      <section>
        <h3 className="font-display text-xl font-semibold">Build configurations</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Every configuration the envelope supports, each underwritten to both exits.
        </p>
        <div className="mt-4 space-y-4">
          {u.configs.map((item) => (
            <ConfigCard
              key={item.config.key}
              item={item}
              isFlipWinner={u.winner.flip === item.config.key}
              isHoldWinner={u.winner.hold === item.config.key}
              isRecommended={u.recommendedTakeout.configKey === item.config.key}
            />
          ))}
        </div>
      </section>

      {/* Concepts */}
      {devReport && devReport.concepts?.length > 0 && (
        <section>
          <h3 className="font-display text-xl font-semibold">What fits on this lot</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Massing concepts matched to your frontage, depth, and lane access.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {devReport.concepts.map((concept) => (
              <ConceptBoard key={concept.conceptId} concept={concept} />
            ))}
          </div>
        </section>
      )}

      {/* Recommendation */}
      <section className="rounded-xl border border-hairline bg-surface p-6">
        <h3 className="font-display text-xl font-semibold">Recommended path</h3>
        <p className="prose-notes mt-2 text-[15px]">{u.report.recommendation.bestPath}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-bad">Deal killers to check</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
              {u.report.recommendation.dealKillers.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Verify with professionals
            </h4>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
              {u.report.recommendation.verifyWithProfessionals.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">Next steps</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
              {u.report.recommendation.nextSteps.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Assumption notes */}
      {u.assumptionNotes.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Assumption notes</h4>
          <ul className="mt-2 space-y-1 text-xs text-ink-faint">
            {u.assumptionNotes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA band */}
      <section className="rounded-xl bg-ink p-6 text-paper">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold">Want to actually build this?</h3>
            <p className="mt-1 max-w-xl text-sm text-paper/70">
              Buy the site with our partner team and get 50% of our commission back at
              closing — plus an intro to the lenders and builders who do these projects.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href={`/work-with-us?property=${encodeURIComponent(site.address ?? "")}`}
              className="rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Buy this with 50% cash-back
            </Link>
            {shareUrl && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="rounded-md border border-paper/30 px-4 py-2.5 text-sm font-semibold text-paper hover:bg-paper/10"
              >
                {copied ? "Link copied ✓" : "Share this report"}
              </button>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-ink-faint">{payload.disclaimer}</p>
    </div>
  );
}
