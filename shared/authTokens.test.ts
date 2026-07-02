import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  LOGIN_LINK_MAX_PER_WINDOW,
  LOGIN_LINK_TTL_MS,
  LOGIN_LINK_WINDOW_MS,
  SETUP_LINK_TTL_MS,
  evaluateLoginLinkRequest,
  hashLoginToken,
  issueLoginToken,
  normalizeEmail,
  verifyLoginToken,
} from "./authTokens";

const NOW = 1_750_000_000_000;

describe("normalizeEmail", () => {
  it("lowercases and trims so casing/whitespace cannot fork identities", () => {
    expect(normalizeEmail("  Dan.Foch@Example.COM  ")).toBe("dan.foch@example.com");
  });

  it("returns empty string for null/undefined input", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("   ")).toBe("");
  });
});

describe("issueLoginToken / hashLoginToken", () => {
  it("issues a 64-char hex raw token with a 30-minute expiry", () => {
    const issued = issueLoginToken(NOW);
    expect(issued.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.expiresAt.getTime()).toBe(NOW + LOGIN_LINK_TTL_MS);
    expect(LOGIN_LINK_TTL_MS).toBe(30 * 60 * 1000);
  });

  it("stores only the purpose-scoped hash, never the raw token", () => {
    const issued = issueLoginToken(NOW, () => "a".repeat(64));
    expect(issued.tokenHash).toBe(hashLoginToken("a".repeat(64)));
    expect(issued.tokenHash).not.toBe(issued.rawToken);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("scopes login hashes away from bare sha256 so a login token can never redeem as a set-password token", () => {
    const raw = "b".repeat(64);
    const bareSha256 = createHash("sha256").update(raw).digest("hex");
    expect(hashLoginToken(raw)).not.toBe(bareSha256);
  });

  it("hashes deterministically and distinctly per token", () => {
    expect(hashLoginToken("token-1")).toBe(hashLoginToken("token-1"));
    expect(hashLoginToken("token-1")).not.toBe(hashLoginToken("token-2"));
  });
});

describe("verifyLoginToken", () => {
  const freshRecord = () => ({ expiresAt: new Date(NOW + LOGIN_LINK_TTL_MS), usedAt: null });

  it("accepts a fresh unused token within its window", () => {
    expect(verifyLoginToken(freshRecord(), NOW + 1)).toEqual({ ok: true });
    expect(verifyLoginToken(freshRecord(), NOW + LOGIN_LINK_TTL_MS - 1)).toEqual({ ok: true });
  });

  it("rejects a missing record as not_found", () => {
    expect(verifyLoginToken(null, NOW)).toEqual({ ok: false, reason: "not_found" });
    expect(verifyLoginToken(undefined, NOW)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an already-used token (single use)", () => {
    expect(verifyLoginToken({ ...freshRecord(), usedAt: new Date(NOW) }, NOW + 1)).toEqual({
      ok: false,
      reason: "used",
    });
  });

  it("rejects at and after the expiry instant", () => {
    const record = freshRecord();
    expect(verifyLoginToken(record, NOW + LOGIN_LINK_TTL_MS)).toEqual({ ok: false, reason: "expired" });
    expect(verifyLoginToken(record, NOW + LOGIN_LINK_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts ISO-string dates from serialized rows and rejects garbage dates", () => {
    expect(
      verifyLoginToken({ expiresAt: new Date(NOW + 1000).toISOString(), usedAt: null }, NOW),
    ).toEqual({ ok: true });
    expect(verifyLoginToken({ expiresAt: "not-a-date", usedAt: null }, NOW)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});

describe("evaluateLoginLinkRequest (3 per rolling hour per email)", () => {
  it("allows the first three requests in a window and records them", () => {
    let history: number[] = [];
    for (let i = 0; i < LOGIN_LINK_MAX_PER_WINDOW; i++) {
      const decision = evaluateLoginLinkRequest(history, NOW + i * 1000);
      expect(decision.allowed).toBe(true);
      history = decision.recentRequests;
    }
    expect(history).toHaveLength(3);
  });

  it("blocks the fourth request in the window with a retry hint", () => {
    const history = [NOW, NOW + 1000, NOW + 2000];
    const decision = evaluateLoginLinkRequest(history, NOW + 3000);
    expect(decision.allowed).toBe(false);
    expect(decision.recentRequests).toHaveLength(3);
    expect(decision.retryAfterMs).toBe(LOGIN_LINK_WINDOW_MS - 3000);
  });

  it("allows again once the oldest request slides out of the window", () => {
    const history = [NOW, NOW + 1000, NOW + 2000];
    const later = NOW + LOGIN_LINK_WINDOW_MS + 1;
    const decision = evaluateLoginLinkRequest(history, later);
    expect(decision.allowed).toBe(true);
    // NOW slid out; NOW+1000 and NOW+2000 remain, plus the new request.
    expect(decision.recentRequests).toEqual([NOW + 1000, NOW + 2000, later]);
  });

  it("prunes stale timestamps so per-email state cannot grow unbounded", () => {
    const stale = [NOW - 2 * LOGIN_LINK_WINDOW_MS, NOW - LOGIN_LINK_WINDOW_MS - 1];
    const decision = evaluateLoginLinkRequest(stale, NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.recentRequests).toEqual([NOW]);
  });
});

describe("setup link TTL", () => {
  it("is uniformly 14 days (replaces the 24h/7d/30d per-path spread)", () => {
    expect(SETUP_LINK_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
