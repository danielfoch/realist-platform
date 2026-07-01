import { describe, expect, it } from "vitest";
import {
  assignEpisodeSlugs,
  deriveEpisodeTopics,
  detectEpisodeCity,
  mapEpisodeCta,
  slugifyEpisodeTitle,
} from "./podcastEpisodes";

describe("slugifyEpisodeTitle", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(slugifyEpisodeTitle("Canada Is Finally In A Recession, Now What?")).toBe(
      "canada-is-finally-in-a-recession-now-what",
    );
  });

  it("removes apostrophes instead of hyphenating them", () => {
    expect(slugifyEpisodeTitle("Power Of Sale Listings Just Hit A 2-Year High. Here's What It Means")).toBe(
      "power-of-sale-listings-just-hit-a-2-year-high-heres-what-it-means",
    );
    expect(slugifyEpisodeTitle("Here’s the Deal")).toBe("heres-the-deal");
  });

  it("converts ampersands to 'and'", () => {
    expect(slugifyEpisodeTitle("Rates & Rents")).toBe("rates-and-rents");
  });

  it("is stable (same input always yields the same slug)", () => {
    const title = "Top 10 Canadian Cities to Invest in for 2026";
    expect(slugifyEpisodeTitle(title)).toBe(slugifyEpisodeTitle(title));
    expect(slugifyEpisodeTitle(title)).toBe("top-10-canadian-cities-to-invest-in-for-2026");
  });

  it("never returns an empty slug", () => {
    expect(slugifyEpisodeTitle("???!!!")).toBe("episode");
  });
});

describe("assignEpisodeSlugs", () => {
  it("gives unique titles their plain slug", () => {
    const result = assignEpisodeSlugs([
      { title: "Episode One", pubDate: "Mon, 02 Jun 2025 10:00:00 +0000" },
      { title: "Episode Two", pubDate: "Mon, 26 May 2025 10:00:00 +0000" },
    ]);
    expect(result.map((episode) => episode.slug)).toEqual(["episode-one", "episode-two"]);
  });

  it("on collision the oldest episode keeps the base slug, newer ones get a date suffix", () => {
    // Feed order is newest-first, like the real RSS.
    const result = assignEpisodeSlugs([
      { title: "Market Update", pubDate: "Mon, 02 Jun 2025 10:00:00 +0000" },
      { title: "Market Update", pubDate: "Mon, 06 Jan 2025 10:00:00 +0000" },
    ]);
    expect(result[1].slug).toBe("market-update"); // oldest keeps base
    expect(result[0].slug).toBe("market-update-2025-06-02"); // newer gets its pubDate
  });

  it("does not change existing slugs when a new colliding episode arrives", () => {
    const before = assignEpisodeSlugs([
      { title: "Market Update", pubDate: "Mon, 06 Jan 2025 10:00:00 +0000" },
    ]);
    const after = assignEpisodeSlugs([
      { title: "Market Update", pubDate: "Mon, 02 Jun 2025 10:00:00 +0000" },
      { title: "Market Update", pubDate: "Mon, 06 Jan 2025 10:00:00 +0000" },
    ]);
    // The previously-published URL is preserved.
    expect(after[1].slug).toBe(before[0].slug);
    expect(after[0].slug).not.toBe(before[0].slug);
  });

  it("disambiguates same-title same-date collisions with a numeric bump", () => {
    const result = assignEpisodeSlugs([
      { title: "Live Show", pubDate: "Mon, 02 Jun 2025 18:00:00 +0000" },
      { title: "Live Show", pubDate: "Mon, 02 Jun 2025 10:00:00 +0000" },
      { title: "Live Show", pubDate: "Mon, 06 Jan 2025 10:00:00 +0000" },
    ]);
    const slugs = result.map((episode) => episode.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs[2]).toBe("live-show");
    expect(slugs).toContain("live-show-2025-06-02");
    expect(slugs).toContain("live-show-2025-06-02-2");
  });

  it("is deterministic regardless of how often it runs", () => {
    const episodes = [
      { title: "A", pubDate: "Mon, 02 Jun 2025 10:00:00 +0000" },
      { title: "A", pubDate: "Mon, 26 May 2025 10:00:00 +0000" },
      { title: "B", pubDate: "Mon, 19 May 2025 10:00:00 +0000" },
    ];
    expect(assignEpisodeSlugs(episodes)).toEqual(assignEpisodeSlugs(episodes));
  });
});

describe("deriveEpisodeTopics", () => {
  it("derives topics from recognizable title terms", () => {
    const topics = deriveEpisodeTopics("The Mortgage Renewal Shock Is Here, But Canadians Still Believe");
    expect(topics).toContain("Mortgages");
  });

  it("recognizes city names", () => {
    expect(deriveEpisodeTopics("Toronto Condo Prices Are Falling")).toContain("Toronto");
    expect(deriveEpisodeTopics("Toronto Condo Prices Are Falling")).toContain("Condos");
  });

  it("returns an empty list when nothing is recognized", () => {
    expect(deriveEpisodeTopics("An Interview With Our Moms")).toEqual([]);
  });
});

describe("mapEpisodeCta", () => {
  it("maps mortgage/rate episodes to the deal analyzer", () => {
    const cta = mapEpisodeCta("The Mortgage Renewal Shock Is Here");
    expect(cta.primary.href).toBe("/tools/analyzer");
  });

  it("maps rate episodes to the deal analyzer", () => {
    const cta = mapEpisodeCta("Why Interest Rates Will Stay Higher For Longer");
    expect(cta.primary.href).toBe("/tools/analyzer");
  });

  it("maps cap-rate/market episodes to the cap rate map", () => {
    const cta = mapEpisodeCta("Which Housing Market Has The Best Cap Rates?");
    expect(cta.primary.href).toBe("/tools/cap-rates");
  });

  it("adds the /markets/:city link when a programmatic market page exists", () => {
    const cta = mapEpisodeCta("Is Toronto Still Investable?");
    expect(cta.primary.href).toBe("/tools/cap-rates");
    expect(cta.secondary?.href).toBe("/markets/toronto");
  });

  it("recognized city without a market page still maps to cap rates, with no market link", () => {
    const cta = mapEpisodeCta("What Is Going On In Montreal?");
    expect(cta.primary.href).toBe("/tools/cap-rates");
    expect(cta.secondary).toBeUndefined();
    expect(detectEpisodeCity("What Is Going On In Montreal?")?.marketSlug).toBeNull();
  });

  it("defaults to the deal analyzer with the conversion copy", () => {
    const cta = mapEpisodeCta("An Interview With Our Moms");
    expect(cta.primary.href).toBe("/tools/analyzer");
    expect(cta.copy).toBe("Run the numbers on your own deal — free.");
    expect(cta.secondary).toBeUndefined();
  });

  it("prefers the mortgage/rate mapping when both themes appear", () => {
    const cta = mapEpisodeCta("Toronto Mortgage Rates Are Breaking The Market");
    expect(cta.primary.href).toBe("/tools/analyzer");
  });
});
