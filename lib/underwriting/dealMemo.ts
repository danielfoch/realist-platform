/**
 * The deal memo: what a good investor-realtor would tell you across the table
 * after looking at your numbers. The template version here is pure and
 * complete on its own — every sentence is derived from the engine, so it can't
 * invent a figure. lib/ai/dealMemoWriter.ts can rewrite it with Claude, and is
 * held to the same numbers.
 */

import { coverageContext, solveOfferPrice, underwrite, type UnderwriterInputs } from "./underwriter";

export interface MemoDeal {
  address?: string | null;
  city?: string | null;
  province?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  /** Where the starting rent came from, e.g. "Actual rent", "Rent comps", "CMHC average". */
  rentSourceLabel?: string | null;
  /** Did the person change the rent from what we offered? */
  rentEdited?: boolean;
  taxFromListing?: boolean;
}

/** The "what if" numbers a lender or a careful partner would ask for. */
export interface Sensitivities {
  /** Cash flow if the rate is one point higher at renewal. */
  cashFlowRatePlus1: number | null;
  /** Cash flow if rents come in 10% under. */
  cashFlowRentMinus10: number | null;
  /** Total monthly rent at which the deal breaks even. */
  breakEvenRent: number | null;
  /** IRR with no appreciation at all — what the property earns on its own. */
  irrNoAppreciation: number | null;
  pricePerUnit: number | null;
  /** Rent as a share of price, per month (the "1% rule" number). */
  rentToPricePercent: number | null;
}

export interface DealMemo {
  headline: string;
  summary: string;
  working: string[];
  watch: string[];
  beforeYouOffer: string[];
  offer: { breakEven: number | null; lenderReady: number | null; line: string };
  sensitivities: Sensitivities;
}

// A true minus sign, the same one the rest of the interface uses.
const money = (value: number) => `${value < 0 ? "−" : ""}$${Math.abs(Math.round(value)).toLocaleString("en-CA")}`;

function breakEvenRent(inputs: UnderwriterInputs): number | null {
  if (!(inputs.price > 0)) return null;
  const cashFlowAt = (rent: number) => underwrite({ ...inputs, monthlyRent: rent }).monthlyCashFlow ?? -Infinity;
  let low = 0;
  let high = Math.max(inputs.monthlyRent * 4, inputs.price * 0.03);
  if (cashFlowAt(high) < 0) return null;
  for (let i = 0; i < 50 && high - low > 1; i += 1) {
    const mid = (low + high) / 2;
    if (cashFlowAt(mid) >= 0) high = mid;
    else low = mid;
  }
  return Math.ceil(high / 10) * 10;
}

export function sensitivities(inputs: UnderwriterInputs): Sensitivities {
  return {
    cashFlowRatePlus1: underwrite({ ...inputs, interestRate: inputs.interestRate + 1 }).monthlyCashFlow,
    cashFlowRentMinus10: underwrite({ ...inputs, monthlyRent: inputs.monthlyRent * 0.9 }).monthlyCashFlow,
    breakEvenRent: breakEvenRent(inputs),
    irrNoAppreciation: underwrite({ ...inputs, annualAppreciationPercent: 0 }).irr,
    pricePerUnit: inputs.units > 0 && inputs.price > 0 ? Math.round(inputs.price / inputs.units) : null,
    rentToPricePercent: inputs.price > 0 && inputs.monthlyRent > 0 ? Math.round((inputs.monthlyRent / inputs.price) * 10000) / 100 : null,
  };
}

function inspectionFocus(yearBuilt: number | null | undefined): string {
  if (!yearBuilt) return "Inspection with someone who inspects rentals: roof, foundation, electrical service, plumbing stacks, and each unit's fire separation and egress.";
  if (yearBuilt < 1950) return `Built ${yearBuilt}: ask the inspector about knob-and-tube wiring, galvanized or lead supply lines, clay sewer laterals, and asbestos — each changes what insurance and a lender will accept.`;
  if (yearBuilt < 1980) return `Built ${yearBuilt}: ask the inspector about aluminum wiring, 60-amp service, cast-iron stacks and any vermiculite insulation.`;
  if (yearBuilt < 2000) return `Built ${yearBuilt}: check for Kitec or polybutylene plumbing, the age of the roof and furnace, and window seals.`;
  return `Built ${yearBuilt}: the big items should have life left — confirm with the inspector, and ask for any warranty or permit records.`;
}

export function templateMemo(deal: MemoDeal, inputs: UnderwriterInputs): DealMemo {
  const result = underwrite(inputs);
  const what = sensitivities(inputs);
  const cashFlow = result.monthlyCashFlow ?? 0;
  const dscr = result.dscr ?? 0;
  const breakEven = solveOfferPrice(inputs, { metric: "cash_flow", value: 0 });
  const lenderReady = solveOfferPrice(inputs, { metric: "dscr", value: 1.2 });
  const place = `this ${deal.propertyType?.trim().toLowerCase() || "property"}${deal.city ? ` in ${deal.city}` : ""}`;

  const working: string[] = [];
  const watch: string[] = [];

  if (cashFlow >= 0) working.push(`It carries itself: ${money(cashFlow)} a month after the mortgage and every operating cost you entered.`);
  const lender = coverageContext(inputs.units);
  if (dscr >= 1.2) working.push(`Rent covers the mortgage ${dscr.toFixed(2)} times over, which ${lender.comfortable}.`);
  // Leverage, stated from the person's own numbers rather than a claim about "the market".
  if (result.capRate != null && result.capRate > inputs.interestRate) {
    working.push(`The cap rate (${result.capRate.toFixed(1)}%) is above your mortgage rate (${inputs.interestRate}%): every borrowed dollar earns more than it costs.`);
  }
  if (deal.rentSourceLabel === "Actual rent" && !deal.rentEdited) working.push("The rent is the seller's reported actual rent, not an estimate — the income side is on firmer ground than most listings.");
  if (what.cashFlowRatePlus1 != null && what.cashFlowRatePlus1 >= 0) working.push(`It survives a rate shock: a full point higher at renewal still leaves ${money(what.cashFlowRatePlus1)} a month.`);
  if (what.irrNoAppreciation != null && what.irrNoAppreciation >= 6) working.push(`Even with zero appreciation the IRR is ${what.irrNoAppreciation.toFixed(1)}% — the return doesn't depend on the market going up.`);

  if (cashFlow < 0) watch.push(`Negative carry: you would add ${money(Math.abs(cashFlow))} every month. That's a bet on appreciation or on raising the rent — name which one.`);
  if (dscr > 0 && dscr < 1.2) watch.push(`Coverage of ${dscr.toFixed(2)} ${lender.thin}.`);
  if (result.capRate != null && result.capRate < inputs.interestRate) {
    watch.push(`The cap rate (${result.capRate.toFixed(1)}%) is below your mortgage rate (${inputs.interestRate}%): borrowing costs more than the property earns, so the return has to come from appreciation or higher rents.`);
  }
  if (what.cashFlowRatePlus1 != null && cashFlow >= 0 && what.cashFlowRatePlus1 < 0) watch.push(`One point higher at renewal turns it negative (${money(what.cashFlowRatePlus1)} a month). Pick your term with that in mind.`);
  if (what.cashFlowRentMinus10 != null && what.cashFlowRentMinus10 < 0 && cashFlow >= 0) watch.push(`If rents come in 10% under, cash flow goes to ${money(what.cashFlowRentMinus10)} a month. The rent number is the one to be sure of.`);
  if (deal.rentSourceLabel && deal.rentSourceLabel !== "Actual rent" && !deal.rentEdited) watch.push(`The rent is an estimate (${deal.rentSourceLabel.toLowerCase()}), not this building's rent roll. Everything downstream depends on it.`);
  if (deal.taxFromListing === false) watch.push("The property tax is inferred at 1% of price. Get the actual bill — in some municipalities it is half that, in others nearly double.");
  if (inputs.managementPercent === 0) watch.push("You've priced management at zero. If you ever hire it out — or value your own time — budget 8–10% of rent.");
  if (inputs.vacancyPercent < 3) watch.push(`Vacancy at ${inputs.vacancyPercent}% leaves no room for turnover. One empty month in a year is already 8%.`);
  if (what.irrNoAppreciation != null && result.irr != null && result.irr - what.irrNoAppreciation > 6) watch.push(`Most of the ${result.irr.toFixed(1)}% IRR is appreciation: with none, it's ${what.irrNoAppreciation.toFixed(1)}%.`);
  if (inputs.monthlyCondoFees > 0) watch.push("Condo fees rise faster than rents in most buildings. Read the status certificate and the reserve fund study before you firm up.");

  const beforeYouOffer = [
    deal.rentSourceLabel === "Actual rent" ? "Ask for the rent roll and the leases: amounts, start dates, who pays which utilities, and any tenants on month-to-month." : "Ask the listing agent for the current rents and leases — or three real comparable rentals if it's vacant.",
    "Get the last tax bill, a year of utility bills, and an insurance quote for a rental at this address.",
    inspectionFocus(deal.yearBuilt),
    "Confirm every unit is legal: a retrofit certificate or permits for any second suite. An illegal unit is income a lender won't count.",
  ];

  const offerLine =
    breakEven == null
      ? "No price in range makes this rent cover the mortgage — it's a rent or a financing problem, not a price problem."
      : breakEven >= inputs.price
        ? `The price above already breaks even${lenderReady != null && lenderReady < inputs.price ? `; for 1.20 coverage${lender.commercial ? ", which a commercial lender sizes to," : ""} you'd need ${money(lenderReady)}` : ""}.`
        : `Break-even is ${money(breakEven)}${lenderReady != null ? `, and ${money(lenderReady)} gets you to 1.20 coverage` : ""}. Open below the number you need, with financing and inspection conditions.`;

  const headline =
    cashFlow >= 0 && dscr >= 1.2 ? "This one pencils." : cashFlow >= 0 ? "It works, with no margin for error." : breakEven != null ? "It works at a lower price." : "The rent doesn't support this one.";

  return {
    headline,
    summary: `At ${money(inputs.price)} with ${inputs.downPaymentPercent}% down, ${place} returns a ${result.capRate?.toFixed(1) ?? "—"}% cap rate and ${money(cashFlow)} a month after a ${money(result.monthlyDebtService ?? 0)} mortgage payment, on ${money(result.cashInvested ?? 0)} of your cash.`,
    working: working.length ? working : ["Nothing about the numbers stands out yet — which is an answer. Change the price or the rent and see what moves."],
    watch: watch.length ? watch : ["No red flags in the numbers themselves. The risk is now in the building: see the list below."],
    beforeYouOffer,
    offer: { breakEven, lenderReady, line: offerLine },
    sensitivities: what,
  };
}
