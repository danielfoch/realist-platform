import { describe, expect, it } from "vitest";
import { getLoginRedirectMessage } from "./authErrors";

describe("getLoginRedirectMessage", () => {
  it("turns expired magic-link redirects into human copy", () => {
    expect(getLoginRedirectMessage(new URLSearchParams("error=link_invalid"))).toContain("sign-in link");
  });

  it("turns Google OAuth codes into human copy", () => {
    expect(getLoginRedirectMessage(new URLSearchParams("error=auth_failed&reason=state_mismatch"))).toContain("session expired");
    expect(getLoginRedirectMessage(new URLSearchParams("error=auth_failed&reason=no_email"))).toContain("email address");
    expect(getLoginRedirectMessage(new URLSearchParams("error=auth_failed"))).toContain("Google sign-in could not be completed");
  });

  it("ignores unknown query params", () => {
    expect(getLoginRedirectMessage(new URLSearchParams("source=youtube"))).toBeNull();
  });
});
