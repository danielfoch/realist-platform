import {
  hasTrafficAttribution,
  normalizeTrafficAttribution,
  type TrafficAttribution,
} from "@shared/trafficAnalytics";

const VISITOR_KEY = "realist.analytics.visitorId";
const SESSION_KEY = "realist.analytics.sessionId";
const FIRST_TOUCH_KEY = "realist.analytics.firstTouch";
const CURRENT_TOUCH_KEY = "realist.analytics.currentTouch";

type TouchRecord = {
  attribution: TrafficAttribution;
  landingPath: string;
  capturedAt: string;
  referrer: string | null;
};

type AnalyticsEvent = {
  eventName?: "page_view" | "ticket_cta_clicked" | "outbound_click" | "lead_conversion";
  path?: string;
  page?: string;
  title?: string;
  referrer?: string | null;
  component?: string;
  targetUrl?: string;
  metadata?: Record<string, unknown>;
};

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Tracking must never break the app.
  }
}

function getOrCreateId(key: string, prefix: string): string {
  const existing = safeStorageGet(key);
  if (existing) return existing;
  const id = `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  safeStorageSet(key, id);
  return id;
}

function readJson<T>(key: string): T | null {
  const raw = safeStorageGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function captureAttribution(): { attribution: TrafficAttribution; firstTouch: TouchRecord | null; currentTouch: TouchRecord | null } {
  const attribution = normalizeTrafficAttribution(new URLSearchParams(window.location.search));
  const now = new Date().toISOString();
  let firstTouch = readJson<TouchRecord>(FIRST_TOUCH_KEY);
  let currentTouch = readJson<TouchRecord>(CURRENT_TOUCH_KEY);

  if (hasTrafficAttribution(attribution)) {
    currentTouch = {
      attribution,
      landingPath: `${window.location.pathname}${window.location.search}`,
      capturedAt: now,
      referrer: document.referrer || null,
    };
    safeStorageSet(CURRENT_TOUCH_KEY, JSON.stringify(currentTouch));

    if (!firstTouch) {
      firstTouch = currentTouch;
      safeStorageSet(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
    }
  }

  return { attribution, firstTouch, currentTouch };
}

export function trackTrafficEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const visitorId = getOrCreateId(VISITOR_KEY, "v");
  const sessionId = getOrCreateId(SESSION_KEY, "s");
  const { attribution, firstTouch, currentTouch } = captureAttribution();
  const payload = {
    eventName: event.eventName || "page_view",
    visitorId,
    sessionId,
    page: event.page || `${window.location.pathname}${window.location.search}`,
    path: event.path || window.location.pathname,
    title: event.title || document.title || null,
    referrer: event.referrer === undefined ? document.referrer || null : event.referrer,
    component: event.component || "web_analytics",
    targetUrl: event.targetUrl || null,
    attribution,
    firstTouch,
    currentTouch,
    metadata: event.metadata || null,
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body,
    keepalive: true,
  }).catch(() => {
    // Best-effort only.
  });
}
