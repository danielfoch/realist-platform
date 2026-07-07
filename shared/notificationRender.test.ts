import { describe, it, expect } from "vitest";
import {
  DEFAULT_TITLES,
  humanizeTemplateKey,
  internalizeLink,
  renderNotification,
} from "./notificationRender";

// Every templateKey actually written to notification_queue, by producer:
// - server/notifications.ts (channel ghl_webhook, templateKey = eventType)
// - server/weeklyDigest.ts   -> weekly_leaderboard_digest
// - server/monthlyWinnerEmail.ts -> monthly_leaderboard_winner
// - server/podcastDigest.ts  -> podcast_digest
// multiplex_intent / distress_intent are declared NotificationKinds with no
// enqueue site yet; they get default titles so future producers just work.
const GHL_STYLE_KEYS = [
  "saved_search_match",
  "analysis_created",
  "analysis_updated",
  "comment_created",
  "comment_reply",
  "consensus_shifted",
  "listing_price_changed",
  "listing_status_changed",
  "analyzer_completed",
  "inactive_high_intent",
  "multiplex_intent",
  "distress_intent",
  "daily_digest_ready",
  "weekly_leaderboard_digest",
  "co_analysis_alert",
  "milestone_reached",
  "note_vote_update",
] as const;

describe("renderNotification — GHL-style payloads", () => {
  it.each(GHL_STYLE_KEYS)("%s: renders subjectLine/reasonText/ctaUrl from the payload", (key) => {
    const rendered = renderNotification(key, {
      subjectLine: `Subject for ${key}`,
      reasonText: "Something changed on a listing you follow.",
      previewText: "Preview line.",
      ctaUrl: "https://realist.ca/tools/cap-rates?mls=X123&tab=community",
    });
    expect(rendered.title).toBe(`Subject for ${key}`);
    expect(rendered.body).toBe("Something changed on a listing you follow.");
    expect(rendered.link).toBe("/tools/cap-rates?mls=X123&tab=community");
  });

  it.each(GHL_STYLE_KEYS)("%s: falls back to its default human line without a payload", (key) => {
    const rendered = renderNotification(key, null);
    expect(rendered.title).toBe(DEFAULT_TITLES[key]);
    expect(rendered.body).toBe("");
    expect(rendered.link).toBeNull();
  });

  it("prefers reasonText but falls back to previewText for the body", () => {
    const withBoth = renderNotification("saved_search_match", {
      reasonText: "3 new matches in Hamilton.",
      previewText: "Preview only.",
    });
    expect(withBoth.body).toBe("3 new matches in Hamilton.");

    const previewOnly = renderNotification("saved_search_match", { previewText: "Preview only." });
    expect(previewOnly.body).toBe("Preview only.");
  });

  it("ignores blank/non-string payload fields instead of rendering empty lines", () => {
    const rendered = renderNotification("comment_reply", {
      subjectLine: "   ",
      reasonText: 42,
      ctaUrl: "",
    });
    expect(rendered.title).toBe(DEFAULT_TITLES.comment_reply);
    expect(rendered.body).toBe("");
    expect(rendered.link).toBeNull();
  });
});

describe("renderNotification — monthly_leaderboard_winner", () => {
  it("renders rank, deal count, and month from the resend payload", () => {
    const rendered = renderNotification("monthly_leaderboard_winner", {
      rank: 2,
      dealCount: 14,
      monthKey: "2026-06",
      monthLabel: "June 2026",
    });
    expect(rendered.title).toBe("You ranked #2 on the June 2026 leaderboard");
    expect(rendered.body).toBe("14 deals analyzed in June 2026. See where you stand.");
    expect(rendered.link).toBe("/community/leaderboard");
  });

  it("singularizes a one-deal month and survives a missing payload", () => {
    expect(renderNotification("monthly_leaderboard_winner", { rank: 3, dealCount: 1 }).body)
      .toBe("1 deal analyzed. See where you stand.");

    const bare = renderNotification("monthly_leaderboard_winner", null);
    expect(bare.title).toBe(DEFAULT_TITLES.monthly_leaderboard_winner);
    expect(bare.link).toBe("/community/leaderboard");
  });
});

describe("renderNotification — podcast_digest", () => {
  it("counts the week's episodes from the resend payload", () => {
    const rendered = renderNotification("podcast_digest", {
      week: "2026-W27",
      episodeSlugs: ["ep-1", "ep-2"],
    });
    expect(rendered.title).toBe(DEFAULT_TITLES.podcast_digest);
    expect(rendered.body).toBe("2 new episodes this week. Listen on Realist.");
    expect(rendered.link).toBe("/insights/podcast");
  });

  it("singularizes one episode and survives a missing payload", () => {
    expect(renderNotification("podcast_digest", { episodeSlugs: ["ep-1"] }).body)
      .toBe("1 new episode this week. Listen on Realist.");
    expect(renderNotification("podcast_digest", null).body)
      .toBe("Fresh investor conversations are up. Listen on Realist.");
  });
});

describe("renderNotification — unknown templateKey fallback", () => {
  it("humanizes the key and still uses GHL-style payload fields when present", () => {
    const rendered = renderNotification("brand_new_thing", {
      reasonText: "Something new happened.",
      ctaUrl: "https://www.realist.ca/dashboard",
    });
    expect(rendered.title).toBe("Brand new thing");
    expect(rendered.body).toBe("Something new happened.");
    expect(rendered.link).toBe("/dashboard");
  });

  it("degrades to a bare humanized title with no payload", () => {
    const rendered = renderNotification("brand_new_thing", undefined);
    expect(rendered).toEqual({ title: "Brand new thing", body: "", link: null });
  });

  it("respects an explicit subjectLine on unknown keys", () => {
    expect(renderNotification("brand_new_thing", { subjectLine: "Custom subject" }).title)
      .toBe("Custom subject");
  });
});

describe("humanizeTemplateKey", () => {
  it("turns snake/kebab case into a sentence-case line", () => {
    expect(humanizeTemplateKey("saved_search_match")).toBe("Saved search match");
    expect(humanizeTemplateKey("deal-risk-FLAGGED")).toBe("Deal risk flagged");
    expect(humanizeTemplateKey("")).toBe("Notification");
  });
});

describe("internalizeLink", () => {
  it("strips the realist.ca origin (with or without www, http or https)", () => {
    expect(internalizeLink("https://realist.ca/tools/cap-rates?mls=A1")).toBe("/tools/cap-rates?mls=A1");
    expect(internalizeLink("https://www.realist.ca/community/leaderboard")).toBe("/community/leaderboard");
    expect(internalizeLink("http://realist.ca")).toBe("/");
    expect(internalizeLink("https://realist.ca?source=email")).toBe("?source=email");
  });

  it("passes through relative paths and external URLs; rejects lookalike hosts", () => {
    expect(internalizeLink("/watchlist")).toBe("/watchlist");
    expect(internalizeLink("https://example.com/page")).toBe("https://example.com/page");
    // realist.ca.evil.com must NOT be treated as internal.
    expect(internalizeLink("https://realist.ca.evil.com/x")).toBe("https://realist.ca.evil.com/x");
    expect(internalizeLink(null)).toBeNull();
    expect(internalizeLink("   ")).toBeNull();
  });
});

describe("internalizeLink hardening", () => {
  it("drops javascript: and data: URLs", () => {
    expect(internalizeLink("javascript:alert(1)")).toBeNull();
    expect(internalizeLink("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("passes plain external http(s) URLs through", () => {
    expect(internalizeLink("https://example.com/report")).toBe("https://example.com/report");
    expect(internalizeLink("http://example.com/")).toBe("http://example.com/");
  });

  it("collapses protocol-relative //host to a same-origin path", () => {
    expect(internalizeLink("//evil.com/phish")).toBe("/evil.com/phish");
  });

  it("collapses a realist.ca //path remainder safely", () => {
    expect(internalizeLink("https://realist.ca//evil.com")).toBe("/evil.com");
  });

  it("does not internalize userinfo lookalikes", () => {
    expect(internalizeLink("https://realist.ca@evil.com/phish")).toBeNull();
  });
});
