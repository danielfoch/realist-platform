/**
 * Tests for the flagship-event helpers (client/src/lib/flagshipEvent.ts).
 *
 * The important behaviour is what happens on and after September 15: every promo
 * surface keys off hasEnded(), so a bug here means the site keeps advertising a
 * date that has passed — which reads as abandoned, and is the exact failure the
 * auto-hide was written to prevent.
 */
import { describe, expect, it } from "vitest";
import { FLAGSHIP_EVENT, daysUntil, hasEnded, urgencyLabel } from "./flagshipEvent";

const BEFORE = new Date("2026-09-01T12:00:00-04:00");
const DAY_BEFORE = new Date("2026-09-14T12:00:00-04:00");
const DURING = new Date("2026-09-15T19:00:00-04:00");
const AFTER = new Date("2026-09-16T09:00:00-04:00");

describe("FLAGSHIP_EVENT", () => {
  it("ends after it starts", () => {
    expect(FLAGSHIP_EVENT.endsAt.getTime()).toBeGreaterThan(FLAGSHIP_EVENT.startsAt.getTime());
  });

  it("points at a real in-app route", () => {
    expect(FLAGSHIP_EVENT.href.startsWith("/")).toBe(true);
    expect(FLAGSHIP_EVENT.href).toContain(FLAGSHIP_EVENT.slug);
  });
});

describe("hasEnded", () => {
  it("is false well before the event", () => {
    expect(hasEnded(BEFORE)).toBe(false);
  });

  it("is false while the event is running", () => {
    // Someone opening the site mid-event should still see the promo.
    expect(hasEnded(DURING)).toBe(false);
  });

  it("is true the morning after", () => {
    expect(hasEnded(AFTER)).toBe(true);
  });
});

describe("daysUntil", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    // Noon on the 14th to a 5pm start on the 15th is 29 hours — but a reader
    // calls that "tomorrow", i.e. 1 day.
    expect(daysUntil(DAY_BEFORE)).toBe(1);
  });

  it("returns null once the event has started", () => {
    expect(daysUntil(DURING)).toBeNull();
    expect(daysUntil(AFTER)).toBeNull();
  });

  it("counts a fortnight correctly", () => {
    expect(daysUntil(new Date("2026-09-01T12:00:00-04:00"))).toBe(14);
  });
});

describe("urgencyLabel", () => {
  it("stays quiet when the event is far off", () => {
    // No fake scarcity: if there is nothing true to say, say nothing.
    expect(urgencyLabel(new Date("2026-07-01T12:00:00-04:00"))).toBeNull();
  });

  it("counts down inside two weeks", () => {
    expect(urgencyLabel(new Date("2026-09-05T12:00:00-04:00"))).toBe("In 10 days");
  });

  it("says tomorrow on the eve", () => {
    expect(urgencyLabel(DAY_BEFORE)).toBe("Tomorrow");
  });

  it("says today once it starts", () => {
    expect(urgencyLabel(DURING)).toBe("Happening today");
  });

  it("returns null after the event so nothing stale renders", () => {
    expect(urgencyLabel(AFTER)).toBeNull();
  });
});
