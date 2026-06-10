export type ProfessionalRole =
  | "investor"
  | "realtor"
  | "contractor"
  | "property_manager"
  | "lender"
  | "appraiser"
  | "inspector"
  | "insurance_broker"
  | "lawyer"
  | "wholesaler"
  | "admin";

export type ListingFeedbackInputType =
  | "comment"
  | "deal_rating"
  | "price_feedback"
  | "rent_feedback"
  | "expense_feedback"
  | "repair_estimate"
  | "arv_feedback"
  | "offer_strategy"
  | "risk_flag"
  | "financing_feedback"
  | "comparable_note"
  | "inspection_note"
  | "professional_quote";

export type DealStatus = "watchlist" | "needs_review" | "qualified" | "rejected" | "under_offer";
export type MetricConfidence = "low" | "medium" | "high";

export type ListingFeedbackEvent = {
  id: string;
  listingId: string;
  userId?: string;
  userName?: string;
  userRole: ProfessionalRole;
  inputType: ListingFeedbackInputType;
  fieldAffected?: string;
  originalValue?: number | string;
  suggestedValue?: number | string;
  confidence?: number;
  physicallyInspected?: boolean;
  verifiedProfessional?: boolean;
  reputationScore?: number;
  comment?: string;
  createdAt: string;
};

export interface ListingProfessionalProfile {
  id: string;
  name: string;
  role: Exclude<ProfessionalRole, "investor" | "admin"> | "internal_advisor";
  market: string;
  specialties: string[];
  verified: boolean;
  rating: number;
  contributionCount: number;
  responseCta: string;
  dealTypesSupported: string[];
}

export interface ListingUnderwritingAssumptions {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  amortizationYears: number;
  monthlyRent: number;
  vacancyPercent: number;
  annualPropertyTax: number;
  annualInsurance: number;
  annualUtilities: number;
  annualRepairsMaintenance: number;
  annualPropertyManagement: number;
  annualOtherExpenses: number;
  renovationBudget: number;
  afterRepairValue: number;
  closingCostsPercent: number;
  sellingCostsPercent: number;
  rentConfidence: MetricConfidence;
  expenseConfidence: MetricConfidence;
  arvConfidence: MetricConfidence;
}

export interface ListingIntelligenceRecord {
  id: string;
  address: string;
  city: string;
  province: string;
  propertyType: string;
  askingPrice: number;
  bedrooms: number;
  bathrooms: number;
  units: number;
  estimatedRent: number;
  estimatedExpenses: number;
  estimatedRenovationBudget: number;
  estimatedArv: number;
  listingSource: string;
  status: DealStatus;
  daysOnMarket: number;
  photoUrl?: string;
  assumptions: ListingUnderwritingAssumptions;
  thesis: string;
  keyUpside: string[];
  keyRisks: string[];
}

export interface ListingUnderwritingResult {
  grossMonthlyRent: number;
  grossAnnualRent: number;
  downPayment: number;
  loanAmount: number;
  monthlyMortgagePayment: number;
  annualDebtService: number;
  monthlyOperatingExpenses: number;
  annualOperatingExpenses: number;
  noi: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  cashOnCashReturn: number;
  rentToPriceRatio: number;
  dscr: number;
  refinancePotential: number;
  flipProfitEstimate: number;
  brrrrViability: "weak" | "borderline" | "strong";
  riskScore: number;
  opportunityScore: number;
  confidenceScore: number;
  assumptionsUsed: ListingUnderwritingAssumptions;
  warnings: string[];
  analysisSummary: {
    investmentThesis: string;
    whyScoreMoved: string;
    whatWouldMakeItWork: string;
    recommendedNextStep: string;
  };
}

export interface FeedbackTrainingExportEvent {
  eventId: string;
  listingId: string;
  role: ProfessionalRole;
  inputType: ListingFeedbackInputType;
  targetField: string | null;
  originalValue: number | string | null;
  suggestedValue: number | string | null;
  normalizedConfidence: number;
  sourceWeight: number;
  physicallyInspected: boolean;
  verifiedProfessional: boolean;
  comment: string | null;
  createdAt: string;
}

export function roundNumber(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateMonthlyMortgagePayment(loanAmount: number, annualInterestRate: number, amortizationYears: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = annualInterestRate / 100 / 12;
  const payments = Math.max(1, Math.round(amortizationYears * 12));
  if (monthlyRate <= 0) return loanAmount / payments;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundNumber(value, 0)));
}

function confidenceToScore(confidence: MetricConfidence): number {
  if (confidence === "high") return 90;
  if (confidence === "medium") return 68;
  return 42;
}

export function getFeedbackWeight(event: ListingFeedbackEvent): number {
  const roleWeight: Record<ProfessionalRole, number> = {
    investor: 1,
    realtor: 1.45,
    contractor: 1.6,
    property_manager: 1.6,
    lender: 1.5,
    appraiser: 1.55,
    inspector: 1.5,
    insurance_broker: 1.3,
    lawyer: 1.35,
    wholesaler: 1.15,
    admin: 1.75,
  };
  const confidence = Math.max(0.1, Math.min(1, (event.confidence ?? 60) / 100));
  const verificationBoost = event.verifiedProfessional ? 0.4 : 0;
  const inspectionBoost = event.physicallyInspected ? 0.25 : 0;
  const reputationBoost = Math.max(0, Math.min(0.35, (event.reputationScore ?? 0) / 300));
  return roundNumber(roleWeight[event.userRole] * confidence + verificationBoost + inspectionBoost + reputationBoost, 2);
}

export function summarizeFeedbackEvents(events: ListingFeedbackEvent[]) {
  const weightedEvents = events.map((event) => ({ event, weight: getFeedbackWeight(event) }));
  const totalWeight = weightedEvents.reduce((sum, item) => sum + item.weight, 0);
  const verifiedProfessionalCount = events.filter((event) => event.verifiedProfessional).length;
  const inspectedCount = events.filter((event) => event.physicallyInspected).length;
  const riskFlags = events.filter((event) => event.inputType === "risk_flag" || event.inputType === "inspection_note").length;
  const fieldCounts = events.reduce<Record<string, number>>((acc, event) => {
    if (event.fieldAffected) acc[event.fieldAffected] = (acc[event.fieldAffected] || 0) + 1;
    return acc;
  }, {});
  const conflictingFields = Object.entries(fieldCounts).filter(([, count]) => count > 1).map(([field]) => field);
  const confidenceImpact = clampScore((totalWeight * 8) + (verifiedProfessionalCount * 8) + (inspectedCount * 6) - (conflictingFields.length * 8));

  return {
    totalEvents: events.length,
    totalWeight: roundNumber(totalWeight, 2),
    verifiedProfessionalCount,
    inspectedCount,
    riskFlags,
    fieldsWithMultipleCorrections: conflictingFields,
    confidenceImpact,
  };
}

export function exportFeedbackTrainingEvents(events: ListingFeedbackEvent[]): FeedbackTrainingExportEvent[] {
  return events.map((event) => ({
    eventId: event.id,
    listingId: event.listingId,
    role: event.userRole,
    inputType: event.inputType,
    targetField: event.fieldAffected ?? null,
    originalValue: event.originalValue ?? null,
    suggestedValue: event.suggestedValue ?? null,
    normalizedConfidence: Math.max(0, Math.min(1, (event.confidence ?? 50) / 100)),
    sourceWeight: getFeedbackWeight(event),
    physicallyInspected: Boolean(event.physicallyInspected),
    verifiedProfessional: Boolean(event.verifiedProfessional),
    comment: event.comment ?? null,
    createdAt: event.createdAt,
  }));
}

export function applyNumericFeedback(
  assumptions: ListingUnderwritingAssumptions,
  events: ListingFeedbackEvent[],
): ListingUnderwritingAssumptions {
  const next = { ...assumptions };
  const numericFields: Array<keyof ListingUnderwritingAssumptions> = [
    "purchasePrice",
    "interestRate",
    "monthlyRent",
    "annualPropertyTax",
    "annualInsurance",
    "annualUtilities",
    "annualRepairsMaintenance",
    "annualPropertyManagement",
    "annualOtherExpenses",
    "renovationBudget",
    "afterRepairValue",
  ];

  for (const field of numericFields) {
    const relevant = events.filter((event) => event.fieldAffected === field && typeof event.suggestedValue === "number");
    if (!relevant.length) continue;
    const weightedTotal = relevant.reduce((sum, event) => sum + ((event.suggestedValue as number) * getFeedbackWeight(event)), 0);
    const totalWeight = relevant.reduce((sum, event) => sum + getFeedbackWeight(event), 0);
    if (totalWeight > 0) {
      next[field] = roundNumber(weightedTotal / totalWeight, 0) as never;
    }
  }

  if (events.some((event) => event.fieldAffected === "monthlyRent" && event.verifiedProfessional)) {
    next.rentConfidence = "high";
  }
  if (events.some((event) => ["annualRepairsMaintenance", "annualOtherExpenses", "annualPropertyTax"].includes(event.fieldAffected || "") && event.verifiedProfessional)) {
    next.expenseConfidence = "high";
  }
  if (events.some((event) => event.fieldAffected === "afterRepairValue" && event.verifiedProfessional)) {
    next.arvConfidence = "high";
  }

  return next;
}

export function calculateListingUnderwriting(
  listing: ListingIntelligenceRecord,
  feedbackEvents: ListingFeedbackEvent[] = [],
): ListingUnderwritingResult {
  const assumptions = applyNumericFeedback(listing.assumptions, feedbackEvents);
  const grossMonthlyRent = assumptions.monthlyRent;
  const grossAnnualRent = grossMonthlyRent * 12;
  const downPayment = assumptions.purchasePrice * (assumptions.downPaymentPercent / 100);
  const loanAmount = Math.max(0, assumptions.purchasePrice - downPayment);
  const monthlyMortgagePayment = calculateMonthlyMortgagePayment(loanAmount, assumptions.interestRate, assumptions.amortizationYears);
  const vacancyAllowance = grossAnnualRent * (assumptions.vacancyPercent / 100);
  const annualOperatingExpenses =
    vacancyAllowance +
    assumptions.annualPropertyTax +
    assumptions.annualInsurance +
    assumptions.annualUtilities +
    assumptions.annualRepairsMaintenance +
    assumptions.annualPropertyManagement +
    assumptions.annualOtherExpenses;
  const noi = grossAnnualRent - annualOperatingExpenses;
  const annualDebtService = monthlyMortgagePayment * 12;
  const annualCashFlow = noi - annualDebtService;
  const monthlyCashFlow = annualCashFlow / 12;
  const cashInvested = downPayment + assumptions.renovationBudget + (assumptions.purchasePrice * (assumptions.closingCostsPercent / 100));
  const capRate = assumptions.purchasePrice > 0 ? (noi / assumptions.purchasePrice) * 100 : 0;
  const cashOnCashReturn = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
  const rentToPriceRatio = assumptions.purchasePrice > 0 ? (grossMonthlyRent / assumptions.purchasePrice) * 100 : 0;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const refinancePotential = Math.max(0, assumptions.afterRepairValue * 0.8 - loanAmount - assumptions.renovationBudget);
  const flipProfitEstimate = assumptions.afterRepairValue - assumptions.purchasePrice - assumptions.renovationBudget - (assumptions.afterRepairValue * (assumptions.sellingCostsPercent / 100));
  const feedbackSummary = summarizeFeedbackEvents(feedbackEvents);

  const riskScore = clampScore(
    52
      + (monthlyCashFlow < 0 ? 16 : -8)
      + (dscr < 1.1 ? 14 : -6)
      + (assumptions.renovationBudget > assumptions.purchasePrice * 0.12 ? 10 : 0)
      + (feedbackSummary.riskFlags * 7)
      - feedbackSummary.verifiedProfessionalCount * 3,
  );
  const opportunityScore = clampScore(
    42
      + Math.min(24, Math.max(-8, capRate * 3))
      + Math.min(18, Math.max(-12, cashOnCashReturn * 1.4))
      + (refinancePotential > 0 ? 10 : 0)
      + (flipProfitEstimate > assumptions.purchasePrice * 0.08 ? 8 : 0)
      - Math.max(0, riskScore - 62) * 0.35,
  );
  const confidenceScore = clampScore(
    (confidenceToScore(assumptions.rentConfidence) * 0.34)
      + (confidenceToScore(assumptions.expenseConfidence) * 0.28)
      + (confidenceToScore(assumptions.arvConfidence) * 0.18)
      + (feedbackSummary.confidenceImpact * 0.2),
  );
  const brrrrViability = refinancePotential > downPayment * 0.45 && dscr >= 1.15
    ? "strong"
    : refinancePotential > 0 && dscr >= 1
      ? "borderline"
      : "weak";

  const warnings: string[] = [];
  if (monthlyCashFlow < 0) warnings.push("Current assumptions show negative monthly cash flow.");
  if (dscr < 1.1) warnings.push("Debt service coverage is thin at the current rate and rent.");
  if (confidenceScore < 60) warnings.push("Major assumptions need professional validation before relying on this score.");
  if (feedbackSummary.riskFlags > 0) warnings.push("Community or professional contributors have flagged due diligence risks.");

  const whatWouldMakeItWork = monthlyCashFlow >= 0
    ? "Protect the basis, validate rent, and lock financing terms before firming up."
    : `The deal needs roughly ${Math.abs(roundNumber(monthlyCashFlow, 0)).toLocaleString("en-CA")} dollars more monthly room through lower price, higher rent, or cheaper debt.`;

  return {
    grossMonthlyRent: roundNumber(grossMonthlyRent, 0),
    grossAnnualRent: roundNumber(grossAnnualRent, 0),
    downPayment: roundNumber(downPayment, 0),
    loanAmount: roundNumber(loanAmount, 0),
    monthlyMortgagePayment: roundNumber(monthlyMortgagePayment, 0),
    annualDebtService: roundNumber(annualDebtService, 0),
    monthlyOperatingExpenses: roundNumber(annualOperatingExpenses / 12, 0),
    annualOperatingExpenses: roundNumber(annualOperatingExpenses, 0),
    noi: roundNumber(noi, 0),
    monthlyCashFlow: roundNumber(monthlyCashFlow, 0),
    annualCashFlow: roundNumber(annualCashFlow, 0),
    capRate: roundNumber(capRate, 2),
    cashOnCashReturn: roundNumber(cashOnCashReturn, 2),
    rentToPriceRatio: roundNumber(rentToPriceRatio, 2),
    dscr: roundNumber(dscr, 2),
    refinancePotential: roundNumber(refinancePotential, 0),
    flipProfitEstimate: roundNumber(flipProfitEstimate, 0),
    brrrrViability,
    riskScore,
    opportunityScore,
    confidenceScore,
    assumptionsUsed: assumptions,
    warnings,
    analysisSummary: {
      investmentThesis: listing.thesis,
      whyScoreMoved: feedbackSummary.totalEvents
        ? `${feedbackSummary.totalEvents} structured feedback events adjusted confidence and selected assumptions.`
        : "This prototype score is based on Realist sample assumptions only.",
      whatWouldMakeItWork,
      recommendedNextStep: riskScore > 68
        ? "Request professional due diligence before writing an offer."
        : opportunityScore >= 70
          ? "Validate rent, repairs, and financing with a market professional."
          : "Keep watching unless price or rents improve.",
    },
  };
}

export const sampleListingIntelligence: ListingIntelligenceRecord = {
  id: "realist-demo-hamilton-fourplex",
  address: "Approx. Barton St E corridor",
  city: "Hamilton",
  province: "ON",
  propertyType: "Legal fourplex candidate",
  askingPrice: 849000,
  bedrooms: 7,
  bathrooms: 4,
  units: 4,
  estimatedRent: 7200,
  estimatedExpenses: 2860,
  estimatedRenovationBudget: 95000,
  estimatedArv: 1050000,
  listingSource: "Demo listing intelligence sample",
  status: "needs_review",
  daysOnMarket: 38,
  assumptions: {
    purchasePrice: 849000,
    downPaymentPercent: 20,
    interestRate: 5.25,
    amortizationYears: 25,
    monthlyRent: 7200,
    vacancyPercent: 5,
    annualPropertyTax: 6200,
    annualInsurance: 3600,
    annualUtilities: 4200,
    annualRepairsMaintenance: 6200,
    annualPropertyManagement: 6900,
    annualOtherExpenses: 2400,
    renovationBudget: 95000,
    afterRepairValue: 1050000,
    closingCostsPercent: 3,
    sellingCostsPercent: 5,
    rentConfidence: "medium",
    expenseConfidence: "medium",
    arvConfidence: "low",
  },
  thesis: "A small multifamily value-add deal that could work if rent, legal-use status, and renovation scope validate quickly.",
  keyUpside: [
    "Multi-unit income base with rent lift potential.",
    "Possible BRRRR or refinance path if ARV is confirmed.",
    "Professional feedback can quickly improve confidence on repairs and rent.",
  ],
  keyRisks: [
    "ARV is still a low-confidence estimate.",
    "Renovation budget could expand after inspection.",
    "Debt service is sensitive to current Canadian borrowing rates.",
  ],
};

export const sampleListingFeedbackEvents: ListingFeedbackEvent[] = [
  {
    id: "feedback-rent-pm-1",
    listingId: "realist-demo-hamilton-fourplex",
    userName: "GVT Property Management",
    userRole: "property_manager",
    inputType: "rent_feedback",
    fieldAffected: "monthlyRent",
    originalValue: 7200,
    suggestedValue: 6900,
    confidence: 82,
    verifiedProfessional: true,
    comment: "Rent is achievable only if two units are fully refreshed and separately metered.",
    createdAt: "2026-05-01T14:30:00.000Z",
  },
  {
    id: "feedback-contractor-1",
    listingId: "realist-demo-hamilton-fourplex",
    userName: "Realist contractor partner",
    userRole: "contractor",
    inputType: "repair_estimate",
    fieldAffected: "renovationBudget",
    originalValue: 95000,
    suggestedValue: 118000,
    confidence: 76,
    physicallyInspected: true,
    verifiedProfessional: true,
    comment: "Electrical and fire separation scope needs allowance before offer.",
    createdAt: "2026-05-02T10:15:00.000Z",
  },
  {
    id: "feedback-lender-1",
    listingId: "realist-demo-hamilton-fourplex",
    userName: "Investor-focused broker",
    userRole: "lender",
    inputType: "financing_feedback",
    fieldAffected: "interestRate",
    originalValue: 5.25,
    suggestedValue: 5.45,
    confidence: 70,
    verifiedProfessional: true,
    comment: "Use a slightly higher stress case until lease documentation is reviewed.",
    createdAt: "2026-05-02T16:00:00.000Z",
  },
  {
    id: "feedback-risk-1",
    listingId: "realist-demo-hamilton-fourplex",
    userName: "Community investor",
    userRole: "investor",
    inputType: "risk_flag",
    fieldAffected: "zoning",
    confidence: 55,
    comment: "Confirm legal unit status and parking before assuming four stabilized rents.",
    createdAt: "2026-05-03T09:00:00.000Z",
  },
];

export const sampleProfessionals: ListingProfessionalProfile[] = [
  {
    id: "pro-realtor-ham-1",
    name: "Investor Realtor Desk",
    role: "realtor",
    market: "Hamilton, ON",
    specialties: ["CMA", "seller motivation", "small multifamily"],
    verified: true,
    rating: 4.8,
    contributionCount: 42,
    responseCta: "Ask for CMA",
    dealTypesSupported: ["buy and hold", "BRRRR", "multiplex"],
  },
  {
    id: "pro-contractor-ham-1",
    name: "Value-Add Contractor Pool",
    role: "contractor",
    market: "Hamilton, ON",
    specialties: ["fire separation", "basement suites", "turnover scopes"],
    verified: true,
    rating: 4.7,
    contributionCount: 31,
    responseCta: "Request quote",
    dealTypesSupported: ["BRRRR", "flip", "small multifamily"],
  },
  {
    id: "pro-pm-ham-1",
    name: "Property Manager Review",
    role: "property_manager",
    market: "Hamilton, ON",
    specialties: ["rent validation", "tenant demand", "vacancy risk"],
    verified: true,
    rating: 4.9,
    contributionCount: 58,
    responseCta: "Validate rent",
    dealTypesSupported: ["buy and hold", "student rental", "multiplex"],
  },
  {
    id: "pro-lender-on-1",
    name: "Investor Financing Desk",
    role: "lender",
    market: "Ontario",
    specialties: ["DSCR review", "rate assumptions", "LTV stress tests"],
    verified: true,
    rating: 4.8,
    contributionCount: 47,
    responseCta: "Check financing",
    dealTypesSupported: ["buy and hold", "BRRRR", "refinance"],
  },
];
