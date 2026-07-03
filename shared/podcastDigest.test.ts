import { describe, expect, it } from "vitest";
import {
  isoWeek,
  isoWeekKey,
  podcastDigestDedupeKey,
  selectEpisodesForDigest,
  showNotesToPlainText,
  summarizeShowNotes,
  type DigestEpisode,
} from "./podcastDigest";

function ep(overrides: Partial<DigestEpisode> & { pubDate: string; slug: string }): DigestEpisode {
  return {
    title: overrides.title ?? overrides.slug,
    description: overrides.description ?? "",
    duration: overrides.duration ?? "",
    imageUrl: overrides.imageUrl ?? "",
    ...overrides,
  };
}

describe("isoWeek / isoWeekKey", () => {
  it("computes the ISO week number (weeks start Monday)", () => {
    // Thu 2 Jan 2026 is in ISO week 1 of 2026.
    expect(isoWeek(new Date("2026-01-02T12:00:00Z"))).toEqual({ year: 2026, week: 1 });
    // 1 Jan 2021 (Fri) belongs to ISO week 53 of 2020.
    expect(isoWeek(new Date("2021-01-01T12:00:00Z"))).toEqual({ year: 2020, week: 53 });
  });

  it("zero-pads the week token to two digits", () => {
    expect(isoWeekKey(new Date("2026-01-02T12:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2026-07-03T12:00:00Z"))).toBe("2026-W27");
  });

  it("is stable across times within the same ISO week", () => {
    const mon = isoWeekKey(new Date("2026-06-29T00:00:00Z"));
    const sun = isoWeekKey(new Date("2026-07-05T23:59:59Z"));
    expect(mon).toBe(sun);
  });
});

describe("podcastDigestDedupeKey", () => {
  it("embeds the user id and ISO week and is one-per-week stable", () => {
    const key = podcastDigestDedupeKey("user-123", new Date("2026-07-03T13:00:00Z"));
    expect(key).toBe("podcast_digest:user-123:2026-W27");
    // Same user, different day in the same ISO week → identical key.
    expect(podcastDigestDedupeKey("user-123", new Date("2026-07-01T09:00:00Z"))).toBe(key);
  });
});

describe("selectEpisodesForDigest", () => {
  const episodes = [
    ep({ slug: "old", pubDate: "Mon, 16 Jun 2025 10:00:00 +0000" }),
    ep({ slug: "mid", pubDate: "Mon, 23 Jun 2025 10:00:00 +0000" }),
    ep({ slug: "new", pubDate: "Thu, 26 Jun 2025 10:00:00 +0000" }),
  ];

  it("returns episodes strictly after `since`, newest first", () => {
    const result = selectEpisodesForDigest(episodes, {
      since: new Date("2025-06-20T00:00:00Z"),
    });
    expect(result.map((e) => e.slug)).toEqual(["new", "mid"]);
  });

  it("excludes an episode published exactly at `since` (strictly-after)", () => {
    const result = selectEpisodesForDigest(episodes, {
      since: new Date("Mon, 23 Jun 2025 10:00:00 +0000"),
    });
    expect(result.map((e) => e.slug)).toEqual(["new"]);
  });

  it("first send (no `since`) uses the lookback window", () => {
    const result = selectEpisodesForDigest(episodes, {
      firstSendLookback: new Date("2025-06-20T00:00:00Z"),
    });
    expect(result.map((e) => e.slug)).toEqual(["new", "mid"]);
  });

  it("caps the number of episodes and skips unparseable pubDates", () => {
    const noisy = [
      ...episodes,
      ep({ slug: "newest", pubDate: "Fri, 27 Jun 2025 10:00:00 +0000" }),
      ep({ slug: "garbage", pubDate: "not-a-date" }),
    ];
    const result = selectEpisodesForDigest(noisy, {
      since: new Date("2025-01-01T00:00:00Z"),
      maxEpisodes: 2,
    });
    expect(result.map((e) => e.slug)).toEqual(["newest", "new"]);
  });

  it("returns nothing when no episode is newer than `since`", () => {
    const result = selectEpisodesForDigest(episodes, {
      since: new Date("2030-01-01T00:00:00Z"),
    });
    expect(result).toEqual([]);
  });
});

describe("showNotesToPlainText", () => {
  it("strips tags and decodes entities", () => {
    expect(showNotesToPlainText("<p>Rates &amp; <b>rents</b></p><p>Part two</p>")).toBe(
      "Rates & rents Part two",
    );
  });

  it("drops script/style content", () => {
    expect(showNotesToPlainText("<style>x{}</style><p>Hi</p><script>evil()</script>")).toBe("Hi");
  });
});

describe("summarizeShowNotes", () => {
  it("keeps only the first N sentences", () => {
    const html = "<p>One. Two. Three. Four.</p>";
    expect(summarizeShowNotes(html, { maxSentences: 2 })).toBe("One. Two.");
  });

  it("truncates long text on a word boundary with an ellipsis", () => {
    const long = `<p>${"word ".repeat(200)}</p>`;
    const out = summarizeShowNotes(long, { maxSentences: 3, maxChars: 40 });
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    // No dangling partial word: the ellipsis must follow a whole word, not a
    // mid-word cut like "wo…". Every token before the ellipsis is intact.
    expect(out).toMatch(/^(word )+word…$/);
  });

  it("returns an empty string for empty show notes", () => {
    expect(summarizeShowNotes("")).toBe("");
    expect(summarizeShowNotes("<p></p>")).toBe("");
  });
});
