import { describe, expect, it } from "vitest";
import { parseFeed } from "./feed";

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>The Canadian Real Estate Investor</title>
    <image>
      <url>https://www.omnycontent.com/d/playlist/image.jpg?t=1657659989&amp;size=Large</url>
    </image>
    <item>
      <title>Rates &amp; Rents</title>
      <description><![CDATA[<p>Show notes stay as HTML &amp; entities.</p>]]></description>
      <pubDate>Tue, 30 Jun 2026 09:00:00 +0000</pubDate>
      <link>https://omny.fm/shows/the-canadian-real-estate-investor/416-final?a=1&amp;b=2</link>
      <itunes:duration>2803</itunes:duration>
      <enclosure url="https://traffic.omny.fm/d/clips/abc/audio.mp3?utm_source=Podcast&amp;in_playlist=xyz" type="audio/mpeg" length="1"/>
      <itunes:image href="https://www.omnycontent.com/d/playlist/episode.jpg?t=1&amp;size=Large"/>
    </item>
    <item>
      <title>No Enclosure Attributes</title>
      <pubDate>Mon, 29 Jun 2026 09:00:00 +0000</pubDate>
      <link>https://omny.fm/shows/the-canadian-real-estate-investor/415-final</link>
    </item>
  </channel>
</rss>`;

describe("parseFeed", () => {
  const episodes = parseFeed(feedXml);

  it("decodes XML entities in the enclosure audio URL", () => {
    // An undecoded &amp; corrupts Omny's signed redirect and playback 400s.
    expect(episodes[0].audioUrl).toBe(
      "https://traffic.omny.fm/d/clips/abc/audio.mp3?utm_source=Podcast&in_playlist=xyz",
    );
  });

  it("decodes XML entities in link and image URLs", () => {
    expect(episodes[0].link).toBe(
      "https://omny.fm/shows/the-canadian-real-estate-investor/416-final?a=1&b=2",
    );
    expect(episodes[0].imageUrl).toBe(
      "https://www.omnycontent.com/d/playlist/episode.jpg?t=1&size=Large",
    );
  });

  it("decodes entity-encoded titles", () => {
    expect(episodes[0].title).toBe("Rates & Rents");
  });

  it("leaves description HTML untouched", () => {
    expect(episodes[0].description).toBe("<p>Show notes stay as HTML &amp; entities.</p>");
  });

  it("falls back to link and decoded feed image when enclosure/itunes tags are absent", () => {
    expect(episodes[1].audioUrl).toBe(
      "https://omny.fm/shows/the-canadian-real-estate-investor/415-final",
    );
    expect(episodes[1].imageUrl).toBe(
      "https://www.omnycontent.com/d/playlist/image.jpg?t=1657659989&size=Large",
    );
  });
});
