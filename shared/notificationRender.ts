/**
 * Pure renderer: notification_queue (templateKey, payloadJson) -> a human
 * line for the in-app inbox. No IO, no dates, no framework imports — safe to
 * unit test and to share between server (API rendering) and client.
 *
 * Payload reality (see the producers):
 * - server/notifications.ts enqueues GhlNotificationPayload rows (channel
 *   "ghl_webhook") whose payloads always carry subjectLine / reasonText /
 *   previewText / ctaUrl. templateKey = NotificationKind.
 * - server/weeklyDigest.ts enqueues "weekly_leaderboard_digest" with the same
 *   GHL-style payload shape.
 * - server/monthlyWinnerEmail.ts enqueues "monthly_leaderboard_winner"
 *   (channel "email_resend") with { rank, dealCount, monthKey, monthLabel }.
 * - server/podcastDigest.ts enqueues "podcast_digest" (channel
 *   "email_resend") with { week, episodeSlugs }.
 *
 * Unknown keys fall back to a humanized key plus whatever GHL-style fields
 * the payload happens to carry, so new producers degrade gracefully.
 */

export type RenderedNotification = {
  title: string;
  body: string;
  /** Site-relative path when the CTA points at realist.ca, absolute URL when external, null when absent. */
  link: string | null;
};

/** Default human line per known templateKey, used when the payload has no subjectLine. */
export const DEFAULT_TITLES: Record<string, string> = {
  saved_search_match: "New listings match your saved search",
  analysis_created: "New analysis on a listing you watch",
  analysis_updated: "Updated numbers on a listing you watch",
  comment_created: "New comment on a listing you watch",
  comment_reply: "Someone replied to your comment",
  consensus_shifted: "Community consensus shifted on a listing you watch",
  listing_price_changed: "Price change on a listing you watch",
  listing_status_changed: "Status change on a listing you watch",
  analyzer_completed: "Your deal analysis is ready",
  inactive_high_intent: "Deals are moving in your market",
  multiplex_intent: "Multiplex opportunity update",
  distress_intent: "Motivated seller update",
  daily_digest_ready: "Your daily market digest is ready",
  weekly_leaderboard_digest: "Your weekly Realist leaderboard digest",
  co_analysis_alert: "Another investor analyzed a listing you underwrote",
  milestone_reached: "You reached a new analyst milestone",
  note_vote_update: "Your field note is getting votes",
  monthly_leaderboard_winner: "You made the monthly leaderboard",
  podcast_digest: "New Realist podcast episodes are live",
};

const REALIST_ORIGINS = /^https?:\/\/(www\.)?realist\.ca(?=[/?#]|$)/i;

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** "some_new_key" / "some-new-key" -> "Some new key". */
export function humanizeTemplateKey(templateKey: string): string {
  const words = templateKey.replace(/[_-]+/g, " ").trim();
  if (!words) return "Notification";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * Make CTA links navigable in-app: realist.ca URLs become site-relative
 * paths (wouter can route them); anything else passes through untouched.
 */
export function internalizeLink(url: unknown): string | null {
  const value = str(url);
  if (!value) return null;
  if (value.startsWith("/")) {
    // Collapse protocol-relative "//host" — it would navigate cross-origin.
    return value.startsWith("//") ? `/${value.replace(/^\/+/, "")}` : value;
  }
  if (REALIST_ORIGINS.test(value)) {
    const path = value.replace(REALIST_ORIGINS, "").replace(/^\/+/, "/");
    return path.startsWith("/") || path.startsWith("?") || path.startsWith("#") ? path || "/" : `/${path}`;
  }
  // External links: http(s) only, and no userinfo — javascript:/data: would
  // make the inbox a script-URL launcher, and "https://realist.ca@evil.com"
  // is a lookalike that actually navigates to evil.com. Payloads are
  // producer-written today; one buggy producer must not open either hole.
  if (!/^https?:\/\//i.test(value)) return null;
  return /^https?:\/\/[^/?#]*@/i.test(value) ? null : value;
}

export function renderNotification(templateKey: string, payload: unknown): RenderedNotification {
  const data = asRecord(payload);

  // Resend-channel producers store minimal payloads; give them bespoke lines.
  if (templateKey === "monthly_leaderboard_winner") {
    const rank = num(data.rank);
    const dealCount = num(data.dealCount);
    const monthLabel = str(data.monthLabel);
    return {
      title: rank
        ? `You ranked #${rank} on the ${monthLabel ?? "monthly"} leaderboard`
        : DEFAULT_TITLES.monthly_leaderboard_winner,
      body: dealCount != null
        ? `${dealCount} deal${dealCount === 1 ? "" : "s"} analyzed${monthLabel ? ` in ${monthLabel}` : ""}. See where you stand.`
        : "See where you stand on the Realist leaderboard.",
      link: "/community/leaderboard",
    };
  }

  if (templateKey === "podcast_digest") {
    const episodes = Array.isArray(data.episodeSlugs) ? data.episodeSlugs.length : 0;
    return {
      title: DEFAULT_TITLES.podcast_digest,
      body: episodes > 0
        ? `${episodes} new episode${episodes === 1 ? "" : "s"} this week. Listen on Realist.`
        : "Fresh investor conversations are up. Listen on Realist.",
      link: "/insights/podcast",
    };
  }

  // GHL-style payloads (and the sensible default for unknown keys).
  const title = str(data.subjectLine) ?? DEFAULT_TITLES[templateKey] ?? humanizeTemplateKey(templateKey);
  const body = str(data.reasonText) ?? str(data.previewText) ?? "";
  return { title, body, link: internalizeLink(data.ctaUrl) };
}
