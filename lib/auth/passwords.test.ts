import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH, hashPassword, passwordProblem, verifyPassword } from "./passwords";
import { generateToken, hashToken } from "./tokens";

describe("passwords", () => {
  it("round-trips, and rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterz", hash)).toBe(false);
  }, 20_000);

  it("verifies a hash minted by the legacy app's bcrypt (no pepper, any cost)", async () => {
    const legacyHash = bcrypt.hashSync("legacy-pass-123", 10);
    expect(await verifyPassword("legacy-pass-123", legacyHash)).toBe(true);
  }, 20_000);

  it("an account with no password never matches — and doesn't throw", async () => {
    expect(await verifyPassword("anything-at-all", null)).toBe(false);
    expect(await verifyPassword("anything-at-all", "not-a-bcrypt-hash")).toBe(false);
  }, 20_000);

  it("explains a weak password in a sentence", () => {
    expect(passwordProblem("x".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/i);
    expect(passwordProblem("x".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe("tokens", () => {
  it("are long, unique, URL-safe — and only their hash is comparable", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
