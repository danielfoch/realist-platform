import { describe, expect, it } from "vitest";
import {
  FIELD_NOTE_LIMITS,
  buildNoteVoteCopy,
  decideNoteVoteMilestone,
  fieldNoteMaxLength,
  isVoteValue,
  noteExcerpt,
  noteVoteDedupeKey,
  scoreAfterVote,
  validateFieldNoteBody,
  voteDelta,
} from "./fieldNotes";

describe("validateFieldNoteBody", () => {
  it("rejects short or non-string bodies", () => {
    expect(validateFieldNoteBody("too short", "member").ok).toBe(false);
    expect(validateFieldNoteBody("         ", "member").ok).toBe(false);
    expect(validateFieldNoteBody(undefined, "member").ok).toBe(false);
    expect(validateFieldNoteBody(42, "expert").ok).toBe(false);
  });

  it("trims and accepts a valid member note", () => {
    const result = validateFieldNoteBody("  Solid duplex, separate meters already in.  ", "member");
    expect(result).toEqual({ ok: true, body: "Solid duplex, separate meters already in." });
  });

  it("enforces the 500-char member cap but allows exactly 500", () => {
    expect(validateFieldNoteBody("x".repeat(501), "member").ok).toBe(false);
    expect(validateFieldNoteBody("x".repeat(500), "member").ok).toBe(true);
  });

  it("gives experts the long-form allowance", () => {
    expect(validateFieldNoteBody("x".repeat(4000), "expert").ok).toBe(true);
    expect(validateFieldNoteBody("x".repeat(4001), "expert").ok).toBe(false);
    expect(fieldNoteMaxLength("expert")).toBe(FIELD_NOTE_LIMITS.EXPERT_MAX_LENGTH);
    expect(fieldNoteMaxLength("member")).toBe(FIELD_NOTE_LIMITS.MEMBER_MAX_LENGTH);
  });
});

describe("vote score math", () => {
  it("guards vote values", () => {
    expect(isVoteValue(1)).toBe(true);
    expect(isVoteValue(0)).toBe(true);
    expect(isVoteValue(-1)).toBe(true);
    expect(isVoteValue(2)).toBe(false);
    expect(isVoteValue("1")).toBe(false);
  });

  it("computes toggle deltas", () => {
    expect(voteDelta(0, 1)).toBe(1); // new upvote
    expect(voteDelta(1, 0)).toBe(-1); // toggle off
    expect(voteDelta(1, -1)).toBe(-2); // flip up -> down
    expect(voteDelta(-1, 1)).toBe(2); // flip down -> up
    expect(voteDelta(1, 1)).toBe(0); // no-op
  });

  it("applies deltas to the denormalized score", () => {
    expect(scoreAfterVote(4, 0, 1)).toBe(5);
    expect(scoreAfterVote(5, 1, -1)).toBe(3);
    expect(scoreAfterVote(0, 0, -1)).toBe(-1);
  });
});

describe("decideNoteVoteMilestone", () => {
  it("fires on the first upvote", () => {
    expect(decideNoteVoteMilestone(0, 1)).toBe("first_upvote");
  });

  it("fires at +5 and +10", () => {
    expect(decideNoteVoteMilestone(4, 5)).toBe("score_5");
    expect(decideNoteVoteMilestone(9, 10)).toBe("score_10");
  });

  it("reports only the highest threshold crossed in one jump", () => {
    expect(decideNoteVoteMilestone(0, 5)).toBe("score_5");
    expect(decideNoteVoteMilestone(3, 12)).toBe("score_10");
  });

  it("fires on the first downvote into negative territory", () => {
    expect(decideNoteVoteMilestone(0, -1)).toBe("first_downvote");
    expect(decideNoteVoteMilestone(1, -1)).toBe("first_downvote");
  });

  it("stays quiet between thresholds and on the way back up to zero", () => {
    expect(decideNoteVoteMilestone(1, 2)).toBeNull();
    expect(decideNoteVoteMilestone(5, 6)).toBeNull();
    expect(decideNoteVoteMilestone(5, 4)).toBeNull(); // falling off a threshold
    expect(decideNoteVoteMilestone(-1, -2)).toBeNull(); // already negative
    expect(decideNoteVoteMilestone(-1, 0)).toBeNull();
    expect(decideNoteVoteMilestone(3, 3)).toBeNull(); // no change
  });

  it("re-fires when a threshold is re-crossed (daily batching is the dedupe key's job)", () => {
    expect(decideNoteVoteMilestone(4, 5)).toBe("score_5");
    expect(decideNoteVoteMilestone(5, 4)).toBeNull();
    expect(decideNoteVoteMilestone(4, 5)).toBe("score_5");
  });
});

describe("noteVoteDedupeKey", () => {
  it("batches to one notification per note per UTC day", () => {
    const morning = new Date("2026-07-01T04:10:00Z");
    const evening = new Date("2026-07-01T23:55:00Z");
    const nextDay = new Date("2026-07-02T00:05:00Z");
    expect(noteVoteDedupeKey("note-1", morning)).toBe("note_vote_update:note-1:2026-07-01");
    expect(noteVoteDedupeKey("note-1", evening)).toBe(noteVoteDedupeKey("note-1", morning));
    expect(noteVoteDedupeKey("note-1", nextDay)).not.toBe(noteVoteDedupeKey("note-1", morning));
    expect(noteVoteDedupeKey("note-2", morning)).not.toBe(noteVoteDedupeKey("note-1", morning));
  });
});

describe("notification copy", () => {
  it("builds copy for every milestone, well under the 120-word budget", () => {
    for (const milestone of ["first_upvote", "score_5", "score_10", "first_downvote"] as const) {
      const copy = buildNoteVoteCopy({
        milestone,
        score: milestone === "first_downvote" ? -1 : 5,
        listingLabel: "12 Main St, Hamilton",
        noteExcerpt: "Separate hydro meters already installed",
      });
      expect(copy.subjectLine.length).toBeGreaterThan(10);
      expect(copy.reasonText).toContain("12 Main St, Hamilton");
      expect(copy.reasonText.split(/\s+/).length).toBeLessThanOrEqual(120);
      expect(copy.previewText.length).toBeGreaterThan(10);
    }
  });

  it("omits the excerpt cleanly when the note has none", () => {
    const copy = buildNoteVoteCopy({ milestone: "first_upvote", score: 1, listingLabel: "MLS X123", noteExcerpt: null });
    expect(copy.reasonText).not.toContain('""');
    expect(copy.reasonText).toContain("MLS X123");
  });
});

describe("noteExcerpt", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(noteExcerpt("  line one \n line two  ")).toBe("line one line two");
    expect(noteExcerpt(null)).toBeNull();
    expect(noteExcerpt("   ")).toBeNull();
    const long = noteExcerpt("word ".repeat(40), 20)!;
    expect(long.length).toBeLessThanOrEqual(20);
    expect(long.endsWith("…")).toBe(true);
  });
});
