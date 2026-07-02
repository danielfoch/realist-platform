import { describe, expect, it } from "vitest";
import { paymentOutcome, sessionMatchesEvent, summarizeRoster } from "./eventCheckout";

describe("paymentOutcome", () => {
  it("treats a paid session as paid", () => {
    expect(paymentOutcome({ payment_status: "paid", status: "complete" })).toBe("paid");
  });

  it("treats a $0 comp (no_payment_required) as paid", () => {
    expect(paymentOutcome({ payment_status: "no_payment_required", status: "complete" })).toBe("paid");
  });

  it("treats an expired unpaid session as unpaid", () => {
    expect(paymentOutcome({ payment_status: "unpaid", status: "expired" })).toBe("unpaid");
  });

  it("treats an open/unpaid session (webhook not landed) as processing", () => {
    expect(paymentOutcome({ payment_status: "unpaid", status: "open" })).toBe("processing");
    expect(paymentOutcome({})).toBe("processing");
  });
});

describe("sessionMatchesEvent", () => {
  it("requires both the events source tag and a matching eventId", () => {
    const meta = { source: "realist_events", eventId: "evt_1" };
    expect(sessionMatchesEvent({ metadata: meta }, "evt_1")).toBe(true);
    expect(sessionMatchesEvent({ metadata: meta }, "evt_2")).toBe(false);
    expect(sessionMatchesEvent({ metadata: { source: "masterclass", eventId: "evt_1" } }, "evt_1")).toBe(false);
    expect(sessionMatchesEvent({ metadata: null }, "evt_1")).toBe(false);
  });
});

describe("summarizeRoster", () => {
  const orders = [
    { quantity: 2, amountPaidCents: 5000, status: "PAID" },
    { quantity: 1, amountPaidCents: 2500, status: "PAID" },
    { quantity: 1, amountPaidCents: 2500, status: "REFUNDED" },
  ];
  const attendees = [
    { ticketTypeId: "ga", checkedInAt: new Date() },
    { ticketTypeId: "ga", checkedInAt: null },
    { ticketTypeId: "vip", checkedInAt: "2026-09-15T18:00:00Z" },
  ];

  it("counts only PAID orders toward revenue and tickets", () => {
    const s = summarizeRoster(orders, attendees);
    expect(s.orderCount).toBe(2);
    expect(s.ticketsSold).toBe(3);
    expect(s.grossCents).toBe(7500);
  });

  it("tallies check-ins overall and per ticket type", () => {
    const s = summarizeRoster(orders, attendees);
    expect(s.attendees).toBe(3);
    expect(s.checkedIn).toBe(2);
    expect(s.checkedInByTicketType).toEqual({ ga: 1, vip: 1 });
    expect(s.soldByTicketType).toEqual({ ga: 2, vip: 1 });
  });

  it("handles an empty roster", () => {
    const s = summarizeRoster([], []);
    expect(s).toMatchObject({ orderCount: 0, ticketsSold: 0, attendees: 0, checkedIn: 0, grossCents: 0 });
  });
});
