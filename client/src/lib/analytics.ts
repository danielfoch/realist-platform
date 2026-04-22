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
  | { event: "search_submitted"; query: string; geography?: string; asset_type?: string; budget_max?: number; source?: string }
  | { event: "nl_query_submitted"; query: string; matched_intent?: string }
  | { event: "listing_viewed"; listing_id: string; city?: string; property_type?: string; price?: number; gross_yield?: number }
  | { event: "geography_selected"; city: string; province?: string; source?: string }
  | { event: "asset_type_selected"; type: string; source?: string }

  // Deal Analyzer
  | { event: "analyzer_started"; address?: string; strategy?: string; source?: string }
  | { event: "analyzer_completed"; strategy: string; price?: number; city?: string; province?: string; gross_yield?: number; cash_on_cash?: number; irr?: number; cap_rate?: number }
  | { event: "analyzer_shared"; share_token: string }
  | { event: "analyzer_exported"; format: "pdf" | "sheets" }

  // Saves
  | { event: "saved_listing"; listing_id?: string; city?: string; price?: number }
  | { event: "saved_search"; filters: Record<string, unknown>; geography?: string }

  // Conversions
  | { event: "lead_captured"; source: string; strategy?: string }
  | { event: "newsletter_signup"; source?: string; page?: string }
  | { event: "consultation_requested"; type: "mortgage" | "realtor" | "coaching" | "general" }
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
  province?: string;
  budget_min?: number;
  budget_max?: number;
  target_gross_yield?: number;
  target_coc?: number;
  target_irr?: number;
  property_type?: string;
  financing_intent?: boolean;
  renovation_intent?: boolean;
  timeline?: string;
}

export function captureInvestorPreference(signal: InvestorPreferenceSignal): void {
  try {
    const existing = JSON.parse(sessionStorage.getItem("_rip") || "{}");
    const merged = { ...existing, ...signal, updated_at: Date.now() };
    sessionStorage.setItem("_rip", JSON.stringify(merged));
    // Also ship to server so it survives session
    track({ event: "feature_used", feature: "preference_signal", details: merged });
  } catch {}
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
