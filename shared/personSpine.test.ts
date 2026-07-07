import { describe, expect, it } from "vitest";
import { buildEmailIndex, decideLink, emailsMatch } from "./personSpine";

describe("buildEmailIndex", () => {
  it("normalizes case and whitespace and skips rows without a usable email", () => {
    const index = buildEmailIndex([
      { id: "u1", email: "  Dan@Example.COM " },
      { id: "u2", email: null },
      { id: "u3", email: "   " },
      { id: "u4", email: undefined },
    ]);
    expect(index.size).toBe(1);
    expect(index.get("dan@example.com")).toBe("u1");
  });

  it("keeps the first (oldest) user when two rows share a normalized email", () => {
    const index = buildEmailIndex([
      { id: "u-old", email: "dan@example.com" },
      { id: "u-new", email: "DAN@EXAMPLE.COM" },
    ]);
    expect(index.get("dan@example.com")).toBe("u-old");
  });
});

describe("decideLink", () => {
  const index = buildEmailIndex([{ id: "u1", email: "dan@example.com" }]);

  it("links case- and whitespace-insensitively", () => {
    expect(
      decideLink({ email: " DAN@Example.com  ", linkedUserId: null }, index),
    ).toEqual({ action: "link", userId: "u1" });
  });

  it("skips with no-match when the email resolves to no user", () => {
    expect(
      decideLink({ email: "stranger@example.com", linkedUserId: null }, index),
    ).toEqual({ action: "skip", reason: "no-match" });
  });

  it("skips with no-email for null, undefined, and whitespace-only emails", () => {
    for (const email of [null, undefined, "", "   "]) {
      expect(decideLink({ email, linkedUserId: null }, index)).toEqual({
        action: "skip",
        reason: "no-email",
      });
    }
  });

  it("never overwrites an existing link, even when the email resolves to another user", () => {
    expect(
      decideLink({ email: "dan@example.com", linkedUserId: "u-other" }, index),
    ).toEqual({ action: "skip", reason: "already-linked" });
  });

  it("is idempotent: applying a link decision makes the next pass already-linked", () => {
    const row: { email: string; linkedUserId: string | null } = {
      email: "Dan@Example.com",
      linkedUserId: null,
    };
    const first = decideLink(row, index);
    expect(first).toEqual({ action: "link", userId: "u1" });
    if (first.action === "link") row.linkedUserId = first.userId;
    expect(decideLink(row, index)).toEqual({
      action: "skip",
      reason: "already-linked",
    });
  });
});

describe("emailsMatch", () => {
  it("matches across casing and surrounding whitespace", () => {
    expect(emailsMatch("  Dan@Example.COM ", "dan@example.com")).toBe(true);
  });

  it("never matches empty or missing emails, even against each other", () => {
    expect(emailsMatch("", "")).toBe(false);
    expect(emailsMatch(null, undefined)).toBe(false);
    expect(emailsMatch("   ", "  ")).toBe(false);
    expect(emailsMatch("dan@example.com", null)).toBe(false);
  });
});
