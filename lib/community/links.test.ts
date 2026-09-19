import { describe, expect, it } from "vitest";
import { isMeetupUrl } from "./links";

describe("isMeetupUrl", () => {
  it("accepts https meetup.com event URLs", () => {
    expect(isMeetupUrl("https://www.meetup.com/toronto-real-estate-realist/events/313399836/")).toBe(true);
    expect(isMeetupUrl("https://meetup.com/some-group/")).toBe(true);
  });

  it("rejects lookalike hosts, other schemes, and junk", () => {
    expect(isMeetupUrl("https://meetup.com.evil.example/events/1")).toBe(false);
    expect(isMeetupUrl("https://notmeetup.com/events/1")).toBe(false);
    expect(isMeetupUrl("http://www.meetup.com/group/")).toBe(false);
    expect(isMeetupUrl("javascript:alert(1)")).toBe(false);
    expect(isMeetupUrl("not a url")).toBe(false);
    expect(isMeetupUrl(null)).toBe(false);
  });
});
