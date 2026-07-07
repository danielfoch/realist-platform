import { describe, expect, it } from "vitest";
import {
  buildPushContent,
  buildPushMessage,
  shouldSendWatchAlert,
  isDeadTokenResponse,
  type PushPriceChangeItem,
  type PushSearchMatchesItem,
} from "./fcmPayload";

function priceItem(overrides: Partial<PushPriceChangeItem> = {}): PushPriceChangeItem {
  return {
    listingKey: "X123456",
    address: "42 Barton St E",
    city: "Hamilton",
    previousPrice: 850000,
    currentPrice: 799000,
    direction: "drop",
    ...overrides,
  };
}

function searchItem(overrides: Partial<PushSearchMatchesItem> = {}): PushSearchMatchesItem {
  return {
    name: "Edmonton 6-plexes",
    matchCount: 3,
    city: "Edmonton",
    url: "/tools/cap-rates?city=Edmonton",
    sampleAddresses: ["42 Barton St E", "9 Jasper Ave"],
    ...overrides,
  };
}

describe("buildPushMessage — watchlist_price_change", () => {
  it("titles with the address and puts old→new prices in the body", () => {
    const message = buildPushMessage("watchlist_price_change", { items: [priceItem()] });
    expect(message.notification.title).toBe("Price change on 42 Barton St E");
    expect(message.notification.body).toBe("Down from $850,000 to $799,000");
    expect(message.data.kind).toBe("watchlist_price_change");
  });

  it("falls back to the listing key when there is no address and words increases as up", () => {
    const message = buildPushMessage("watchlist_price_change", {
      items: [priceItem({ address: null, direction: "increase", previousPrice: 500000, currentPrice: 540000 })],
    });
    expect(message.notification.title).toBe("Price change on X123456");
    expect(message.notification.body).toBe("Up from $500,000 to $540,000");
  });

  it("folds extra watchlist moves into the body instead of separate pushes", () => {
    const message = buildPushMessage("watchlist_price_change", {
      items: [priceItem(), priceItem({ listingKey: "Y1" }), priceItem({ listingKey: "Y2" })],
    });
    expect(message.notification.body).toContain("and 2 more on your watchlist moved");
  });

  it("deep-links to the analyzer with the same params as the email CTA, on every link surface", () => {
    const message = buildPushMessage("watchlist_price_change", { items: [priceItem()] });
    expect(message.data.link).toContain("https://realist.ca/tools/analyzer?");
    expect(message.data.link).toContain("mls=X123456");
    expect(message.data.link).toContain("price=799000");
    expect(message.data.link).toContain("utm_source=push");
    // Web tokens follow webpush.fcm_options.link; native taps read data.link.
    expect(message.webpush.fcm_options.link).toBe(message.data.link);
  });
});

describe("buildPushMessage — saved_search_matches", () => {
  it("titles with the match count and search name", () => {
    const message = buildPushMessage("saved_search_matches", { searches: [searchItem()] });
    expect(message.notification.title).toBe('3 new matches for "Edmonton 6-plexes"');
    expect(message.notification.body).toContain("42 Barton St E · 9 Jasper Ave");
    expect(message.data.kind).toBe("saved_search_matches");
  });

  it("uses singular wording for one match and survives missing samples", () => {
    const message = buildPushMessage("saved_search_matches", {
      searches: [searchItem({ matchCount: 1, sampleAddresses: [] })],
    });
    expect(message.notification.title).toBe('1 new match for "Edmonton 6-plexes"');
    expect(message.notification.body.length).toBeGreaterThan(0);
  });

  it("mentions additional saved searches beyond the first", () => {
    const message = buildPushMessage("saved_search_matches", {
      searches: [searchItem(), searchItem({ name: "Hamilton duplexes" })],
    });
    expect(message.notification.body).toContain("1 more saved search");
  });

  it("absolutizes the relative search deep link and tags the push channel", () => {
    const message = buildPushMessage("saved_search_matches", { searches: [searchItem()] });
    expect(message.data.link).toBe(
      "https://realist.ca/tools/cap-rates?city=Edmonton&utm_source=push&utm_campaign=saved_search_matches",
    );
    expect(message.webpush.fcm_options.link).toBe(message.data.link);
  });
});

describe("buildPushContent", () => {
  it("returns the same title/body/link that the message envelope wraps", () => {
    const content = buildPushContent("watchlist_price_change", { items: [priceItem()] });
    const message = buildPushMessage("watchlist_price_change", { items: [priceItem()] });
    expect(message.notification).toEqual({ title: content.title, body: content.body });
    expect(message.data.link).toBe(content.link);
  });
});

describe("shouldSendWatchAlert", () => {
  it("allows when there is no preference row (defaults are on)", () => {
    expect(shouldSendWatchAlert(null)).toBe(true);
    expect(shouldSendWatchAlert(undefined)).toBe(true);
  });

  it("requires BOTH the product-updates master switch and the listing-watch switch", () => {
    expect(shouldSendWatchAlert({ productUpdatesEnabled: true, listingWatchAlertsEnabled: true })).toBe(true);
    expect(shouldSendWatchAlert({ productUpdatesEnabled: false, listingWatchAlertsEnabled: true })).toBe(false);
    expect(shouldSendWatchAlert({ productUpdatesEnabled: true, listingWatchAlertsEnabled: false })).toBe(false);
    expect(shouldSendWatchAlert({ productUpdatesEnabled: false, listingWatchAlertsEnabled: false })).toBe(false);
  });
});

describe("isDeadTokenResponse", () => {
  it("classifies 404 + UNREGISTERED as dead", () => {
    expect(isDeadTokenResponse(404, '{"error":{"status":"UNREGISTERED"}}')).toBe(true);
  });

  it("does NOT classify a bare 404 as dead (wrong project_id / FCM API disabled)", () => {
    expect(isDeadTokenResponse(404, '{"error":{"status":"NOT_FOUND","message":"Requested entity was not found."}}')).toBe(false);
  });

  it("classifies 400 INVALID_ARGUMENT naming message.token as dead", () => {
    expect(
      isDeadTokenResponse(
        400,
        '{"error":{"status":"INVALID_ARGUMENT","details":[{"fieldViolations":[{"field":"message.token","description":"Invalid registration token"}]}]}}',
      ),
    ).toBe(true);
  });

  it("does NOT classify payload-shaped INVALID_ARGUMENT as dead (would wipe healthy tokens)", () => {
    expect(
      isDeadTokenResponse(
        400,
        '{"error":{"status":"INVALID_ARGUMENT","details":[{"fieldViolations":[{"field":"message.notification.title","description":"required"}]}]}}',
      ),
    ).toBe(false);
  });

  it("never classifies 200/403/429/500 without UNREGISTERED as dead", () => {
    for (const status of [200, 403, 429, 500]) {
      expect(isDeadTokenResponse(status, '{"error":{"status":"UNAVAILABLE"}}')).toBe(false);
    }
  });
});
