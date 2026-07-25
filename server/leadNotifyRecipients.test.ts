/**
 * Tests for the lead/account notification recipient list (server/resend.ts).
 *
 * Worth pinning down because the defaults live in code: a silent drift here means
 * revenue events stop reaching a human, which is exactly the failure mode this
 * replaced (getNotifyEmails returns [] when its env vars are unset, so lead
 * notifications were going nowhere).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));

const { getLeadNotifyEmails } = await import("./resend");

const ORIGINAL = process.env.LEAD_NOTIFY_EMAILS;

beforeEach(() => {
  delete process.env.LEAD_NOTIFY_EMAILS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.LEAD_NOTIFY_EMAILS;
  else process.env.LEAD_NOTIFY_EMAILS = ORIGINAL;
});

describe("getLeadNotifyEmails", () => {
  it("reaches both Dan and Nick with no configuration", () => {
    expect(getLeadNotifyEmails()).toEqual(["danielfoch@gmail.com", "nick@bldfinancial.ca"]);
  });

  it("is overridable by env for when the list changes", () => {
    process.env.LEAD_NOTIFY_EMAILS = "a@example.com,b@example.com";
    expect(getLeadNotifyEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("tolerates whitespace in the env list", () => {
    process.env.LEAD_NOTIFY_EMAILS = " a@example.com , b@example.com ";
    expect(getLeadNotifyEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("falls back to the defaults rather than sending nowhere", () => {
    // A typo'd override must not silently mute every revenue notification.
    process.env.LEAD_NOTIFY_EMAILS = "not-an-email,also-bad";
    expect(getLeadNotifyEmails()).toEqual(["danielfoch@gmail.com", "nick@bldfinancial.ca"]);
  });

  it("drops only the malformed entries from a partly-valid list", () => {
    process.env.LEAD_NOTIFY_EMAILS = "good@example.com,garbage";
    expect(getLeadNotifyEmails()).toEqual(["good@example.com"]);
  });

  it("falls back when the override is empty", () => {
    process.env.LEAD_NOTIFY_EMAILS = "";
    expect(getLeadNotifyEmails()).toEqual(["danielfoch@gmail.com", "nick@bldfinancial.ca"]);
  });
});
