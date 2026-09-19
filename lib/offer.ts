/**
 * The cash-back offer, stated once. Every page that mentions the rebate reads
 * it from here, so the figure on the site can never disagree with itself — or,
 * more importantly, with what the partner brokerage actually pays.
 *
 * NEXT_PUBLIC_CASHBACK_PERCENT overrides the default without a code change.
 */

const configured = Number(process.env.NEXT_PUBLIC_CASHBACK_PERCENT);

/** Share of the buyer-side commission rebated to the buyer at closing. */
export const CASHBACK_PERCENT = isFinite(configured) && configured > 0 && configured <= 100 ? Math.round(configured) : 50;

/** "50%" */
export const CASHBACK_LABEL = `${CASHBACK_PERCENT}%`;

/** "half" when that's what it is — otherwise the number. For running prose. */
export const CASHBACK_SHARE_WORDS = CASHBACK_PERCENT === 50 ? "half" : `${CASHBACK_PERCENT}%`;
