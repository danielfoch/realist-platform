import { describe, expect, it } from "vitest";
import { decryptMeetupToken, encryptMeetupToken } from "./meetupSecrets";

describe("Meetup token envelope", () => {
  const secret = "a-strong-token-envelope-secret";

  it("encrypts and decrypts tokens without storing plaintext", () => {
    const encrypted = encryptMeetupToken("refresh-token-value", secret);
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptMeetupToken(encrypted, secret)).toBe("refresh-token-value");
  });

  it("accepts legacy plaintext values for a safe migration", () => {
    expect(decryptMeetupToken("legacy-token", secret)).toBe("legacy-token");
  });

  it("rejects the wrong key", () => {
    const encrypted = encryptMeetupToken("token", secret);
    expect(() => decryptMeetupToken(encrypted, "a-different-strong-secret")).toThrow();
  });
});
