import { describe, expect, it } from "vitest";
import {
  GOOGLE_OAUTH_STATE_MAX_AGE_MS,
  signGoogleOAuthState,
  verifyGoogleOAuthState,
} from "./googleOAuthState";

const SECRET = "test-secret";
const USER_ID = "5d3f9c0a-2f3e-4f4f-9d6a-0b1c2d3e4f5a";
const NOW = 1_750_000_000_000;

describe("signGoogleOAuthState / verifyGoogleOAuthState", () => {
  it("round-trips a uuid user id", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    expect(verifyGoogleOAuthState(state, SECRET, NOW)).toBe(USER_ID);
  });

  it("produces url-safe state (no padding, +, or /)", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a state signed with a different secret", () => {
    const state = signGoogleOAuthState(USER_ID, "other-secret", NOW);
    expect(verifyGoogleOAuthState(state, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered user id", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [, ts, sig] = decoded.split(".");
    const forged = Buffer.from(`a0000000-0000-4000-8000-000000000000.${ts}.${sig}`).toString("base64url");
    expect(verifyGoogleOAuthState(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered timestamp", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [userId, , sig] = decoded.split(".");
    const forged = Buffer.from(`${userId}.${NOW + 1}.${sig}`).toString("base64url");
    expect(verifyGoogleOAuthState(forged, SECRET, NOW)).toBeNull();
  });

  it("accepts a state just inside the max age", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    expect(verifyGoogleOAuthState(state, SECRET, NOW + GOOGLE_OAUTH_STATE_MAX_AGE_MS - 1)).toBe(USER_ID);
  });

  it("rejects an expired state", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW);
    expect(verifyGoogleOAuthState(state, SECRET, NOW + GOOGLE_OAUTH_STATE_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects a far-future timestamp (clock-skew guard)", () => {
    const state = signGoogleOAuthState(USER_ID, SECRET, NOW + 10 * 60 * 1000);
    expect(verifyGoogleOAuthState(state, SECRET, NOW)).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(verifyGoogleOAuthState("", SECRET, NOW)).toBeNull();
    expect(verifyGoogleOAuthState("not-base64url!!", SECRET, NOW)).toBeNull();
    expect(verifyGoogleOAuthState(Buffer.from("only.two").toString("base64url"), SECRET, NOW)).toBeNull();
    expect(verifyGoogleOAuthState(Buffer.from("a.b.c.d").toString("base64url"), SECRET, NOW)).toBeNull();
  });

  it("refuses to sign an id containing the delimiter", () => {
    expect(() => signGoogleOAuthState("bad.id", SECRET, NOW)).toThrow();
    expect(() => signGoogleOAuthState("", SECRET, NOW)).toThrow();
  });
});
