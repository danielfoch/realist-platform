# Realist Transaction Ledger Direction

## Verdict

Realist should become the permissioned system of record for investor deal-through transactions, not an open agent-to-agent marketplace first.

The core missing row is the assumption-to-outcome join: what an investor believed before the deal, tied to showing, offer, financing, close, GCI, referral fee, and lost-reason outcomes after the deal.

## Payee And Entity

Referral-fee payee for realtor referrals is:

**Valery Real Estate Inc.**

The public partner agreement and network copy should treat Valery Real Estate Inc. as the referring brokerage/payee for realtor referrals.

Mortgage broker referrals remain governed by the mortgage-broker network terms.

## Routing Policy

Default lead-routing policy:

- **Valery lane:** Ontario investor leads within roughly a two-hour drive of Toronto stay with Valery.
- **Partner-referral lane:** Leads outside Ontario are referred to signed local experts / realtor partners.
- **Manual-review lane:** Ontario markets outside the explicit Valery service zone are held for manual review until Dan sets the market-by-market policy.

Partners must sign the referral agreement before they can claim referred investor leads.

## Partner Enforcement

Outcome reporting should be a hard condition of continued lead flow.

Default posture:

- Status stale for 14 days: reminder/nudge.
- Repeated stale outcomes: pause routing until the partner updates statuses.
- Closed deal with missing GCI/referral-fee details: reconcile before future lead flow.

This is not punishment. It is the price of receiving investor leads with underwriting context.

## Local Expert / Meetup Host Story

The public story is:

- The Canadian Real Estate Investor Podcast invites selected professionals to claim local investor markets.
- Local experts get investor referrals, meetup-host visibility, and a CRM seat.
- The CRM backend is GHL-backed today.
- Homie becomes the future operating layer for follow-up, status management, and partner workflow automation.

This keeps the offer simple:

**Free software, deal-through fees.**

Do not revive paid directory tiers, Featured Expert fees, or meetup-host subscriptions as the main public story.

## MCP / DDF Position

Proceed with MCP build and private dry-runs.

Public demo posture:

- OK to show workflow and derived tools.
- Do not publicly expose listing-derived data through MCP until DDF / listing-data permissions are reviewed.
- Keep Deal Desk internals, referral ledger, partner conversion stats, model training corpus, sale-resolution ground truth, and outcome data private forever by default.

## Privacy / Consent

Persist Ask Realist conversations and agent payloads when users or key owners consent.

Default policy:

- Capture structured inputs needed for product improvement and routing.
- Avoid publishing raw user payloads.
- Serve derived outputs, not the underlying corpus.
- Explain this plainly at key mint / product entry points.

## Founding Market Sequence

Start with existing meetup-host and local-expert relationships.

At small N, partner quality is curation, not an algorithm. Route only after agreement + CRM workflow are in place.

## Data Rights

Sold-price and PropTx / VOW rights are a separate data-rights project. Code should assume sale-price providers are constrained until authorization is confirmed.

## Operating Principle

The moat is proprietary small-data outcome labels attached to a media-driven lead faucet.

If content stops, the faucet slows. If partners do not report, the ledger is useless. The product has to make reporting a byproduct of useful CRM, financing pre-flight, offer packs, and status nudges.
