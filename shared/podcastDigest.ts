/**
 * Pure helpers for the weekly podcast digest (The Canadian Real Estate
 * Investor). No fetch, no DB, no DOM — everything here is unit-testable in
 * isolation and shared between the server producer (server/podcastDigest.ts)
 * and its tests (shared/podcastDigest.test.ts).
 *
 * Responsibilities:
 *   - ISO-week dedupe key (one digest per user per ISO week).
 *   - Episode selection: which episodes are "new" since the user's last send.
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
