/**
 * Frontend event tracking utility.
 *
 * Usage:
 *   import { track } from '../lib/event-tracking';
 *   track('listing_view', { mls_number: 'W1234567' });
 *
 * All calls are fire-and-forget (no await needed).
 * Session ID is auto-generated on first call and persisted in sessionStorage.
 */

type EventName =
  | 'page_view'
  | 'signup_started'
  | 'signup_completed'
  | 'login'
  | 'logout'
  | 'listing_search'
  | 'listing_view'
  | 'listing_favorite'
  | 'deal_analyzer_start'
  | 'deal_analyzer_report_generated'
  | 'deal_analyzer_saved'
  | 'listing_analyze_click'
  | 'listing_lead_submitted'
  | 'investor_signup_started'
  | 'investor_signup_completed'
  | 'lead_form_started'
  | 'lead_form_submitted'
  | 'realtor_signup_started'
  | 'realtor_signup_completed'
  | 'realtor_market_claimed'
  | 'realtor_lead_claimed'
  | 'subscription_checkout_started'
  | 'subscription_completed'
  | 'subscription_canceled';

const SESSION_KEY = 'realist_session_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function track(event: EventName, properties?: Record<string, unknown>): void {
  const payload = {
    event,
    properties: properties ?? {},
    session_id: getSessionId(),
  };

  // Fire-and-forget POST — navigator.sendBeacon guarantees delivery on page unload
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // Prefer sendBeacon for reliability on page navigation / close
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/events/track', blob);
  } else {
    // Fallback: regular fetch with keepalive
    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {
      // Swallow — tracking should never break the UX
    });
  }
}