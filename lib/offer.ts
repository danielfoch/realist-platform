/**
 * The cash-back offer, stated once. Every page that mentions it reads it from
 * here, so the site can never disagree with itself — or with what the partner
 * actually pays. The wording below is the copy approved for realist.ca on
 * Sept 14 2026 (`shared/keypr.ts` in the v1 app): an ONTARIO offer, delivered by
 * Keypr's RECO-licensed REALTORS®. Change the partner's terms here and nowhere else.
 *
 * NEXT_PUBLIC_CASHBACK_PERCENT overrides the figure without a code change.
 */

const configured = Number(process.env.NEXT_PUBLIC_CASHBACK_PERCENT);

/** Share of the buyer's agent commission the buyer keeps, paid at closing. */
export const CASHBACK_PERCENT = isFinite(configured) && configured > 0 && configured <= 100 ? Math.round(configured) : 80;

/** "80%" */
export const CASHBACK_LABEL = `${CASHBACK_PERCENT}%`;

/** "half" when that's what it is — otherwise the number. For running prose. */
export const CASHBACK_SHARE_WORDS = CASHBACK_PERCENT === 50 ? "half" : `${CASHBACK_PERCENT}%`;

/** The brokerage whose agents show the property, write the offer, and pay the cash back. */
export const CASHBACK_PARTNER = { name: "Keypr", url: "https://keypr.ca" } as const;

/** Where the offer is available. Elsewhere we introduce an agent and promise no figure. */
export const CASHBACK_PROVINCE = { code: "ON", name: "Ontario" } as const;

/** The brokerage that receives referral fees on introductions made through Realist. */
export const REFERRAL_BROKERAGE = "Valery Real Estate Inc.";

/** The commission the worked examples assume. Actual commission is whatever the listing offers. */
export const ASSUMED_COMMISSION_RATE = 0.025;

/** What the buyer keeps on a purchase at `price`, at the assumed commission. An estimate, always labelled as one. */
export function cashbackOn(price: number): number {
  return Math.round(price * ASSUMED_COMMISSION_RATE * (CASHBACK_PERCENT / 100));
}

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-CA")}`;

export const CASHBACK_OFFER_TEXT = `Keep ${CASHBACK_LABEL} of the buyer’s agent commission, paid at closing. That’s about ${dollars(cashbackOn(1_000_000))} on a $1M Toronto home, assuming a 2.5% buyer’s agent commission.`;
export const CASHBACK_SERVICE_TEXT = "Get help with showings, offer strategy, negotiation and closing from RECO-licensed REALTORS®. Nothing owed unless you buy.";
export const CASHBACK_ESTIMATE_NOTE = `Estimate based on a 2.5% buyer’s agent commission. Actual cashback depends on the commission offered and your agreement with ${CASHBACK_PARTNER.name}.`;
