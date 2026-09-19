import { CITY_COORDS } from "@/lib/geo/cityCoords";
import type { LeadIntent, LeadKind, LeadRouting } from "@/lib/db/schema";

/**
 * Who works a lead. Two questions, both answered by pure rules so they can be
 * tested and changed without touching a form:
 *   intent  — acquisition (a realtor's job) or financing (a mortgage broker's)
 *   routing — Valery works it in-house within about two hours of Toronto;
 *             everywhere else it goes to that market's referral partner.
 */

const TORONTO = { lat: 43.65, lng: -79.38 };
/** ~2 hours' drive, as the crow flies. */
const IN_HOUSE_RADIUS_KM = 160;

/** Places inside the radius that aren't in the coordinate table. */
const IN_HOUSE_CITIES = new Set([
  "ajax", "ancaster", "aurora", "barrie", "brampton", "brantford", "burlington", "caledon", "cambridge",
  "clarington", "etobicoke", "georgina", "guelph", "hamilton", "king", "kitchener", "markham", "milton",
  "mississauga", "newmarket", "niagara falls", "north york", "oakville", "orangeville", "oshawa", "pickering",
  "richmond hill", "scarborough", "st catharines", "st. catharines", "toronto", "vaughan", "waterloo", "welland",
  "whitby", "woodbridge",
]);

const PROVINCES: Record<string, string> = {
  ontario: "ON", quebec: "QC", "québec": "QC", "british columbia": "BC", alberta: "AB", manitoba: "MB",
  saskatchewan: "SK", "nova scotia": "NS", "new brunswick": "NB", "newfoundland and labrador": "NL",
  newfoundland: "NL", "prince edward island": "PE", pei: "PE", yukon: "YT", "northwest territories": "NT",
  nunavut: "NU",
};

export function provinceCode(value: string | null | undefined): string | null {
  const text = value?.trim().toLowerCase();
  if (!text) return null;
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return PROVINCES[text] ?? null;
}

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function leadRouting(input: {
  city?: string | null;
  province?: string | null;
  lat?: number | null;
  lng?: number | null;
}): LeadRouting {
  // Coordinates beat names: a listing knows exactly where it is.
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    return kmBetween(TORONTO, { lat: input.lat, lng: input.lng }) <= IN_HOUSE_RADIUS_KM ? "in_house" : "partner_referral";
  }
  const city = normalizeCity(input.city);
  const province = provinceCode(input.province);
  if (city) {
    const known = CITY_COORDS.find(
      (point) => point.city.toLowerCase() === city && (!province || point.province === province),
    );
    if (known) return kmBetween(TORONTO, known) <= IN_HOUSE_RADIUS_KM ? "in_house" : "partner_referral";
    if (IN_HOUSE_CITIES.has(city) && (!province || province === "ON")) return "in_house";
  }
  if (province && province !== "ON") return "partner_referral";
  // Ontario but an unrecognised town, or nothing to go on: a person decides.
  return "manual_review";
}

export function leadIntent(kind: LeadKind, context?: Record<string, unknown> | null): LeadIntent {
  if (kind === "financing") return "financing";
  if (kind === "offer" || kind === "showing" || kind === "underwriting_help" || kind === "active_underwriter") {
    return "acquisition";
  }
  if (kind === "power_team") {
    const roles = Array.isArray(context?.roles) ? (context.roles as unknown[]).map(String) : [];
    if (roles.length > 0 && roles.every((role) => role === "mortgage_broker")) return "financing";
    if (roles.includes("realtor")) return "acquisition";
  }
  return "general";
}

function emailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry));
}

/**
 * Team inboxes come from env (ACQUISITION_LEAD_EMAILS, FINANCING_LEAD_EMAILS —
 * the same names the previous app used). Financing leads copy acquisition.
 */
export function teamRecipients(intent: LeadIntent): { to: string[]; cc: string[] } {
  const acquisition = emailList(process.env.ACQUISITION_LEAD_EMAILS);
  const financing = emailList(process.env.FINANCING_LEAD_EMAILS);
  if (intent === "financing" && financing.length > 0) {
    return { to: financing, cc: acquisition.filter((address) => !financing.includes(address)) };
  }
  if (intent === "general") {
    const everyone = [...new Set([...acquisition, ...financing])];
    return { to: everyone.length > 0 ? [everyone[0]] : [], cc: everyone.slice(1) };
  }
  return { to: acquisition, cc: [] };
}
