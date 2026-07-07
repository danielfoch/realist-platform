import { describe, expect, it } from "vitest";
import {
  hasRoundupContent,
  isoWeek,
  isoWeekKey,
  podcastDigestDedupeKey,
  roundupSendWindow,
  ROUNDUP_WINDOW_DAYS,
  selectEpisodesForDigest,
  selectItemsForWindow,
  selectRoundupExtras,
  showNotesToPlainText,
  summarizeShowNotes,
  type DigestEpisode,
  type RoundupItem,
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

describe("roundupSendWindow", () => {
  it("an on-schedule send (Thursday 13:00 UTC) anchors to itself, exactly 7*24h (DST-safe)", () => {
    // 2026-11-05 is a Thursday and straddles the November DST fall-back in
    // Toronto: fixed-ms UTC arithmetic keeps the window exactly 7*24h.
    const sendAt = new Date("2026-11-05T13:00:00Z");
    const window = roundupSendWindow(sendAt);
    expect(ROUNDUP_WINDOW_DAYS).toBe(7);
    expect(window.end).toEqual(sendAt);
    expect(window.end.getTime() - window.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(window.start.toISOString()).toBe("2026-10-29T13:00:00.000Z");
  });

  it("an OFF-schedule run computes the SAME window as that week's scheduled send", () => {
    // The D1 failure mode: an admin real-sweep on Monday must not shift the
    // window (double-sending last week's tail and orphaning the gap).
    const scheduled = roundupSendWindow(new Date("2026-07-02T13:00:00Z")); // Thu
    const mondayAdminRun = roundupSendWindow(new Date("2026-07-06T10:00:00Z"));
    const saturdayJitter = roundupSendWindow(new Date("2026-07-04T02:30:00Z"));
    expect(mondayAdminRun).toEqual(scheduled);
    expect(saturdayJitter).toEqual(scheduled);
  });

  it("boundary exactness: 12:59 Thursday anchors to the PREVIOUS Thursday", () => {
    const justBefore = roundupSendWindow(new Date("2026-07-02T12:59:59Z"));
    expect(justBefore.end.toISOString()).toBe("2026-06-25T13:00:00.000Z");
    const atBoundary = roundupSendWindow(new Date("2026-07-02T13:00:00Z"));
    expect(atBoundary.end.toISOString()).toBe("2026-07-02T13:00:00.000Z");
  });

  it("consecutive weekly boundaries tile exactly: this week's start = last week's end", () => {
    const lastWeek = roundupSendWindow(new Date("2026-06-25T13:00:00Z"));
    const thisWeek = roundupSendWindow(new Date("2026-07-02T13:00:00Z"));
    expect(thisWeek.start).toEqual(lastWeek.end);
  });
});

describe("selectItemsForWindow", () => {
  const window = {
    start: new Date("2026-06-25T13:00:00Z"),
    end: new Date("2026-07-02T13:00:00Z"),
  };
  const item = (slug: string, date: string): RoundupItem => ({ slug, title: slug, date });

  it("includes items inside the window and excludes items outside it, newest first", () => {
    const items = [
      item("too-old", "2026-06-20"), // before start
      item("in-window-early", "2026-06-28"),
      item("in-window-late", "2026-07-01"),
      item("future", "2026-07-03"), // after end (publishDate ahead of the send)
    ];
    expect(selectItemsForWindow(items, window).map((i) => i.slug)).toEqual([
      "in-window-late",
      "in-window-early",
    ]);
  });

  it("boundaries: strictly after start, at-or-before end (windows tile with no double-send)", () => {
    const atStart = item("at-start", "2026-06-25T13:00:00Z"); // last week's send instant
    const atEnd = item("at-end", "2026-07-02T13:00:00Z"); // this send instant
    expect(selectItemsForWindow([atStart, atEnd], window).map((i) => i.slug)).toEqual(["at-end"]);
  });

  it("skips unparseable dates and caps at maxItems", () => {
    const items = [
      item("garbage", "not-a-date"),
      item("a", "2026-06-27"),
      item("b", "2026-06-29"),
      item("c", "2026-07-01"),
    ];
    expect(selectItemsForWindow(items, window, 2).map((i) => i.slug)).toEqual(["c", "b"]);
  });
});

describe("selectRoundupExtras", () => {
  const window = {
    start: new Date("2026-06-25T13:00:00Z"),
    end: new Date("2026-07-02T13:00:00Z"),
  };

  it("windows reports and videos identically (videos-seam flow-through)", () => {
    // Videos carry extra fields (url) exactly like the server's VideoItem —
    // the generic keeps them intact through selection.
    const reports = [
      { slug: "old-report", title: "Old", date: "2026-06-01" },
      { slug: "fresh-report", title: "Fresh", dek: "A dek", date: "2026-06-30" },
    ];
    const videos = [
      { slug: "vid-old", title: "Old video", date: "2026-06-10", url: "https://youtu.be/old" },
      { slug: "vid-new", title: "New video", date: "2026-07-01", url: "https://youtu.be/new" },
    ];
    const selected = selectRoundupExtras({ reports, videos }, window);
    expect(selected.reports.map((r) => r.slug)).toEqual(["fresh-report"]);
    expect(selected.videos).toEqual([videos[1]]); // full object, url preserved
  });

  it("mixed content: an empty videos array (today's dormant seam) selects reports alone", () => {
    const selected = selectRoundupExtras(
      {
        reports: [{ slug: "r1", title: "R1", date: "2026-07-01" }],
        videos: [] as Array<RoundupItem & { url: string }>,
      },
      window,
    );
    expect(selected.reports.map((r) => r.slug)).toEqual(["r1"]);
    expect(selected.videos).toEqual([]);
  });
});

describe("hasRoundupContent (empty-week skip decision)", () => {
  it("is false only when episodes, reports, AND videos are all empty", () => {
    expect(hasRoundupContent({ episodes: [], reports: [], videos: [] })).toBe(false);
    expect(hasRoundupContent({ episodes: [{}], reports: [], videos: [] })).toBe(true);
    expect(hasRoundupContent({ episodes: [], reports: [{}], videos: [] })).toBe(true);
    expect(hasRoundupContent({ episodes: [], reports: [], videos: [{}] })).toBe(true);
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
