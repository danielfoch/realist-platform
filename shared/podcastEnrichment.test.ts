import { describe, expect, it } from "vitest";
import {
  normalizeTranscriptText,
  podcastTranscriptIngestSchema,
  transcriptSourceLabel,
  validatePodcastEnrichmentDraft,
} from "./podcastEnrichment";

describe("podcast enrichment contracts", () => {
  it("normalizes publisher transcript whitespace without flattening paragraphs", () => {
    expect(normalizeTranscriptText("Host: Hello\r\n  \r\n\r\nGuest: World\u0000  \n"))
      .toBe("Host: Hello\n\nGuest: World");
  });

  it("requires a substantial transcript and HTTPS source links", () => {
    const short = podcastTranscriptIngestSchema.safeParse({
      episodeSlug: "an-episode",
      transcriptText: "too short",
      sourceUrl: "http://example.com/transcript",
    });
    expect(short.success).toBe(false);
  });

  it("accepts a reviewable summary, takeaways, and FAQ", () => {
    const result = validatePodcastEnrichmentDraft({
      summaryText: "The hosts compare small residential financing with commercial underwriting and explain where borrower expectations need to change.",
      keyTakeaways: [
        "Commercial lenders focus more heavily on property income and debt-service coverage.",
        "Investors should confirm the lender's documentation and recourse requirements before waiving conditions.",
      ],
      faq: [{
        question: "What changes when an investor moves into commercial mortgages?",
        answer: "The episode describes a shift toward property-level income, lender-specific covenants, and a more involved due-diligence process.",
      }],
    });
    expect(result.errors).toEqual([]);
    expect(result.draft?.faq).toHaveLength(1);
  });

  it("labels transcript provenance plainly", () => {
    expect(transcriptSourceLabel("omny_publisher")).toContain("Omny Studio");
    expect(transcriptSourceLabel("manual_transcript")).toContain("Manually");
  });
});
