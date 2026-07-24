import { z } from "zod";
import {
  jvPartnerRoles,
  jvListingStatuses,
  type JvPartnerListing,
  type JvPartnerRole,
} from "./schema";

// ============================================
// JV PARTNER MATCHING LOGIC
// ============================================
// Simple first pass: a listing matches another listing when the offered
// roles are complementary and the locations overlap (same province, or
// same city when province is missing). Investment ranges only filter a
// candidate out when both sides specify a range and the ranges do not
// overlap.

export const jvPartnerRoleLabels: Record<JvPartnerRole, string> = {
  land: "Land",
  capital: "Capital",
  development: "Development",
  realtor: "Realtor",
  gc: "General Contractor",
};

// Which roles each offered role is looking for. Example: a `land` listing
// matches users bringing `capital` or `development` (plus a realtor or GC
// to round out the team). Realtors connect with everyone.
export const jvComplementaryRoles: Record<JvPartnerRole, JvPartnerRole[]> = {
  land: ["capital", "development", "realtor", "gc"],
  capital: ["land", "development", "realtor"],
  development: ["land", "capital", "realtor", "gc"],
  realtor: ["land", "capital", "development", "gc"],
  gc: ["land", "development", "realtor"],
};

export function areComplementaryRoles(a: string, b: string): boolean {
  const candidates = jvComplementaryRoles[a as JvPartnerRole];
  return !!candidates && candidates.includes(b as JvPartnerRole);
}

type JvLocation = Pick<JvPartnerListing, "city" | "province">;

function normalizePlace(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

// Locations overlap when provinces match, or when provinces are missing on
// either side but cities match.
export function jvLocationsOverlap(a: JvLocation, b: JvLocation): boolean {
  const aProvince = normalizePlace(a.province);
  const bProvince = normalizePlace(b.province);
  if (aProvince && bProvince) return aProvince === bProvince;

  const aCity = normalizePlace(a.city);
  const bCity = normalizePlace(b.city);
  if (aCity && bCity) return aCity === bCity;

  return false;
}

// Null/undefined range bounds are open-ended: a listing without a stated
// range overlaps everything. When both sides state a range they must
// intersect.
export function jvInvestmentRangesOverlap(
  a: Pick<JvPartnerListing, "investmentMin" | "investmentMax">,
  b: Pick<JvPartnerListing, "investmentMin" | "investmentMax">,
): boolean {
  const aMin = a.investmentMin ?? null;
  const aMax = a.investmentMax ?? null;
  const bMin = b.investmentMin ?? null;
  const bMax = b.investmentMax ?? null;

  if (aMin === null && aMax === null) return true;
  if (bMin === null && bMax === null) return true;

  const lowerBound = Math.max(aMin ?? 0, bMin ?? 0);
  const upperBound = Math.min(aMax ?? Number.POSITIVE_INFINITY, bMax ?? Number.POSITIVE_INFINITY);
  return lowerBound <= upperBound;
}

export function isJvListingMatch(listing: JvPartnerListing, candidate: JvPartnerListing): boolean {
  if (candidate.id === listing.id) return false;
  if (candidate.userId === listing.userId) return false;
  if (candidate.status !== "active") return false;
  if (!areComplementaryRoles(listing.partnerRoleOffered, candidate.partnerRoleOffered)) return false;
  if (!jvLocationsOverlap(listing, candidate)) return false;
  if (!jvInvestmentRangesOverlap(listing, candidate)) return false;
  return true;
}

export function findJvListingMatches(
  listing: JvPartnerListing,
  candidates: JvPartnerListing[],
): JvPartnerListing[] {
  return candidates.filter((candidate) => isJvListingMatch(listing, candidate));
}

// Validation schemas shared by the API and the client form.
export const createJvListingSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(5000).optional(),
    partnerRoleOffered: z.enum(jvPartnerRoles),
    city: z.string().trim().max(120).optional(),
    province: z.string().trim().max(60).optional(),
    investmentMin: z.number().min(0).optional(),
    investmentMax: z.number().min(0).optional(),
  })
  .refine(
    (data) =>
      data.investmentMin === undefined ||
      data.investmentMax === undefined ||
      data.investmentMin <= data.investmentMax,
    { message: "Minimum investment cannot exceed maximum investment", path: ["investmentMin"] },
  );

export type CreateJvListingInput = z.infer<typeof createJvListingSchema>;

export const jvListingSearchSchema = z.object({
  role: z.enum(jvPartnerRoles).optional(),
  province: z.string().trim().optional(),
  city: z.string().trim().optional(),
  investmentMin: z.coerce.number().min(0).optional(),
  investmentMax: z.coerce.number().min(0).optional(),
});
export type JvListingSearch = z.infer<typeof jvListingSearchSchema>;

export const updateJvListingStatusSchema = z.object({
  status: z.enum(jvListingStatuses),
});
