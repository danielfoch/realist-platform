import { describe, expect, it } from "vitest";
import {
  resolveEndorsement,
  buildFieldNoteLeadCrm,
  buildFieldNoteLeadCopy,
  ENDORSEMENT_POINTS,
} from "./fieldNoteIncentives";

describe("resolveEndorsement", () => {
  it("adds a new agree endorsement and rewards the author", () => {
    expect(resolveEndorsement(null, "agree")).toEqual({
      action: "added",
      newStance: "agree",
      authorPointsDelta: ENDORSEMENT_POINTS,
    });
  });

  it("adds a disagree endorsement without reputation points", () => {
    expect(resolveEndorsement(null, "disagree")).toEqual({
      action: "added",
      newStance: "disagree",
      authorPointsDelta: 0,
    });
  });

  it("toggles the same agree stance off, reversing the reward", () => {
    expect(resolveEndorsement("agree", "agree")).toEqual({
      action: "removed",
      newStance: null,
      authorPointsDelta: -ENDORSEMENT_POINTS,
    });
  });

  it("switching agree -> disagree removes the reward", () => {
    expect(resolveEndorsement("agree", "disagree")).toEqual({
      action: "changed",
      newStance: "disagree",
      authorPointsDelta: -ENDORSEMENT_POINTS,
    });
  });

  it("switching disagree -> agree grants the reward", () => {
    expect(resolveEndorsement("disagree", "agree")).toEqual({
      action: "changed",
      newStance: "agree",
      authorPointsDelta: ENDORSEMENT_POINTS,
    });
  });

  it("toggling off a disagree is a no-op for reputation", () => {
    expect(resolveEndorsement("disagree", "disagree")).toEqual({
      action: "removed",
      newStance: null,
      authorPointsDelta: 0,
    });
  });
});

describe("buildFieldNoteLeadCrm", () => {
  it("attributes the lead to the note + listing with power-team tags", () => {
    const m = buildFieldNoteLeadCrm(
      { noteId: "note-1", listingMlsNumber: "C7891234", category: "urban_planning", message: "  interested in a rezoning read  " },
      "Urban Planner",
    );
    expect(m.source).toBe("field_note");
    expect(m.sourceDetail).toBe("Field-note lead — Urban Planner on listing C7891234");
    expect(m.tags).toEqual(["field-note-lead", "power-team"]);
    expect(m.data).toEqual({ fieldNoteId: "note-1", listingMlsNumber: "C7891234", category: "urban_planning" });
    expect(m.activityBody).toContain("work with this Urban Planner");
    expect(m.activityBody).toContain('Message: "interested in a rezoning read"'); // trimmed
  });

  it("omits the message clause when none is given", () => {
    const m = buildFieldNoteLeadCrm({ noteId: "n", listingMlsNumber: "X1", category: "architecture" }, "Architect");
    expect(m.activityBody).not.toContain("Message:");
  });
});

describe("buildFieldNoteLeadCopy", () => {
  it("names the lead and the listing, and quotes a trimmed message", () => {
    const c = buildFieldNoteLeadCopy({
      leadName: "  Jane Investor ",
      listingLabel: "MLS C7891234 (Toronto)",
      message: "  looking for a sixplex feasibility read  ",
    });
    expect(c.subjectLine).toBe("New lead: Jane Investor wants to work with you");
    expect(c.previewText).toBe("From your field note on MLS C7891234 (Toronto)");
    expect(c.reasonText).toContain("Jane Investor asked to work with you");
    expect(c.reasonText).toContain('"looking for a sixplex feasibility read"');
  });

  it("falls back to a generic lead name and truncates long messages", () => {
    const c = buildFieldNoteLeadCopy({
      leadName: "   ",
      listingLabel: "MLS X1",
      message: "x".repeat(200),
    });
    expect(c.subjectLine).toBe("New lead: An investor wants to work with you");
    expect(c.reasonText).toContain("…");
    expect(c.reasonText).not.toContain("x".repeat(150));
  });

  it("omits the message clause when none is given", () => {
    const c = buildFieldNoteLeadCopy({ leadName: "Sam", listingLabel: "MLS X1" });
    expect(c.reasonText).not.toContain("Their message:");
  });
});
