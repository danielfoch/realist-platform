import { describe, expect, it } from "vitest";
import {
  assignVideoSlugs,
  deriveVideoKeywords,
  deriveVideoTopics,
  mapVideoCta,
  selectVideosSince,
  slugifyVideoTitle,
} from "./youtubeVideos";

describe("slugifyVideoTitle", () => {
  it("lowercases, hyphenates, strips punctuation, and removes apostrophes", () => {
    expect(
      slugifyVideoTitle("Canada's Housing Market Just Hit Rock Bottom (Worst Market Ever)"),
    ).toBe("canadas-housing-market-just-hit-rock-bottom-worst-market-ever");
  });

  it("is stable (same input always yields the same slug)", () => {
    const title = "Top 10 Canadian Cities to Invest in for 2026";
    expect(slugifyVideoTitle(title)).toBe(slugifyVideoTitle(title));
    expect(slugifyVideoTitle(title)).toBe("top-10-canadian-cities-to-invest-in-for-2026");
  });

  it("never returns an empty slug", () => {
    expect(slugifyVideoTitle("???")).toBe("episode");
  });
});

describe("assignVideoSlugs", () => {
  it("gives unique titles their plain slug", () => {
    const result = assignVideoSlugs([
      { title: "Video One", pubDate: "2026-06-02T10:00:00+00:00" },
      { title: "Video Two", pubDate: "2026-05-26T10:00:00+00:00" },
    ]);
    expect(result.map((video) => video.slug)).toEqual(["video-one", "video-two"]);
  });

  it("on collision the oldest video keeps the base slug, newer ones get a date suffix", () => {
    // Feed order is newest-first, like the real Atom feed.
    const result = assignVideoSlugs([
      { title: "Market Update", pubDate: "2026-06-02T10:00:00+00:00" },
      { title: "Market Update", pubDate: "2026-01-06T10:00:00+00:00" },
    ]);
    expect(result[1].slug).toBe("market-update"); // oldest keeps base
    expect(result[0].slug).toBe("market-update-2026-06-02"); // newer gets its pubDate
  });

  it("does not change existing slugs when a new colliding video arrives (URL stability)", () => {
    const before = assignVideoSlugs([
      { title: "Market Update", pubDate: "2026-01-06T10:00:00+00:00" },
    ]);
    const after = assignVideoSlugs([
      { title: "Market Update", pubDate: "2026-06-02T10:00:00+00:00" },
      { title: "Market Update", pubDate: "2026-01-06T10:00:00+00:00" },
    ]);
    expect(after[1].slug).toBe(before[0].slug);
    expect(after[0].slug).not.toBe(before[0].slug);
  });

  it("is deterministic regardless of how often it runs", () => {
    const videos = [
      { title: "A", pubDate: "2026-06-02T10:00:00+00:00" },
      { title: "A", pubDate: "2026-05-26T10:00:00+00:00" },
      { title: "B", pubDate: "2026-05-19T10:00:00+00:00" },
    ];
    expect(assignVideoSlugs(videos)).toEqual(assignVideoSlugs(videos));
  });
});

describe("deriveVideoTopics / keywords", () => {
  it("derives topics from recognizable title terms", () => {
    expect(deriveVideoTopics("The Mortgage Renewal Shock Is Here")).toContain("Mortgages");
    expect(deriveVideoTopics("Toronto Condo Prices Are Falling")).toContain("Toronto");
    expect(deriveVideoTopics("Toronto Condo Prices Are Falling")).toContain("Condos");
  });

  it("always includes the channel keywords", () => {
    const keywords = deriveVideoKeywords("An Interview With Our Moms");
    expect(keywords).toContain("Daniel Foch");
    expect(keywords).toContain("YouTube");
  });
});

describe("mapVideoCta", () => {
  it("maps mortgage/rate videos to the deal analyzer", () => {
    expect(mapVideoCta("The Mortgage Renewal Shock Is Here").primary.href).toBe("/tools/analyzer");
  });

  it("maps cap-rate/market videos to the cap rate map", () => {
    expect(mapVideoCta("Which Housing Market Has The Best Cap Rates?").primary.href).toBe(
      "/tools/cap-rates",
    );
  });

  it("defaults to the deal analyzer with the conversion copy", () => {
    const cta = mapVideoCta("An Interview With Our Moms");
    expect(cta.primary.href).toBe("/tools/analyzer");
    expect(cta.copy).toBe("Run the numbers on your own deal — free.");
  });
});

describe("selectVideosSince", () => {
  const videos = [
    { slug: "c", pubDate: "2026-06-02T10:00:00+00:00" },
    { slug: "b", pubDate: "2026-05-26T10:00:00+00:00" },
    { slug: "a", pubDate: "2026-05-19T10:00:00+00:00" },
  ];

  it("returns only videos published strictly after the cutoff, newest first", () => {
    expect(selectVideosSince(videos, "2026-05-26T10:00:00+00:00").map((v) => v.slug)).toEqual(["c"]);
  });

  it("returns all videos newest-first when no cutoff is given (first run)", () => {
    expect(selectVideosSince(videos).map((v) => v.slug)).toEqual(["c", "b", "a"]);
  });

  it("excludes videos with an unparseable pubDate", () => {
    const withBad = [...videos, { slug: "bad", pubDate: "not-a-date" }];
    expect(selectVideosSince(withBad).map((v) => v.slug)).toEqual(["c", "b", "a"]);
  });

  it("treats an unparseable cutoff as no cutoff", () => {
    expect(selectVideosSince(videos, "garbage").map((v) => v.slug)).toEqual(["c", "b", "a"]);
  });
});
