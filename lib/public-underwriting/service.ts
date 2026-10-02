import { houseDefaults, underwrite, readTheDeal, solveOfferPrice, type UnderwriterField, type UnderwriterInputs } from "@/lib/underwriting/underwriter";
import { templateMemo } from "@/lib/underwriting/dealMemo";
import { numericFields, type RentalRequest } from "./model";

export const PUBLIC_BASE = "https://realist-lean.vercel.app";
export const SAMPLE = { address: "Sample Hamilton triplex", city: "Hamilton", province: "ON", price: 750000, monthlyRent: 5400, units: 3, downPaymentPercent: 25, interestRate: 5.5, annualPropertyTax: 6500, annualInsurance: 2400 };

export function calculateRental(request: RentalRequest) {
  const defaults = houseDefaults({ price: request.price, monthlyRent: request.monthlyRent, units: request.units, city: request.city, province: request.province });
  const inputs = { ...defaults };
  const assumed = new Set(request.assumedFields?.split(",").filter(Boolean) ?? []);
  const provenance = {} as Record<UnderwriterField, "caller_supplied" | "model_default">;
  for (const field of numericFields) {
    if (request[field] !== undefined) inputs[field] = request[field]!;
    provenance[field] = request[field] === undefined || assumed.has(field) ? "model_default" : "caller_supplied";
  }
  const metrics = underwrite(inputs);
  const memo = templateMemo({ address: request.address, city: request.city, province: request.province, rentSourceLabel: "Caller supplied rent", rentEdited: true }, inputs);
  // Debt coverage has no denominator on an all-cash acquisition.
  const verdict = inputs.downPaymentPercent === 100
    ? { tone: metrics.monthlyCashFlow! >= 0 ? "good" as const : "bad" as const, headline: metrics.monthlyCashFlow! >= 0 ? "Positive operating cash flow on an all-cash purchase." : "Operating costs exceed rent on an all-cash purchase.", detail: "DSCR is not applicable because there is no mortgage." }
    : readTheDeal(metrics);
  if (inputs.downPaymentPercent === 100) memo.headline = verdict.headline;
  const scenario = (label: string, changes: Partial<UnderwriterInputs>) => ({ label, changes, metrics: underwrite({ ...inputs, ...changes }) });
  const sensitivity = [
    scenario("Base", {}),
    scenario("Rent −10%", { monthlyRent: inputs.monthlyRent * 0.9 }),
    scenario("Rent +10%", { monthlyRent: inputs.monthlyRent * 1.1 }),
    scenario("Rate +1 point", { interestRate: inputs.interestRate + 1 }),
    scenario("Rate −1 point", { interestRate: Math.max(0, inputs.interestRate - 1) }),
    scenario("Vacancy +5 points", { vacancyPercent: Math.min(100, inputs.vacancyPercent + 5) }),
  ];
  const snapshot = new URLSearchParams();
  for (const [key, value] of Object.entries(inputs)) snapshot.set(key, String(value));
  for (const key of ["address", "city", "province"] as const) if (request[key]) snapshot.set(key, request[key]!);
  const assumedFields = numericFields.filter(field => provenance[field] === "model_default");
  if (assumedFields.length) snapshot.set("assumedFields", assumedFields.join(","));
  const link = (path: string) => `${PUBLIC_BASE}${path}?${snapshot}`;
  return {
    success: true, apiVersion: "1.0", currency: "CAD", calculationVersion: metrics.calculationVersion,
    property: { address: request.address ?? null, city: request.city ?? null, province: request.province ?? null },
    inputs, provenance, metrics, verdict, memo, sensitivity,
    offerPrices: {
      breakEvenCashFlow: solveOfferPrice(inputs, { metric: "cash_flow", value: 0 }),
      dscr120: solveOfferPrice(inputs, { metric: "dscr", value: 1.2 }),
    },
    charts: {
      cashFlow: { unit: "CAD/month", grossRent: inputs.monthlyRent, operatingCosts: metrics.annualOperatingExpenses! / 12, debtService: metrics.monthlyDebtService, netCashFlow: metrics.monthlyCashFlow },
      sensitivity: sensitivity.map(row => ({ label: row.label, cashFlowMonthly: row.metrics.monthlyCashFlow, dscr: row.metrics.dscr })),
    },
    visuals: { png: link("/api/underwriting/chart.png"), svg: link("/api/underwriting/chart.svg"), report: link("/api/underwriting/report"), json: link("/api/underwriting") },
    notes: [
      "Caller-supplied price, rent and property information are scenario inputs, not independently verified facts.",
      "Rates and returns use percentage points: interestRate=5.5 means 5.5%. Canadian semi-annual mortgage compounding; cash-on-cash and IRR include closing costs.",
      "The price solver searches 5% to 300% of the input price; insurance and closing costs scale with trial price, while property tax and operating assumptions stay fixed. Its result is a scenario threshold, not a valuation or a financing approval.",
      "Assumptions are embedded in visual links. Anyone with a link can read them; no member analysis, lead or community record is created.",
      ...(assumedFields.length ? [`Model defaults requiring confirmation: ${assumedFields.join(", ")}.`] : []),
      ...(inputs.vacancyPercent + inputs.managementPercent + inputs.maintenancePercent > 100 ? ["Vacancy, management and maintenance allowances together exceed gross rent."] : []),
      ...(inputs.holdPeriodYears > inputs.amortizationYears ? ["Hold period exceeds mortgage amortization; the current engine keeps debt service constant in its hold projection."] : []),
      ...metrics.calculationWarnings,
    ],
  };
}
export type RentalResult = ReturnType<typeof calculateRental>;
