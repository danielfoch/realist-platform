/**
 * Pure helpers for event-ticket checkout hardening (Sept 15 on-sale).
 *
 * Kept side-effect-free so they can be unit-tested under shared/ and reused by
 * both the Stripe webhook path and the success-page verification path — the two
 * must agree on what "paid" means so a delayed webhook and an eager buyer never
 * disagree about whether a ticket is real.
 */

/** What the buyer's success page should show, derived from a Stripe session. */
export type PaymentOutcome = "paid" | "processing" | "unpaid";

/** Minimal shape of the Stripe Checkout.Session fields we reason about. */
export interface SessionPaymentView {
  payment_status?: string | null; // "paid" | "unpaid" | "no_payment_required"
  status?: string | null; // "open" | "complete" | "expired"
  metadata?: Record<string, string | undefined> | null;
}

/**
 * Collapse Stripe's two status axes into one buyer-facing outcome:
 *  - paid        → payment_status "paid" (or "no_payment_required" for $0 comps)
 *  - unpaid      → the session expired without payment
 *  - processing  → everything else (async payment method still settling, or the
 *                  webhook simply hasn't landed yet)
 */
export function paymentOutcome(session: SessionPaymentView): PaymentOutcome {
  const pay = (session.payment_status || "").toLowerCase();
  if (pay === "paid" || pay === "no_payment_required") return "paid";
  if ((session.status || "").toLowerCase() === "expired") return "unpaid";
  return "processing";
}

/** A verified session must be a real events checkout for THIS event. */
export function sessionMatchesEvent(session: SessionPaymentView, eventId: string): boolean {
  return session.metadata?.source === "realist_events" && session.metadata?.eventId === eventId;
}

export interface RosterOrderLike {
  quantity: number;
  amountPaidCents: number;
  status: string;
}

export interface RosterAttendeeLike {
  checkedInAt: Date | string | null;
  ticketTypeId: string;
}

export interface RosterSummary {
  orderCount: number;
  ticketsSold: number;
  attendees: number;
  checkedIn: number;
  grossCents: number;
  checkedInByTicketType: Record<string, number>;
  soldByTicketType: Record<string, number>;
}

/**
 * Door-ops summary for an event's roster. Only PAID orders count toward revenue
 * and ticket totals; refunded/pending orders are excluded from the money math
 * but their attendee rows (if any) are still counted for check-in reconciliation.
 */
export function summarizeRoster(
  orders: RosterOrderLike[],
  attendees: RosterAttendeeLike[],
): RosterSummary {
  const paid = orders.filter((o) => o.status === "PAID");
  const soldByTicketType: Record<string, number> = {};
  const checkedInByTicketType: Record<string, number> = {};
  let checkedIn = 0;
  for (const a of attendees) {
    soldByTicketType[a.ticketTypeId] = (soldByTicketType[a.ticketTypeId] ?? 0) + 1;
    if (a.checkedInAt) {
      checkedIn += 1;
      checkedInByTicketType[a.ticketTypeId] = (checkedInByTicketType[a.ticketTypeId] ?? 0) + 1;
    }
  }
  return {
    orderCount: paid.length,
    ticketsSold: paid.reduce((sum, o) => sum + o.quantity, 0),
    attendees: attendees.length,
    checkedIn,
    grossCents: paid.reduce((sum, o) => sum + o.amountPaidCents, 0),
    checkedInByTicketType,
    soldByTicketType,
  };
}
