import { describe, expect, it } from "vitest";
import {
  claimProfileSchema,
  deriveSubmissionStatus,
  ROLE_LABELS,
  POWER_TEAM_ROLES,
  verificationBadge,
} from "./professionalProfiles";

describe("verificationBadge", () => {
  it("maps each status to a badge with the right tone", () => {
    expect(verificationBadge("verified")).toEqual({ label: "Verified pro", tone: "green" });
    expect(verificationBadge("pending").tone).toBe("amber");
    expect(verificationBadge("unverified").tone).toBe("muted");
    expect(verificationBadge("rejected").label).toBe("Unverified pro");
  });
});

describe("deriveSubmissionStatus", () => {
  it("goes pending only when both licence body and number are present", () => {
    expect(deriveSubmissionStatus({ licenceBody: "OAA", licenceNumber: "12345" })).toBe("pending");
    expect(deriveSubmissionStatus({ licenceBody: "OAA", licenceNumber: "" })).toBe("unverified");
    expect(deriveSubmissionStatus({ licenceBody: null, licenceNumber: null })).toBe("unverified");
  });

  it("keeps an already-verified profile verified across edits", () => {
    expect(deriveSubmissionStatus({ currentStatus: "verified", licenceBody: null, licenceNumber: null })).toBe("verified");
  });
});

describe("claimProfileSchema", () => {
  it("accepts a valid claim and defaults service areas + lead CTA", () => {
    const parsed = claimProfileSchema.parse({ roles: ["planner", "architect"], company: "Acme" });
    expect(parsed.roles).toEqual(["planner", "architect"]);
    expect(parsed.serviceAreas).toEqual([]);
    expect(parsed.leadCtaEnabled).toBe(true);
  });

  it("requires at least one valid role and rejects unknown roles / too many", () => {
    expect(claimProfileSchema.safeParse({ roles: [] }).success).toBe(false);
    expect(claimProfileSchema.safeParse({ roles: ["wizard"] }).success).toBe(false);
    expect(claimProfileSchema.safeParse({ roles: ["planner", "architect", "realtor", "arborist", "other"] }).success).toBe(false);
  });
});

describe("role taxonomy", () => {
  it("labels every role", () => {
    for (const r of POWER_TEAM_ROLES) expect(ROLE_LABELS[r]).toBeTruthy();
  });
});
