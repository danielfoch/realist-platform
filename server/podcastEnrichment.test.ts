import { describe, expect, it } from "vitest";
import { extractTranscriptText, isAllowedOmnyTranscriptUrl } from "./podcastEnrichment";
import { parseFeed } from "./podcastFeed";

describe("podcast transcript import", () => {
  it("extracts speaker-labelled text from common JSON segments", () => {
    const transcript = extractTranscriptText(JSON.stringify({
      segments: [
        { speaker: "Daniel", text: "Let's compare the two financing paths." },
        { speaker: "Guest", text: "Start with how the lender underwrites the property." },
      ],
    }), "application/json");
    expect(transcript).toContain("Daniel: Let's compare");
    expect(transcript).toContain("Guest: Start with");
  });

  it("removes WebVTT cue metadata while keeping the spoken text", () => {
    const transcript = extractTranscriptText(
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nDaniel: Welcome to the show.\n",
      "text/vtt",
    );
    expect(transcript).toBe("Daniel: Welcome to the show.");
  });

  it("allows only HTTPS Omny transcript hosts for automatic fetching", () => {
    expect(isAllowedOmnyTranscriptUrl("https://www.omnycontent.com/d/transcripts/example.vtt")).toBe(true);
    expect(isAllowedOmnyTranscriptUrl("http://www.omnycontent.com/transcript")).toBe(false);
    expect(isAllowedOmnyTranscriptUrl("https://example.com/internal/transcript")).toBe(false);
  });

  it("carries the public Omny clip id from RSS into the episode record", () => {
    const [episode] = parseFeed(`
      <rss><channel><item>
        <title><![CDATA[An Episode]]></title>
        <omny:clipId>clip-123</omny:clipId>
        <pubDate>Tue, 25 Aug 2026 09:00:00 +0000</pubDate>
        <enclosure url="https://traffic.omny.fm/audio.mp3" />
      </item></channel></rss>
    `);
    expect(episode.clipId).toBe("clip-123");
    expect(episode.slug).toBe("an-episode");
  });
});
