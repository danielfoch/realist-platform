// Realist lead routing policy — which desk works a high-intent lead.
//
// Decision (Dan, 2026-07-07): leads within roughly a 2-hour drive of Toronto
// are worked in-house by Valery Real Estate Inc.; leads outside that zone
// route to the claimed-market referral partner (signed referral agreement
// required — see shared/partnerNetwork.ts). Pure module: no DB, no env.

import { haversineMeters } from "./geoGeometry";

export const IN_HOUSE_BROKERAGE = "Valery Real Estate Inc.";

export const TORONTO_CENTRE = { lat: 43.6532, lng: -79.3832 } as const;

/** Approximation of a 2-hour drive from Toronto as straight-line distance. */
export const IN_HOUSE_RADIUS_KM = 160;

export type LeadChannel = "in_house" | "referral_partner";

export interface LeadRoutingDecision {
  channel: LeadChannel;
  reason: string;
}

/**
 * Ontario cities/regions inside the ~2-hour in-house zone, for leads that
 * arrive with a city name but no coordinates. Normalized via normalizeCity.
 * Anything not listed (and without coordinates) defaults to referral —
 * a mis-routed referral costs 25% of one commission; a mis-routed in-house
 * lead costs a partner's trust.
 */
export const IN_HOUSE_CITIES = new Set(
  [
    "toronto", "north york", "scarborough", "etobicoke", "east york",
    "mississauga", "brampton", "vaughan", "markham", "richmond hill",
    "oakville", "burlington", "milton", "halton hills", "caledon",
    "pickering", "ajax", "whitby", "oshawa", "clarington",
    "newmarket", "aurora", "king city", "stouffville", "uxbridge",
    "hamilton", "grimsby", "st. catharines", "niagara falls", "welland",
    "niagara-on-the-lake", "thorold", "fort erie",
    "guelph", "kitchener", "waterloo", "cambridge", "brantford",
    "barrie", "innisfil", "bradford", "orillia", "collingwood", "wasaga beach",
    "peterborough", "cobourg", "port hope", "lindsay", "kawartha lakes",
    "orangeville", "shelburne", "woodstock", "paris", "simcoe", "caledonia",
  ].map((c) => c),
);

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isWithinInHouseRadius(lat: number, lng: number): boolean {
  const meters = haversineMeters(TORONTO_CENTRE.lat, TORONTO_CENTRE.lng, lat, lng);
  return meters <= IN_HOUSE_RADIUS_KM * 1000;
}

export interface LeadLocation {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  province?: string | null;
}

/**
 * Route a lead to the in-house desk or a referral partner.
 * Coordinates win over city names; unknown locations default to referral.
 */
export function routeLead(location: LeadLocation): LeadRoutingDecision {
  const { lat, lng, city, province } = location;

  if (typeof lat === "number" && typeof lng === "number") {
    if (isWithinInHouseRadius(lat, lng)) {
      return {
        channel: "in_house",
        reason: `Within ${IN_HOUSE_RADIUS_KM} km of Toronto — worked by ${IN_HOUSE_BROKERAGE}.`,
      };
    }
    return {
      channel: "referral_partner",
      reason: `Beyond ${IN_HOUSE_RADIUS_KM} km of Toronto — routed to the claimed-market partner.`,
    };
  }

  if (city && IN_HOUSE_CITIES.has(normalizeCity(city))) {
    return {
      channel: "in_house",
      reason: `${city.trim()} is inside the Toronto in-house zone — worked by ${IN_HOUSE_BROKERAGE}.`,
    };
  }

  if (city || province) {
    return {
      channel: "referral_partner",
      reason: "Outside the Toronto in-house zone — routed to the claimed-market partner.",
    };
  }

  return {
    channel: "referral_partner",
    reason: "Location unknown — defaults to the claimed-market partner.",
  };
}
