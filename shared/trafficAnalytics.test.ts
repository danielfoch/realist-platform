import { describe, expect, it } from "vitest";
import {
  buildTrafficTrackingUrl,
  normalizeTrafficAttribution,
} from "./trafficAnalytics";

describe("traffic analytics attribution", () => {
  it("normalizes source and UTM source aliases", () => {
    const attribution = normalizeTrafficAttribution(new URLSearchParams("source=youtube&campaign=boosted-video"));

    expect(attribution).toMatchObject({
      source: "youtube",
      utm_source: "youtube",
      campaign: "boosted-video",
      utm_campaign: "boosted-video",
    });
  });

  it("keeps UTM source when source is omitted", () => {
    const attribution = normalizeTrafficAttribution(new URLSearchParams("utm_source=linkedin&utm_medium=social"));

    expect(attribution.source).toBe("linkedin");
    expect(attribution.utm_source).toBe("linkedin");
    expect(attribution.utm_medium).toBe("social");
  });

  it("builds campaign URLs without dropping existing params", () => {
    const url = buildTrafficTrackingUrl("https://realist.ca/community/events/unpacking-multiplexes-toronto?early=1", {
      source: "youtube",
      campaign: "boosted-video",
      link_id: "yt-multiplex-event",
    });

    expect(url).toBe("https://realist.ca/community/events/unpacking-multiplexes-toronto?early=1&source=youtube&campaign=boosted-video&link_id=yt-multiplex-event");
  });
});
