import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdmin } from "./admin";

afterEach(() => vi.unstubAllEnvs());

describe("isAdmin", () => {
  it("honours the database role", () => {
    expect(isAdmin({ role: "admin", email: "a@x.ca", emailVerifiedAt: null })).toBe(true);
    expect(isAdmin({ role: "user", email: "a@x.ca", emailVerifiedAt: new Date() })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("accepts a listed address only once it is verified", () => {
    vi.stubEnv("ADMIN_EMAILS", "Boss@Example.com, ops@example.com");
    expect(isAdmin({ role: "user", email: "boss@example.com", emailVerifiedAt: new Date() })).toBe(true);
    // Anyone can sign up with someone else's address and a password. That proves nothing.
    expect(isAdmin({ role: "user", email: "boss@example.com", emailVerifiedAt: null })).toBe(false);
    expect(isAdmin({ role: "user", email: "stranger@example.com", emailVerifiedAt: new Date() })).toBe(false);
  });
});
