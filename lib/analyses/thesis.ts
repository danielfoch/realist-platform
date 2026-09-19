/**
 * An investor's thesis, learned from what they do rather than what they say.
 *
 * Every call someone makes on a deal — pursue, watch, pass — next to the numbers
 * they underwrote it at is a labelled example of their judgement. Enough of them
 * and the pattern is plain: where they look, what they pay, how many units, and
 * the return at which a "no" becomes a "yes". That is their buy box. It drives
 * the deals we put in front of them, what the AI realtor knows about them, and
 * what our team sees in the CRM before they ever pick up the phone.
 *
 * Pure and explainable on purpose: medians and quartiles, never a model nobody
 * can read. The person can see exactly why a deal was suggested.
 */

export interface ThesisExample {
  verdict: "pursue" | "watch" | "pass" | null;
  city: string | null;
  province: string | null;
  price: number;
  units: number | null;
  capRate: number | null;
  monthlyCashFlow: number | null;
  downPaymentPercent?: number | null;
  source?: string | null;
}

export interface BuyBox {
  /** Calls the box was learned from. */
  calls: number;
  pursued: number;
  /** Where they say yes, most frequent first. */
  markets: Array<{ city: string; province: string | null; share: number }>;
  /** The middle half of what they'd pay. */
  priceLow: number;
  priceHigh: number;
  unitsLow: number;
  unitsHigh: number;
  /** The cap rate a deal needs before they say yes (lower quartile of what they pursued). */
  minCapRate: number | null;
  /** The worst monthly carry they've still said yes to. */
  carryFloor: number | null;
  /** Median cap rate of what they passed on — the other side of the line. */
  passedAtCapRate: number | null;
  typicalDownPercent: number | null;
}

/** Below this many "pursue" calls there is an anecdote, not a pattern. */
export const MIN_PURSUED = 3;

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

const numbers = (values: Array<number | null | undefined>) => values.filter((value): value is number => typeof value === "number" && isFinite(value));
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function learnBuyBox(examples: ThesisExample[]): BuyBox | null {
  const called = examples.filter((example) => example.verdict && example.price > 0 && example.source !== "multiplex");
  const pursued = called.filter((example) => example.verdict === "pursue");
  if (pursued.length < MIN_PURSUED) return null;
  // "Watch" is a soft yes: it widens where and what they look at, but not the return they demand.
  const interested = called.filter((example) => example.verdict !== "pass");
  const passed = called.filter((example) => example.verdict === "pass");

  const byMarket = new Map<string, { city: string; province: string | null; count: number }>();
  for (const example of interested) {
    const city = example.city?.trim();
    if (!city) continue;
    const key = `${example.province ?? ""}|${city.toLowerCase()}`;
    const entry = byMarket.get(key) ?? { city, province: example.province ?? null, count: 0 };
    entry.count += 1;
    byMarket.set(key, entry);
  }
  const placed = [...byMarket.values()].reduce((sum, entry) => sum + entry.count, 0);
  const markets = [...byMarket.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((entry) => ({ city: entry.city, province: entry.province, share: Math.round((entry.count / placed) * 100) / 100 }));

  const prices = interested.map((example) => example.price);
  const units = numbers(interested.map((example) => example.units));
  const caps = numbers(pursued.map((example) => example.capRate));
  const carries = numbers(pursued.map((example) => example.monthlyCashFlow));
  const passedCaps = numbers(passed.map((example) => example.capRate));
  const downs = numbers(pursued.map((example) => example.downPaymentPercent));

  return {
    calls: called.length,
    pursued: pursued.length,
    markets,
    priceLow: roundTo(quantile(prices, 0.25), 5_000),
    priceHigh: roundTo(quantile(prices, 0.75), 5_000),
    unitsLow: units.length ? Math.max(1, Math.round(quantile(units, 0.1))) : 1,
    unitsHigh: units.length ? Math.max(1, Math.round(quantile(units, 0.9))) : 1,
    minCapRate: caps.length >= MIN_PURSUED ? Math.round(quantile(caps, 0.25) * 10) / 10 : null,
    carryFloor: carries.length >= MIN_PURSUED ? roundTo(Math.min(...carries), 25) : null,
    passedAtCapRate: passedCaps.length >= MIN_PURSUED ? Math.round(quantile(passedCaps, 0.5) * 10) / 10 : null,
    typicalDownPercent: downs.length >= MIN_PURSUED ? Math.round(quantile(downs, 0.5)) : null,
  };
}

const dollars = (value: number) => (value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)}M` : `$${Math.round(value / 1000)}K`);

/**
 * The box in one sentence. To the member it is about them ("You pursue…"); in a
 * note for the agent who will call them it is about someone else ("Pursues…").
 */
export function describeBuyBox(box: BuyBox, voice: "member" | "agent" = "member"): string {
  const you = voice === "member";
  const where = box.markets.length === 0 ? null : box.markets.length === 1 ? box.markets[0].city : `${box.markets.slice(0, -1).map((market) => market.city).join(", ")} and ${box.markets[box.markets.length - 1].city}`;
  const size = box.unitsLow === box.unitsHigh ? (box.unitsLow === 1 ? "single-unit properties" : `${box.unitsLow}-unit properties`) : `${box.unitsLow}–${box.unitsHigh} unit properties`;
  const price = box.priceLow === box.priceHigh ? `around ${dollars(box.priceLow)}` : `between ${dollars(box.priceLow)} and ${dollars(box.priceHigh)}`;
  const parts = [`${you ? "You pursue" : "Pursues"} ${size}${where ? ` in ${where}` : ""}, ${price}`];
  if (box.minCapRate != null) parts.push(`at a cap rate of ${box.minCapRate.toFixed(1)}% or better`);
  let sentence = `${parts.join(", ")}.`;
  if (box.passedAtCapRate != null && box.minCapRate != null && box.passedAtCapRate < box.minCapRate) sentence += ` ${you ? "You pass" : "Passes"} around ${box.passedAtCapRate.toFixed(1)}%.`;
  if (box.carryFloor != null) {
    sentence += box.carryFloor < 0
      ? ` ${you ? "You'll carry" : "Will carry"} up to $${Math.abs(box.carryFloor).toLocaleString("en-CA")} a month for the right one.`
      : ` ${you ? "You don't buy" : "Doesn't buy"} negative carry.`;
  }
  return sentence;
}

/** Does a listing sit inside the box? Deliberately generous at the edges: a suggestion, not a filter. */
export function fitsBuyBox(box: BuyBox, listing: { city: string | null; price: number; units: number | null; netYield: number | null }): boolean {
  const inMarket = box.markets.length === 0 || box.markets.some((market) => market.city.toLowerCase() === (listing.city ?? "").trim().toLowerCase());
  const inPrice = listing.price >= box.priceLow * 0.85 && listing.price <= box.priceHigh * 1.15;
  const units = listing.units ?? 1;
  const inSize = units >= box.unitsLow && units <= Math.max(box.unitsHigh, box.unitsLow);
  const inReturn = box.minCapRate == null || (listing.netYield != null && listing.netYield >= box.minCapRate - 0.5);
  return inMarket && inPrice && inSize && inReturn;
}
