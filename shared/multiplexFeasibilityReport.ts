/**
 * Concept-level development report for the public multiplex feasibility tool.
 *
 * The planning engine decides what may be permitted. This module turns that
 * decision into one internally consistent sample project: a dimensioned massing
 * diagram, a deterministic pro forma, and a project schedule. It deliberately
 * keeps the site plan code-native and pairs it with a pre-generated sample
 * drawing board for the nearest common lot configuration.
 */

import {
  DEV_ASSUMPTION_DEFAULTS,
  computeCostStack,
  computeRentalHold,
  computeResidualLandValue,
  type DevAssumptions,
} from "./multiplexProForma";
import type { BuildConfiguration } from "./multiplexConfigs";
import {
  selectMultiplexConceptSample,
  type MultiplexConceptSample,
} from "./multiplexConceptLibrary";
import { computeMliTakeout, scoreMliPoints } from "./mliSelect";
import type { UnitMixEntry, UnitType } from "./multiplexTypes";

export type ReportTransitStatus =
  | "unknown"
  | "outside"
  | "likely_mtsa_inferred"
  | "mtsa"
  | "pmtsa";

export interface DevelopmentReportInput {
  municipality: string;
  frontageFt: number | null;
  depthFt: number | null;
  lotAreaSqft: number | null;
  coverageRatio: number;
  practicalGfaSqft: number | null;
  asOfRightStoreys: number;
  policyStoreys: number | null;
  effectiveBaselineUnits: number;
  sixUnitStatus: "not_applicable" | "possible_unverified" | "more_likely_area";
  laneAccess: boolean;
  gardenSuitePossible: boolean;
  lanewaySuitePossible: boolean;
  majorStreet: boolean;
  transitStatus: ReportTransitStatus;
  approvalPath:
    | "as_of_right"
    | "minor_variance_likely"
    | "rezoning_required"
    | "complex"
    | "unknown";
  purchasePrice?: number | null;
  hardCostPsf?: number | null;
}

export interface ConceptBuilding {
  id: "main" | "rear_suite";
  label: string;
  units: number;
  storeys: number;
  widthFt: number;
  depthFt: number;
  offsetLeftFt: number;
  offsetTopFt: number;
  footprintSqft: number;
}

export interface DevelopmentConcept {
  conceptId: string;
  title: string;
  form: string;
  summary: string;
  widthBand: "25_ft" | "30_ft" | "40_ft" | "50_ft";
  depthBand: "shallow" | "standard" | "deep" | "extra_deep";
  principalUnits: number;
  totalUnits: number;
  includesRearSuite: boolean;
  rearSuiteType: "laneway" | "garden" | null;
  asOfRightStoreys: number;
  policyUpsideStoreys: number | null;
  policyUpsideNote: string | null;
  sitePlan: {
    lotFrontageFt: number;
    lotDepthFt: number;
    streetEdge: "front";
    laneDepthFt: number;
    setbacks: {
      frontFt: number;
      rearFt: number;
      sideFt: number;
      buildingSeparationFt: number;
      basis: "concept_assumption";
    };
    buildings: ConceptBuilding[];
    walkwaySide: "left" | "right";
    drivewayShown: boolean;
    calculatedCoverageRatio: number;
    allowedCoverageRatio: number;
  };
  sampleDrawing: MultiplexConceptSample;
  caveats: string[];
}

export interface LotOutcomeRow {
  frontageFt: 25 | 30 | 40 | 50;
  typicalForm: string;
  noLaneUnits: number;
  laneUnits: number;
  depthRead: string;
  policyUpside: string;
  isCurrentBand: boolean;
}

export interface SampleProForma {
  basis: "illustrative";
  landPriceProvided: boolean;
  configuration: {
    label: string;
    units: number;
    grossGfaSqft: number;
    netRentableSqft: number;
    unitMix: UnitMixEntry[];
  };
  assumptions: {
    hardCostPsf: number;
    softCostPct: number;
    contingencyPct: number;
    constructionLoanRate: number;
    constructionLoanToCost: number;
    constructionMonths: number;
    vacancyPct: number;
    operatingExpensePct: number;
    exitCapRate: number;
    mliInterestRate: number;
    mliPoints: number;
    source: string;
    lastVerified: string;
  };
  costs: {
    purchasePrice: number | null;
    landTransferTax: number;
    hardCosts: number;
    softCosts: number;
    contingency: number;
    developmentCharges: number;
    financingCarry: number;
    totalDevelopmentCost: number;
    totalBeforeLand: number;
    costPerUnit: number;
  };
  sourcesAndUses: {
    constructionLoan: number;
    equityRequired: number;
    loanToCost: number;
    cmhcTakeoutLoan: number | null;
    cmhcPremium: number | null;
    equityRemainingAfterTakeout: number | null;
  };
  operations: {
    grossPotentialRent: number;
    effectiveGrossIncome: number;
    operatingExpenses: number;
    stabilizedNoi: number;
    stabilizedValue: number;
    yieldOnCost: number;
    averageMonthlyRentPerUnit: number;
  };
  cmhcTakeout: {
    eligible: boolean;
    reason: string | null;
    points: number;
    amortYears: number | null;
    maxLoan: number | null;
    premiumPct: number | null;
    premiumDollars: number | null;
    dscr: number | null;
    bindingConstraint: "ltv" | "dscr" | null;
  };
  residualLandValue: {
    condoPath: number;
    rentalPath: number;
  };
  notes: string[];
}

export type TimelineCategory =
  | "acquisition"
  | "design_approvals"
  | "financing"
  | "construction"
  | "lease_up"
  | "takeout";

export interface ProjectTimelinePhase {
  id: string;
  category: TimelineCategory;
  label: string;
  startMonth: number;
  endMonth: number;
  durationMonths: number;
  dependencies: string[];
  components: string[];
  critical: boolean;
}

export interface ProjectTimelineMilestone {
  id: string;
  label: string;
  month: number;
  category: TimelineCategory;
}

export interface ProjectTimeline {
  totalMonths: number;
  phases: ProjectTimelinePhase[];
  milestones: ProjectTimelineMilestone[];
  criticalPath: string[];
  notes: string[];
}

export interface MultiplexDevelopmentReport {
  concept: DevelopmentConcept;
  outcomeMatrix: LotOutcomeRow[];
  proForma: SampleProForma;
  timeline: ProjectTimeline;
}

const MLI_RATE = 0.045;
const MLI_DEFAULT_COMMITMENTS = {
  affordabilityLevel: 1,
  energyLevel: 1,
  accessibilityLevel: 0,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function widthBand(frontage: number): DevelopmentConcept["widthBand"] {
  if (frontage < 28) return "25_ft";
  if (frontage < 36) return "30_ft";
  if (frontage < 46) return "40_ft";
  return "50_ft";
}

function depthBand(depth: number): DevelopmentConcept["depthBand"] {
  if (depth < 105) return "shallow";
  if (depth < 130) return "standard";
  if (depth < 150) return "deep";
  return "extra_deep";
}

function formForWidth(band: DevelopmentConcept["widthBand"], units: number): string {
  if (band === "25_ft") return units >= 4 ? "narrow stacked multiplex" : "stacked triplex";
  if (band === "30_ft") return units >= 5 ? "central-core apartment multiplex" : "stacked fourplex";
  if (band === "40_ft") return units >= 5 ? "side-by-side sixplex form" : "semi-detached fourplex form";
  return units >= 6 ? "wide-lot courtyard multiplex" : "side-by-side family multiplex";
}

function approvalPathForConfig(path: DevelopmentReportInput["approvalPath"]): BuildConfiguration["approvalPath"] {
  if (path === "as_of_right") return "as_of_right";
  if (path === "rezoning_required" || path === "complex") return "rezoning";
  return "minor_variance";
}

function capacityForGfa(netGfa: number): number {
  // A feasibility concept can include compact units, but never assumes less
  // than roughly 425 net sqft per home.
  return Math.max(2, Math.floor(netGfa / 425));
}

function buildUnitMix(units: number, netBudget: number): UnitMixEntry[] {
  const counts: Record<UnitType, number> = {
    bachelor: 0,
    "1br": 0,
    "2br": 0,
    "3br": 0,
  };

  if (units >= 4) counts["3br"] = 1;
  const remaining = units - counts["3br"];
  counts["2br"] = Math.floor(remaining / 2);
  counts["1br"] = remaining - counts["2br"];

  const weights: Record<UnitType, number> = {
    bachelor: 0.75,
    "1br": 0.9,
    "2br": 1.1,
    "3br": 1.3,
  };
  const weightedUnits = (Object.keys(counts) as UnitType[]).reduce(
    (sum, type) => sum + counts[type] * weights[type],
    0,
  );
  const baseSize = weightedUnits > 0 ? netBudget / weightedUnits : 0;
  const sizes: Record<UnitType, number> = {
    bachelor: Math.max(350, Math.floor(baseSize * weights.bachelor)),
    "1br": Math.max(425, Math.floor(baseSize * weights["1br"])),
    "2br": Math.max(525, Math.floor(baseSize * weights["2br"])),
    "3br": Math.max(650, Math.floor(baseSize * weights["3br"])),
  };

  let total = (Object.keys(counts) as UnitType[]).reduce(
    (sum, type) => sum + counts[type] * sizes[type],
    0,
  );
  if (total > netBudget && total > 0) {
    const scale = netBudget / total;
    for (const type of Object.keys(sizes) as UnitType[]) {
      sizes[type] = Math.floor(sizes[type] * scale);
    }
    total = (Object.keys(counts) as UnitType[]).reduce(
      (sum, type) => sum + counts[type] * sizes[type],
      0,
    );
  }

  const mix = (Object.keys(counts) as UnitType[])
    .filter((type) => counts[type] > 0)
    .map((type) => ({
      type,
      count: counts[type],
      netSqftEach: sizes[type],
    }));

  // Put any rounding remainder into the first unit type without changing count.
  if (mix.length > 0 && total < netBudget) {
    mix[0].netSqftEach += Math.floor((netBudget - total) / mix[0].count);
  }
  return mix;
}

function principalPermission(input: DevelopmentReportInput): number {
  return input.sixUnitStatus === "more_likely_area"
    ? Math.max(6, input.effectiveBaselineUnits)
    : input.effectiveBaselineUnits;
}

function rearSuiteType(input: DevelopmentReportInput, frontage: number, depth: number) {
  if (input.laneAccess && input.lanewaySuitePossible && depth >= 105) return "laneway" as const;
  if (!input.laneAccess && input.gardenSuitePossible && frontage >= 28 && depth >= 125) {
    return "garden" as const;
  }
  return null;
}

function buildConcept(input: DevelopmentReportInput): DevelopmentConcept {
  const frontage = input.frontageFt!;
  const depth = input.depthFt!;
  const lotArea = input.lotAreaSqft ?? frontage * depth;
  const band = widthBand(frontage);
  const dBand = depthBand(depth);
  const netMainGfa = Math.max(1_200, (input.practicalGfaSqft ?? lotArea * input.coverageRatio * input.asOfRightStoreys * 0.78) * 0.85);
  const permittedPrincipal = principalPermission(input);
  const principalUnits = clamp(
    Math.min(permittedPrincipal, capacityForGfa(netMainGfa)),
    2,
    6,
  );
  const suiteType = rearSuiteType(input, frontage, depth);
  const totalUnits = principalUnits + (suiteType ? 1 : 0);
  const sideSetback = band === "25_ft" ? 1.5 : band === "30_ft" ? 2.5 : band === "40_ft" ? 3 : 4;
  const frontSetback = input.majorStreet ? 14 : 18;
  const laneDepth = input.laneAccess ? 12 : 0;
  const separation = suiteType ? 16 : 0;
  const rearSetback = suiteType ? (input.laneAccess ? 2 : 5) : input.laneAccess ? 14 : 25;
  const buildableWidth = Math.max(16, frontage - sideSetback * 2);

  const suiteWidth = suiteType ? Math.min(buildableWidth, band === "25_ft" ? 21 : 24) : 0;
  const suiteDepth = suiteType ? clamp(500 / suiteWidth, 18, 24) : 0;
  const suiteFootprint = suiteType ? suiteWidth * suiteDepth : 0;
  const allowedFootprint = lotArea * input.coverageRatio;
  const mainFootprintTarget = Math.max(650, allowedFootprint - suiteFootprint);
  const mainMaxDepth = Math.max(
    24,
    depth - frontSetback - rearSetback - laneDepth - separation - suiteDepth,
  );
  const mainDepth = clamp(mainFootprintTarget / buildableWidth, 28, mainMaxDepth);
  const mainFootprint = buildableWidth * mainDepth;

  const buildings: ConceptBuilding[] = [
    {
      id: "main",
      label: `${principalUnits}-unit ${formForWidth(band, principalUnits)}`,
      units: principalUnits,
      storeys: input.asOfRightStoreys,
      widthFt: round1(buildableWidth),
      depthFt: round1(mainDepth),
      offsetLeftFt: round1(sideSetback),
      offsetTopFt: frontSetback,
      footprintSqft: Math.round(mainFootprint),
    },
  ];

  if (suiteType) {
    const suiteTop = depth - laneDepth - rearSetback - suiteDepth;
    buildings.push({
      id: "rear_suite",
      label: suiteType === "laneway" ? "1-unit laneway suite" : "1-unit garden suite",
      units: 1,
      storeys: 2,
      widthFt: round1(suiteWidth),
      depthFt: round1(suiteDepth),
      offsetLeftFt: round1((frontage - suiteWidth) / 2),
      offsetTopFt: round1(suiteTop),
      footprintSqft: Math.round(suiteFootprint),
    });
  }

  const form = formForWidth(band, principalUnits);
  const calculatedCoverage = (mainFootprint + suiteFootprint) / lotArea;
  const policyUpside = input.policyStoreys && input.policyStoreys > input.asOfRightStoreys
    ? input.policyStoreys
    : null;
  const laneLabel = suiteType === "laneway"
    ? " plus a rear laneway suite"
    : suiteType === "garden"
      ? " plus a detached garden suite"
      : "";

  return {
    conceptId: [
      band,
      dBand,
      `${principalUnits}u`,
      suiteType ?? "no_suite",
      input.majorStreet ? "major" : "local",
      input.transitStatus,
    ].join("-"),
    title: `${totalUnits}-home ${form}${laneLabel}`,
    form,
    summary: `A concept-level ${principalUnits}-unit principal building${laneLabel} on a ${round1(frontage)} × ${round1(depth)} ft lot. The massing uses the screening envelope; every setback and building dimension still needs a survey and zoning review.`,
    widthBand: band,
    depthBand: dBand,
    principalUnits,
    totalUnits,
    includesRearSuite: !!suiteType,
    rearSuiteType: suiteType,
    asOfRightStoreys: input.asOfRightStoreys,
    policyUpsideStoreys: policyUpside,
    policyUpsideNote: policyUpside
      ? `${policyUpside} storeys is shown only as transit-area policy upside. The base concept and pro forma stay at ${input.asOfRightStoreys} storeys because the zoning amendment/application path is not guaranteed.`
      : null,
    sitePlan: {
      lotFrontageFt: round1(frontage),
      lotDepthFt: round1(depth),
      streetEdge: "front",
      laneDepthFt: laneDepth,
      setbacks: {
        frontFt: frontSetback,
        rearFt: rearSetback,
        sideFt: sideSetback,
        buildingSeparationFt: separation,
        basis: "concept_assumption",
      },
      buildings,
      walkwaySide: input.laneAccess ? "left" : "right",
      drivewayShown: input.laneAccess && frontage >= 30,
      calculatedCoverageRatio: Math.round(calculatedCoverage * 1000) / 1000,
      allowedCoverageRatio: input.coverageRatio,
    },
    sampleDrawing: selectMultiplexConceptSample({
      widthBand: band,
      depthBand: dBand,
      laneAccess: input.laneAccess,
    }),
    caveats: [
      "Concept massing only — not a survey, zoning certificate, site plan approval drawing, or permit set.",
      "The diagram is calculated from screening assumptions; angular planes, tree protection zones, grading, servicing, fire access, waste storage, and easements are not modelled.",
      "The drawing board is a pre-generated example for a similar lot, not a rendering of this property. The dimensioned plan and deterministic calculations control wherever the sample differs.",
    ],
  };
}

function matrixForm(frontage: LotOutcomeRow["frontageFt"]): string {
  if (frontage === 25) return "Stacked / central stair";
  if (frontage === 30) return "Stacked or central core";
  if (frontage === 40) return "Side-by-side / semi form";
  return "Courtyard / two-wing form";
}

function buildOutcomeMatrix(
  input: DevelopmentReportInput,
  concept: DevelopmentConcept,
): LotOutcomeRow[] {
  const depth = input.depthFt!;
  const permitted = principalPermission(input);
  const isSuiteDepth = depth >= 105;

  return ([25, 30, 40, 50] as const).map((frontage) => {
    const area = frontage * depth;
    const practicalGross = area * input.coverageRatio * input.asOfRightStoreys * 0.78;
    const capacity = capacityForGfa(practicalGross * 0.85);
    const noLaneUnits = clamp(Math.min(permitted, capacity), 2, 6);
    const laneUnits = noLaneUnits + (
      isSuiteDepth && input.lanewaySuitePossible
        ? 1
        : 0
    );
    const currentBand = widthBand(input.frontageFt!);

    return {
      frontageFt: frontage,
      typicalForm: matrixForm(frontage),
      noLaneUnits,
      laneUnits,
      depthRead: depth < 100
        ? `${round1(depth)} ft is shallow; rear-suite and usable-yard options are constrained.`
        : depth < 120
          ? `${round1(depth)} ft supports a normal principal envelope; a rear suite needs careful separation.`
          : depth < 140
            ? `${round1(depth)} ft is a strong infill depth and can support a rear building where access works.`
            : `${round1(depth)} ft is extra deep; servicing and emergency access become the key rear-building checks.`,
      policyUpside: input.policyStoreys
        ? `${input.policyStoreys} storeys may have transit-policy support; not included as-of-right.`
        : input.transitStatus === "likely_mtsa_inferred"
          ? "Possible MTSA — verify the mapped boundary before assigning upside."
          : "No transit-area height uplift applied.",
      isCurrentBand:
        (frontage === 25 && currentBand === "25_ft")
        || (frontage === 30 && currentBand === "30_ft")
        || (frontage === 40 && currentBand === "40_ft")
        || (frontage === 50 && currentBand === "50_ft"),
    };
  });
}

function buildDevAssumptions(input: DevelopmentReportInput, constructionMonths: number): DevAssumptions {
  return {
    ...DEV_ASSUMPTION_DEFAULTS,
    hardCostPsf: input.hardCostPsf && input.hardCostPsf > 0
      ? input.hardCostPsf
      : DEV_ASSUMPTION_DEFAULTS.hardCostPsf,
    constructionMonths,
    monthlyRents: { ...DEV_ASSUMPTION_DEFAULTS.monthlyRents },
  };
}

function buildProForma(
  input: DevelopmentReportInput,
  concept: DevelopmentConcept,
  constructionMonths: number,
): SampleProForma {
  const main = concept.sitePlan.buildings.find((b) => b.id === "main")!;
  const suite = concept.sitePlan.buildings.find((b) => b.id === "rear_suite");
  const grossMain = Math.round(
    Math.min(
      input.practicalGfaSqft ?? main.footprintSqft * main.storeys * 0.78,
      main.footprintSqft * main.storeys,
    ),
  );
  const grossSuite = suite ? Math.round(suite.footprintSqft * suite.storeys) : 0;
  const netMain = Math.round(grossMain * 0.85);
  const netSuite = Math.round(grossSuite * 0.85);
  const principalMix = buildUnitMix(concept.principalUnits, netMain);
  const unitMix: UnitMixEntry[] = suite
    ? [...principalMix, { type: "2br", count: 1, netSqftEach: netSuite }]
    : principalMix;
  const netRentable = unitMix.reduce((sum, item) => sum + item.count * item.netSqftEach, 0);

  const config: BuildConfiguration = {
    key: concept.conceptId,
    label: concept.title,
    units: concept.totalUnits,
    unitMix,
    grossGfaSqft: grossMain,
    netSqft: netRentable,
    includesSuite: !!suite,
    suiteGfaSqft: grossSuite,
    parkingRequired: 0,
    parkingProvided: concept.sitePlan.drivewayShown ? 1 : 0,
    approvalPath: approvalPathForConfig(input.approvalPath),
    approvalCertainty: input.sixUnitStatus === "more_likely_area" ? "inferred" : "verified",
    envelopeSlackPct: 0,
    constraints: concept.caveats,
    flags: [],
  };

  const a = buildDevAssumptions(input, constructionMonths);
  const landPriceProvided = typeof input.purchasePrice === "number" && input.purchasePrice > 0;
  const purchasePrice = landPriceProvided ? input.purchasePrice! : 0;
  const costs = computeCostStack(config, purchasePrice, a);
  const rental = computeRentalHold(config, costs, a);
  const residual = computeResidualLandValue(config, a);
  const points = scoreMliPoints(MLI_DEFAULT_COMMITMENTS);
  const mli = computeMliTakeout({
    units: config.units,
    noi: rental.noi,
    lendingValue: Math.min(costs.totalDevCost, rental.stabilizedValue),
    points,
    purpose: "other",
    interestRate: MLI_RATE,
  });
  const constructionLoan = Math.round(costs.totalDevCost * a.loanToCost);
  const equityRequired = Math.max(0, costs.totalDevCost - constructionLoan);
  const takeoutLoan = mli.eligible ? mli.maxLoan : null;
  const equityRemaining = takeoutLoan === null
    ? null
    : Math.max(0, costs.totalDevCost - takeoutLoan);

  const notes = [
    landPriceProvided
      ? "The entered acquisition price is included in total development cost and equity."
      : "No acquisition price was supplied. Total development cost and equity exclude land; use the residual land values as a first-pass acquisition ceiling.",
    "This is a sample rental-hold pro forma. It is not a lender quote, appraisal, contractor budget, quantity survey, tax opinion, or investment recommendation.",
    `MLI Select is modelled at ${points} points using 10% affordability plus a 20% energy improvement; commitments, premiums, leverage, rate, and amortization require lender/CMHC confirmation.`,
    "Development charges use the platform default and may be reduced or exempt depending on the existing dwelling, municipal program, and final unit count.",
  ];

  return {
    basis: "illustrative",
    landPriceProvided,
    configuration: {
      label: config.label,
      units: config.units,
      grossGfaSqft: grossMain + grossSuite,
      netRentableSqft: netRentable,
      unitMix,
    },
    assumptions: {
      hardCostPsf: a.hardCostPsf,
      softCostPct: a.softCostPctOfHard,
      contingencyPct: a.contingencyPct,
      constructionLoanRate: a.constructionRate,
      constructionLoanToCost: a.loanToCost,
      constructionMonths: a.constructionMonths,
      vacancyPct: a.vacancyPct,
      operatingExpensePct: a.opexPctOfEgi,
      exitCapRate: a.exitCapRate,
      mliInterestRate: MLI_RATE,
      mliPoints: points,
      source: a.source,
      lastVerified: a.lastVerified,
    },
    costs: {
      purchasePrice: landPriceProvided ? purchasePrice : null,
      landTransferTax: costs.landTransferTax,
      hardCosts: costs.hardCosts,
      softCosts: costs.softCosts,
      contingency: costs.contingency,
      developmentCharges: costs.developmentCharges,
      financingCarry: costs.financingCarry,
      totalDevelopmentCost: costs.totalDevCost,
      totalBeforeLand: costs.totalDevCost - costs.land - costs.landTransferTax,
      costPerUnit: costs.costPerUnit,
    },
    sourcesAndUses: {
      constructionLoan,
      equityRequired,
      loanToCost: a.loanToCost,
      cmhcTakeoutLoan: takeoutLoan,
      cmhcPremium: mli.eligible ? mli.premiumDollars : null,
      equityRemainingAfterTakeout: equityRemaining,
    },
    operations: {
      grossPotentialRent: rental.grossPotentialRent,
      effectiveGrossIncome: rental.effectiveGrossIncome,
      operatingExpenses: rental.operatingExpenses,
      stabilizedNoi: rental.noi,
      stabilizedValue: rental.stabilizedValue,
      yieldOnCost: rental.yieldOnCost,
      averageMonthlyRentPerUnit: config.units > 0
        ? Math.round(rental.grossPotentialRent / 12 / config.units)
        : 0,
    },
    cmhcTakeout: {
      eligible: mli.eligible,
      reason: mli.reason ?? null,
      points,
      amortYears: mli.eligible ? mli.amortYears : null,
      maxLoan: takeoutLoan,
      premiumPct: mli.eligible ? mli.premiumPct : null,
      premiumDollars: mli.eligible ? mli.premiumDollars : null,
      dscr: mli.eligible ? mli.actualDscr : null,
      bindingConstraint: mli.eligible ? mli.bindingConstraint : null,
    },
    residualLandValue: residual,
    notes,
  };
}

function phase(
  id: string,
  category: TimelineCategory,
  label: string,
  startMonth: number,
  endMonth: number,
  dependencies: string[],
  components: string[],
  critical = false,
): ProjectTimelinePhase {
  return {
    id,
    category,
    label,
    startMonth,
    endMonth,
    durationMonths: round1(endMonth - startMonth),
    dependencies,
    components,
    critical,
  };
}

function buildTimeline(
  input: DevelopmentReportInput,
  concept: DevelopmentConcept,
): ProjectTimeline {
  const approvalMonths =
    input.approvalPath === "as_of_right" ? 5
      : input.approvalPath === "minor_variance_likely" ? 9
        : input.approvalPath === "rezoning_required" ? 15
          : input.approvalPath === "complex" ? 18
            : 8;
  const constructionMonths =
    13
    + (concept.totalUnits >= 5 ? 1 : 0)
    + (concept.includesRearSuite ? 2 : 0)
    + (concept.asOfRightStoreys > 3 ? 2 : 0);
  const acquisitionClose = 2;
  const permitMonth = acquisitionClose + approvalMonths;
  const loanClose = permitMonth + 1;
  const constructionStart = loanClose;
  const constructionEnd = constructionStart + constructionMonths;
  const preLeaseStart = Math.max(constructionStart + 4, constructionEnd - 3);
  const leaseUpMonths = clamp(Math.ceil(concept.totalUnits / 2), 2, 5);
  const leaseUpEnd = constructionEnd + leaseUpMonths;
  const stabilizationEnd = leaseUpEnd + 3;
  const takeoutStart = Math.max(constructionStart, constructionEnd - 2);
  const takeoutEnd = stabilizationEnd + 1;

  const foundationEnd = constructionStart + 2.5;
  const structureEnd = foundationEnd + 3;
  const enclosureEnd = structureEnd + 2;
  const roughInEnd = enclosureEnd + 2.5;
  const interiorEnd = Math.max(roughInEnd + 3, constructionEnd - 1);

  const phases: ProjectTimelinePhase[] = [
    phase(
      "site_control",
      "acquisition",
      "LOI, site control & initial screen",
      0,
      0.75,
      [],
      ["Offer/LOI", "financing condition", "planning screen", "access for consultants"],
      true,
    ),
    phase(
      "due_diligence",
      "acquisition",
      "Due diligence & acquisition financing",
      0.25,
      acquisitionClose,
      ["site_control"],
      ["survey/title", "environmental review", "building condition", "appraisal", "legal", "acquisition loan"],
      true,
    ),
    phase(
      "concept_design",
      "design_approvals",
      "Survey, concept design & consultant studies",
      0.75,
      3,
      ["site_control"],
      ["architect", "planner", "arborist", "civil/servicing", "energy/MLI strategy", "pre-consultation"],
      true,
    ),
    phase(
      "planning_approvals",
      "design_approvals",
      input.approvalPath === "as_of_right"
        ? "Zoning review & permit drawings"
        : "Planning application, revisions & decision",
      2,
      permitMonth - 1,
      ["concept_design", "due_diligence"],
      input.approvalPath === "as_of_right"
        ? ["zoning certificate", "code review", "permit set", "utility coordination"]
        : ["application package", "City circulation", "community/committee process", "conditions", "appeal allowance"],
      true,
    ),
    phase(
      "permit",
      "design_approvals",
      "Building permit review & clearances",
      Math.max(3, permitMonth - 3),
      permitMonth,
      ["planning_approvals"],
      ["building permit", "tree permit", "utility sign-offs", "development charges", "pre-construction conditions"],
      true,
    ),
    phase(
      "construction_loan",
      "financing",
      "Construction loan underwriting & closing",
      Math.max(2, permitMonth - 3),
      loanClose,
      ["concept_design", "due_diligence"],
      ["lender budget", "quantity survey", "appraisal", "guarantor review", "commitment", "legal closing", "first-draw conditions"],
      true,
    ),
    phase(
      "site_prep",
      "construction",
      "Mobilization, demolition & site servicing",
      constructionStart,
      constructionStart + 1,
      ["permit", "construction_loan"],
      ["hoarding", "demolition", "temporary services", "erosion controls", "service disconnects"],
      true,
    ),
    phase(
      "foundation",
      "construction",
      "Excavation, underpinning & foundations",
      constructionStart + 1,
      foundationEnd,
      ["site_prep"],
      ["excavation", "shoring/underpinning", "footings", "foundation walls", "below-grade waterproofing"],
      true,
    ),
    phase(
      "structure",
      "construction",
      "Structure & framing",
      foundationEnd,
      structureEnd,
      ["foundation"],
      ["floor assemblies", "load-bearing walls", "stairs", "roof structure", "rear-suite structure where applicable"],
      true,
    ),
    phase(
      "enclosure",
      "construction",
      "Building envelope",
      structureEnd,
      enclosureEnd,
      ["structure"],
      ["roofing", "windows/doors", "air/water barrier", "cladding", "insulation"],
      true,
    ),
    phase(
      "rough_ins",
      "construction",
      "MEP, fire/life-safety & rough-ins",
      structureEnd + 0.5,
      roughInEnd,
      ["structure"],
      ["plumbing", "electrical", "HVAC", "sprinkler/fire alarm where required", "metering", "inspections"],
      true,
    ),
    phase(
      "interiors",
      "construction",
      "Interior finishes & unit completion",
      roughInEnd - 0.5,
      interiorEnd,
      ["enclosure", "rough_ins"],
      ["drywall", "millwork", "flooring", "fixtures", "appliances", "common areas", "deficiency work"],
      true,
    ),
    phase(
      "sitework_commissioning",
      "construction",
      "Sitework, commissioning & occupancy",
      interiorEnd,
      constructionEnd,
      ["interiors"],
      ["landscaping", "walkways", "waste area", "systems commissioning", "final inspections", "occupancy permit"],
      true,
    ),
    phase(
      "pre_leasing",
      "lease_up",
      "Marketing & pre-leasing",
      preLeaseStart,
      constructionEnd,
      ["enclosure"],
      ["branding/listings", "show suite or virtual tour", "applications", "tenant screening", "lease documentation"],
      false,
    ),
    phase(
      "lease_up",
      "lease_up",
      "Occupancy & lease-up",
      constructionEnd,
      leaseUpEnd,
      ["sitework_commissioning", "pre_leasing"],
      ["tenant move-ins", "rent collection", "deficiency resolution", "operating handoff", "occupancy tracking"],
      true,
    ),
    phase(
      "stabilization",
      "lease_up",
      "Stabilized operations",
      leaseUpEnd,
      stabilizationEnd,
      ["lease_up"],
      ["sustained occupancy", "seasoned rent roll", "normalized expenses", "NOI verification", "property management reporting"],
      true,
    ),
    phase(
      "cmhc_takeout",
      "takeout",
      "CMHC MLI Select takeout",
      takeoutStart,
      takeoutEnd,
      ["construction_loan", "sitework_commissioning", "stabilization"],
      ["MLI commitments/evidence", "lender submission", "CMHC underwriting", "as-complete appraisal", "cost certification", "stabilized rent roll", "insured loan closing", "construction-loan payout"],
      true,
    ),
  ];

  const milestones: ProjectTimelineMilestone[] = [
    { id: "site_acquired", label: "Site acquired", month: acquisitionClose, category: "acquisition" },
    { id: "permit_issued", label: "Permit issued", month: permitMonth, category: "design_approvals" },
    { id: "first_draw", label: "Construction loan / first draw", month: loanClose, category: "financing" },
    { id: "occupancy", label: "Occupancy", month: constructionEnd, category: "construction" },
    { id: "stabilized", label: "Stabilized", month: stabilizationEnd, category: "lease_up" },
    { id: "takeout_funded", label: "CMHC takeout funded", month: takeoutEnd, category: "takeout" },
  ];

  return {
    totalMonths: Math.ceil(takeoutEnd),
    phases,
    milestones,
    criticalPath: [
      "site_control",
      "due_diligence",
      "concept_design",
      "planning_approvals",
      "permit",
      "construction_loan",
      "site_prep",
      "foundation",
      "structure",
      "enclosure",
      "rough_ins",
      "interiors",
      "sitework_commissioning",
      "lease_up",
      "stabilization",
      "cmhc_takeout",
    ],
    notes: [
      `Illustrative ${Math.ceil(takeoutEnd)}-month schedule from site control to insured takeout; durations are planning and construction assumptions, not promises.`,
      "The planning path drives the front end. A minor variance, rezoning, heritage matter, conservation review, tree injury permit, servicing upgrade, or appeal can materially extend it.",
      "The CMHC workstream begins before occupancy, but funding is shown only after lease-up and a stabilized rent roll. Exact stabilization evidence and timing are lender-specific.",
    ],
  };
}

export function buildMultiplexDevelopmentReport(
  input: DevelopmentReportInput,
): MultiplexDevelopmentReport | null {
  if (
    !input.frontageFt
    || !input.depthFt
    || input.frontageFt <= 0
    || input.depthFt <= 0
  ) {
    return null;
  }

  const concept = buildConcept(input);
  const timeline = buildTimeline(input, concept);
  const constructionPhase = timeline.phases.find((item) => item.id === "site_prep");
  const occupancy = timeline.milestones.find((item) => item.id === "occupancy");
  const constructionMonths = constructionPhase && occupancy
    ? Math.max(1, Math.round(occupancy.month - constructionPhase.startMonth))
    : DEV_ASSUMPTION_DEFAULTS.constructionMonths;

  return {
    concept,
    outcomeMatrix: buildOutcomeMatrix(input, concept),
    proForma: buildProForma(input, concept, constructionMonths),
    timeline,
  };
}
