export const TRAFFIC_ATTRIBUTION_KEYS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "campaign",
  "campaign_id",
  "link_id",
  "ad_id",
  "creative",
  "placement",
  "ref",
] as const;

export type TrafficAttributionKey = (typeof TRAFFIC_ATTRIBUTION_KEYS)[number];

export type TrafficAttribution = Partial<Record<TrafficAttributionKey, string>>;

export function normalizeTrafficAttribution(params: URLSearchParams): TrafficAttribution {
  const attribution: TrafficAttribution = {};

  for (const key of TRAFFIC_ATTRIBUTION_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const value = raw.trim().slice(0, 160);
    if (value) attribution[key] = value;
  }

  if (!attribution.source && attribution.utm_source) {
    attribution.source = attribution.utm_source;
  }
  if (!attribution.utm_source && attribution.source) {
    attribution.utm_source = attribution.source;
  }
  if (!attribution.campaign && attribution.utm_campaign) {
    attribution.campaign = attribution.utm_campaign;
  }
  if (!attribution.utm_campaign && attribution.campaign) {
    attribution.utm_campaign = attribution.campaign;
  }

  return attribution;
}

export function hasTrafficAttribution(attribution: TrafficAttribution | null | undefined): boolean {
  return Boolean(attribution && Object.keys(attribution).length);
}

export function buildTrafficTrackingUrl(
  baseUrl: string,
  attribution: TrafficAttribution,
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(attribution)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
