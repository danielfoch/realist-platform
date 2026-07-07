/**
 * FCM push payloads for watchlist + saved-search alerts (pure, shared).
 *
 * Builds the exact Firebase Cloud Messaging (HTTP v1) message JSON for the
 * ONLY two notification kinds we push — watchlist price changes and
 * saved-search matches — and mirrors the consent gate the email path uses
 * (server/watchlists.ts allowsWatchAlerts / notifications.ts
 * recipientAllows("listing")). Keep this file free of DB / IO / node imports;
 * the sender lives in server/fcm.ts and unit tests in shared/fcmPayload.test.ts.
 *
 * Item shapes intentionally mirror the email payloads the sweep already
 * enqueues (server/emailQueue.ts WatchlistPriceChangeItem /
 * SavedSearchMatchesItem) so the sweep can hand the SAME payload to both
 * channels.
 */

export const PUSH_KINDS = ["watchlist_price_change", "saved_search_matches"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** Mirror of server/emailQueue.ts WatchlistPriceChangeItem. */
export interface PushPriceChangeItem {
  listingKey: string;
  address?: string | null;
  city?: string | null;
  previousPrice: number;
  currentPrice: number;
  direction: "drop" | "increase";
}

/** Mirror of server/emailQueue.ts SavedSearchMatchesItem. */
export interface PushSearchMatchesItem {
  name: string;
  matchCount: number;
  city?: string | null;
  /** Relative /tools/cap-rates?... deep link from buildCapRatesSearchUrl. */
  url: string;
  sampleAddresses?: string[];
}

export interface WatchlistPriceChangePushPayload {
  items: PushPriceChangeItem[];
}

export interface SavedSearchMatchesPushPayload {
  searches: PushSearchMatchesItem[];
}

export type PushPayload = WatchlistPriceChangePushPayload | SavedSearchMatchesPushPayload;

/** Human-facing pieces of a push, before FCM envelope wrapping. */
export interface PushContent {
  title: string;
  body: string;
  /** Absolute https://realist.ca deep link (webpush fcm_options requires absolute). */
  link: string;
}

/**
 * FCM HTTP v1 message (minus the per-device `token`, added by the sender).
 * `data` values must be strings per the FCM spec. Native (Capacitor iOS /
 * Android) taps read data.link; web tokens follow webpush.fcm_options.link.
 */
export interface FcmMessage {
  notification: { title: string; body: string };
  data: { kind: PushKind; link: string };
  webpush: { fcm_options: { link: string } };
  apns: { payload: { aps: { sound: string } } };
}

/** Same formatting as server/emailQueue.ts formatDollars. */
function formatDollars(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `$${Math.round(value).toLocaleString("en-CA")}`;
}

function buildPriceChangeContent(payload: WatchlistPriceChangePushPayload): PushContent {
  const items = payload.items || [];
  const first = items[0];
  const label = first?.address || first?.listingKey || "a listing you watch";
  const title = `Price change on ${label}`;

  const move = first
    ? `${first.direction === "increase" ? "Up" : "Down"} from ${formatDollars(first.previousPrice)} to ${formatDollars(first.currentPrice)}`
    : "A listing you watch changed price";
  const body = items.length > 1
    ? `${move} — and ${items.length - 1} more on your watchlist moved`
    : move;

  // Same CTA target as the email (server/emailQueue.ts buildWatchlistPriceChangeEmail).
  const params = new URLSearchParams();
  if (first?.listingKey) params.set("mls", first.listingKey);
  if (first?.address) params.set("address", first.address);
  if (first?.city) params.set("city", first.city);
  if (first?.currentPrice) params.set("price", String(first.currentPrice));
  params.set("utm_source", "push");
  params.set("utm_campaign", "watchlist_price_change");
  return { title, body, link: `https://realist.ca/tools/analyzer?${params.toString()}` };
}

function buildSearchMatchesContent(payload: SavedSearchMatchesPushPayload): PushContent {
  const searches = payload.searches || [];
  const first = searches[0];
  const title = first
    ? `${first.matchCount} new match${first.matchCount === 1 ? "" : "es"} for "${first.name}"`
    : "New listings match your saved search";

  const samples = (first?.sampleAddresses || []).slice(0, 2).join(" · ");
  const rest = searches.length > 1
    ? `${samples ? " — plus" : "Plus"} matches on ${searches.length - 1} more saved search${searches.length === 2 ? "" : "es"}`
    : "";
  const body = `${samples}${rest}` || "Fresh inventory just hit your criteria — run the numbers.";

  const relative = first?.url || "/tools/cap-rates";
  const joiner = relative.includes("?") ? "&" : "?";
  return {
    title,
    body,
    link: `https://realist.ca${relative}${joiner}utm_source=push&utm_campaign=saved_search_matches`,
  };
}

/** Title/body/deep-link for a push, from the same payload the email sweep enqueues. */
export function buildPushContent(kind: "watchlist_price_change", payload: WatchlistPriceChangePushPayload): PushContent;
export function buildPushContent(kind: "saved_search_matches", payload: SavedSearchMatchesPushPayload): PushContent;
export function buildPushContent(kind: PushKind, payload: PushPayload): PushContent;
export function buildPushContent(kind: PushKind, payload: PushPayload): PushContent {
  return kind === "watchlist_price_change"
    ? buildPriceChangeContent(payload as WatchlistPriceChangePushPayload)
    : buildSearchMatchesContent(payload as SavedSearchMatchesPushPayload);
}

/** Wrap already-built content in the FCM v1 message envelope (token added by sender). */
export function buildFcmEnvelope(push: PushContent & { kind: PushKind }): FcmMessage {
  return {
    notification: { title: push.title, body: push.body },
    data: { kind: push.kind, link: push.link },
    webpush: { fcm_options: { link: push.link } },
    apns: { payload: { aps: { sound: "default" } } },
  };
}

/** The exact FCM message JSON for one of the two push kinds. */
export function buildPushMessage(kind: PushKind, payload: PushPayload): FcmMessage {
  return buildFcmEnvelope({ ...buildPushContent(kind, payload), kind });
}

/**
 * Consent gate for BOTH watch-alert channels — EMAIL AND PUSH share this
 * exact rule (server/watchlists.ts allowsWatchAlerts delegates here, so a
 * change to this function changes who receives alert EMAILS too): absent
 * preference row = allowed (prefs default on), otherwise the master
 * product-updates switch AND the listing-watch switch must both be enabled.
 * Push is deliberately NOT routed through the email governor — these are
 * explicit, user-requested alerts.
 */
export function shouldSendWatchAlert(
  prefs: { productUpdatesEnabled?: boolean | null; listingWatchAlertsEnabled?: boolean | null } | null | undefined,
): boolean {
  if (!prefs) return true;
  return Boolean(prefs.productUpdatesEnabled && prefs.listingWatchAlertsEnabled);
}

/**
 * Dead-device classification per the FCM v1 error contract. Deliberately
 * NARROW: a token is dead only when FCM says so about THE TOKEN —
 * 404 + UNREGISTERED (app uninstalled / token rotated), or
 * 400 + INVALID_ARGUMENT that names message.token (malformed token).
 * A bare 404 (wrong project_id / FCM API disabled) or a payload-shaped
 * INVALID_ARGUMENT must NOT classify as dead: the caller deactivates dead
 * tokens, and over-matching here would sweep the whole device-token table
 * on a config typo or payload regression.
 */
export function isDeadTokenResponse(status: number, body: string): boolean {
  if (body.includes("UNREGISTERED")) return true;
  if (status === 400 && body.includes("INVALID_ARGUMENT") && body.includes("message.token")) return true;
  return false;
}
