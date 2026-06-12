// Recurrence engine for Realist meetups — the mechanical piece behind
// "recurring Realist meetups always present" (the meetup.com replacement).
//
// Deliberately small: three rules, next-occurrence math, and slug generation.
// A daily server job clones an ended recurring event into its next occurrence;
// no iCal RRULE parsing, no infinite series tables. Pure module, no DB.

export const RECURRENCE_RULES = ["weekly", "biweekly", "monthly_same_weekday"] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  return typeof value === "string" && (RECURRENCE_RULES as readonly string[]).includes(value);
}

export const RECURRENCE_RULE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly_same_weekday: "Monthly (same weekday, e.g. 2nd Tuesday)",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Next occurrence start for a rule, preserving time of day.
 * monthly_same_weekday keeps the "Nth <weekday> of the month" position
 * (a meetup on the 2nd Tuesday recurs on next month's 2nd Tuesday). If the
 * source date is the 5th such weekday, months without a 5th fall back to
 * the 4th (the last one).
 */
export function nextOccurrenceStart(rule: RecurrenceRule, from: Date): Date {
  if (rule === "weekly") return new Date(from.getTime() + 7 * DAY_MS);
  if (rule === "biweekly") return new Date(from.getTime() + 14 * DAY_MS);

  // monthly_same_weekday
  const weekday = from.getUTCDay();
  const nth = Math.floor((from.getUTCDate() - 1) / 7); // 0-based week-of-month
  const next = new Date(from);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  // first <weekday> of the next month
  const firstWeekdayOffset = (weekday - next.getUTCDay() + 7) % 7;
  let date = 1 + firstWeekdayOffset + nth * 7;
  const daysInMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  if (date > daysInMonth) date -= 7; // no 5th occurrence this month → use the 4th
  next.setUTCDate(date);
  return next;
}

/** Strip any trailing -YYYY-MM-DD occurrence suffix from a slug. */
export function seriesBaseSlug(slug: string): string {
  return slug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

/** Slug for a specific occurrence: base-slug-YYYY-MM-DD (UTC date). */
export function occurrenceSlug(slug: string, startsAt: Date): string {
  return `${seriesBaseSlug(slug)}-${startsAt.toISOString().slice(0, 10)}`;
}

export interface RecurringEventLike {
  isRecurring: boolean;
  recurrenceRule: string | null;
  recurrenceUntil: Date | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
}

/**
 * Decide the next occurrence to spawn for an ended recurring event.
 * Returns null when nothing should be created: not recurring, unknown rule,
 * event not over yet, or the series has reached recurrenceUntil. When an
 * event has been dormant for several periods, the next occurrence is rolled
 * forward into the future instead of spawning stale past dates (capped to
 * avoid loops on corrupt data).
 */
export function nextSpawnStart(event: RecurringEventLike, now: Date): Date | null {
  if (!event.isRecurring || event.status !== "PUBLISHED") return null;
  if (!isRecurrenceRule(event.recurrenceRule)) return null;
  const over = (event.endsAt ?? event.startsAt).getTime() < now.getTime();
  if (!over) return null;

  let next = nextOccurrenceStart(event.recurrenceRule, event.startsAt);
  for (let i = 0; next.getTime() <= now.getTime() && i < 36; i++) {
    next = nextOccurrenceStart(event.recurrenceRule, next);
  }
  if (next.getTime() <= now.getTime()) return null;
  if (event.recurrenceUntil && next.getTime() > event.recurrenceUntil.getTime()) return null;
  return next;
}
