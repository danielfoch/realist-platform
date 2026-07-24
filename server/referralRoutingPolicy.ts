export type LeadRoutingChannel = "valery" | "partner_referral" | "manual_review";

const ONTARIO_ALIASES = new Set(["on", "ontario"]);

// Conservative drive-time proxy for markets normally reachable from Toronto
// within about two hours in normal operating conditions.
const VALERY_TORONTO_SERVICE_ZONE = new Set([
  "ajax",
  "ancaster",
  "aurora",
  "barrie",
  "brampton",
  "brantford",
  "burlington",
  "cambridge",
  "caledon",
  "clarington",
  "etobicoke",
  "georgina",
  "guelph",
  "hamilton",
  "king",
  "kitchener",
  "markham",
  "milton",
  "mississauga",
  "newmarket",
  "niagara falls",
  "north york",
  "oakville",
  "orangeville",
  "oshawa",
  "pickering",
  "richmond hill",
  "scarborough",
  "st catharines",
  "st. catharines",
  "toronto",
  "vaughan",
  "waterloo",
  "welland",
  "whitby",
  "woodbridge",
]);

function normalize(value?: string | null): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isOntario(region?: string | null): boolean {
  return ONTARIO_ALIASES.has(normalize(region));
}

export function isValeryTorontoServiceZone(city?: string | null, region?: string | null): boolean {
  if (!isOntario(region)) return false;
  const normalizedCity = normalize(city);
  if (!normalizedCity) return false;
  return VALERY_TORONTO_SERVICE_ZONE.has(normalizedCity);
}

export function getLeadRoutingChannel(input: {
  city?: string | null;
  region?: string | null;
}): LeadRoutingChannel {
  if (!normalize(input.region)) return "manual_review";
  if (isValeryTorontoServiceZone(input.city, input.region)) return "valery";
  if (!isOntario(input.region)) return "partner_referral";
  return "manual_review";
}

export function shouldNotifyPartnerClaims(input: {
  city?: string | null;
  region?: string | null;
}): boolean {
  return getLeadRoutingChannel(input) === "partner_referral";
}

export type LeadIntent = "purchase" | "financing";

export type RoutablePartnerType = "realtor" | "mortgage_broker" | "lender";

// Which partner claim types a routed lead is fanned out to. Financing-intent
// leads belong on the financing side of the network: mortgage brokers handle
// the borrower, lenders supply the product. Everything else stays with
// realtors. Notifications reuse the realtor_lead_notifications table with a
// partner_type discriminator, so the downstream claim/intro/outcome flow is
// identical for every partner type.
export function getPartnerTypesForIntent(intent?: LeadIntent | null): RoutablePartnerType[] {
  return intent === "financing" ? ["mortgage_broker", "lender"] : ["realtor"];
}
