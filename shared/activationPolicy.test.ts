import { describe, expect, it } from "vitest";
import {
  ACTIVATION_DORMANCY_DAYS,
  ACTIVATION_EMAIL_TYPE,
  ACTIVATION_MAX_LIFETIME_ATTEMPTS,
  ACTIVATION_MIN_DAYS_BETWEEN_SENDS,
  activationDedupeKey,
  decideActivationSend,
  isDormant,
  type ActivationState,
} from "./activationPolicy";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-07-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

/** A dormant, never-emailed, passwordless user — the base eligible case. */
function state(overrides: Partial<ActivationState> = {}): ActivationState {
  return {
    hasPassword: false,
    lastActivityAt: daysAgo(60),
    lastSentAt: null,
    attemptsSent: 0,
    ...overrides,
  };
}

describe("isDormant", () => {
  it("treats never-active (null) as dormant", () => {
    expect(isDormant(null, NOW)).toBe(true);
  });

  it("is exact at the 30-day boundary (>= dormancyDays is dormant)", () => {
    expect(isDormant(daysAgo(ACTIVATION_DORMANCY_DAYS), NOW)).toBe(true);
    expect(isDormant(new Date(daysAgo(ACTIVATION_DORMANCY_DAYS).getTime() + 1), NOW)).toBe(false);
    expect(isDormant(daysAgo(29), NOW)).toBe(false);
  });
});

describe("decideActivationSend", () => {
  it("sends attempt 1 to a dormant passwordless user with no prior sends", () => {
    expect(decideActivationSend(state(), NOW)).toEqual({ send: true, attemptNumber: 1 });
    // Never-active (no signal at all) is also dormant → eligible.
    expect(decideActivationSend(state({ lastActivityAt: null }), NOW)).toEqual({
      send: true,
      attemptNumber: 1,
    });
  });

  it("skips active users — recent activity means the in-app banner owns the nudge", () => {
    expect(decideActivationSend(state({ lastActivityAt: daysAgo(5) }), NOW)).toEqual({
      send: false,
      reason: "active",
    });
    // Boundary: activity exactly 30 days ago is dormant → eligible.
    expect(
      decideActivationSend(state({ lastActivityAt: daysAgo(ACTIVATION_DORMANCY_DAYS) }), NOW),
    ).toEqual({ send: true, attemptNumber: 1 });
  });

  it("enforces the rolling 30-day spacing between attempts", () => {
    const spaced = state({ lastSentAt: daysAgo(29), attemptsSent: 1, lastActivityAt: daysAgo(90) });
    expect(decideActivationSend(spaced, NOW)).toEqual({ send: false, reason: "too_soon" });
    expect(
      decideActivationSend({ ...spaced, lastSentAt: daysAgo(ACTIVATION_MIN_DAYS_BETWEEN_SENDS) }, NOW),
    ).toEqual({ send: true, attemptNumber: 2 });
  });

  it("retires the address forever after 6 lifetime attempts", () => {
    const veteran = state({ lastSentAt: daysAgo(45), lastActivityAt: daysAgo(400) });
    expect(
      decideActivationSend({ ...veteran, attemptsSent: ACTIVATION_MAX_LIFETIME_ATTEMPTS }, NOW),
    ).toEqual({ send: false, reason: "retired" });
    // The 6th (final) attempt itself still goes out.
    expect(
      decideActivationSend({ ...veteran, attemptsSent: ACTIVATION_MAX_LIFETIME_ATTEMPTS - 1 }, NOW),
    ).toEqual({ send: true, attemptNumber: 6 });
  });

  it("stops forever once ANY activity lands after the last send — even if dormant again now", () => {
    // Sent 90d ago, they came back 40d ago, dormant again since: activation
    // succeeded; renewed dormancy is retention's problem, not activation's.
    expect(
      decideActivationSend(
        state({ lastSentAt: daysAgo(90), lastActivityAt: daysAgo(40), attemptsSent: 2 }),
        NOW,
      ),
    ).toEqual({ send: false, reason: "activated_after_send" });
    // Activity strictly BEFORE the last send does not stop the sequence.
    expect(
      decideActivationSend(
        state({ lastSentAt: daysAgo(40), lastActivityAt: daysAgo(90), attemptsSent: 2 }),
        NOW,
      ),
    ).toEqual({ send: true, attemptNumber: 3 });
  });

  it("stops forever once a password is set, ahead of every other rule", () => {
    expect(decideActivationSend(state({ hasPassword: true }), NOW)).toEqual({
      send: false,
      reason: "password_set",
    });
    // Precedence: password_set wins even over retirement.
    expect(
      decideActivationSend(state({ hasPassword: true, attemptsSent: 10 }), NOW),
    ).toEqual({ send: false, reason: "password_set" });
  });

  it("numbers attempts from the lifetime log count (burned/capped rows included)", () => {
    expect(
      decideActivationSend(state({ attemptsSent: 3, lastSentAt: daysAgo(35) }), NOW),
    ).toEqual({ send: true, attemptNumber: 4 });
  });

  it("prefers retirement over dormancy/spacing checks but not over password_set", () => {
    // Retired even though otherwise perfectly due (dormant, well-spaced).
    expect(
      decideActivationSend(
        state({ attemptsSent: ACTIVATION_MAX_LIFETIME_ATTEMPTS, lastSentAt: daysAgo(90) }),
        NOW,
      ),
    ).toEqual({ send: false, reason: "retired" });
  });
});

describe("activationDedupeKey", () => {
  it("embeds the attempt number so a burned attempt never blocks the next one", () => {
    expect(activationDedupeKey(1)).toBe(`${ACTIVATION_EMAIL_TYPE}:1`);
    expect(activationDedupeKey(6)).toBe(`${ACTIVATION_EMAIL_TYPE}:6`);
    expect(activationDedupeKey(2)).not.toBe(activationDedupeKey(3));
  });
});
