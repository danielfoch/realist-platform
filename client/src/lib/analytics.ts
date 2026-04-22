/**
 * Realist.ca Event Tracking
 *
 * Every event captured here is a labeled data point for future AI systems:
 * - Search queries → training data for NL deal-finding models
 * - Analyzer inputs → underwriting dataset with structured preferences
 * - Geographic selections → market demand signal dataset
 * - Conversion events → intent classification labels
 * - Saved searches / listings → implicit preference feedback
 *
 * Design principle: fire-and-forget, never block UX, always degrade gracefully.
 *
 * Labeled data strategy (see /docs/PLATFORM_AI_STRATEGY.md for full detail):
 * - user query + clicked result = search relevance label
 * - analyzer input + accepted assumptions = underwriting norm label
 * - saved listing + price/yield = investor preference label
 * - partner match accepted/ignored = routing quality label
 */

// ─── Event Taxonomy ───────────────────────────────────────────────────────────

export type RealistEvent =
  // Discovery
  | { event: "search_submitted"; query: string; geography?: string; asset_type?: string; budget_max?: number; strategy?: string; property_type?: string; target_gross_yield?: number; source?: string }
  | { event: "nl_query_submitted"; query: string; matched_intent?: string }
  | { event: "listing_viewed"; listing_id: string; city?: string; property_type?: string; price?: number; gross_yield?: number }
  | { event: "geography_selected"; city: string; province?: string; source?: string }
  | { event: "asset_type_selected"; type: string; source?: string }

  // Deal Analyzer
  | { event: "analyzer_started"; address?: string; strategy?: string; geography?: string; budget_max?: number; property_type?: string; source?: string }
  | { event: "analyzer_completed"; strategy: string; price?: number; city?: string; province?: string; property_type?: string; gross_yield?: number; cash_on_cash?: number; irr?: number; cap_rate?: number }
  | { event: "analyzer_shared"; share_token: string }
  | { event: "analyzer_exported"; format: "pdf" | "sheets" }

  // Saves
  | { event: "saved_listing"; listing_id?: string; city?: string; price?: number; strategy?: string; property_type?: string; source?: string }
  | { event: "saved_search"; filters: Record<string, unknown>; geography?: string }

  // Conversions
  | { event: "lead_captured"; source: string; strategy?: string; geography?: string; budget_max?: number }
  | { event: "newsletter_signup"; source?: string; page?: string }
  | { event: "consultation_requested"; type: "mortgage" | "realtor" | "coaching" | "general"; context?: string; city?: string; strategy?: string }
  | { event: "partner_interest"; partner_type: "realtor" | "lender" | "investor" | "service" }
  | { event: "account_created"; method: "email" | "google" }

  // Content
  | { event: "page_viewed"; path: string; referrer?: string; title?: string }
  | { event: "content_consumed"; content_type: "podcast" | "blog" | "guide" | "report"; content_id?: string; title?: string }
  | { event: "cta_clicked"; cta: string; location: string; destination?: string }
  | { event: "feature_used"; feature: string; details?: Record<string, unknown> };

// ─── Structured Preference Capture ───────────────────────────────────────────
// Extracted from analyzer inputs to build investor preference profiles

export interface InvestorPreferenceSignal {
  strategy?: "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb";
  geography?: string;
  preferred_geographies?: string[];
  province?: string;
  budget_min?: number;
  budget_max?: number;
  target_gross_yield?: number;
  target_coc?: number;
  target_irr?: number;
  property_type?: string;
  property_types?: string[];
  target_returns?: string[];
  financing_intent?: boolean;
  renovation_intent?: boolean;
  development_intent?: boolean;
  search_query?: string;
  timeline?: string;
}

export interface SavedSearchSignal {
  id: string;
  createdAt: string;
  label: string;
  query?: string;
  geography?: string;
  strategy?: string;
  propertyType?: string;
  budgetMax?: number;
  targetGrossYield?: number;
  targetCashOnCash?: number;
  targetIrr?: number;
  financingIntent?: boolean;
  renovationIntent?: boolean;
}

export interface SavedListingSignal {
  id: string;
  createdAt: string;
  label: string;
  listingId?: string;
  address?: string;
  city?: string;
  strategy?: string;
  propertyType?: string;
  price?: number;
  monthlyCashFlow?: number;
  capRate?: number;
  source?: string;
}

export interface DiscoverySignalsPayload {
  savedSearches: SavedSearchSignal[];
  savedListings: SavedListingSignal[];
  recentViewedListings: SavedListingSignal[];
}

const INVESTOR_PREFERENCE_KEY = "_rip";
const SAVED_SEARCHES_KEY = "realist_saved_searches";
const SAVED_LISTINGS_KEY = "realist_saved_listing_drafts";
const RECENT_VIEWED_LISTINGS_KEY = "realist_recent_viewed_listings";

function uniqueStrings(values: Array<string | undefined>): string[] | undefined {
  const normalized = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (!normalized.length) return undefined;
  return Array.from(new Set(normalized));
}

export function captureInvestorPreference(signal: InvestorPreferenceSignal): void {
  try {
    const existing = JSON.parse(sessionStorage.getItem(INVESTOR_PREFERENCE_KEY) || "{}");
    const merged = {
      ...existing,
      ...signal,
      preferred_geographies: uniqueStrings([
        ...(Array.isArray(existing.preferred_geographies) ? existing.preferred_geographies : []),
        ...(Array.isArray(signal.preferred_geographies) ? signal.preferred_geographies : []),
        signal.geography,
      ]),
      property_types: uniqueStrings([
        ...(Array.isArray(existing.property_types) ? existing.property_types : []),
        ...(Array.isArray(signal.property_types) ? signal.property_types : []),
        signal.property_type,
      ]),
      target_returns: uniqueStrings([
        ...(Array.isArray(existing.target_returns) ? existing.target_returns : []),
        ...(Array.isArray(signal.target_returns) ? signal.target_returns : []),
      ]),
      updated_at: Date.now(),
    };
    sessionStorage.setItem(INVESTOR_PREFERENCE_KEY, JSON.stringify(merged));
    // Also ship to server so it survives session
    track({ event: "feature_used", feature: "preference_signal", details: merged });
  } catch {}
}

export function getInvestorPreferenceSnapshot(): Record<string, unknown> {
  try {
    return JSON.parse(sessionStorage.getItem(INVESTOR_PREFERENCE_KEY) || "{}");
  } catch {
    return {};
  }
}

function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalArray<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getSavedSearchSignals(): SavedSearchSignal[] {
  return readLocalArray<SavedSearchSignal>(SAVED_SEARCHES_KEY);
}

export function persistSavedSearchSignal(search: SavedSearchSignal): void {
  const existing = getSavedSearchSignals();
  writeLocalArray(SAVED_SEARCHES_KEY, [search, ...existing.filter((item) => item.id !== search.id)].slice(0, 25));
}

export function removeSavedSearchSignal(searchId: string): void {
  const existing = getSavedSearchSignals();
  writeLocalArray(
    SAVED_SEARCHES_KEY,
    existing.filter((item) => item.id !== searchId),
  );
}

export function getSavedListingSignals(): SavedListingSignal[] {
  return readLocalArray<SavedListingSignal>(SAVED_LISTINGS_KEY);
}

export function persistSavedListingSignal(listing: SavedListingSignal): void {
  const existing = getSavedListingSignals();
  writeLocalArray(SAVED_LISTINGS_KEY, [listing, ...existing.filter((item) => item.id !== listing.id)].slice(0, 25));
}

export function removeSavedListingSignal(listingKey: string): void {
  const existing = getSavedListingSignals();
  writeLocalArray(
    SAVED_LISTINGS_KEY,
    existing.filter((item) => (item.listingId || item.address || item.id) !== listingKey),
  );
}

export function getRecentViewedListingSignals(): SavedListingSignal[] {
  return readLocalArray<SavedListingSignal>(RECENT_VIEWED_LISTINGS_KEY);
}

export function persistRecentViewedListingSignal(listing: SavedListingSignal): void {
  const existing = getRecentViewedListingSignals();
  const dedupeKey = (item: SavedListingSignal) => item.listingId || item.address || item.id;
  writeLocalArray(
    RECENT_VIEWED_LISTINGS_KEY,
    [listing, ...existing.filter((item) => dedupeKey(item) !== dedupeKey(listing))].slice(0, 12),
  );
}

export function removeRecentViewedListingSignal(listingKey: string): void {
  const existing = getRecentViewedListingSignals();
  writeLocalArray(
    RECENT_VIEWED_LISTINGS_KEY,
    existing.filter((item) => (item.listingId || item.address || item.id) !== listingKey),
  );
}

export function getDiscoverySignalsPayload(): DiscoverySignalsPayload {
  return {
    savedSearches: getSavedSearchSignals(),
    savedListings: getSavedListingSignals(),
    recentViewedListings: getRecentViewedListingSignals(),
  };
}

export function hydrateDiscoverySignals(payload: Partial<DiscoverySignalsPayload>): void {
  if (payload.savedSearches) {
    writeLocalArray(SAVED_SEARCHES_KEY, payload.savedSearches.slice(0, 25));
  }
  if (payload.savedListings) {
    writeLocalArray(SAVED_LISTINGS_KEY, payload.savedListings.slice(0, 25));
  }
  if (payload.recentViewedListings) {
    writeLocalArray(RECENT_VIEWED_LISTINGS_KEY, payload.recentViewedListings.slice(0, 12));
  }
}

let discoverySyncPromise: Promise<DiscoverySignalsPayload | null> | null = null;

export async function syncDiscoverySignalsWithAccount(): Promise<DiscoverySignalsPayload | null> {
  if (discoverySyncPromise) {
    return discoverySyncPromise;
  }

  discoverySyncPromise = (async () => {
    try {
      const response = await fetch("/api/user/discovery-signals/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getDiscoverySignalsPayload()),
        credentials: "include",
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Discovery sync failed: ${response.status}`);
      }

      const payload = await response.json() as DiscoverySignalsPayload;
      hydrateDiscoverySignals(payload);
      return payload;
    } catch {
      return null;
    } finally {
      discoverySyncPromise = null;
    }
  })();

  return discoverySyncPromise;
}

// ─── Core Track Function ──────────────────────────────────────────────────────

export function track(payload: RealistEvent): void {
  try {
    const body = {
      ...payload,
      ts: Date.now(),
      session_id: getSessionId(),
      page: window.location.pathname,
      referrer: document.referrer || undefined,
    };
    fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// ─── Session Identity ─────────────────────────────────────────────────────────

let _sid: string | null = null;

function getSessionId(): string {
  if (_sid) return _sid;
  try {
    _sid = sessionStorage.getItem("_rsid");
    if (!_sid) {
      _sid = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("_rsid", _sid);
    }
  } catch {
    _sid = Math.random().toString(36).slice(2);
  }
  return _sid;
}
