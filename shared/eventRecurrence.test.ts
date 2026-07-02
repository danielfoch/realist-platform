import { describe, expect, it } from "vitest";
import {
  isRecurrenceRule,
  nextOccurrenceStart,
  nextSpawnStart,
  occurrenceSlug,
  seriesBaseSlug,
} from "./eventRecurrence";

const T = (iso: string) => new Date(iso);

describe("nextOccurrenceStart", () => {
  it("weekly adds 7 days preserving time", () => {
    expect(nextOccurrenceStart("weekly", T("2026-06-09T23:00:00Z")).toISOString()).toBe("2026-06-16T23:00:00.000Z");
  });

  it("biweekly adds 14 days", () => {
    expect(nextOccurrenceStart("biweekly", T("2026-06-09T23:00:00Z")).toISOString()).toBe("2026-06-23T23:00:00.000Z");
  });

  it("monthly_same_weekday keeps the Nth-weekday slot", () => {
    // 2026-06-09 is the 2nd Tuesday of June → 2nd Tuesday of July is 2026-07-14
    expect(nextOccurrenceStart("monthly_same_weekday", T("2026-06-09T23:00:00Z")).toISOString()).toBe(
      "2026-07-14T23:00:00.000Z",
    );
  });

  it("monthly_same_weekday falls back to the 4th when there is no 5th occurrence", () => {
    // 2026-06-30 is the 5th Tuesday of June; July 2026 has only 4 Tuesdays → 4th Tuesday = 2026-07-28
    expect(nextOccurrenceStart("monthly_same_weekday", T("2026-06-30T23:00:00Z")).toISOString()).toBe(
      "2026-07-28T23:00:00.000Z",
    );
  });
});

describe("slug helpers", () => {
  it("appends the occurrence date and never stacks suffixes", () => {
    expect(occurrenceSlug("toronto-investor-meetup", T("2026-07-14T23:00:00Z"))).toBe(
      "toronto-investor-meetup-2026-07-14",
    );
    expect(occurrenceSlug("toronto-investor-meetup-2026-06-09", T("2026-07-14T23:00:00Z"))).toBe(
      "toronto-investor-meetup-2026-07-14",
    );
    expect(seriesBaseSlug("toronto-investor-meetup-2026-06-09")).toBe("toronto-investor-meetup");
  });
});

describe("nextSpawnStart", () => {
  const base = {
    isRecurring: true,
    recurrenceRule: "weekly" as string | null,
    recurrenceUntil: null as Date | null,
    startsAt: T("2026-06-09T23:00:00Z"),
    endsAt: T("2026-06-10T01:00:00Z"),
    status: "PUBLISHED",
  };
  const now = T("2026-06-12T00:00:00Z");

  it("spawns the next future occurrence after the event ends", () => {
    expect(nextSpawnStart(base, now)?.toISOString()).toBe("2026-06-16T23:00:00.000Z");
  });

  it("returns null while the event has not ended", () => {
    expect(nextSpawnStart(base, T("2026-06-09T12:00:00Z"))).toBeNull();
  });

  it("returns null for non-recurring, drafts, and unknown rules", () => {
    expect(nextSpawnStart({ ...base, isRecurring: false }, now)).toBeNull();
    expect(nextSpawnStart({ ...base, status: "DRAFT" }, now)).toBeNull();
    expect(nextSpawnStart({ ...base, recurrenceRule: "every-full-moon" }, now)).toBeNull();
  });

  it("rolls dormant series forward to the next future date", () => {
    // last occurrence months ago → next spawn is in the future, not a stale backfill
    const dormant = { ...base, startsAt: T("2026-01-06T23:00:00Z"), endsAt: T("2026-01-07T01:00:00Z") };
    const next = nextSpawnStart(dormant, now);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
    expect(next!.getUTCDay()).toBe(2); // still a Tuesday
  });

  it("stops at recurrenceUntil", () => {
    expect(nextSpawnStart({ ...base, recurrenceUntil: T("2026-06-14T00:00:00Z") }, now)).toBeNull();
  });

  it("rule guard", () => {
    expect(isRecurrenceRule("weekly")).toBe(true);
    expect(isRecurrenceRule("monthly_same_weekday")).toBe(true);
    expect(isRecurrenceRule("yearly")).toBe(false);
  });
});
