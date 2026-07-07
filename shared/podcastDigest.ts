/**
 * Pure helpers for the weekly podcast digest / "everything Realist published
 * this week" roundup (The Canadian Real Estate Investor). No fetch, no DB, no
 * DOM — everything here is unit-testable in isolation and shared between the
 * server producer (server/podcastDigest.ts) and its tests
 * (shared/podcastDigest.test.ts).
 *
 * Responsibilities:
 *   - ISO-week dedupe key (one digest per user per ISO week).
 *   - Episode selection: which episodes are "new" since the user's last send.
 *   - Roundup selection: which reports/videos fall inside the weekly send
 *     window (the last 7 days before the send), and the send/skip decision.
 *   - Summary extraction/truncation from RSS show-notes (2-3 clean sentences).
 *
 * See server/podcastDigest.ts for the send loop, governor wiring, and the
 * AI-summary seam.
 */

// ---------------------------------------------------------------------------
// ISO week key
// ---------------------------------------------------------------------------

/**
 * ISO-8601 week number for a date (weeks start Monday; week 1 is the week
 * containing the first Thursday of the year). Returns { year, week } where
 * `year` is the ISO week-year (which can differ from the calendar year in
 * late December / early January).
 */
export function isoWeek(date: Date): { year: number; week: number } {
  // Copy so we don't mutate the caller's date; work in UTC to stay TZ-stable.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of the current week decides the ISO week-year.
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // move to Thursday
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { year: isoYear, week };
}

/**
 * Dedupe key for one user's digest in a given ISO week:
 * `podcast_digest:<userId>:<yyyy-Www>` (week zero-padded to two digits). The
 * governor's per-type dedupe collapses any second sweep in the same ISO week
 * to a no-op, so a user gets at most one digest per week no matter how often
 * the sweep runs.
 */
export function podcastDigestDedupeKey(userId: string, date: Date): string {
  return `podcast_digest:${userId}:${isoWeekKey(date)}`;
}

/** Bare ISO-week token, e.g. "2026-W27". Exported for logging/preview. */
export function isoWeekKey(date: Date): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Episode selection since last send
// ---------------------------------------------------------------------------

export interface DigestEpisode {
  slug: string;
  title: string;
  /** Raw show-notes HTML from the RSS feed. */
  description: string;
  pubDate: string;
  duration: string;
  imageUrl: string;
}

export interface SelectEpisodesOptions {
  /**
   * Only include episodes published strictly after this instant. Null/undefined
   * means "first send" — fall back to the lookback window so a brand-new
   * subscriber gets the most recent episode(s) rather than the whole back
   * catalogue.
   */
  since?: Date | null;
  /** For a first send (no `since`), include episodes newer than this. */
  firstSendLookback?: Date;
  /** Hard cap on episodes per digest so a busy week can't produce a wall of text. */
  maxEpisodes?: number;
}

/** Parse an RSS pubDate to epoch ms, or null when unparseable. */
export function parsePubDate(pubDate: string): number | null {
  const t = new Date(pubDate).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Pick the episodes a given user should see this week, newest first.
 *
 * - With `since` (the user's last-digest timestamp): every episode published
 *   strictly after it, capped at `maxEpisodes`.
 * - Without `since` (first-ever digest for this user): every episode published
 *   after `firstSendLookback` (default: caller supplies), capped — so a new
 *   subscriber gets recent episodes, not the archive.
 *
 * Episodes with an unparseable pubDate are skipped (they can't be time-scoped
 * safely). Input order is not assumed; output is sorted newest-first.
 */
export function selectEpisodesForDigest<T extends DigestEpisode>(
  episodes: T[],
  options: SelectEpisodesOptions = {},
): T[] {
  const { since, firstSendLookback, maxEpisodes = 3 } = options;
  const threshold =
    since instanceof Date && !Number.isNaN(since.getTime())
      ? since.getTime()
      : firstSendLookback instanceof Date && !Number.isNaN(firstSendLookback.getTime())
        ? firstSendLookback.getTime()
        : null;

  const withTime = episodes
    .map((episode) => ({ episode, t: parsePubDate(episode.pubDate) }))
    .filter((entry): entry is { episode: T; t: number } => entry.t !== null);

  const eligible =
    threshold === null ? withTime : withTime.filter((entry) => entry.t > threshold);

  eligible.sort((a, b) => b.t - a.t); // newest first
  return eligible.slice(0, Math.max(0, maxEpisodes)).map((entry) => entry.episode);
}

// ---------------------------------------------------------------------------
// Weekly roundup: send window + report/video selection + skip decision
// ---------------------------------------------------------------------------

/**
 * One non-episode content item in the weekly roundup ("New on Realist"):
 * a config report today, a YouTube video once the rail lands. `date` is an
 * ISO date (YYYY-MM-DD, parsed as UTC midnight) or any Date-parseable
 * timestamp — config reports use their `publishDate`, videos will use their
 * upload timestamp.
 */
export interface RoundupItem {
  slug: string;
  title: string;
  /** Optional standfirst shown under the title in the email. */
  dek?: string;
  date: string;
}

/** The roundup covers everything published in the last 7 days before a send. */
export const ROUNDUP_WINDOW_DAYS = 7;

/** A half-open send window: items strictly after `start`, at-or-before `end`. */
export interface SendWindow {
  start: Date;
  end: Date;
}

/** The weekly boundary the roundup window anchors to: Thursday 13:00 UTC —
 * MUST match the sweep cron ("0 13 * * 4", scheduled in Etc/UTC). */
export const ROUNDUP_BOUNDARY = { isoWeekday: 4, hourUtc: 13 } as const;

/**
 * The send window for a weekly roundup sent at `sendAt`: the 7 days ending at
 * the most recent weekly boundary (Thursday 13:00 UTC) at-or-before `sendAt`
 * — NOT the 7 days ending at `sendAt` itself. Anchoring to a stable boundary
 * instead of the actual sweep time means an off-schedule run (manual admin
 * sweep on a Monday, cron jitter, DST shift of the host clock) computes the
 * SAME window as that week's scheduled send: consecutive weekly windows tile
 * exactly by construction, and the dedupe key derived from window.end (see
 * the sweep) suppresses off-schedule re-sends of the same window.
 *
 * Known limitation (accepted): the window has no memory of the last
 * successful send, so a report whose code deploys AFTER its window closed
 * (e.g. publishDate = this Thursday, deployed Thursday afternoon) is never
 * featured. Date reports for the upcoming Thursday or deploy before
 * Thursday 13:00 UTC.
 */
export function roundupSendWindow(sendAt: Date, days: number = ROUNDUP_WINDOW_DAYS): SendWindow {
  const end = lastWeeklyBoundary(sendAt);
  return {
    start: new Date(end.getTime() - days * 24 * 60 * 60 * 1000),
    end,
  };
}

/** Most recent Thursday 13:00 UTC at-or-before `at` (fixed-ms UTC math). */
export function lastWeeklyBoundary(at: Date): Date {
  const candidate = new Date(Date.UTC(
    at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), ROUNDUP_BOUNDARY.hourUtc,
  ));
  const dayDelta = (candidate.getUTCDay() - ROUNDUP_BOUNDARY.isoWeekday + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() - dayDelta);
  if (candidate.getTime() > at.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() - 7);
  }
  return candidate;
}

/**
 * Pick the roundup items that fall inside the send window, newest first.
 * Boundary semantics match episode selection: strictly after `start` (an item
 * exactly on the previous send instant was already covered by last week's
 * window), and at-or-before `end`. Items with an unparseable `date` are
 * skipped — they can't be time-scoped safely. Capped at `maxItems`.
 */
export function selectItemsForWindow<T extends RoundupItem>(
  items: T[],
  window: SendWindow,
  maxItems: number = 5,
): T[] {
  const start = window.start.getTime();
  const end = window.end.getTime();
  return items
    .map((item) => ({ item, t: parsePubDate(item.date) }))
    .filter((entry): entry is { item: T; t: number } => entry.t !== null)
    .filter((entry) => entry.t > start && entry.t <= end)
    .sort((a, b) => b.t - a.t)
    .slice(0, Math.max(0, maxItems))
    .map((entry) => entry.item);
}

/** The non-episode content selected for one week's roundup. */
export interface RoundupExtras<R extends RoundupItem, V extends RoundupItem> {
  reports: R[];
  videos: V[];
}

/**
 * Window-select every non-episode content type for the roundup in one pass.
 * Videos flow through EXACTLY like reports — today the server passes an empty
 * videos array (see the getNewVideos() seam in server/podcastDigest.ts); when
 * the YouTube rail (PR #121) lands, its items are windowed here with no
 * further changes.
 */
export function selectRoundupExtras<R extends RoundupItem, V extends RoundupItem>(
  input: { reports: R[]; videos: V[] },
  window: SendWindow,
  opts: { maxReports?: number; maxVideos?: number } = {},
): RoundupExtras<R, V> {
  return {
    reports: selectItemsForWindow(input.reports, window, opts.maxReports ?? 5),
    videos: selectItemsForWindow(input.videos, window, opts.maxVideos ?? 5),
  };
}

/**
 * The empty-week rule: a roundup email is sent only when there is at least one
 * new episode, report, or video. Otherwise the sweep skips the user and logs —
 * never an empty email.
 */
export function hasRoundupContent(selection: {
  episodes: readonly unknown[];
  reports: readonly unknown[];
  videos: readonly unknown[];
}): boolean {
  return (
    selection.episodes.length > 0 ||
    selection.reports.length > 0 ||
    selection.videos.length > 0
  );
}

// ---------------------------------------------------------------------------
// Summary extraction + truncation
// ---------------------------------------------------------------------------

/** Strip tags/entities from show-notes HTML to plain text (one line). */
export function showNotesToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>(?=\S)/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the 2-3 sentence episode summary shown in the digest.
 *
 * Today the summary source is the RSS show-notes: convert to plain text, keep
 * the first `maxSentences` sentences, and hard-cap the length so a novella of
 * show notes can't blow out the email. When truncation happens mid-text an
 * ellipsis is appended.
 *
 * SEAM: this is the single function a future AI-written summary would replace
 * (see server/podcastDigest.ts getEpisodeSummary). Keep it pure and
 * signature-stable so the swap is a one-liner in the server producer.
 */
export function summarizeShowNotes(
  html: string,
  opts: { maxSentences?: number; maxChars?: number } = {},
): string {
  const { maxSentences = 3, maxChars = 320 } = opts;
  const text = showNotesToPlainText(html);
  if (!text) return "";

  // Split on sentence boundaries, keeping the terminator with the sentence.
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  let summary = sentences
    .slice(0, Math.max(1, maxSentences))
    .map((sentence) => sentence.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (summary.length > maxChars) {
    // Cut on a word boundary, then append an ellipsis.
    summary = `${summary.slice(0, maxChars - 1).replace(/\s+\S*$/, "").trim()}…`;
  }
  return summary;
}
