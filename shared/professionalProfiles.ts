/**
 * Power Team professional profiles (FN-1) — the claim + verification layer on
 * top of the existing reputation/field-note engine (shared/contributorReputation
 * .ts, expert_field_notes, /api/experts). FN-0 (power_team_waitlist) collects
 * interest; FN-1 turns a signed-in pro into a verifiable profile with roles,
 * service areas, and a verification tier that badges their field notes.
 *
 * Pure module (no I/O): validation + display helpers, unit-tested under shared/.
 */

import { z } from "zod";

/** The seven launch roles (+ "other"); kept in sync with server/powerTeam.ts. */
export const POWER_TEAM_ROLES = [
  "planner",
  "architect",
  "gc_builder",
  "mortgage_pro",
  "realtor",
  "property_manager",
  "arborist",
  "other",
] as const;
export type PowerTeamRole = (typeof POWER_TEAM_ROLES)[number];

export const ROLE_LABELS: Record<PowerTeamRole, string> = {
  planner: "Urban planner",
  architect: "Architect",
  gc_builder: "GC / builder",
  mortgage_pro: "Mortgage pro",
  realtor: "Realtor",
  property_manager: "Property manager",
  arborist: "Arborist",
  other: "Other",
};

/** Verification tiers — the badge language mirrors the underwriter's provenance chips. */
export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface VerificationBadge {
  label: string;
  tone: "muted" | "amber" | "green";
}

export function verificationBadge(status: VerificationStatus): VerificationBadge {
  switch (status) {
    case "verified":
      return { label: "Verified pro", tone: "green" };
    case "pending":
      return { label: "Verification pending", tone: "amber" };
    case "rejected":
      return { label: "Unverified pro", tone: "amber" };
    default:
      return { label: "Unverified pro", tone: "muted" };
  }
}

/**
 * A profile is "verifiable" (eligible to enter the admin queue) once it names a
 * licence body + number. Without those it stays unverified but can still post
 * notes — the open-with-badges model from the spec.
 */
export function deriveSubmissionStatus(input: {
  licenceBody?: string | null;
  licenceNumber?: string | null;
  currentStatus?: VerificationStatus;
}): VerificationStatus {
  // A previously verified profile stays verified across edits (admin re-checks on material change).
  if (input.currentStatus === "verified") return "verified";
  const hasLicence = !!(input.licenceBody && input.licenceBody.trim() && input.licenceNumber && input.licenceNumber.trim());
  return hasLicence ? "pending" : "unverified";
}

/** Claim payload from the "claim your profile" form. */
export const claimProfileSchema = z.object({
  roles: z.array(z.enum(POWER_TEAM_ROLES)).min(1).max(4),
  company: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  serviceAreas: z.array(z.string().min(1).max(80)).max(20).default([]),
  licenceBody: z.string().max(120).optional().nullable(),
  licenceNumber: z.string().max(120).optional().nullable(),
  leadCtaEnabled: z.boolean().default(true),
});
export type ClaimProfileInput = z.infer<typeof claimProfileSchema>;

/** Admin verify decision. */
export const verifyDecisionSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  adminNotes: z.string().max(1000).optional().nullable(),
});
