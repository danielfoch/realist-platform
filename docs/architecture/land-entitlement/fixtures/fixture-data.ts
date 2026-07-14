export const stages = [
  "unknown", "pre_application", "application_submitted", "deemed_complete", "under_review",
  "recommendation_or_appeal", "approved", "conditions_or_agreements", "permits_or_site_works",
  "under_construction", "completed", "withdrawn", "refused", "expired",
] as const;
export type Stage = typeof stages[number];

export type FixtureRecord = { id:string; municipality:string; site:string; track:string; stage:Stage; previous?:Stage; matchScore?:number };
export const records: FixtureRecord[] = stages.map((stage, i) => ({
  id:`r${i+1}`, municipality:`Fake ${String.fromCharCode(65 + i%3)}`, site:`site-${i+1}`, track:"zoning_bylaw_amendment", stage,
}));
records.push({ id:"r15", municipality:"Fake A", site:"parallel", track:"zoning_bylaw_amendment", stage:"approved" });
records.push({ id:"r16", municipality:"Fake A", site:"parallel", track:"site_plan", stage:"under_review" });
records.push({ id:"r17", municipality:"Fake B", site:"fuzzy", track:"site_plan", stage:"application_submitted", matchScore:0.81 });
records.push({ id:"r18", municipality:"Fake C", site:"illegal", track:"building_permit", previous:"application_submitted", stage:"completed" });

export const assumptions = {
  base: { rentPerUnitMonthly:3000, expenseRatio:0.30, hardCostPerUnit:360000, otherCost:850000, vacancy:0.03, amortYears:40, dscr:1.10 },
  bull: { rentPerUnitMonthly:3300, expenseRatio:0.28, hardCostPerUnit:335000, otherCost:800000, vacancy:0.02, amortYears:40, dscr:1.10 },
  bear: { rentPerUnitMonthly:2700, expenseRatio:0.34, hardCostPerUnit:395000, otherCost:925000, vacancy:0.05, amortYears:40, dscr:1.15 },
};

export const expectedCells = [
  { units:5, rate:0.04, debtCap:2215419.63 },
  { units:6, rate:0.05, debtCap:2304228.00 },
];
