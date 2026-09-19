import { describe, expect, it } from "vitest";
import {
  effectiveConsent,
  mapLegacyUser,
  normalizeLegacyEmail,
  pickDuplicateWinner,
  snapshotFromLegacyDeal,
  stripSecrets,
} from "./legacyUsers";

const created = "2025-03-01T12:00:00Z";

describe("normalizeLegacyEmail", () => {
  it("trims and lowercases, and rejects non-emails", () => {
    expect(normalizeLegacyEmail("  Dan@Realist.CA ")).toBe("dan@realist.ca");
    expect(normalizeLegacyEmail("not-an-email")).toBeNull();
    expect(normalizeLegacyEmail(null)).toBeNull();
  });
});

describe("pickDuplicateWinner", () => {
  const noGoogle = () => false;

  it("keeps the account someone can still sign in to: a password beats none", () => {
    const winner = pickDuplicateWinner(
      [
        { id: "old", email: "A@x.com", password_hash: null, created_at: "2024-01-01" },
        { id: "new", email: "a@x.com", password_hash: "$2b$12$hash", created_at: "2025-01-01" },
      ],
      noGoogle,
    );
    expect(winner.id).toBe("new");
  });

  it("a Google link breaks the tie when neither has a password", () => {
    const winner = pickDuplicateWinner(
      [
        { id: "a", password_hash: null, created_at: "2024-01-01" },
        { id: "b", password_hash: null, created_at: "2025-01-01" },
      ],
      (id) => id === "b",
    );
    expect(winner.id).toBe("b");
  });

  it("among equals the oldest account wins, deterministically", () => {
    const rows = [
      { id: "z", password_hash: null, created_at: "2025-06-01" },
      { id: "y", password_hash: null, created_at: "2024-06-01" },
    ];
    expect(pickDuplicateWinner(rows, noGoogle).id).toBe("y");
    expect(pickDuplicateWinner([...rows].reverse(), noGoogle).id).toBe("y");
  });
});

describe("effectiveConsent", () => {
  it("treats NO ledger rows as granted — the legacy default — and labels it", () => {
    const consent = effectiveConsent({
      ledger: [],
      emailDigestOptIn: null,
      marketingEmailEnabled: undefined,
      userCreatedAt: created,
    });
    expect(consent).toEqual({ granted: true, at: new Date(created), source: "legacy:default" });
  });

  it("lets the latest email-channel row decide, keeping its source as the proof", () => {
    const consent = effectiveConsent({
      ledger: [
        { channel: "email", status: "granted", source: "signup", created_at: "2025-01-01T00:00:00Z" },
        { channel: "email", status: "revoked", source: "unsubscribe_link", created_at: "2025-05-01T00:00:00Z" },
        { channel: "sms", status: "granted", source: "phone_verify", created_at: "2025-09-01T00:00:00Z" },
      ],
      emailDigestOptIn: true,
      marketingEmailEnabled: true,
      userCreatedAt: created,
    });
    expect(consent.granted).toBe(false);
    expect(consent.source).toBe("legacy:unsubscribe_link");
    expect(consent.at).toEqual(new Date("2025-05-01T00:00:00Z"));
  });

  it("re-granting after a revoke is honoured", () => {
    const consent = effectiveConsent({
      ledger: [
        { channel: "email", status: "revoked", source: "unsubscribe_link", created_at: "2025-05-01T00:00:00Z" },
        { channel: "email", status: "granted", source: "event_rsvp", created_at: "2025-08-01T00:00:00Z" },
      ],
      emailDigestOptIn: null,
      marketingEmailEnabled: null,
      userCreatedAt: created,
    });
    expect(consent).toMatchObject({ granted: true, source: "legacy:event_rsvp" });
  });

  it("the master unsubscribe flag vetoes a granted ledger", () => {
    const consent = effectiveConsent({
      ledger: [{ channel: "email", status: "granted", source: "signup", created_at: created }],
      emailDigestOptIn: false,
      marketingEmailEnabled: true,
      userCreatedAt: created,
    });
    expect(consent).toMatchObject({ granted: false, source: "legacy:unsubscribed" });
  });

  it("the marketing toggle vetoes too", () => {
    const consent = effectiveConsent({
      ledger: [],
      emailDigestOptIn: true,
      marketingEmailEnabled: false,
      userCreatedAt: created,
    });
    expect(consent).toMatchObject({ granted: false, source: "legacy:marketing_off" });
  });
});

describe("mapLegacyUser", () => {
  const consent = { granted: true, at: new Date(created), source: "legacy:default" };

  it("carries the login over intact and keeps unknown columns without secrets", () => {
    const mapped = mapLegacyUser({
      user: {
        id: "u-1",
        email: " Dan@Realist.ca",
        password_hash: "$2b$12$abcdefghijklmnopqrstuv",
        first_name: "Daniel",
        last_name: "Foch",
        phone: "416-555-0100",
        role: "investor",
        email_verified: true,
        email_verification_token: "should-never-travel",
        stripe_customer_id: "cus_123",
        some_new_drifted_column: "kept",
        created_at: created,
      },
      googleId: "google-sub-1",
      profile: { city: "Toronto", province: "ON", investment_goals: "Multiplexes", bio: "Host" },
      consent,
    });
    expect(mapped).toMatchObject({
      id: "u-1",
      email: "dan@realist.ca",
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
      googleId: "google-sub-1",
      name: "Daniel Foch",
      phone: "416-555-0100",
      city: "Toronto",
      province: "ON",
      investorFocus: "Multiplexes",
      role: "user",
      emailVerifiedAt: new Date(created),
      consentMarketing: true,
      consentSource: "legacy:default",
    });
    expect(mapped?.legacy).toMatchObject({
      role: "investor",
      stripe_customer_id: "cus_123",
      some_new_drifted_column: "kept",
      bio: "Host",
    });
    expect(JSON.stringify(mapped?.legacy)).not.toContain("should-never-travel");
    expect(JSON.stringify(mapped?.legacy)).not.toContain("$2b$12$");
  });

  it("maps admin, leaves passwordless accounts passwordless, and records merges", () => {
    const mapped = mapLegacyUser({
      user: { id: "u-2", email: "a@x.com", password_hash: null, role: "admin", email_verified: false, created_at: created },
      googleId: null,
      profile: null,
      consent,
      mergedIds: ["u-9"],
    });
    expect(mapped).toMatchObject({ role: "admin", passwordHash: null, emailVerifiedAt: null, name: null });
    expect(mapped?.legacy.mergedLegacyIds).toEqual(["u-9"]);
  });

  it("refuses rows with no usable email or id", () => {
    expect(mapLegacyUser({ user: { id: "u-3", email: "" }, googleId: null, profile: null, consent })).toBeNull();
    expect(mapLegacyUser({ user: { email: "a@x.com" }, googleId: null, profile: null, consent })).toBeNull();
  });
});

describe("stripSecrets", () => {
  it("removes tokens and hashes from an archived row", () => {
    expect(stripSecrets({ id: "1", access_token: "t", refresh_token: "r", provider: "google" })).toEqual({
      id: "1",
      provider: "google",
    });
  });
});

describe("snapshotFromLegacyDeal", () => {
  it("finds headline numbers whatever the analyzer called them", () => {
    const snapshot = snapshotFromLegacyDeal({
      address: "12 Main St",
      city: "Hamilton",
      province: "ON",
      strategy_type: "buy_hold",
      mls_number: "H123",
      inputs_json: { purchasePrice: 650000 },
      results_json: { metrics: { capRate: 5.4, monthlyCashFlow: "312.5" } },
    });
    expect(snapshot).toEqual({
      source: "legacy_deal_analyzer",
      address: "12 Main St",
      city: "Hamilton",
      province: "ON",
      strategy: "buy_hold",
      mlsNumber: "H123",
      capRate: 5.4,
      cashFlowMonthly: 312.5,
      purchasePrice: 650000,
    });
  });
});
